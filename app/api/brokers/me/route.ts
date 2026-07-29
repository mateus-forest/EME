import {
  UserRole } from "@/lib/prisma-enums"
import {
  compare,
  hash } from "bcryptjs"
import { NextRequest,
  NextResponse } from "next/server"
import type { Broker } from "@/lib/prisma-model-types"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma, type PrismaTransaction } from "@/lib/prisma"

type BrokerProfileUser = {
  id: string
  name: string
  email: string
  phone: string | null
  photoUrl: string | null
  broker:
    | (Pick<Broker, "id" | "agencyId" | "phone" | "creci" | "description"> & {
        agency?: {
          id: string
          name: string
          phone: string | null
          cnpj: string | null
        } | null
      })
    | null
}

function buildBrokerProfile(user: BrokerProfileUser | null) {
  if (!user?.broker) return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.broker.phone ?? user.phone ?? "",
    photoUrl: user.photoUrl ?? "",
    brokerId: user.broker.id,
    agencyId: user.broker.agencyId ?? null,
    agencyName: user.broker.agency?.name ?? "",
    accountType: user.broker.agencyId ? "BROKER_AGENCY" : "BROKER_INDEPENDENT",
    creci: user.broker.creci ?? "",
    description: user.broker.description ?? "",
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

  const profile = buildBrokerProfile(user)
  if (!profile) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  const response = NextResponse.json({ profile })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
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

  const broker = user.broker

  try {
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body?.phone === "string" ? body.phone.trim() : ""
    const creci = typeof body?.creci === "string" ? body.creci.trim() : ""
    const description = typeof body?.description === "string" ? body.description.trim() : ""
    const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl.trim() : ""
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!name || !email || !phone || !creci) {
      return NextResponse.json({ error: "Nome, email, telefone e CRECI são obrigatórios." }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Informe um email válido." }, { status: 400 })
    }

    const isChangingPassword = Boolean(currentPassword || newPassword)
    let passwordHash: string | undefined

    if (isChangingPassword) {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: "Informe a senha atual e a nova senha." }, { status: 400 })
      }

      if (!user.passwordHash) {
        return NextResponse.json({ error: "Não foi possível validar a senha atual." }, { status: 400 })
      }

      const passwordMatches = await compare(currentPassword, user.passwordHash)
      if (!passwordMatches) {
        return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 400 })
      }

      passwordHash = await hash(newPassword, 10)
    }

    const emailOwner = await prisma.user.findFirst({
      where: {
        email,
        NOT: { id: user.id },
      },
      select: { id: true },
    })

    if (emailOwner) {
      return NextResponse.json({ error: "Já existe uma conta com este email." }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx: PrismaTransaction) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          name,
          email,
          phone,
          photoUrl: photoUrl || null,
          ...(passwordHash ? { passwordHash } : {}),
        },
        include: {
          broker: true,
          ownedAgency: true,
        },
      })

      await tx.broker.update({
        where: { id: broker.id },
        data: {
          phone,
          creci,
          description: description || null,
        },
      })

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          broker: true,
          ownedAgency: true,
        },
      })
    })

    const response = NextResponse.json({
      profile: buildBrokerProfile(updated),
    })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][brokers][me] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de conta está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar a conta do corretor." }, { status: 500 })
  }
}
