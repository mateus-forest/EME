import { UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { mapPropertyStatus, serializeProperty } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"

const propertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
  agency: true,
  _count: {
    select: {
      leads: true,
    },
  },
} as const

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  try {
    const { id } = await context.params
    const property = await prisma.property.findUnique({
      where: { id },
      include: propertyInclude,
    })

    if (!property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    if (!user.broker || property.brokerId !== user.broker.id) {
      return NextResponse.json({ error: "Acesso não permitido a este imóvel." }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const statusPayload = mapPropertyStatus(body?.status ?? (body?.published ? "Publicado" : "Rascunho"))

    if (!statusPayload) {
      return NextResponse.json({ error: "Informe um status de publicação válido." }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextProperty = await tx.property.update({
        where: { id: property.id },
        data: {
          status: statusPayload.status,
          published: statusPayload.published,
        },
        include: propertyInclude,
      })

      const changedPublication = property.published !== statusPayload.published
      if (changedPublication) {
        await tx.notification.create({
          data: {
            userId: user.id,
            title: statusPayload.published ? "Imóvel publicado" : "Imóvel despublicado",
            message: statusPayload.published
              ? `O imóvel ${nextProperty.title} foi publicado no catálogo.`
              : `O imóvel ${nextProperty.title} saiu do catálogo público.`,
            read: false,
          },
        })
      }

      return nextProperty
    })

    return NextResponse.json({ property: serializeProperty(updated) })
  } catch (caughtError) {
    console.error("[api][properties][publish] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao publicar o imóvel." }, { status: 500 })
  }
}
