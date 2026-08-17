import { UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { mapPropertyStatus, serializeProperty } from "@/lib/property-contract"
import {
  assessCatalogReadiness,
  propertyPublicationBlockedResponse,
} from "@/lib/property-publication-readiness"
import { prisma, type PrismaTransaction } from "@/lib/prisma"

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

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    if (!user.ownedAgency) {
      return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
    }

    const { id } = await context.params
    const property = await prisma.property.findFirst({
      where: {
        id,
        agencyId: user.ownedAgency.id,
      },
      include: propertyInclude,
    })

    if (!property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const statusPayload = mapPropertyStatus(body?.status ?? (body?.published ? "Publicado" : "Rascunho"))

    if (!statusPayload) {
      return NextResponse.json({ error: "Informe um status de publicação válido." }, { status: 400 })
    }

    if (statusPayload.published && !property.published) {
      const readiness = assessCatalogReadiness(property)
      if (!readiness.ready) {
        return NextResponse.json(propertyPublicationBlockedResponse(readiness, "catalog"), { status: 422 })
      }
    }

    const updated = await prisma.$transaction(async (tx: PrismaTransaction) => {
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
        await tx.notification.createMany({
          data: [
            {
              userId: user.id,
              title: statusPayload.published ? "Imóvel publicado" : "Imóvel despublicado",
              message: statusPayload.published
                ? `O imóvel ${nextProperty.title} foi publicado no catálogo da imobiliária.`
                : `O imóvel ${nextProperty.title} saiu do catálogo público da imobiliária.`,
              read: false,
            },
            {
              userId: nextProperty.broker.userId,
              title: statusPayload.published ? "Imóvel publicado pela imobiliária" : "Imóvel despublicado pela imobiliária",
              message: statusPayload.published
                ? `O imóvel ${nextProperty.title} foi publicado pela imobiliária.`
                : `O imóvel ${nextProperty.title} foi removido do catálogo público pela imobiliária.`,
              read: false,
            },
          ],
          skipDuplicates: true,
        })
      }

      return nextProperty
    })

    const response = NextResponse.json({ property: serializeProperty(updated) })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][agency][publish] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao publicar o imóvel da imobiliária." }, { status: 500 })
  }
}
