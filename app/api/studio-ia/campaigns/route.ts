import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { listStudioCampaigns, getLatestStudioCampaign, type StudioCampaignKind } from "@/lib/studio-campaigns"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

function readKind(value: string | null): StudioCampaignKind | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  return ["INSTAGRAM", "BUYERS", "OWNERS", "SELL_PROPERTY", "CONSTRUCTION", "VIDEO"].includes(normalized)
    ? (normalized as StudioCampaignKind)
    : undefined
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso nao permitido para este perfil." }, { status: 403 })
  }

  const kind = readKind(request.nextUrl.searchParams.get("kind"))
  const propertyId = request.nextUrl.searchParams.get("propertyId")?.trim() || null
  const latest = request.nextUrl.searchParams.get("latest") === "1"
  const limit = Number(request.nextUrl.searchParams.get("limit") || 30)

  if (latest && kind) {
    const campaign = await getLatestStudioCampaign(user, { kind, propertyId })
    return NextResponse.json({ campaign })
  }

  const campaigns = await listStudioCampaigns(user, {
    kind,
    propertyId,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 30,
  })

  return NextResponse.json({ campaigns })
}
