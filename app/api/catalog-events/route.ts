import { CatalogOwnerType } from "@/lib/prisma-enums"

import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

const allowedEvents = new Set(["catalog_view", "property_view", "whatsapp_click"])
const DEDUPE_WINDOW_MS = 30 * 60 * 1000

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

function catalogOwnerType(value: unknown) {
  if (value === "agency") return CatalogOwnerType.AGENCY
  return CatalogOwnerType.BROKER
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const eventType = cleanText(body?.eventType, 40)
    const catalogSlug = cleanText(body?.catalogSlug, 160)
    const propertyId = cleanText(body?.propertyId, 120)
    const visitorKey = cleanText(body?.visitorKey, 160)

    if (!allowedEvents.has(eventType)) {
      return NextResponse.json({ error: "Evento inválido." }, { status: 400 })
    }

    if (!catalogSlug && !propertyId) {
      return NextResponse.json({ error: "Informe o catálogo ou imóvel do evento." }, { status: 400 })
    }

    const property = propertyId
      ? await prisma.property.findFirst({
          where: {
            id: propertyId,
            published: true,
          },
          select: {
            id: true,
            brokerId: true,
            agencyId: true,
          },
        })
      : null

    const catalog =
      !property && catalogSlug
        ? await prisma.catalog.findFirst({
            where: {
              slug: catalogSlug,
              ownerType: catalogOwnerType(body?.catalogType),
            },
          })
        : null

    const brokerId = property?.brokerId ?? (catalog?.ownerType === CatalogOwnerType.BROKER ? catalog.ownerId : null)
    const agencyId = property?.agencyId ?? (catalog?.ownerType === CatalogOwnerType.AGENCY ? catalog.ownerId : null)

    if (!brokerId && !agencyId) {
      return NextResponse.json({ ok: true })
    }

    if (visitorKey) {
      const existing = await prisma.catalogEvent.findFirst({
        where: {
          visitorKey,
          eventType,
          propertyId: property?.id ?? null,
          catalogSlug: catalogSlug || null,
          createdAt: {
            gte: new Date(Date.now() - DEDUPE_WINDOW_MS),
          },
        },
        select: { id: true },
      })

      if (existing) return NextResponse.json({ ok: true, deduped: true })
    }

    await prisma.$transaction([
      prisma.catalogEvent.create({
        data: {
          eventType,
          catalogSlug: catalogSlug || null,
          visitorKey: visitorKey || null,
          propertyId: property?.id ?? null,
          brokerId,
          agencyId,
        },
      }),
      ...(property?.id && eventType === "property_view"
        ? [
            prisma.property.update({
              where: { id: property.id },
              data: {
                viewsCount: {
                  increment: 1,
                },
              },
            }),
          ]
        : []),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api][catalog-events] create failed", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json({ error: "Não foi possível registrar o evento do catálogo." }, { status: 500 })
  }
}
