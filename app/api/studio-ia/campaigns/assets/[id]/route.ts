import { NextRequest, NextResponse } from "next/server"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import {
  deleteStudioCampaignAsset,
  updateStudioCampaignAssetContent,
  updateStudioCampaignAssetStatus,
  type StudioCampaignAssetStatus,
} from "@/lib/studio-campaigns"
import { UserRole } from "@/lib/prisma-enums"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function readStatus(value: unknown): StudioCampaignAssetStatus | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toUpperCase()
  return ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "PUBLISHED", "FAILED"].includes(normalized)
    ? (normalized as StudioCampaignAssetStatus)
    : null
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
  const status = readStatus(body?.status)

  try {
    const { id } = await context.params

    if (status) {
      const campaign = await updateStudioCampaignAssetStatus(user, id, status)
      return NextResponse.json({ campaign })
    }

    if (body && Object.prototype.hasOwnProperty.call(body, "content")) {
      const content = body.content as Prisma.InputJsonValue | string
      const campaign = await updateStudioCampaignAssetContent(user, id, content)
      return NextResponse.json({ campaign })
    }

    return NextResponse.json({ error: "Nenhuma alteracao valida foi informada." }, { status: 400 })
  } catch (caughtError) {
    if (caughtError instanceof Error && caughtError.message === "STUDIO_CAMPAIGN_ASSET_NOT_FOUND") {
      return NextResponse.json({ error: "Asset nao encontrado." }, { status: 404 })
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Studio IA / asset de campanha")
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Studio IA está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel atualizar o asset." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const campaign = await deleteStudioCampaignAsset(user, id)
    return NextResponse.json({ campaign })
  } catch (caughtError) {
    if (caughtError instanceof Error && caughtError.message === "STUDIO_CAMPAIGN_ASSET_NOT_FOUND") {
      return NextResponse.json({ error: "Asset nao encontrado." }, { status: 404 })
    }

    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Studio IA / exclusao de asset")
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Studio IA está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel excluir o asset." }, { status: 500 })
  }
}
