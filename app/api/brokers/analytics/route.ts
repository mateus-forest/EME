import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"

function getPeriodStart(period: string | null) {
  if (period === "7d") return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  if (period === "90d") return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  if (period === "all") return null
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
}

function cleanText(value: string | null, maxLength: number) {
  return value?.trim().slice(0, maxLength) ?? ""
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER || !user.broker) {
    return NextResponse.json({ error: "Acesso permitido apenas para corretor." }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const periodStart = getPeriodStart(searchParams.get("period"))
    const propertyId = cleanText(searchParams.get("propertyId"), 120)
    const source = cleanText(searchParams.get("source"), 80)
    const search = cleanText(searchParams.get("search"), 120)
    const propertyFilter = propertyId ? { id: propertyId } : search ? {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { city: { contains: search, mode: "insensitive" as const } },
        { neighborhood: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}
    const propertiesWhere = {
      brokerId: user.broker.id,
      ...propertyFilter,
    }
    const propertyRelationFilter = Object.keys(propertyFilter).length > 0 ? { is: propertyFilter } : undefined
    const eventWhere = {
      brokerId: user.broker.id,
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(search && propertyRelationFilter ? { property: propertyRelationFilter } : {}),
      ...(source ? { source } : {}),
    }
    const leadWhere = {
      brokerId: user.broker.id,
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(source ? { source } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { message: { contains: search, mode: "insensitive" as const } },
          { searchTerm: { contains: search, mode: "insensitive" as const } },
          ...(propertyRelationFilter ? [{ property: propertyRelationFilter }] : []),
        ],
      } : {}),
    }

    const [catalogViews, marketplaceViews, propertyViews, whatsappClicks, leads, properties, leadOrigins, propertyViewGroups, leadPropertyGroups, leadSources, eventSources, searchSources, recentSearches] = await Promise.all([
      source && source !== "catalog" ? Promise.resolve(0) : prisma.catalogEvent.count({ where: { ...eventWhere, source: "catalog", eventType: { in: ["catalog_view", "property_view"] } } }),
      source && source !== "marketplace" ? Promise.resolve(0) : prisma.catalogEvent.count({ where: { ...eventWhere, source: "marketplace", eventType: { in: ["marketplace_view", "property_view"] } } }),
      prisma.catalogEvent.count({ where: { ...eventWhere, eventType: "property_view" } }),
      prisma.catalogEvent.count({ where: { ...eventWhere, eventType: "whatsapp_click" } }),
      prisma.lead.count({ where: leadWhere }),
      prisma.property.findMany({
        where: propertiesWhere,
        select: {
          id: true,
          title: true,
          viewsCount: true,
          _count: {
            select: {
              leads: true,
            },
          },
        },
        orderBy: { viewsCount: "desc" },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: leadWhere,
        _count: { _all: true },
      }),
      prisma.catalogEvent.groupBy({
        by: ["propertyId"],
        where: { ...eventWhere, eventType: "property_view", propertyId: { not: null } },
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["propertyId"],
        where: { ...leadWhere, propertyId: { not: null } },
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { brokerId: user.broker.id },
        _count: { _all: true },
      }),
      prisma.catalogEvent.groupBy({
        by: ["source"],
        where: { brokerId: user.broker.id },
        _count: { _all: true },
      }),
      prisma.searchEvent.groupBy({
        by: ["source"],
        where: { brokerId: user.broker.id },
        _count: { _all: true },
      }),
      prisma.searchEvent.findMany({
        where: {
          brokerId: user.broker.id,
          ...(source ? { source } : { source: { in: ["catalog", "marketplace"] } }),
          ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
          ...(search ? { query: { contains: search, mode: "insensitive" as const } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          query: true,
          resultCount: true,
          source: true,
          createdAt: true,
        },
      }),
    ])
    const viewsByProperty = new Map(propertyViewGroups.map((item) => [item.propertyId, item._count._all]))
    const leadsByProperty = new Map(leadPropertyGroups.map((item) => [item.propertyId, item._count._all]))

    return NextResponse.json({
      catalogViews,
      marketplaceViews,
      propertyViews,
      totalViews: catalogViews + marketplaceViews,
      whatsappClicks,
      leads,
      monitoredProperties: properties.length,
      mostAccessed: properties
        .map((property) => ({
          id: property.id,
          title: property.title,
          views: viewsByProperty.get(property.id) ?? 0,
          leads: leadsByProperty.get(property.id) ?? 0,
        }))
        .sort((first, second) => second.views - first.views || second.leads - first.leads)
        .slice(0, 5),
      leadOrigins: leadOrigins.map((origin) => ({
        source: origin.source || "Sem origem",
        count: origin._count._all,
      })),
      sources: [...new Set([
        ...leadSources.map((origin) => origin.source || "Sem origem"),
        ...eventSources.map((origin) => origin.source || "Sem origem"),
        ...searchSources.map((origin) => origin.source || "Sem origem"),
      ].filter(Boolean))],
      recentSearches: recentSearches.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  } catch (caughtError) {
    console.error("[api][brokers][analytics] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de analytics indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível carregar analytics." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER || !user.broker) {
    return NextResponse.json({ error: "Acesso permitido apenas para corretor." }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const query = cleanText(body?.query, 240)
    const resultCount = typeof body?.resultCount === "number" ? Math.max(0, Math.trunc(body.resultCount)) : 0
    const source = cleanText(body?.source, 80) || "dashboard"

    if (!query) {
      return NextResponse.json({ error: "Informe o termo buscado." }, { status: 400 })
    }

    await prisma.searchEvent.create({
      data: {
        brokerId: user.broker.id,
        query,
        resultCount,
        source,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (caughtError) {
    console.error("[api][brokers][analytics][search] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "Serviço de analytics indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível registrar a busca." }, { status: 500 })
  }
}
