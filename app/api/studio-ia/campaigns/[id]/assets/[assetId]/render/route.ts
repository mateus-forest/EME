import { readFile } from "node:fs/promises"
import path from "node:path"

import { NextRequest, NextResponse } from "next/server"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
  prismaSchemaMismatchResponse,
} from "@/lib/auth-route"
import {
  escapeXml,
  getOfficialStudioLogoPath,
  renderStudioCreativeLayers,
  STUDIO_FONT_ASCENT_RATIO,
  STUDIO_FONT_ASSETS,
} from "@/lib/studio-creative-renderer"
import type { StudioTextRun } from "@/lib/studio-creative-renderer"
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
    const layers = renderStudioCreativeLayers(campaign, asset, await getOfficialStudioLogoDataUri(), propertyImageDataUri)
    if (!layers) {
      return NextResponse.json({ error: "Este asset nao possui renderizacao visual oficial." }, { status: 404 })
    }

    const sharp = (await import("sharp")).default
    const pngBuffer = await renderStudioCreativePng(sharp, layers.svg, layers.textRuns)
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

type SharpFactory = typeof import("sharp")

type StudioTextLine = {
  text: string
  x: number
  y: number
  fontSize: number
  fontWeight: StudioTextRun["fontWeight"]
  color: string
  letterSpacingEm: number
  anchor: StudioTextRun["anchor"]
}

// Rasterization density for the background SVG. librsvg treats the unitless width/height on
// the root <svg> (e.g. 1080) as being at the default 72dpi, so rendering at 216dpi scales the
// actual output bitmap to 3x those nominal dimensions (3240px for a "1080" feed creative). Text
// layers are composited in that same final pixel space, so every text coordinate below is scaled
// by DENSITY_SCALE to match — using the nominal payload coordinates directly would place text at
// roughly a third of its intended position and size.
const STUDIO_RENDER_DENSITY = 216
const DENSITY_SCALE = STUDIO_RENDER_DENSITY / 72

// The background (gradients, badge shapes, icons, property photo) is still one SVG rasterized
// by sharp/librsvg, same as before. Text is rasterized separately, one line at a time, via
// sharp's native text renderer pointed at the embedded Geist font file (see
// lib/studio-creative-renderer.ts for why: librsvg in this environment doesn't honor @font-face
// or FONTCONFIG_FILE overrides, so a font-family string in the SVG can silently fall back to
// whatever font happens to be installed on the host, or nothing at all in production), then
// composited on top in a single pass.
async function renderStudioCreativePng(sharp: SharpFactory, svg: string, textRuns: StudioTextRun[]) {
  const lines = textRuns.flatMap(flattenTextRun)

  const composites = await Promise.all(
    lines.map(async (line) => {
      const fontAsset = STUDIO_FONT_ASSETS[line.fontWeight]
      const fontfile = path.join(process.cwd(), "public", "fonts", "geist", fontAsset.file)
      const fontSizePx = line.fontSize * DENSITY_SCALE
      const xPx = line.x * DENSITY_SCALE
      const yPx = line.y * DENSITY_SCALE
      const letterSpacingAttr = line.letterSpacingEm
        ? ` letter_spacing="${Math.round(line.letterSpacingEm * fontSizePx * 1024)}"`
        : ""
      const markup = `<span foreground="${escapeXml(line.color)}" size="${Math.round(fontSizePx * 1024)}"${letterSpacingAttr}>${escapeXml(line.text)}</span>`

      const buffer = await sharp({
        text: {
          text: markup,
          font: fontAsset.family,
          fontfile,
          rgba: true,
          dpi: 72,
        },
      })
        .png()
        .toBuffer()

      const { width, height } = await sharp(buffer).metadata()
      const left = Math.round(resolveTextLeft(line.anchor, xPx, width ?? 0))
      const top = Math.round(yPx - fontSizePx * STUDIO_FONT_ASCENT_RATIO)

      return { input: buffer, left, top, width: width ?? 0, height: height ?? 0 }
    }),
  )

  const validComposites = composites
    .filter((composite) => composite.width > 0 && composite.height > 0)
    .map(({ input, left, top }) => ({ input, left, top }))

  return sharp(Buffer.from(svg), { density: STUDIO_RENDER_DENSITY })
    .composite(validComposites)
    .png()
    .toBuffer()
}

function flattenTextRun(run: StudioTextRun): StudioTextLine[] {
  return run.lines
    .filter(Boolean)
    .map((text, index) => ({
      text,
      x: run.x,
      y: run.y + index * run.lineHeight,
      fontSize: run.fontSize,
      fontWeight: run.fontWeight,
      color: run.color,
      letterSpacingEm: run.letterSpacingEm,
      anchor: run.anchor,
    }))
}

function resolveTextLeft(anchor: StudioTextRun["anchor"], x: number, width: number) {
  if (anchor === "middle") return x - width / 2
  if (anchor === "end") return x - width
  return x
}
