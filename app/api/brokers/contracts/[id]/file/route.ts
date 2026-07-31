import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { readBrokerContractFile } from "@/lib/broker-document-storage"
import { isExternalContractContent, parseContractContent } from "@/lib/contract-template"
import { buildDocumentDisposition } from "@/lib/entity-document"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

async function requireBroker() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
  return user
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBroker()
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await context.params
    const contract = await prisma.brokerDocument.findFirst({
      where: { id, brokerId: auth.broker!.id, type: "contract" },
      select: {
        content: true,
      },
    })

    if (!contract) {
      return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 })
    }

    const content = parseContractContent(contract.content)
    if (!isExternalContractContent(content) || !content.attachment?.fileUrl) {
      return NextResponse.json({ error: "Este contrato não possui arquivo anexado." }, { status: 404 })
    }

    const file = await readBrokerContractFile(content.attachment.fileUrl)
    const forceDownload = request.nextUrl.searchParams.get("download") === "1"
    const headers = new Headers({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": content.attachment.mimeType || file.mimeType,
    })

    if (file.contentLength) {
      headers.set("Content-Length", file.contentLength)
    }

    headers.set(
      "Content-Disposition",
      forceDownload
        ? `attachment; filename="${encodeURIComponent(content.attachment.fileName)}"`
        : buildDocumentDisposition(content.attachment.mimeType || file.mimeType, content.attachment.fileName),
    )

    return new NextResponse(file.buffer, { status: 200, headers })
  } catch (caughtError) {
    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de contratos indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível abrir o contrato anexado." }, { status: 500 })
  }
}
