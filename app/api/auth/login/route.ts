import { compare } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

import { isDatabaseUnavailableError } from "@/lib/auth-errors"
import { createAuthToken, setAuthCookie } from "@/lib/auth"
import { authUserInclude } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"
import { buildSessionProfile } from "@/lib/session-profile"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const method = typeof body?.method === "string" ? body.method : "password"
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    const pin = typeof body?.pin === "string" ? body.pin.trim() : ""

    if (method === "pin") {
      if (!pin) {
        return NextResponse.json({ error: "Informe o PIN para continuar." }, { status: 400 })
      }

      return NextResponse.json(
        { error: "Entrar com PIN ainda nao esta disponivel. Configure esse acesso futuramente em Conta > Seguranca." },
        { status: 501 },
      )
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: authUserInclude,
    })

    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 })
    }

    if (typeof user.passwordHash !== "string" || user.passwordHash.length === 0) {
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

    const response = NextResponse.json({ user: buildSessionProfile(user) })
    response.headers.set("Cache-Control", "no-store, max-age=0")

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
