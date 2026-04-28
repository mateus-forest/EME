import { CatalogOwnerType, SubscriptionOwnerType, SubscriptionStatus, UserRole } from "@prisma/client"
import { hash } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

import { isDatabaseUnavailableError } from "@/lib/auth-errors"
import { createAuthToken, setAuthCookie } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

async function generateUniqueSlug(baseValue: string, exists: (slug: string) => Promise<boolean>) {
  const baseSlug = slugify(baseValue) || "eme"

  if (!(await exists(baseSlug))) {
    return baseSlug
  }

  let counter = 2

  while (true) {
    const candidate = `${baseSlug}-${counter}`

    if (!(await exists(candidate))) {
      return candidate
    }

    counter += 1
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    const role =
      typeof body?.role === "string" && Object.values(UserRole).includes(body.role as UserRole)
        ? (body.role as UserRole)
        : undefined
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    const phone = typeof body?.phone === "string" ? body.phone.trim() : ""
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : ""

    console.info("[auth][register] payload received", {
      keys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [],
      role: role ?? null,
      hasName: Boolean(name),
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
      hasPhone: Boolean(phone),
      hasCompanyName: Boolean(companyName),
    })

    if (!role || !name || !email || !password) {
      return NextResponse.json({ error: "Dados obrigatórios não informados." }, { status: 400 })
    }

    if (![UserRole.BROKER, UserRole.AGENCY, UserRole.ADMIN].includes(role)) {
      return NextResponse.json({ error: "Role inválido." }, { status: 400 })
    }

    if (role === UserRole.AGENCY && !companyName) {
      return NextResponse.json({ error: "Nome da imobiliária é obrigatório." }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "Já existe uma conta com este email." }, { status: 409 })
    }

    const passwordHash = await hash(password, 10)

    if (!passwordHash) {
      console.error("[auth][register] password hash generation failed", { email, role })
      return NextResponse.json({ error: "Não foi possível proteger a senha informada." }, { status: 500 })
    }

    let brokerId: string | null = null
    let agencyId: string | null = null

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
        },
      })

      if (role === UserRole.BROKER) {
        const catalogSlug = await generateUniqueSlug(name, async (slug) => {
          const broker = await tx.broker.findUnique({ where: { catalogSlug: slug } })
          return Boolean(broker)
        })

        const broker = await tx.broker.create({
          data: {
            userId: createdUser.id,
            phone,
            catalogSlug,
          },
        })

        brokerId = broker.id

        await tx.catalog.create({
          data: {
            slug: broker.catalogSlug,
            ownerType: CatalogOwnerType.BROKER,
            ownerId: broker.id,
          },
        })

        await tx.subscription.create({
          data: {
            ownerType: SubscriptionOwnerType.BROKER,
            ownerId: broker.id,
            status: SubscriptionStatus.TRIALING,
            nextBillingAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      }

      if (role === UserRole.AGENCY) {
        const catalogSlug = await generateUniqueSlug(companyName, async (slug) => {
          const agency = await tx.agency.findUnique({ where: { catalogSlug: slug } })
          return Boolean(agency)
        })

        const agency = await tx.agency.create({
          data: {
            ownerUserId: createdUser.id,
            name: companyName!,
            catalogSlug,
          },
        })

        agencyId = agency.id

        await tx.catalog.create({
          data: {
            slug: agency.catalogSlug,
            ownerType: CatalogOwnerType.AGENCY,
            ownerId: agency.id,
          },
        })

        await tx.subscription.create({
          data: {
            ownerType: SubscriptionOwnerType.AGENCY,
            ownerId: agency.id,
            status: SubscriptionStatus.TRIALING,
            nextBillingAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      }

      return createdUser
    })

    console.info("[auth][register] user created", {
      email,
      userId: user.id,
      role: user.role,
      hasPasswordHash: Boolean(user.passwordHash),
    })

    const token = await createAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        brokerId,
        agencyId,
      },
    })

    setAuthCookie(response, token)

    return response
  } catch (error) {
    console.error("[auth][register] unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    })

    if (isDatabaseUnavailableError(error)) {
      return NextResponse.json(
        { error: "O serviço de cadastro está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao criar a conta." }, { status: 500 })
  }
}
