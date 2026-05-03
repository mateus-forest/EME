import { CatalogOwnerType, UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { slugify } from "@/lib/catalog-slug"
import { prisma, type PrismaTransaction } from "@/lib/prisma"

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

export const dynamic = "force-dynamic"

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
    const displayName = typeof data.displayName === "string" ? data.displayName.trim() : user.name
    const requestedSlug =
      typeof data.slug === "string" && data.slug.trim() ? slugify(data.slug) : user.broker.catalogSlug
    const photoUrl = typeof data.photoUrl === "string" ? data.photoUrl.trim() : user.photoUrl ?? ""
    const description = typeof data.description === "string" ? data.description.trim() : user.broker.description ?? ""

    if (!displayName) {
      return NextResponse.json({ error: "Nome do corretor e obrigatorio." }, { status: 400 })
    }

    if (!requestedSlug) {
      return NextResponse.json({ error: "Link do catalogo e obrigatorio." }, { status: 400 })
    }

    if (displayName.length > 120) {
      return NextResponse.json({ error: "Nome do corretor deve ter no maximo 120 caracteres." }, { status: 400 })
    }

    if (photoUrl.length > 800_000) {
      return NextResponse.json({ error: "Foto muito grande. Use uma imagem menor ou tente enviar novamente." }, { status: 400 })
    }

    if (description.length > 600) {
      return NextResponse.json({ error: "Descrição do catálogo deve ter no máximo 600 caracteres." }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const slugInUseByBroker = await tx.broker.findFirst({
        where: {
          catalogSlug: requestedSlug,
          NOT: {
            id: user.broker!.id,
          },
        },
        select: {
          id: true,
        },
      })

      const slugInUseByCatalog = await tx.catalog.findFirst({
        where: {
          slug: requestedSlug,
        },
        select: {
          ownerType: true,
          ownerId: true,
        },
      })

      const isOwnCatalog =
        slugInUseByCatalog?.ownerType === CatalogOwnerType.BROKER && slugInUseByCatalog.ownerId === user.broker!.id

      if (slugInUseByBroker || (slugInUseByCatalog && !isOwnCatalog)) {
        throw new Error("CATALOG_SLUG_IN_USE")
      }

      await tx.broker.update({
        where: {
          id: user.broker!.id,
        },
        data: {
          catalogSlug: requestedSlug,
          description: description || null,
        },
      })

      await tx.catalog.upsert({
        where: {
          slug: user.broker!.catalogSlug,
        },
        update: {
          slug: requestedSlug,
          ownerType: CatalogOwnerType.BROKER,
          ownerId: user.broker!.id,
        },
        create: {
          slug: requestedSlug,
          ownerType: CatalogOwnerType.BROKER,
          ownerId: user.broker!.id,
        },
      })

      return tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          name: displayName,
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

    if (caughtError instanceof Error && caughtError.message === "CATALOG_SLUG_IN_USE") {
      return NextResponse.json({ error: "Este link de catalogo ja esta em uso." }, { status: 409 })
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de catálogo está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar catálogo do corretor." }, { status: 500 })
  }
}
