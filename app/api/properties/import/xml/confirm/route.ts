import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { enforceAgencyOperationalAccess, enforceBrokerPropertyCreation } from "@/lib/billing-enforcement"
import { parsePriceInput, serializeProperty } from "@/lib/property-contract"
import { mapXmlPropertyType, type ParsedXmlProperty, XML_IMPORT_MAX_PROPERTIES } from "@/lib/property-xml-import"
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

function sanitizeString(value: unknown, maxLength = 4000) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : ""
}

function sanitizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function sanitizeProperty(value: unknown): ParsedXmlProperty | null {
  if (!value || typeof value !== "object") return null

  const candidate = value as Partial<ParsedXmlProperty>
  const images = Array.isArray(candidate.images)
    ? candidate.images
        .filter((image): image is string => typeof image === "string" && /^https?:\/\//i.test(image))
        .slice(0, 6)
    : []
  const type = candidate.type === "Casa" || candidate.type === "Comercial" ? candidate.type : "Apartamento"
  const title = sanitizeString(candidate.title, 160)
  const city = sanitizeString(candidate.city, 120)
  const neighborhood = sanitizeString(candidate.neighborhood, 120)
  const price = sanitizeString(candidate.price, 80)

  return {
    title,
    description: sanitizeString(candidate.description),
    price,
    type,
    city,
    neighborhood,
    address: sanitizeString(candidate.address, 180),
    bedrooms: sanitizeNumber(candidate.bedrooms),
    bathrooms: sanitizeNumber(candidate.bathrooms),
    parking: sanitizeNumber(candidate.parking),
    area: sanitizeString(candidate.area, 80),
    images,
    externalRef: sanitizeString(candidate.externalRef, 120),
    status: candidate.status === "ready" || candidate.status === "needs_review" || candidate.status === "invalid" ? candidate.status : "invalid",
    issues: Array.isArray(candidate.issues) ? candidate.issues.filter((issue): issue is string => typeof issue === "string").slice(0, 8) : [],
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    const body = (await request.json().catch(() => null)) as { properties?: unknown[] } | null
    const properties = Array.isArray(body?.properties)
      ? body.properties
          .map(sanitizeProperty)
          .filter((property: ParsedXmlProperty | null): property is ParsedXmlProperty => Boolean(property))
          .slice(0, XML_IMPORT_MAX_PROPERTIES)
      : []

    if (properties.length === 0) {
      return NextResponse.json({ error: "Nenhum imóvel foi enviado para importação." }, { status: 400 })
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
        { error: user.role === UserRole.AGENCY ? "Cadastre ou vincule um corretor antes de importar imóveis." : "Corretor não encontrado para esta conta." },
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

    const agencyId = user.role === UserRole.AGENCY ? user.ownedAgency?.id ?? null : null
    const report = {
      imported: 0,
      duplicates: 0,
      errors: 0,
      pendingFields: 0,
      importedProperties: [] as ReturnType<typeof serializeProperty>[],
      failed: [] as Array<{ title: string; reason: string }>,
    }

    for (const property of properties) {
      const price = parsePriceInput(property.price)
      const missingFields = [property.title, property.city, property.neighborhood, property.price].filter((field) => !field).length

      if (!property.title || !property.city || !property.neighborhood || price === null) {
        report.errors += 1
        report.pendingFields += missingFields
        report.failed.push({ title: property.title || "Imovel sem titulo", reason: "Campos obrigatorios pendentes." })
        continue
      }

      const duplicate = await prisma.property.findFirst({
        where: {
          brokerId: broker.id,
          agencyId,
          title: property.title,
          city: property.city,
          neighborhood: property.neighborhood,
          price,
        },
      })

      if (duplicate) {
        report.duplicates += 1
        continue
      }

      const descriptionParts = [
        property.description,
        property.address ? `Endereco: ${property.address}` : "",
        property.area ? `Area: ${property.area}` : "",
        property.externalRef ? `Referencia externa: ${property.externalRef}` : "",
      ].filter(Boolean)

      const created = await prisma.property.create({
        data: {
          title: property.title,
          description: descriptionParts.join("\n\n") || null,
          price,
          city: property.city,
          neighborhood: property.neighborhood,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          parkingSpots: property.parking,
          type: mapXmlPropertyType(property.type),
          status: "DRAFT",
          published: false,
          imageUrls: property.images,
          brokerId: broker.id,
          agencyId,
        },
        include: propertyInclude,
      })

      report.imported += 1
      report.importedProperties.push(serializeProperty(created))
    }

    const response = NextResponse.json({ report })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][import][xml][confirm] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Não foi possível importar os imóveis do XML." }, { status: 500 })
  }
}
