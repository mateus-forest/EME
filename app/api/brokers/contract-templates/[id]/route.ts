import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  contractTemplateStructureSchema,
  inspectContractTemplateStructure,
  shouldCreateContractTemplateVersion,
} from "@/lib/contract-template-engine"
import { serializeContractTemplate } from "@/lib/contract-template-server"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import { deleteBrokerContractTemplateFile } from "@/lib/broker-document-storage"
import {
  hasUsableStoredContractTemplate,
  recoverStoredContractTemplateVersion,
} from "@/lib/contract-template-recovery.server"

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { response: error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return { response: forbidden }
  if (!user.broker) return { response: NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 }) }
  return { user }
}

const include = { versions: { orderBy: { version: "desc" as const } } }

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const { id } = await context.params
  try {
    const template = await prisma.contractTemplate.findFirst({
      where: { id, brokerId: auth.user.broker!.id },
      include,
    })
    if (!template) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
    const current = template.versions.find((version) => version.version === template.currentVersion) ?? template.versions[0]
    if (current && !hasUsableStoredContractTemplate(current)) {
      await recoverStoredContractTemplateVersion(current, { templateTitle: template.name })
      const recovered = await prisma.contractTemplate.findFirst({ where: { id, brokerId: auth.user.broker!.id }, include })
      if (!recovered) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
      return NextResponse.json({ template: serializeContractTemplate(recovered) })
    }
    return NextResponse.json({ template: serializeContractTemplate(template) })
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Modelos indisponíveis no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível carregar o modelo." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const brokerId = auth.user.broker!.id
  const { id } = await context.params
  try {
    const template = await prisma.contractTemplate.findFirst({ where: { id, brokerId }, include })
    if (!template) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
    const instanceCount = await prisma.contractTemplateInstance.count({ where: { templateId: template.id } })
    if (instanceCount > 0) {
      return NextResponse.json(
        { error: `Este modelo possui ${instanceCount} contrato(s) vinculado(s). Exclua os contratos antes de remover o modelo.` },
        { status: 409 },
      )
    }
    const storagePaths = [...new Set(template.versions.map((version) => version.sourceStoragePath).filter(Boolean))]
    await prisma.contractTemplate.delete({ where: { id: template.id } })
    await Promise.all(storagePaths.map((storagePath) => deleteBrokerContractTemplateFile(storagePath)))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[contracts][templates] deletion failed", {
      templateId: id,
      brokerId,
      message: error instanceof Error ? error.message : "unknown",
    })
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Modelos indisponíveis no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível excluir o modelo." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const { id } = await context.params
  try {
    const payload = await request.json().catch(() => null) as Record<string, unknown> | null
    const name = typeof payload?.name === "string" ? payload.name.trim().slice(0, 160) : ""
    const parsedStructure = contractTemplateStructureSchema.safeParse(payload?.structure)
    if (!name) return NextResponse.json({ error: "Informe o nome do modelo." }, { status: 400 })
    if (!parsedStructure.success) {
      return NextResponse.json({ error: "Revise os campos e mapeamentos antes de salvar." }, { status: 400 })
    }
    const inspection = inspectContractTemplateStructure(parsedStructure.data)

    const template = await prisma.contractTemplate.findFirst({
      where: { id, brokerId: auth.user.broker!.id },
      include,
    })
    if (!template) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
    const current = template.versions.find((version) => version.version === template.currentVersion)
    if (!current) return NextResponse.json({ error: "A versão atual do modelo não foi encontrada." }, { status: 409 })

    const currentStructure = contractTemplateStructureSchema.safeParse(current.structure)
    const structureChanged = !currentStructure.success || (
      JSON.stringify(currentStructure.data) !== JSON.stringify(parsedStructure.data)
    )
    const bodyChanged = !currentStructure.success || (
      JSON.stringify(currentStructure.data.blocks) !== JSON.stringify(parsedStructure.data.blocks)
    )
    const currentVersionInstanceCount = await prisma.contractTemplateInstance.count({
      where: { templateVersionId: current.id },
    })
    // A new immutable version is necessary only when an existing contract already
    // points at the current structure. Renaming or confirming an unchanged model
    // must not create version noise.
    const mustVersion = shouldCreateContractTemplateVersion({
      structureChanged,
      currentVersionInstanceCount,
    })
    const nextStatus = inspection.canMarkReady ? "READY" : "REVIEW_REQUIRED"

    const updated = await prisma.$transaction(async (tx) => {
      if (template.status === "READY" && !structureChanged && inspection.canMarkReady) {
        return tx.contractTemplate.update({
          where: { id: template.id },
          data: { name },
          include,
        })
      }

      if (mustVersion) {
        const nextVersion = Math.max(...template.versions.map((version) => version.version), 0) + 1
        await tx.contractTemplateVersion.create({
          data: {
            templateId: template.id,
            version: nextVersion,
            status: nextStatus,
            sourceFileName: current.sourceFileName,
            sourceStoragePath: current.sourceStoragePath,
            sourceMimeType: current.sourceMimeType,
            sourceFileSize: current.sourceFileSize,
            originalText: bodyChanged
              ? parsedStructure.data.blocks.map((block) => block.text).join("\n\n")
              : current.originalText,
            structure: parsedStructure.data,
            analysisMetadata: {
              ...(current.analysisMetadata && typeof current.analysisMetadata === "object" ? current.analysisMetadata : {}),
              editedAfterImport: true,
              reviewedByUser: inspection.canMarkReady,
              structuralReviewIncomplete: !inspection.canMarkReady,
              legalTextModified: bodyChanged,
            },
            reviewedAt: inspection.canMarkReady ? new Date() : null,
          },
        })
        return tx.contractTemplate.update({
          where: { id: template.id },
          data: { name, status: nextStatus, currentVersion: nextVersion },
          include,
        })
      }

      await tx.contractTemplateVersion.update({
        where: { id: current.id },
        data: {
          status: nextStatus,
          structure: parsedStructure.data,
          reviewedAt: inspection.canMarkReady ? new Date() : null,
          analysisMetadata: {
            ...(current.analysisMetadata && typeof current.analysisMetadata === "object" ? current.analysisMetadata : {}),
            reviewedByUser: inspection.canMarkReady,
            structuralReviewIncomplete: !inspection.canMarkReady,
            legalTextModified: bodyChanged,
          },
        },
      })
      return tx.contractTemplate.update({
        where: { id: template.id },
        data: { name, status: nextStatus },
        include,
      })
    })

    const response = {
      template: serializeContractTemplate(updated),
      legalTextModified: bodyChanged,
      versionCreated: mustVersion,
    }
    if (!inspection.canMarkReady) {
      return NextResponse.json(
        {
          ...response,
          error: inspection.issues[0] || "A estrutura ainda precisa de revisão antes de ser utilizada.",
        },
        { status: 422 },
      )
    }
    return NextResponse.json(response)
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Modelos indisponíveis no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível salvar a revisão deste modelo." }, { status: 500 })
  }
}
