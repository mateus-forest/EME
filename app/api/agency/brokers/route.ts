import { randomUUID } from "node:crypto"

import { BrokerAccountStatus, CatalogOwnerType, UserRole } from "@prisma/client"
import { hash } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

import { serializeAgencyBroker, buildAgencyBrokerHighlight } from "@/lib/agency-broker-contract"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { enforceAgencyOperationalAccess } from "@/lib/billing-enforcement"
import { generateUniqueSlug } from "@/lib/catalog-slug"
import { prisma } from "@/lib/prisma"

const brokerInclude = {
  user: true,
  properties: {
    include: {
      _count: {
        select: {
          leads: true,
        },
      },
    },
  },
} as const

function getOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin
}

function normalizePayload(body: unknown) {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}

  return {
    fullName:
      typeof data.fullName === "string"
        ? data.fullName.trim()
        : typeof data.name === "string"
          ? data.name.trim()
          : "",
    email: typeof data.email === "string" ? data.email.trim().toLowerCase() : "",
    whatsApp:
      typeof data.whatsApp === "string"
        ? data.whatsApp.trim()
        : typeof data.phone === "string"
          ? data.phone.trim()
          : "",
    creci: typeof data.creci === "string" ? data.creci.trim() : "",
  }
}

export async function GET(request: NextRequest) {
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
    const brokers = await prisma.broker.findMany({
      where: {
        agencyId: user.ownedAgency.id,
      },
      include: brokerInclude,
      orderBy: [
        {
          createdAt: "asc",
        },
      ],
    })

    const serialized = buildAgencyBrokerHighlight(
      brokers.map((broker) => serializeAgencyBroker(broker, { origin: getOrigin(request) })),
    )

    return NextResponse.json({ brokers: serialized })
  } catch (caughtError) {
    console.error("[api][agency][brokers] list failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de corretores está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao listar corretores da imobiliária." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
  }

  const billingBlocked = enforceAgencyOperationalAccess(user)
  if (billingBlocked) return billingBlocked

  try {
    const payload = normalizePayload(await request.json().catch(() => null))

    if (!payload.fullName || !payload.email || !payload.whatsApp || !payload.creci) {
      return NextResponse.json(
        { error: "Nome, email, WhatsApp e CRECI são obrigatórios." },
        { status: 400 },
      )
    }

    const broker = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: payload.email },
        include: {
          broker: true,
        },
      })

      if (existingUser && existingUser.role !== UserRole.BROKER) {
        return { error: "Já existe uma conta com este email em outro perfil." } as const
      }

      if (existingUser?.broker?.agencyId && existingUser.broker.agencyId !== user.ownedAgency!.id) {
        return { error: "Este corretor já está vinculado a outra imobiliária." } as const
      }

      if (existingUser?.broker) {
        const updated = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: payload.fullName,
            phone: payload.whatsApp,
            broker: {
              update: {
                phone: payload.whatsApp,
                creci: payload.creci,
                agencyId: user.ownedAgency!.id,
                status: BrokerAccountStatus.PENDING,
              },
            },
          },
          include: {
            broker: {
              include: {
                user: true,
                properties: true,
              },
            },
          },
        })

        return { broker: updated.broker! } as const
      }

      const passwordHash = await hash(randomUUID(), 10)
      const catalogSlug = await generateUniqueSlug(payload.fullName, async (slug) => {
        const existingBroker = await tx.broker.findUnique({ where: { catalogSlug: slug } })
        return Boolean(existingBroker)
      })

      const createdUser = await tx.user.create({
        data: {
          name: payload.fullName,
          email: payload.email,
          passwordHash,
          role: UserRole.BROKER,
          phone: payload.whatsApp,
        },
      })

      const createdBroker = await tx.broker.create({
        data: {
          userId: createdUser.id,
          agencyId: user.ownedAgency!.id,
          phone: payload.whatsApp,
          catalogSlug,
          creci: payload.creci,
          status: BrokerAccountStatus.PENDING,
        },
        include: brokerInclude,
      })

      await tx.catalog.create({
        data: {
          slug: createdBroker.catalogSlug,
          ownerType: CatalogOwnerType.BROKER,
          ownerId: createdBroker.id,
        },
      })

      return { broker: createdBroker } as const
    })

    if ("error" in broker) {
      return NextResponse.json({ error: broker.error }, { status: 409 })
    }

    const admins = await prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    })
    const notificationUserIds = new Set([broker.broker.userId, user.id, ...admins.map((admin) => admin.id)])

    await prisma.notification.createMany({
      data: [...notificationUserIds].map((userId) => ({
        userId,
        title: "Corretor vinculado à imobiliária",
        message: `${broker.broker.user.name} foi vinculado à imobiliária ${user.ownedAgency!.name}.`,
        read: false,
      })),
    })

    const serialized = serializeAgencyBroker(broker.broker, { origin: getOrigin(request) })
    return NextResponse.json({ broker: serialized }, { status: 201 })
  } catch (caughtError) {
    console.error("[api][agency][brokers] create failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de corretores está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao criar corretor da imobiliária." }, { status: 500 })
  }
}
