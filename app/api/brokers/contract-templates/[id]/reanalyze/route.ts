import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
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

  const template = await prisma.contractTemplate.findFirst({ where: { id, brokerId: user.broker.id }, include })
  if (!template) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
  const version = template.versions.find((item) => item.version === template.currentVersion)
  if (!version?.sourceStoragePath) return NextResponse.json({ error: "O arquivo original deste modelo não está disponível." }, { status: 409 })
  if (template.status !== "FAILED") {
    return NextResponse.json({ template: serializeContractTemplate(template), reused: true }, { status: template.status === "ANALYZING" ? 202 : 200 })
  }

  const lock = await prisma.contractTemplate.updateMany({
    where: { id: template.id, brokerId: user.broker.id, status: "FAILED" },
    data: { status: "ANALYZING" },
  })
  if (lock.count !== 1) {
    const active = await prisma.contractTemplate.findFirst({ where: { id: template.id, brokerId: user.broker.id }, include })
    if (!active) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
    return NextResponse.json({ template: serializeContractTemplate(active), reused: true }, { status: 202 })
  }
  await prisma.contractTemplateVersion.update({ where: { id: version.id }, data: { status: "ANALYZING" } })

  try {
    const stored = await readBrokerContractTemplateFile(version.sourceStoragePath)
    const file = new File([new Uint8Array(stored.buffer)], version.sourceFileName, { type: version.sourceMimeType })
    const analysis = await analyzeContractTemplate(file)
    const updated = await prisma.$transaction(async (tx) => {
      await tx.contractTemplateVersion.update({
        where: { id: version.id },
        data: {
          status: "REVIEW_REQUIRED",
          originalText: analysis.originalText,
          structure: analysis.structure,
          analysisMetadata: analysis.metadata,
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
    await prisma.$transaction([
      prisma.contractTemplate.update({ where: { id: template.id }, data: { status: "FAILED" } }),
      prisma.contractTemplateVersion.update({ where: { id: version.id }, data: { status: "FAILED" } }),
    ]).catch(() => null)
    return NextResponse.json({ error: "Não foi possível reanalisar este modelo. O arquivo original continua preservado." }, { status: 400 })
  }
}
