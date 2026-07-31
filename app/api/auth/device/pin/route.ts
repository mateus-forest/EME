import { NextRequest, NextResponse } from "next/server"

import { authUserSelect } from "@/lib/auth-route"
import { resolveTrustedDevice } from "@/lib/auth-device"
import { createAuthToken, setAuthCookie } from "@/lib/auth"
import { clearTrustedDeviceCookie } from "@/lib/premium-auth"
import { buildSessionProfile } from "@/lib/session-profile"
import { comparePin, isValidPin, normalizePin, PIN_MAX_FAILURES } from "@/lib/pin-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const trustedDevice = await resolveTrustedDevice(request)

  if (!trustedDevice) {
    const response = NextResponse.json({ error: "Dispositivo confiável não encontrado." }, { status: 401 })
    clearTrustedDeviceCookie(response)
    return response
  }

  const body = await request.json().catch(() => null)
  const pin = normalizePin(body?.pin)

  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "Informe um PIN válido com 6 dígitos." }, { status: 400 })
  }

  if (!trustedDevice.user.pinHash) {
    return NextResponse.json({ error: "Este usuário ainda não configurou um PIN de acesso." }, { status: 400 })
  }

  const matches = await comparePin(pin, trustedDevice.user.pinHash)

  if (!matches) {
    const updatedDevice = await prisma.userTrustedDevice.update({
      where: { id: trustedDevice.id },
      data: {
        pinFailures: {
          increment: 1,
        },
      },
      select: {
        pinFailures: true,
      },
    })

    if (updatedDevice.pinFailures >= PIN_MAX_FAILURES) {
      return NextResponse.json(
        {
          error: "Limite de tentativas de PIN excedido. Entre novamente com email e senha.",
          fallback: "password",
        },
        { status: 423 },
      )
    }

    return NextResponse.json(
      {
        error: "PIN incorreto.",
        remainingPinAttempts: Math.max(0, PIN_MAX_FAILURES - updatedDevice.pinFailures),
      },
      { status: 401 },
    )
  }

  await prisma.userTrustedDevice.update({
    where: { id: trustedDevice.id },
    data: {
      pinFailures: 0,
      lastAccessAt: new Date(),
      lastPinLoginAt: new Date(),
    },
  })

  const user = await prisma.user.findUnique({
    where: { id: trustedDevice.userId },
    select: authUserSelect,
  })

  if (!user) {
    const response = NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    clearTrustedDeviceCookie(response)
    return response
  }

  const token = await createAuthToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  const response = NextResponse.json({ user: buildSessionProfile(user) })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  setAuthCookie(response, token)
  return response
}
