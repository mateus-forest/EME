import { compare, hash } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUserWithSensitiveFields, isPrismaSchemaMismatch, isPrismaUnavailable } from "@/lib/auth-route"
import { comparePin, hashPin, isValidPin, normalizePin } from "@/lib/pin-auth"
import type { Broker, User } from "@/lib/prisma-model-types"
import { UserRole } from "@/lib/prisma-enums"
import { prisma, type PrismaTransaction } from "@/lib/prisma"

type BrokerProfileUser = Pick<User, "id" | "name" | "email" | "phone" | "photoUrl" | "passwordHash" | "pinHash"> & {
  pinSchemaAvailable?: boolean
  broker:
    | (Pick<Broker, "id" | "agencyId" | "phone" | "creci" | "description" | "brandColor" | "showAgencyWatermark"> & {
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
    brandColor: user.broker.brandColor ?? "",
    showAgencyWatermark: user.broker.showAgencyWatermark,
    pinConfigured: Boolean(user.pinHash),
  }
}

export const dynamic = "force-dynamic"

export async function GET() {
  const { error, user } = await getAuthenticatedUserWithSensitiveFields()

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
  const { error, user } = await getAuthenticatedUserWithSensitiveFields()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden

  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado para esta conta." }, { status: 404 })
  }

  const brokerId = user.broker.id

  try {
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body?.phone === "string" ? body.phone.trim() : ""
    const creci = typeof body?.creci === "string" ? body.creci.trim() : ""
    const description = typeof body?.description === "string" ? body.description.trim() : ""
    const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl.trim() : ""
    const brandColorInput = typeof body?.brandColor === "string" ? body.brandColor.trim() : ""
    const brandColor = /^#[0-9a-fA-F]{6}$/.test(brandColorInput) ? brandColorInput : ""
    const showAgencyWatermark = typeof body?.showAgencyWatermark === "boolean" ? body.showAgencyWatermark : true
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""
    const pinAction = body?.pinAction === "set" || body?.pinAction === "remove" ? body.pinAction : null
    const currentPin = normalizePin(body?.currentPin)
    const newPin = normalizePin(body?.newPin)

    if (!name || !email || !phone || !creci) {
      return NextResponse.json({ error: "Nome, email, telefone e CRECI são obrigatórios." }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Informe um email válido." }, { status: 400 })
    }

    const needsPasswordConfirmation = Boolean(currentPassword || newPassword || pinAction)
    let passwordHash: string | undefined
    let pinHash: string | null | undefined

    if (needsPasswordConfirmation) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Informe sua senha atual para confirmar esta alteração." }, { status: 400 })
      }

      if (!user.passwordHash) {
        return NextResponse.json({ error: "Não foi possível validar a senha atual." }, { status: 400 })
      }

      const passwordMatches = await compare(currentPassword, user.passwordHash)
      if (!passwordMatches) {
        return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 400 })
      }
    }

    if (newPassword) {
      passwordHash = await hash(newPassword, 10)
    }

    if (pinAction === "set") {
      if (user.pinSchemaAvailable === false) {
        return NextResponse.json(
          { error: "O PIN ainda não pode ser configurado nesta base porque a migration necessária não foi aplicada." },
          { status: 503 },
        )
      }

      if (!isValidPin(newPin)) {
        return NextResponse.json({ error: "Informe um PIN válido com 4 dígitos." }, { status: 400 })
      }

      let usersWithPin: Array<{ pinHash: string | null }> = []

      try {
        usersWithPin = await prisma.user.findMany({
          where: {
            id: { not: user.id },
            pinHash: { not: null },
          },
          select: {
            pinHash: true,
          },
        })
      } catch (error) {
        if (isPrismaSchemaMismatch(error)) {
          return NextResponse.json(
            { error: "O PIN ainda não pode ser configurado nesta base porque a migration necessária não foi aplicada." },
            { status: 503 },
          )
        }

        throw error
      }

      for (const candidate of usersWithPin) {
        if (await comparePin(newPin, candidate.pinHash)) {
          return NextResponse.json({ error: "Este PIN já está em uso. Escolha outro código de 4 dígitos." }, { status: 400 })
        }
      }

      pinHash = await hashPin(newPin)
    }

    if (pinAction === "remove") {
      if (user.pinSchemaAvailable === false) {
        return NextResponse.json(
          { error: "O PIN ainda não pode ser removido nesta base porque a migration necessária não foi aplicada." },
          { status: 503 },
        )
      }

      if (!user.pinHash) {
        return NextResponse.json({ error: "Nenhum PIN está configurado para esta conta." }, { status: 400 })
      }

      if (!isValidPin(currentPin)) {
        return NextResponse.json({ error: "Informe o PIN atual para remover este acesso." }, { status: 400 })
      }

      const currentPinMatches = await comparePin(currentPin, user.pinHash)
      if (!currentPinMatches) {
        return NextResponse.json({ error: "O PIN atual está incorreto." }, { status: 400 })
      }

      pinHash = null
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
          ...(pinHash !== undefined ? { pinHash } : {}),
        },
        include: {
          broker: true,
          ownedAgency: true,
        },
      })

      await tx.broker.update({
        where: { id: brokerId },
        data: {
          phone,
          creci,
          description: description || null,
          brandColor: brandColor || null,
          showAgencyWatermark,
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
      profile: buildBrokerProfile(updated as BrokerProfileUser | null),
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
