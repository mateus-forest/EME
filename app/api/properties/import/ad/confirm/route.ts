import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { enforceAgencyOperationalAccess, enforceBrokerPropertyCreation } from "@/lib/billing-enforcement"
import { adImportDraftSchema, type AdImportDraft } from "@/lib/property-ad-import"
import { parsePriceInput, serializeProperty } from "@/lib/property-contract"
import { mapXmlPropertyType } from "@/lib/property-xml-import"
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

export const dynamic = "force-dynamic"

function buildDescription(draft: AdImportDraft) {
  return [
    draft.description,
    draft.features.length > 0 ? `Diferenciais: ${draft.features.join(", ")}` : "",
    draft.tags.length > 0 ? `Tags: ${draft.tags.join(", ")}` : "",
    draft.address ? `Endereco aproximado: ${draft.address}` : "",
    draft.area ? `Area: ${draft.area}` : "",
    draft.sourceUrl ? `Referencia: ${draft.sourceUrl}` : "",
    draft.notes ? `Observacoes: ${draft.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => null)
    const draft = adImportDraftSchema.parse(body?.draft)
    const price = parsePriceInput(draft.price)

    if (!draft.title || !draft.city || !draft.neighborhood || price === null) {
      return NextResponse.json(
        { error: "Revise titulo, cidade, bairro e preco antes de criar o imovel." },
        { status: 400 },
      )
    }

    const broker =
      user.role === UserRole.BROKER
        ? user.broker
        : user.ownedAgency
          ? await prisma.broker.findFirst({
              where: {
                agencyId: user.ownedAgency.id,
              },
              orderBy: {
                createdAt: "asc",
              },
            })
          : null

    if (!broker) {
      return NextResponse.json(
        { error: user.role === UserRole.AGENCY ? "Cadastre ou vincule um corretor antes de criar imoveis." : "Corretor nao encontrado para esta conta." },
        { status: 400 },
      )
    }

    if (user.role === UserRole.BROKER) {
      const billingBlocked = await enforceBrokerPropertyCreation(user)
      if (billingBlocked) return billingBlocked
    } else {
      const billingBlocked = enforceAgencyOperationalAccess(user)
      if (billingBlocked) return billingBlocked
    }

    const agencyId = user.role === UserRole.AGENCY ? user.ownedAgency?.id ?? null : user.broker?.agencyId ?? null
    const created = await prisma.property.create({
      data: {
        title: draft.title,
        description: buildDescription(draft) || null,
        price,
        city: draft.city,
        neighborhood: draft.neighborhood,
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        parkingSpots: draft.parking,
        type: mapXmlPropertyType(draft.type),
        status: "DRAFT",
        published: false,
        imageUrls: draft.images.slice(0, 6),
        brokerId: broker.id,
        agencyId,
      },
      include: propertyInclude,
    })

    const response = NextResponse.json({ property: serializeProperty(created) }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][import][ad][confirm] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O servico de imoveis esta indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Nao foi possivel criar o imovel a partir do anuncio." }, { status: 500 })
  }
}
