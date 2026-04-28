import { UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

function serializeBrokerCatalog(user: {
  name: string
  photoUrl: string | null
  broker: {
    catalogSlug: string
    description: string | null
  } | null
}) {
  return {
    settings: {
      slug: user.broker?.catalogSlug ?? "",
      displayName: user.name,
      photoUrl: user.photoUrl ?? "",
      description: user.broker?.description ?? "",
    },
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  return NextResponse.json(serializeBrokerCatalog(user))
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => null)
    const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    const photoUrl = typeof data.photoUrl === "string" ? data.photoUrl.trim() : user.photoUrl ?? ""
    const description = typeof data.description === "string" ? data.description.trim() : user.broker.description ?? ""

    if (photoUrl.length > 500_000) {
      return NextResponse.json({ error: "Foto muito grande para salvar no perfil do corretor." }, { status: 400 })
    }

    if (description.length > 600) {
      return NextResponse.json({ error: "Descrição do catálogo deve ter no máximo 600 caracteres." }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.broker.update({
        where: {
          id: user.broker!.id,
        },
        data: {
          description: description || null,
        },
      })

      return tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          photoUrl: photoUrl || null,
        },
        include: {
          broker: true,
          ownedAgency: true,
        },
      })
    })

    return NextResponse.json(serializeBrokerCatalog(updated))
  } catch (caughtError) {
    console.error("[api][brokers][catalog] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de catálogo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar catálogo do corretor." }, { status: 500 })
  }
}
