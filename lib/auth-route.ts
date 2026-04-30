import { UserRole } from "@/lib/prisma-enums"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { AUTH_COOKIE_NAME, clearAuthCookie, verifyAuthToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export function isPrismaUnavailable(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null
  const errorName = error instanceof Error ? error.constructor.name : ""

  return (
    errorName === "PrismaClientInitializationError" ||
    (errorName === "PrismaClientKnownRequestError" && typeof code === "string" && ["P1000", "P1001", "P1002"].includes(code))
  )
}

function isAuthTokenError(error: unknown) {
  const errorName = error instanceof Error ? error.constructor.name : ""

  return [
    "JWTExpired",
    "JWTInvalid",
    "JWSInvalid",
    "JWSSignatureVerificationFailed",
    "JWTClaimValidationFailed",
  ].includes(errorName)
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

    if (isAuthTokenError(error)) {
    return {
      error: NextResponse.json({ error: "NÃ£o foi possÃ­vel validar a sessÃ£o agora." }, { status: 500 }),
      user: null,
    }
    }

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
