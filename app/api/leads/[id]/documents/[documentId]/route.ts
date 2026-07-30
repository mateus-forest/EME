import { NextRequest, NextResponse } from "next/server"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { buildDocumentDisposition, parseDocumentPayload } from "@/lib/entity-document"
import { canAccessLead } from "@/lib/lead-contract"
import { parseEntityDocuments } from "@/lib/legal-entities"
import { prisma } from "@/lib/prisma"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  try {
    const { id, documentId } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        brokerId: true,
        agencyId: true,
        documentsData: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 })
    }

    if (!canAccessLead(user, lead)) {
      return NextResponse.json({ error: "Acesso nao permitido para este lead." }, { status: 403 })
    }

    const document = parseEntityDocuments(lead.documentsData).find((item) => item.id === documentId)

    if (!document) {
      return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 })
    }

    const payload = parseDocumentPayload(document)

    if (payload.kind === "external") {
      return NextResponse.redirect(payload.url, { status: 307 })
    }

    return new NextResponse(payload.buffer, {
      headers: {
        "Content-Type": payload.mimeType,
        "Content-Length": String(payload.buffer.byteLength),
        "Content-Disposition": buildDocumentDisposition(payload.mimeType, payload.fileName),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (caughtError) {
    console.error("[api][leads][documents] preview failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de documentos do cliente esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Clientes / visualizacao de documentos")
    }

    if (caughtError instanceof Error && ["INVALID_DATA_URL", "INVALID_DOCUMENT_PAYLOAD", "EMPTY_DOCUMENT_PAYLOAD"].includes(caughtError.message)) {
      return NextResponse.json(
        { error: "O documento salvo esta corrompido ou incompleto. Solicite um novo upload para restaurar a visualizacao." },
        { status: 422 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao abrir documento do cliente." }, { status: 500 })
  }
}
