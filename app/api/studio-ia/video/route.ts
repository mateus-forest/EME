import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"
import {
  generateStudioPropertyVideo,
  getStudioVideoProviderConfig,
  studioVideoRequestSchema,
} from "@/lib/studio-ia-video"

export const dynamic = "force-dynamic"

const propertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
  agency: true,
} as const

async function resolveAccessibleProperty(id: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: propertyInclude,
  })

  if (!property) {
    return {
      error: NextResponse.json({ error: "Imovel nao encontrado." }, { status: 404 }),
      property: null,
    }
  }

  if (user.role === UserRole.BROKER) {
    if (!user.broker || property.brokerId !== user.broker.id) {
      return {
        error: NextResponse.json({ error: "Acesso nao permitido a este imovel." }, { status: 403 }),
        property: null,
      }
    }
  }

  if (user.role === UserRole.AGENCY) {
    if (!user.ownedAgency || property.agencyId !== user.ownedAgency.id) {
      return {
        error: NextResponse.json({ error: "Acesso nao permitido a este imovel." }, { status: 403 }),
        property: null,
      }
    }
  }

  return { error: null, property }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso nao permitido para este perfil." }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const payload = studioVideoRequestSchema.parse(body)

    if (payload.propertyId) {
      const accessible = await resolveAccessibleProperty(payload.propertyId, user)

      if (accessible.error) return accessible.error
    }

    const result = await generateStudioPropertyVideo(payload)
    const response = NextResponse.json(result, { status: 202 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][studio-ia][video] generation failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de imoveis esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "VIDEO_PROVIDER_NOT_CONFIGURED") {
      const config = getStudioVideoProviderConfig()

      return NextResponse.json(
        {
          error: "A geracao de video do Studio IA ainda nao esta configurada neste ambiente.",
          estimatedCredits: config.estimatedCredits,
          providerConfigured: false,
        },
        { status: 503 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "VIDEO_PROVIDER_NOT_IMPLEMENTED") {
      const config = getStudioVideoProviderConfig()

      return NextResponse.json(
        {
          error: `O provedor de video "${config.provider}" ainda nao foi integrado ao Studio IA.`,
          estimatedCredits: config.estimatedCredits,
          providerConfigured: true,
        },
        { status: 501 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao preparar a geracao de video." },
      { status: 500 },
    )
  }
}
