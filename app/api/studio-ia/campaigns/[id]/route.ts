import { NextRequest, NextResponse } from "next/server"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
} from "@/lib/auth-route"
import { studioUnavailableResponse } from "@/lib/studio-api-errors"
import { approveStudioCampaign, getStudioCampaignById } from "@/lib/studio-campaigns"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const campaign = await getStudioCampaignById(user, id)
    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 })
    }

    return NextResponse.json({ campaign })
  } catch (caughtError) {
    if (isPrismaSchemaMismatch(caughtError)) {
      return studioUnavailableResponse()
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Studio IA está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível carregar a campanha." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const action = typeof body?.action === "string" ? body.action.trim() : "approve"
  if (action !== "approve") {
    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 })
  }

  try {
    const { id } = await context.params
    const campaign = await approveStudioCampaign(user, id)
    return NextResponse.json({ campaign })
  } catch (caughtError) {
    if (caughtError instanceof Error && caughtError.message === "STUDIO_CAMPAIGN_NOT_FOUND") {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 })
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return studioUnavailableResponse()
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Studio IA está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível aprovar a campanha." }, { status: 500 })
  }
}
