import { compare } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

import { createAuthToken, setAuthCookie } from "@/lib/auth"
import { resolveTrustedDevice } from "@/lib/auth-device"
import { isDatabaseUnavailableError } from "@/lib/auth-errors"
import { authUserSelect } from "@/lib/auth-route"
import { comparePin, isValidPin, normalizePin } from "@/lib/pin-auth"
import { clearTrustedDeviceCookie } from "@/lib/premium-auth"
import { prisma } from "@/lib/prisma"
import { buildSessionProfile } from "@/lib/session-profile"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const method = typeof body?.method === "string" ? body.method : "password"
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    const pin = normalizePin(body?.pin)

    if (method === "pin") {
      if (!pin) {
        return NextResponse.json({ error: "Informe o PIN para continuar." }, { status: 400 })
      }

      if (!isValidPin(pin)) {
        return NextResponse.json({ error: "Informe um PIN valido com 6 digitos." }, { status: 400 })
      }

      const trustedDevice = await resolveTrustedDevice(request).catch(() => null)

      if (!trustedDevice?.user?.pinHash) {
        return NextResponse.json(
          { error: "PIN indisponivel para este dispositivo. Entre com email e senha para continuar." },
          { status: 400 },
        )
      }

      const pinMatches = await comparePin(pin, trustedDevice.user.pinHash)

      if (!pinMatches) {
        return NextResponse.json({ error: "PIN invalido." }, { status: 401 })
      }

      const user = await prisma.user.findUnique({
        where: { id: trustedDevice.userId },
        select: authUserSelect,
      })

      if (!user) {
        return NextResponse.json({ error: "PIN invalido." }, { status: 401 })
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

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha sao obrigatorios." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...authUserSelect,
        passwordHash: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 })
    }

    if (typeof user.passwordHash !== "string" || user.passwordHash.length === 0) {
      return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 })
    }

    let passwordMatches = false

    try {
      passwordMatches = await compare(password, user.passwordHash)
    } catch (error) {
      console.error("[auth][login] password compare failed", {
        email,
        userId: user.id,
        message: error instanceof Error ? error.message : "unknown",
      })

      return NextResponse.json({ error: "Nao foi possivel validar suas credenciais agora." }, { status: 500 })
    }

    if (!passwordMatches) {
      return NextResponse.json({ error: "Credenciais invalidas." }, { status: 401 })
    }

    const token = await createAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    const response = NextResponse.json({ user: buildSessionProfile(user) })
    response.headers.set("Cache-Control", "no-store, max-age=0")

    const trustedDevice = await resolveTrustedDevice(request).catch(() => null)

    if (trustedDevice) {
      if (trustedDevice.userId === user.id) {
        await prisma.userTrustedDevice
          .update({
            where: { id: trustedDevice.id },
            data: {
              pinFailures: 0,
              lastAccessAt: new Date(),
              lastPasswordLoginAt: new Date(),
            },
          })
          .catch(() => null)
      } else {
        clearTrustedDeviceCookie(response)
      }
    }

    setAuthCookie(response, token)

    return response
  } catch (error) {
    console.error("[auth][login] unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    })

    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json(
        { error: "O servico de autenticacao esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao processar o login." }, { status: 500 })
  }
}
