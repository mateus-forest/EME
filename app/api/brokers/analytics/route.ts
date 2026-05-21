import { NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER || !user.broker) {
    return NextResponse.json({ error: "Acesso permitido apenas para corretor." }, { status: 403 })
  }

  try {
    const [catalogViews, propertyViews, whatsappClicks, leads, properties, leadOrigins] = await Promise.all([
      prisma.catalogEvent.count({ where: { brokerId: user.broker.id, eventType: "catalog_view" } }),
      prisma.catalogEvent.count({ where: { brokerId: user.broker.id, eventType: "property_view" } }),
      prisma.catalogEvent.count({ where: { brokerId: user.broker.id, eventType: "whatsapp_click" } }),
      prisma.lead.count({ where: { brokerId: user.broker.id } }),
      prisma.property.findMany({
        where: { brokerId: user.broker.id },
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
        where: { brokerId: user.broker.id },
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      catalogViews,
      propertyViews,
      totalViews: catalogViews + propertyViews,
      whatsappClicks,
      leads,
      monitoredProperties: properties.length,
      mostAccessed: properties.slice(0, 5).map((property) => ({
        id: property.id,
        title: property.title,
        views: property.viewsCount,
        leads: property._count.leads,
      })),
      leadOrigins: leadOrigins.map((origin) => ({
        source: origin.source || "Sem origem",
        count: origin._count._all,
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
