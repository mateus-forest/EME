import { UserRole } from "@/lib/prisma-enums"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { AUTH_COOKIE_NAME, clearAuthCookie, verifyAuthToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const authUserInclude = {
  broker: {
    select: {
      id: true,
      agencyId: true,
      phone: true,
      creci: true,
      description: true,
      catalogSlug: true,
      agency: {
        select: {
          id: true,
          name: true,
          phone: true,
          cnpj: true,
        },
      },
    },
  },
  ownedAgency: {
    select: {
      id: true,
      name: true,
      phone: true,
      cnpj: true,
      logoUrl: true,
      catalogSlug: true,
      description: true,
    },
  },
} as const

export function isPrismaUnavailable(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null
  const errorName = error instanceof Error ? error.constructor.name : ""
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  const transientConnectionMessages = [
    "emaxconnsessions",
    "max clients reached",
    "too many clients",
    "remaining connection slots",
    "timeout fetching a new connection",
    "timed out fetching a new connection",
    "connection terminated",
    "connection timeout",
    "pool_timeout",
  ]

  return (
    errorName === "PrismaClientInitializationError" ||
    (errorName === "PrismaClientKnownRequestError" &&
      typeof code === "string" &&
      ["P1000", "P1001", "P1002", "P2024", "P2037"].includes(code)) ||
    transientConnectionMessages.some((fragment) => message.includes(fragment))
  )
}

export function isPrismaSchemaMismatch(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : null
  const errorName = error instanceof Error ? error.constructor.name : ""
  const message = error instanceof Error ? error.message.toLowerCase() : ""

  return (
    errorName === "PrismaClientKnownRequestError" &&
    typeof code === "string" &&
    ["P2021", "P2022"].includes(code)
  ) || (
    message.includes("does not exist") ||
    message.includes("doesn't exist") ||
    message.includes("column") && message.includes("does not exist") ||
    message.includes("table") && message.includes("does not exist")
  )
}

export function prismaSchemaMismatchResponse(resourceLabel: string) {
  return NextResponse.json(
    {
      error: `Schema do banco desatualizado para ${resourceLabel}. Execute as migrations pendentes e sincronize o Prisma Client.`,
    },
    { status: 503 },
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

function invalidSessionResponse() {
  const response = NextResponse.json({ error: "Sessão inválida. Faça login novamente." }, { status: 401 })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  clearAuthCookie(response)
  return response
}

function authErrorResponse(error: string, status: number) {
  const response = NextResponse.json({ error }, { status })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

export async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value

  if (!token) {
    return {
      error: authErrorResponse("Não autenticado.", 401),
      user: null,
    }
  }

  try {
    const session = await verifyAuthToken(token)
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: authUserInclude,
    })

    if (!user) {
      return { error: invalidSessionResponse(), user: null }
    }

    return { error: null, user }
  } catch (error) {
    console.error("[auth][route] session validation failed", {
      message: error instanceof Error ? error.message : "unknown",
    })

    if (isAuthTokenError(error)) {
      return { error: invalidSessionResponse(), user: null }
    }

    if (isPrismaUnavailable(error)) {
      return {
        error: authErrorResponse(
          "O serviço de autenticação está indisponível no momento. Verifique a conexão com o banco de dados.",
          503,
        ),
        user: null,
      }
    }

    return {
      error: authErrorResponse("Não foi possível validar a sessão agora.", 500),
      user: null,
    }
  }
}

export function ensureRole(role: UserRole, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(role)) {
    return authErrorResponse("Acesso não permitido para este perfil.", 403)
  }

  return null
}
