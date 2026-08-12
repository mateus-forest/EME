import { createHash } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { saveBrokerContractTemplateFile } from "@/lib/broker-document-storage"
import { validateContractTemplateFile } from "@/lib/contract-document-parser.server"
import { analyzeContractTemplate } from "@/lib/contract-template-analysis.server"
import { serializeContractTemplate } from "@/lib/contract-template-server"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export const maxDuration = 120

const emptyStructure = {
  schemaVersion: 1,
  title: "",
  blocks: [],
  sections: [],
  parties: [],
  fields: [],
  warnings: [],
  partiallyRecognized: false,
}

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { response: error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return { response: forbidden }
  if (!user.broker) return { response: NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 }) }
  return { user }
}

const templateInclude = {
  versions: { orderBy: { version: "desc" as const } },
}

function humanImportError(error: unknown) {
  if (error instanceof Error) {
    const safePrefixes = [
      "Envie um arquivo",
      "O arquivo",
      "Não foi possível ler",
      "O PDF",
      "O DOCX",
      "O documento",
      "A preparação",
      "A análise",
      "Não foi possível preservar",
    ]
    if (safePrefixes.some((prefix) => error.message.startsWith(prefix))) return error.message
  }
  return "Não foi possível preparar este modelo agora. O arquivo original foi preservado para revisão."
}

export async function GET() {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  try {
    const templates = await prisma.contractTemplate.findMany({
      where: { brokerId: auth.user.broker!.id },
      include: templateInclude,
      orderBy: { updatedAt: "desc" },
    })
    return NextResponse.json({ templates: templates.map(serializeContractTemplate) })
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return NextResponse.json({ error: "Os modelos estão temporariamente indisponíveis." }, { status: 503 })
    }
    return NextResponse.json({ error: "Não foi possível carregar seus modelos." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBroker()
  if ("response" in auth) return auth.response
  const brokerId = auth.user.broker!.id
  const workspaceId = `broker:${brokerId}`
  let claimedTemplateId: string | null = null

  try {
    const formData = await request.formData()
    const fileEntry = formData.get("file")
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Selecione um arquivo PDF ou DOCX." }, { status: 400 })
    }
    const mimeType = validateContractTemplateFile(fileEntry)
    const sourceHash = createHash("sha256").update(Buffer.from(await fileEntry.arrayBuffer())).digest("hex")
    const requestedName = String(formData.get("name") ?? "").trim().slice(0, 160)
    const fallbackName = fileEntry.name.replace(/\.(pdf|docx)$/i, "").trim().slice(0, 160) || "Modelo importado"

    const existing = await prisma.contractTemplate.findUnique({
      where: { workspaceId_sourceHash: { workspaceId, sourceHash } },
      include: templateInclude,
    })
    if (existing) {
      return NextResponse.json(
        { template: serializeContractTemplate(existing), reused: true },
        { status: existing.status === "ANALYZING" ? 202 : 200 },
      )
    }

    let claimed
    try {
      claimed = await prisma.contractTemplate.create({
        data: {
          workspaceId,
          brokerId,
          name: requestedName || fallbackName,
          status: "ANALYZING",
          sourceHash,
          versions: {
            create: {
              version: 1,
              status: "ANALYZING",
              sourceFileName: fileEntry.name,
              sourceMimeType: mimeType,
              sourceFileSize: fileEntry.size,
              originalText: "",
              structure: emptyStructure,
            },
          },
        },
        include: templateInclude,
      })
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : null
      if (code !== "P2002") throw error
      const concurrent = await prisma.contractTemplate.findUnique({
        where: { workspaceId_sourceHash: { workspaceId, sourceHash } },
        include: templateInclude,
      })
      if (!concurrent) throw error
      return NextResponse.json({ template: serializeContractTemplate(concurrent), reused: true }, { status: 202 })
    }
    claimedTemplateId = claimed.id
    const version = claimed.versions[0]

    const uploaded = await saveBrokerContractTemplateFile({ brokerId, file: fileEntry })
    await prisma.contractTemplateVersion.update({
      where: { id: version.id },
      data: { sourceStoragePath: uploaded.storagePath },
    })

    const analysis = await analyzeContractTemplate(fileEntry)
    const finalName = requestedName || analysis.structure.title || fallbackName
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
        where: { id: claimed.id },
        data: { name: finalName, status: "REVIEW_REQUIRED" },
        include: templateInclude,
      })
    })

    return NextResponse.json({ template: serializeContractTemplate(updated), reused: false }, { status: 201 })
  } catch (error) {
    if (claimedTemplateId) {
      await prisma.$transaction([
        prisma.contractTemplate.update({ where: { id: claimedTemplateId }, data: { status: "FAILED" } }),
        prisma.contractTemplateVersion.updateMany({
          where: { templateId: claimedTemplateId, status: "ANALYZING" },
          data: { status: "FAILED" },
        }),
      ]).catch(() => null)
    }
    if (isPrismaUnavailable(error)) {
      return NextResponse.json({ error: "O serviço de contratos está temporariamente indisponível." }, { status: 503 })
    }
    return NextResponse.json({ error: humanImportError(error) }, { status: 400 })
  }
}
