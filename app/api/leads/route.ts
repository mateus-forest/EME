import { CatalogOwnerType } from "@/lib/prisma-enums"

import { NextRequest, NextResponse } from "next/server"

import { isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

type NotificationRecipient = {
  id: string
}

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
    const propertyId = cleanText(body?.propertyId, 120)
    const catalogSlug = cleanText(body?.catalogSlug, 160)
    const requestedSource = cleanText(body?.source, 80) || "catalog"
    const marketplaceSource = requestedSource.toLowerCase() === "marketplace"
    const source = marketplaceSource ? "marketplace" : requestedSource
    const name = cleanText(body?.name, 120)
    const email = cleanText(body?.email, 160).toLowerCase()
    const phone = cleanText(body?.phone, 40)
    const message = cleanText(body?.message, 800)
    const searchTerm = cleanText(body?.searchTerm, 240)
    const intent = cleanText(body?.intent, 160)

    if (!propertyId && !catalogSlug) {
      return NextResponse.json({ error: "Informe o imóvel ou catálogo de origem do lead." }, { status: 400 })
    }

    if (!name && !phone && !email) {
      return NextResponse.json({ error: "Informe pelo menos nome, telefone ou email para registrar o lead." }, { status: 400 })
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Informe um email válido." }, { status: 400 })
    }

    const property = propertyId
      ? await prisma.property.findFirst({
          where: {
            id: propertyId,
            ...(marketplaceSource ? { marketplacePublished: true } : { published: true }),
          },
          select: {
            id: true,
            brokerId: true,
            agencyId: true,
            title: true,
            broker: {
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            agency: {
              select: {
                ownerUserId: true,
                name: true,
              },
            },
          },
        })
      : null

    if (propertyId && !property) {
      return NextResponse.json({ error: "Imóvel publicado não encontrado." }, { status: 404 })
    }

    const catalog =
      !property && catalogSlug
        ? await prisma.catalog.findFirst({
            where: {
              slug: catalogSlug,
              ownerType: catalogOwnerType(body?.catalogType),
            },
          })
        : null

    if (!property && catalogSlug && !catalog) {
      return NextResponse.json({ error: "Catálogo não encontrado." }, { status: 404 })
    }

    const brokerId = property?.brokerId ?? (catalog?.ownerType === CatalogOwnerType.BROKER ? catalog.ownerId : null)
    const agencyId = property?.agencyId ?? (catalog?.ownerType === CatalogOwnerType.AGENCY ? catalog.ownerId : null)

    if (!brokerId && !agencyId) {
      return NextResponse.json({ error: "Não foi possível identificar o responsável pelo lead." }, { status: 400 })
    }

    const lead = await prisma.lead.create({
      data: {
        name: name || null,
        email: email || null,
        phone: phone || null,
        whatsapp: phone || null,
        message: message || (property ? `Interesse no imóvel ${property.title}` : "Interesse no catálogo"),
        catalogSlug: catalogSlug || null,
        searchTerm: searchTerm || null,
        intent: intent || null,
        source,
        propertyId: property?.id ?? null,
        brokerId,
        agencyId,
      },
    })

    notifyLeadRecipients({ property, brokerId, agencyId }).catch((error) => {
      console.error("[api][leads] notification failed after lead creation", {
        leadId: lead.id,
        message: error instanceof Error ? error.message : "unknown",
      })
    })

    const response = NextResponse.json({ lead: { id: lead.id } }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][leads] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de leads está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: leadErrorMessage(caughtError) }, { status: 500 })
  }
}

async function notifyLeadRecipients({
  property,
  brokerId,
  agencyId,
}: {
  property: { title: string; broker: { userId: string }; agency: { ownerUserId: string } | null } | null
  brokerId: string | null
  agencyId: string | null
}) {
  const usersToNotify = new Set<string>()

  if (property?.broker.userId) usersToNotify.add(property.broker.userId)
  if (property?.agency?.ownerUserId) usersToNotify.add(property.agency.ownerUserId)

  if (!property && brokerId) {
    const broker = await prisma.broker.findUnique({ where: { id: brokerId }, select: { userId: true } })
    if (broker?.userId) usersToNotify.add(broker.userId)
  }

  if (!property && agencyId) {
    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { ownerUserId: true } })
    if (agency?.ownerUserId) usersToNotify.add(agency.ownerUserId)
  }

  const admins: NotificationRecipient[] = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  })
  admins.forEach((admin) => usersToNotify.add(admin.id))

  if (usersToNotify.size === 0) return

  await prisma.notification.createMany({
    data: [...usersToNotify].map((userId) => ({
      userId,
      title: "Novo lead recebido",
      message: property ? `Novo interesse registrado no imóvel ${property.title}.` : "Novo interesse registrado no catálogo público.",
      read: false,
    })),
  })
}

function leadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  const missingColumn = message.match(/column [`"]?([\w.]+)[`"]?/i)?.[1]

  if (missingColumn) {
    return `Não foi possível criar o lead. Coluna necessária ausente no banco: ${missingColumn}.`
  }

  return "Não foi possível criar o lead agora. Verifique nome, telefone e imóvel selecionado."
}
