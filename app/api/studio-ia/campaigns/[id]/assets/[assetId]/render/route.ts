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
  _request: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso nao permitido para este perfil." }, { status: 403 })
  }

  try {
    const { id, assetId } = (await params) as { id: string; assetId: string }
    const campaign = await getStudioCampaignById(user, id)

    if (!campaign) {
      return NextResponse.json({ error: "Campanha nao encontrada." }, { status: 404 })
    }

    const asset = campaign.assets.find((item) => item.id === assetId)
    if (!asset) {
      return NextResponse.json({ error: "Asset nao encontrado." }, { status: 404 })
    }

    const svg = renderStudioCreativeSvg(campaign, asset, await getOfficialStudioLogoDataUri())
    if (!svg) {
      return NextResponse.json({ error: "Este asset nao possui renderizacao visual oficial." }, { status: 404 })
    }

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (caughtError) {
    if (isPrismaSchemaMismatch(caughtError)) {
      return prismaSchemaMismatchResponse("Studio IA / renderizacao de campanha")
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O servico do Studio IA esta indisponivel no momento." }, { status: 503 })
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
