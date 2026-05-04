import {
  UserRole } from "@/lib/prisma-enums"
import {
  compare,
  hash } from "bcryptjs"
import { NextRequest,
  NextResponse } from "next/server"
import type { Agency } from "@/lib/prisma-model-types"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma, type PrismaTransaction } from "@/lib/prisma"

type AgencyProfileUser = {
  id: string
  name: string
  email: string
  phone: string | null
  ownedAgency: Pick<Agency, "id" | "name" | "phone" | "cnpj" | "logoUrl"> | null
}

function buildAgencyProfile(user: AgencyProfileUser | null) {
  if (!user?.ownedAgency) return null

  return {
    id: user.id,
    companyName: user.ownedAgency.name,
    ownerName: user.name,
    email: user.email,
    phone: user.ownedAgency.phone ?? user.phone ?? "",
    cnpj: user.ownedAgency.cnpj ?? "",
    logoUrl: user.ownedAgency.logoUrl ?? "",
  }
}

export const dynamic = "force-dynamic"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  const profile = buildAgencyProfile(user)
  if (!profile) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
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

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliária não encontrada para esta conta." }, { status: 404 })
  }

  const ownedAgency = user.ownedAgency

  try {
    const body = await request.json().catch(() => null)
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : ""
    const ownerName = typeof body?.ownerName === "string" ? body.ownerName.trim() : ""
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body?.phone === "string" ? body.phone.trim() : ""
    const cnpj = typeof body?.cnpj === "string" ? body.cnpj.trim() : ""
    const logoUrl = typeof body?.logoUrl === "string" ? body.logoUrl.trim() : ""
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!companyName || !ownerName || !email || !phone || !cnpj) {
      return NextResponse.json(
        { error: "Nome da imobiliária, responsável, email, telefone e CNPJ são obrigatórios." },
        { status: 400 },
      )
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
      const nextUser = await tx.user.update({
        where: { id: user.id },
        data: {
          name: ownerName,
          email,
          phone,
          ...(passwordHash ? { passwordHash } : {}),
        },
        include: {
          broker: true,
          ownedAgency: true,
        },
      })

      await tx.agency.update({
        where: { id: ownedAgency.id },
        data: {
          name: companyName,
          phone,
          cnpj,
          logoUrl: logoUrl || null,
        },
      })

      return await tx.user.findUnique({
        where: { id: user.id },
        include: {
          broker: true,
          ownedAgency: true,
        },
      })
    })

    return NextResponse.json({
      profile: buildAgencyProfile(updated),
    })
  } catch (caughtError) {
    console.error("[api][agencies][me] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de conta está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar a conta da imobiliária." }, { status: 500 })
  }
}
