import { compare } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUserWithSensitiveFields } from "@/lib/auth-route"
import { hashPin, isValidPin, normalizePin } from "@/lib/pin-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUserWithSensitiveFields()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: "Nao foi possivel validar a senha atual." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const action = body?.action === "remove" ? "remove" : "set"
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPin = normalizePin(body?.newPin)

  if (!currentPassword) {
    return NextResponse.json({ error: "Informe sua senha atual para continuar." }, { status: 400 })
  }

  const passwordMatches = await compare(currentPassword, user.passwordHash)
  if (!passwordMatches) {
    return NextResponse.json({ error: "A senha atual esta incorreta." }, { status: 400 })
  }

  if (action === "remove") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pinHash: null,
      },
    })

    return NextResponse.json({ success: true, pinConfigured: false })
  }

  if (!isValidPin(newPin)) {
    return NextResponse.json({ error: "Informe um PIN valido com 6 digitos." }, { status: 400 })
  }

  const pinHash = await hashPin(newPin)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      pinHash,
    },
  })

  return NextResponse.json({ success: true, pinConfigured: true })
}
