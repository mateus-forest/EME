import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { readBrokerContractTemplateFile } from "@/lib/broker-document-storage"
import {
  analyzeContractTemplate,
  describeContractTemplateAnalysisError,
} from "@/lib/contract-template-analysis.server"
import { inspectContractTemplateStructure } from "@/lib/contract-template-engine"
import { parseStoredTemplateStructure, serializeContractTemplate } from "@/lib/contract-template-server"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const maxDuration = 120

const include = { versions: { orderBy: { version: "desc" as const } } }

function storedVersionCanBeReady(version: {
  structure: unknown
  originalText: string
}) {
  try {
    return inspectContractTemplateStructure(
      parseStoredTemplateStructure(version.structure, version.originalText),
    ).canMarkReady
  } catch {
    return false
  }
}

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

    const activeCandidate = template.versions.find((version) => version.status === "ANALYZING")
    const candidateIsFresh = activeCandidate
      && activeCandidate.createdAt.getTime() >= Date.now() - 10 * 60 * 1000
    if (candidateIsFresh) {
      return NextResponse.json({ template: serializeContractTemplate(template), reused: true }, { status: 202 })
    }

    const current = template.versions.find((version) => version.version === template.currentVersion)
    const lastValid = template.versions.find((version) => ["READY", "REVIEW_REQUIRED"].includes(version.status))
    const sourceVersion = current?.sourceStoragePath
      ? current
      : lastValid?.sourceStoragePath
        ? lastValid
        : template.versions.find((version) => Boolean(version.sourceStoragePath))
    if (!sourceVersion?.sourceStoragePath) {
      return NextResponse.json({ error: "O arquivo original deste modelo não está disponível." }, { status: 409 })
    }

    const recoveringStaleAnalysis = template.status === "ANALYZING" && !candidateIsFresh
    const rawPreviousStatus = recoveringStaleAnalysis ? (lastValid?.status ?? "FAILED") : template.status
    const previousVersion = recoveringStaleAnalysis ? (lastValid?.version ?? template.currentVersion) : template.currentVersion
    const previousVersionRecord = template.versions.find((version) => version.version === previousVersion)
    const previousStatus = rawPreviousStatus === "READY" && (
      !previousVersionRecord || !storedVersionCanBeReady(previousVersionRecord)
    )
      ? "REVIEW_REQUIRED"
      : rawPreviousStatus
    const nextVersionNumber = Math.max(...template.versions.map((version) => version.version), 0) + 1
    const claimed = await prisma.$transaction(async (tx) => {
      const lock = await tx.contractTemplate.updateMany({
        where: {
          id: template.id,
          brokerId: user.broker!.id,
          status: template.status,
          currentVersion: template.currentVersion,
          updatedAt: template.updatedAt,
        },
        data: { status: "ANALYZING" },
      })
      if (lock.count !== 1) return null

      if (activeCandidate) {
        await tx.contractTemplateVersion.update({
          where: { id: activeCandidate.id },
          data: {
            status: "FAILED",
            analysisMetadata: {
              staleAnalysisRecoveredAt: new Date().toISOString(),
              basedOnVersion: previousVersion,
            },
          },
        })
      }

      return tx.contractTemplateVersion.create({
        data: {
          templateId: template.id,
          version: nextVersionNumber,
          status: "ANALYZING",
          sourceFileName: sourceVersion.sourceFileName,
          sourceStoragePath: sourceVersion.sourceStoragePath,
          sourceMimeType: sourceVersion.sourceMimeType,
          sourceFileSize: sourceVersion.sourceFileSize,
          originalText: sourceVersion.originalText,
          structure: sourceVersion.structure as Prisma.InputJsonValue,
          analysisMetadata: {
            reanalysisRequestedAt: new Date().toISOString(),
            basedOnVersion: previousVersion,
          },
        },
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
      const inspection = inspectContractTemplateStructure(analysis.structure)
      const updated = await prisma.$transaction(async (tx) => {
        await tx.contractTemplateVersion.update({
          where: { id: claimed.id },
          data: {
            status: "REVIEW_REQUIRED",
            originalText: analysis.originalText,
            structure: analysis.structure,
            analysisMetadata: {
              ...analysis.metadata,
              extractedFieldCount: inspection.validFields.length,
              extractedPartyCount: analysis.structure.parties.length,
              hasUsableExtraction: inspection.hasUsableExtraction,
            },
            reviewedAt: null,
          },
        })
        return tx.contractTemplate.update({
          where: { id: template.id },
          data: {
            status: "REVIEW_REQUIRED",
            currentVersion: claimed.version,
            name: analysis.structure.title || template.name,
          },
          include,
        })
      })
      return NextResponse.json({ template: serializeContractTemplate(updated), reused: false })
    } catch (analysisError) {
      await prisma.$transaction([
        prisma.contractTemplateVersion.update({
          where: { id: claimed.id },
          data: {
            status: "FAILED",
            analysisMetadata: {
              failedAt: new Date().toISOString(),
              basedOnVersion: previousVersion,
              reason: analysisError instanceof Error ? analysisError.message.slice(0, 500) : "unknown",
            },
          },
        }),
        prisma.contractTemplate.update({
          where: { id: template.id },
          data: { status: previousStatus, currentVersion: previousVersion },
        }),
      ]).catch(() => null)

      const described = describeContractTemplateAnalysisError(analysisError)
      return NextResponse.json(
        { error: `${described.message} A última versão válida continua disponível.` },
        { status: described.status },
      )
    }
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Os modelos estão temporariamente indisponíveis." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível iniciar a reanálise deste modelo." }, { status: 500 })
  }
}
