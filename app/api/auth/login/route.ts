import { compare } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

import { isDatabaseUnavailableError } from "@/lib/auth-errors"
import { createAuthToken, setAuthCookie } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""

    console.info("[auth][login] payload received", {
      keys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [],
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
    })

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        broker: true,
        ownedAgency: true,
      },
    })

    console.info("[auth][login] lookup", {
      email,
      found: Boolean(user),
      userId: user?.id ?? null,
      role: user?.role ?? null,
      hasPasswordHash: Boolean(user?.passwordHash),
    })

    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 })
    }

    if (typeof user.passwordHash !== "string" || user.passwordHash.length === 0) {
      console.warn("[auth][login] missing password hash", {
        email,
        userId: user.id,
      })

      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 })
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

      return NextResponse.json({ error: "Não foi possível validar suas credenciais agora." }, { status: 500 })
    }

    if (!passwordMatches) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 })
    }

    const token = await createAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        brokerId: user.broker?.id ?? null,
        agencyId: user.ownedAgency?.id ?? user.broker?.agencyId ?? null,
      },
    })

    setAuthCookie(response, token)

    return response
  } catch (error) {
    console.error("[auth][login] unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    })

    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json(
        { error: "O serviço de autenticação está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao processar o login." }, { status: 500 })
  }
}
