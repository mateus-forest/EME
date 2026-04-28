import { Prisma, UserRole } from "@prisma/client"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { AUTH_COOKIE_NAME, clearAuthCookie, verifyAuthToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export function isPrismaUnavailable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1000", "P1001", "P1002"].includes(error.code))
  )
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value

  if (!token) {
    return {
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
      user: null,
    }
  }

  try {
    const session = await verifyAuthToken(token)
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        broker: true,
        ownedAgency: true,
      },
    })

    if (!user) {
      const response = NextResponse.json({ error: "Sessão inválida." }, { status: 401 })
      clearAuthCookie(response)
      return { error: response, user: null }
    }

    return { error: null, user }
  } catch (error) {
    console.error("[auth][route] session validation failed", {
      message: error instanceof Error ? error.message : "unknown",
    })

    if (isPrismaUnavailable(error)) {
      return {
        error: NextResponse.json(
          { error: "O serviço de autenticação está indisponível no momento. Verifique a conexão com o banco de dados." },
          { status: 503 },
        ),
        user: null,
      }
    }

    const response = NextResponse.json({ error: "Sessão inválida." }, { status: 401 })
    clearAuthCookie(response)
    return { error: response, user: null }
  }
}

export function ensureRole(role: UserRole, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  return null
}
