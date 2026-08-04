import { readFile } from "node:fs/promises"
import path from "node:path"

import { NextRequest, NextResponse } from "next/server"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import { getOfficialStudioLogoPath, renderStudioCreativeSvg } from "@/lib/studio-creative-renderer"
import { getStudioCampaignById } from "@/lib/studio-campaigns"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

let cachedLogoDataUriPromise: Promise<string> | null = null

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  try {
    const { id, assetId } = (await params) as { id: string; assetId: string }
    const campaign = await getStudioCampaignById(user, id)

    if (!campaign) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 })
    }

    const asset = campaign.assets.find((item) => item.id === assetId)
    if (!asset) {
      return NextResponse.json({ error: "Asset nao encontrado." }, { status: 404 })
    }

    const propertyImageDataUri = await getPropertyImageDataUri(campaign.property?.imageUrls?.[0])
    const svg = renderStudioCreativeSvg(campaign, asset, await getOfficialStudioLogoDataUri(), propertyImageDataUri)
    if (!svg) {
      return NextResponse.json({ error: "Este asset nao possui renderizacao visual oficial." }, { status: 404 })
    }

    const sharp = (await import("sharp")).default
    const pngBuffer = await sharp(Buffer.from(svg), { density: 216 })
      .png()
      .toBuffer()
    const shouldDownload = request.nextUrl.searchParams.get("download") === "1"

    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        ...(shouldDownload ? { "Content-Disposition": 'attachment; filename="studio-eme.png"' } : {}),
      },
    })
  } catch (caughtError) {
    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Studio IA / renderizacao de campanha")
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Studio IA está indisponível no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel renderizar o criativo do Studio IA." }, { status: 500 })
  }
}

async function getOfficialStudioLogoDataUri() {
  if (!cachedLogoDataUriPromise) {
    cachedLogoDataUriPromise = readFile(
      path.join(process.cwd(), "public", getOfficialStudioLogoPath().replace(/^\//, "")),
      "utf8",
    ).then((content) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`)
  }

  return cachedLogoDataUriPromise
}

async function getPropertyImageDataUri(imageUrl: string | null | undefined) {
  const normalized = imageUrl?.trim()
  if (!normalized) return null

  try {
    const response = await fetch(normalized, { cache: "no-store" })
    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length) return null

    return `data:${contentType};base64,${buffer.toString("base64")}`
  } catch {
    return null
  }
}
