import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"
import {
  getLatestStudioCampaign,
  listStudioCampaigns,
  type StudioCampaignAssetType,
  type StudioCampaignKind,
  type StudioCampaignStatus,
} from "@/lib/studio-campaigns"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

function readKind(value: string | null): StudioCampaignKind | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  return ["INSTAGRAM", "BUYERS", "OWNERS", "SELL_PROPERTY", "CONSTRUCTION", "VIDEO"].includes(normalized)
    ? (normalized as StudioCampaignKind)
    : undefined
}

function readStatus(value: string | null): StudioCampaignStatus | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  return ["DRAFT", "PROCESSING", "PENDING_REVIEW", "APPROVED", "REJECTED", "PUBLISHED", "FAILED"].includes(normalized)
    ? (normalized as StudioCampaignStatus)
    : undefined
}

function readAssetType(value: string | null): StudioCampaignAssetType | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  return ["IMAGE", "VIDEO", "CAROUSEL", "STORY", "REEL", "COPY", "THUMBNAIL"].includes(normalized)
    ? (normalized as StudioCampaignAssetType)
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
  const status = readStatus(request.nextUrl.searchParams.get("status"))
  const assetType = readAssetType(request.nextUrl.searchParams.get("assetType"))
  const propertyId = request.nextUrl.searchParams.get("propertyId")?.trim() || null
  const query = request.nextUrl.searchParams.get("q")?.trim() || null
  const latest = request.nextUrl.searchParams.get("latest") === "1"
  const page = Number(request.nextUrl.searchParams.get("page") || 1)
  const limit = Number(request.nextUrl.searchParams.get("limit") || 30)

  if (latest && kind) {
    const campaign = await getLatestStudioCampaign(user, { kind, propertyId })
    return NextResponse.json({ campaign })
  }

  const result = await listStudioCampaigns(user, {
    kind,
    status,
    assetType,
    query,
    propertyId,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 30,
  })

  return NextResponse.json(result)
}
