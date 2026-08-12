import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { contractTemplateStructureSchema, validateContractTemplateOccurrences } from "@/lib/contract-template-engine"
import { serializeContractTemplate } from "@/lib/contract-template-server"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

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
    return NextResponse.json({ template: serializeContractTemplate(template) })
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Modelos indisponíveis no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível carregar o modelo." }, { status: 500 })
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
    const invalidOccurrences = validateContractTemplateOccurrences(parsedStructure.data)
    if (invalidOccurrences.length > 0) {
      return NextResponse.json(
        { error: `O texto alterado removeu ${invalidOccurrences.length} campo(s) variável(is). Revise o trecho antes de salvar.` },
        { status: 400 },
      )
    }

    const template = await prisma.contractTemplate.findFirst({
      where: { id, brokerId: auth.user.broker!.id },
      include: { ...include, _count: { select: { instances: true } } },
    })
    if (!template) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 })
    const current = template.versions.find((version) => version.version === template.currentVersion)
    if (!current) return NextResponse.json({ error: "A versão atual do modelo não foi encontrada." }, { status: 409 })

    const currentStructure = contractTemplateStructureSchema.safeParse(current.structure)
    const bodyChanged = currentStructure.success && (
      JSON.stringify(currentStructure.data.blocks) !== JSON.stringify(parsedStructure.data.blocks)
    )
    const mustVersion = template.status === "READY" || template._count.instances > 0

    const updated = await prisma.$transaction(async (tx) => {
      if (mustVersion) {
        const nextVersion = template.currentVersion + 1
        await tx.contractTemplateVersion.create({
          data: {
            templateId: template.id,
            version: nextVersion,
            status: "READY",
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
              legalTextModified: bodyChanged,
            },
            reviewedAt: new Date(),
          },
        })
        return tx.contractTemplate.update({
          where: { id: template.id },
          data: { name, status: "READY", currentVersion: nextVersion },
          include,
        })
      }

      await tx.contractTemplateVersion.update({
        where: { id: current.id },
        data: {
          status: "READY",
          structure: parsedStructure.data,
          reviewedAt: new Date(),
          analysisMetadata: {
            ...(current.analysisMetadata && typeof current.analysisMetadata === "object" ? current.analysisMetadata : {}),
            reviewedByUser: true,
            legalTextModified: bodyChanged,
          },
        },
      })
      return tx.contractTemplate.update({
        where: { id: template.id },
        data: { name, status: "READY" },
        include,
      })
    })

    return NextResponse.json({ template: serializeContractTemplate(updated), legalTextModified: bodyChanged })
  } catch (error) {
    if (isPrismaUnavailable(error)) return NextResponse.json({ error: "Modelos indisponíveis no momento." }, { status: 503 })
    return NextResponse.json({ error: "Não foi possível salvar a revisão deste modelo." }, { status: 500 })
  }
}
