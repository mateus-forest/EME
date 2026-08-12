import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { readBrokerContractTemplateFile } from "@/lib/broker-document-storage"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  const { id } = await context.params
  const template = await prisma.contractTemplate.findFirst({
    where: { id, brokerId: user.broker.id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  })
  const version = template?.versions[0]
  if (!template || !version?.sourceStoragePath) {
    return NextResponse.json({ error: "Arquivo original não encontrado." }, { status: 404 })
  }

  try {
    const file = await readBrokerContractTemplateFile(version.sourceStoragePath)
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": version.sourceMimeType || file.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(version.sourceFileName)}`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o arquivo original." }, { status: 500 })
  }
}
