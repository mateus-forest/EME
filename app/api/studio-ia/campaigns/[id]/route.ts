import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { approveStudioCampaign, getStudioCampaignById } from "@/lib/studio-campaigns"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso nao permitido para este perfil." }, { status: 403 })
  }

  const { id } = await context.params
  const campaign = await getStudioCampaignById(user, id)
  if (!campaign) {
    return NextResponse.json({ error: "Campanha nao encontrada." }, { status: 404 })
  }

  return NextResponse.json({ campaign })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso nao permitido para este perfil." }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const action = typeof body?.action === "string" ? body.action.trim() : "approve"
  if (action !== "approve") {
    return NextResponse.json({ error: "Acao nao suportada." }, { status: 400 })
  }

  try {
    const { id } = await context.params
    const campaign = await approveStudioCampaign(user, id)
    return NextResponse.json({ campaign })
  } catch (error) {
    if (error instanceof Error && error.message === "STUDIO_CAMPAIGN_NOT_FOUND") {
      return NextResponse.json({ error: "Campanha nao encontrada." }, { status: 404 })
    }

    return NextResponse.json({ error: "Nao foi possivel aprovar a campanha." }, { status: 500 })
  }
}
