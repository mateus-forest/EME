import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { prisma } from "@/lib/prisma"

function serializeAgencyCatalog(agency: {
  catalogSlug: string
  name: string
  logoUrl: string | null
  description: string | null
}) {
  return {
    settings: {
      slug: agency.catalogSlug,
      displayName: agency.name,
      logoUrl: agency.logoUrl ?? "",
      description: agency.description ?? "",
    },
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliaria nao encontrada para esta conta." }, { status: 404 })
  }

  return NextResponse.json(serializeAgencyCatalog(user.ownedAgency))
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.AGENCY])
  if (forbidden) return forbidden

  if (!user.ownedAgency) {
    return NextResponse.json({ error: "Imobiliaria nao encontrada para esta conta." }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => null)
    const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
    const logoUrl = typeof data.logoUrl === "string" ? data.logoUrl.trim() : user.ownedAgency.logoUrl ?? ""
    const description = typeof data.description === "string" ? data.description.trim() : user.ownedAgency.description ?? ""

    if (logoUrl.length > 500_000) {
      return NextResponse.json({ error: "Logo muito grande para salvar no perfil da imobiliaria." }, { status: 400 })
    }

    if (description.length > 600) {
      return NextResponse.json({ error: "Descricao institucional deve ter no maximo 600 caracteres." }, { status: 400 })
    }

    const agency = await prisma.agency.update({
      where: {
        id: user.ownedAgency.id,
      },
      data: {
        logoUrl: logoUrl || null,
        description: description || null,
      },
    })

    return NextResponse.json(serializeAgencyCatalog(agency))
  } catch (caughtError) {
    console.error("[api][agencies][catalog] update failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "Servico de catalogo indisponivel no momento. Verifique a conexao com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao atualizar catalogo da imobiliaria." }, { status: 500 })
  }
}
