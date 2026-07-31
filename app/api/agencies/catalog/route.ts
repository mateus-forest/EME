import { CatalogOwnerType, UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { slugify } from "@/lib/catalog-slug"
import { prisma, type PrismaTransaction } from "@/lib/prisma"

function serializeAgencyCatalog(agency: {
  catalogSlug: string
  name: string
  logoUrl: string | null
  description: string | null
}) {
  return {
    settings: {
      slug: agency.catalogSlug,
      displayName: agency.name,
      logoUrl: agency.logoUrl ?? "",
      description: agency.description ?? "",
    },
  }
}

export const dynamic = "force-dynamic"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
  }

  const response = NextResponse.json(serializeAgencyCatalog(user.ownedAgency))
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => null)
    const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    const displayName = typeof data.displayName === "string" ? data.displayName.trim() : user.ownedAgency.name
    const requestedSlug =
      typeof data.slug === "string" && data.slug.trim()
        ? slugify(data.slug)
        : user.ownedAgency.catalogSlug
    const logoUrl = typeof data.logoUrl === "string" ? data.logoUrl.trim() : user.ownedAgency.logoUrl ?? ""
    const description = typeof data.description === "string" ? data.description.trim() : user.ownedAgency.description ?? ""

    if (!displayName) {
      return NextResponse.json({ error: "Nome da imobiliaria e obrigatorio." }, { status: 400 })
    }

    if (!requestedSlug) {
      return NextResponse.json({ error: "Link do catalogo e obrigatorio." }, { status: 400 })
    }

    if (displayName.length > 120) {
      return NextResponse.json({ error: "Nome da imobiliaria deve ter no maximo 120 caracteres." }, { status: 400 })
    }

    if (logoUrl.length > 800_000) {
      return NextResponse.json({ error: "Logo muito grande. Use uma imagem menor ou tente enviar novamente." }, { status: 400 })
    }

    if (description.length > 600) {
      return NextResponse.json({ error: "Descricao institucional deve ter no maximo 600 caracteres." }, { status: 400 })
    }

    const agency = await prisma.$transaction(async (tx: PrismaTransaction) => {
      const slugInUseByAgency = await tx.agency.findFirst({
        where: {
          catalogSlug: requestedSlug,
          NOT: {
            id: user.ownedAgency!.id,
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
        slugInUseByCatalog?.ownerType === CatalogOwnerType.AGENCY &&
        slugInUseByCatalog.ownerId === user.ownedAgency!.id

      if (slugInUseByAgency || (slugInUseByCatalog && !isOwnCatalog)) {
        throw new Error("CATALOG_SLUG_IN_USE")
      }

      const updatedAgency = await tx.agency.update({
        where: {
          id: user.ownedAgency!.id,
        },
        data: {
          name: displayName,
          catalogSlug: requestedSlug,
          logoUrl: logoUrl || null,
          description: description || null,
        },
      })

      await tx.catalog.upsert({
        where: {
          slug: user.ownedAgency!.catalogSlug,
        },
        update: {
          slug: requestedSlug,
          ownerType: CatalogOwnerType.AGENCY,
          ownerId: user.ownedAgency!.id,
        },
        create: {
          slug: requestedSlug,
          ownerType: CatalogOwnerType.AGENCY,
          ownerId: user.ownedAgency!.id,
        },
      })

      return updatedAgency
    })

    const response = NextResponse.json(serializeAgencyCatalog(agency))
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][agencies][catalog] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (caughtError instanceof Error && caughtError.message === "CATALOG_SLUG_IN_USE") {
      return NextResponse.json({ error: "Este link de catalogo ja esta em uso." }, { status: 409 })
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "Servico de catalogo indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar catalogo da imobiliaria." }, { status: 500 })
  }
}
