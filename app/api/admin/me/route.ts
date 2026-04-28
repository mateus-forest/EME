import { compare, hash } from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"
import { UserRole, type User } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

function buildAdminProfile(user: Pick<User, "id" | "name" | "email" | "phone"> | null) {
  if (!user) return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  return NextResponse.json({ profile: buildAdminProfile(user) })
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.ADMIN])
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const phone = typeof body?.phone === "string" ? body.phone.trim() : ""
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!name || !email || !phone) {
      return NextResponse.json({ error: "Nome, email e telefone são obrigatórios." }, { status: 400 })
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

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        email,
        phone,
        ...(passwordHash ? { passwordHash } : {}),
      },
    })

    return NextResponse.json({
      profile: buildAdminProfile(updatedUser),
    })
  } catch (caughtError) {
    console.error("[api][admin][me] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de conta está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar a conta administrativa." }, { status: 500 })
  }
}
