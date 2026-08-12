import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { readBrokerContractTemplateFile } from "@/lib/broker-document-storage"
import { analyzeContractTemplate } from "@/lib/contract-template-analysis.server"
import { serializeContractTemplate } from "@/lib/contract-template-server"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const maxDuration = 120

const include = { versions: { orderBy: { version: "desc" as const } } }

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
  const { id } = await context.params

  try {
    const template = await prisma.contractTemplate.findFirst({ where: { id, brokerId: user.broker.id }, include })
    if (!template) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
    const analysisIsStale = template.status === "ANALYZING"
      && template.updatedAt.getTime() < Date.now() - 10 * 60 * 1000
    if (template.status === "ANALYZING" && !analysisIsStale) {
      return NextResponse.json({ template: serializeContractTemplate(template), reused: true }, { status: 202 })
    }

    const current = template.versions.find((item) => item.version === template.currentVersion)
    if (!current?.sourceStoragePath) {
      return NextResponse.json({ error: "O arquivo original deste modelo não está disponível." }, { status: 409 })
    }

    const createsVersion = template.status === "READY"
    const nextVersionNumber = Math.max(...template.versions.map((item) => item.version), 0) + 1
    const claimed = await prisma.$transaction(async (tx) => {
      const lock = await tx.contractTemplate.updateMany({
        where: {
          id: template.id,
          brokerId: user.broker!.id,
          status: template.status,
          updatedAt: template.updatedAt,
        },
        data: { status: "ANALYZING" },
      })
      if (lock.count !== 1) return null

      if (createsVersion) {
        const version = await tx.contractTemplateVersion.create({
          data: {
            templateId: template.id,
            version: nextVersionNumber,
            status: "ANALYZING",
            sourceFileName: current.sourceFileName,
            sourceStoragePath: current.sourceStoragePath,
            sourceMimeType: current.sourceMimeType,
            sourceFileSize: current.sourceFileSize,
            originalText: current.originalText,
            structure: current.structure as Prisma.InputJsonValue,
            analysisMetadata: {
              reanalysisRequestedAt: new Date().toISOString(),
              basedOnVersion: current.version,
            },
          },
        })
        await tx.contractTemplate.update({
          where: { id: template.id },
          data: { currentVersion: nextVersionNumber },
        })
        return version
      }

      return tx.contractTemplateVersion.update({
        where: { id: current.id },
        data: { status: "ANALYZING" },
      })
    })

    if (!claimed) {
      const active = await prisma.contractTemplate.findFirst({ where: { id: template.id, brokerId: user.broker.id }, include })
      if (!active) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
      return NextResponse.json({ template: serializeContractTemplate(active), reused: true }, { status: 202 })
    }

    try {
      const stored = await readBrokerContractTemplateFile(claimed.sourceStoragePath!)
      const file = new File([new Uint8Array(stored.buffer)], claimed.sourceFileName, { type: claimed.sourceMimeType })
      const analysis = await runWithAiOperationContext(
        {
          route: `/api/brokers/contract-templates/${template.id}/reanalyze`,
          source: "portal",
          userId: user.id,
          brokerId: user.broker.id,
          agencyId: user.broker.agencyId ?? null,
          planKey: user.plan ?? null,
          creditsConsumed: null,
          metadata: { templateId: template.id, templateVersion: claimed.version },
        },
        () => analyzeContractTemplate(file),
      )
      const updated = await prisma.$transaction(async (tx) => {
        await tx.contractTemplateVersion.update({
          where: { id: claimed.id },
          data: {
            status: "REVIEW_REQUIRED",
            originalText: analysis.originalText,
            structure: analysis.structure,
            analysisMetadata: analysis.metadata,
            reviewedAt: null,
          },
        })
        return tx.contractTemplate.update({
          where: { id: template.id },
          data: { status: "REVIEW_REQUIRED", name: analysis.structure.title || template.name },
          include,
        })
      })
      return NextResponse.json({ template: serializeContractTemplate(updated), reused: false })
    } catch {
      await prisma.$transaction(async (tx) => {
        await tx.contractTemplateVersion.update({ where: { id: claimed.id }, data: { status: "FAILED" } })
        await tx.contractTemplate.update({
          where: { id: template.id },
          data: createsVersion
            ? { status: "READY", currentVersion: template.currentVersion }
            : { status: "FAILED" },
        })
      }).catch(() => null)
      return NextResponse.json(
        { error: "Não foi possível reanalisar este modelo. O arquivo original e a última versão pronta continuam preservados." },
        { status: 400 },
      )
    }
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Os modelos estão temporariamente indisponíveis." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível iniciar a reanálise deste modelo." }, { status: 500 })
  }
}
