import path from "node:path"

import { NextRequest, NextResponse } from "next/server"

import {
  getAuthenticatedUser,
  isPrismaSchemaMismatch,
  isPrismaUnavailable,
} from "@/lib/auth-route"
import { studioUnavailableResponse } from "@/lib/studio-api-errors"
import {
  escapeXml,
  renderStudioCreativeLayers,
  STUDIO_FONT_ASCENT_RATIO,
  STUDIO_FONT_ASSETS,
} from "@/lib/studio-creative-renderer"
import type { StudioCreativeBranding, StudioTextRun } from "@/lib/studio-creative-renderer"
import { createStudioTextMeasurer } from "@/lib/studio-text-metrics.server"
import { getStudioCampaignById } from "@/lib/studio-campaigns"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

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

    const sharp = (await import("sharp")).default

    const [propertyImageDataUri, brokerPhotoDataUri, brokerLogoDataUri, agencyLogoDataUri] = await Promise.all([
      toPropertyImageDataUri(
        sharp,
        getPropertyImageCandidates(campaign.metadata, campaign.property?.imageUrls ?? []),
        request.nextUrl.origin,
      ),
      toAvatarDataUri(sharp, campaign.branding.brokerPhotoUrl),
      toAvatarDataUri(sharp, campaign.branding.brokerLogoUrl),
      toAvatarDataUri(sharp, campaign.branding.agencyLogoUrl),
    ])
    const branding: StudioCreativeBranding = {
      brokerName: campaign.branding.brokerName,
      brokerPhotoDataUri,
      brokerCreci: campaign.branding.brokerCreci,
      catalogUrl: campaign.branding.catalogUrl,
      brokerLogoDataUri,
      agencyName: campaign.branding.agencyName,
      agencyLogoDataUri,
      accentColor: campaign.branding.accentColor,
      showAgencyWatermark: campaign.branding.showAgencyWatermark,
    }

    const measure = createStudioTextMeasurer(sharp)
    const layers = await renderStudioCreativeLayers(campaign, asset, branding, propertyImageDataUri, measure)
    if (!layers) {
      return NextResponse.json({ error: "Este asset nao possui renderizacao visual oficial." }, { status: 404 })
    }

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
      return studioUnavailableResponse()
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json({ error: "O serviço do Studio IA está indisponível no momento." }, { status: 503 })
    }

    console.error("[api][studio-ia][campaigns][render] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
      stack: caughtError instanceof Error ? caughtError.stack : undefined,
    })

    return NextResponse.json({ error: "Nao foi possivel renderizar o criativo do Studio IA." }, { status: 500 })
  }
}

// Broker photos and agency logos are stored either as a base64 data URL straight on the
// User/Agency row (the account-settings upload flow — see components/broker-account-page.tsx /
// agency-account-page.tsx) or, for property photos, as a real remote Supabase Storage URL — this
// covers both without the caller needing to know which one it's dealing with.
const PROPERTY_RENDER_SOURCE_MAX_BYTES = 25 * 1024 * 1024
const PROPERTY_RENDER_MAX_DIMENSION = 2560

function getPropertyImageCandidates(metadata: unknown, propertyImages: string[]) {
  const campaignMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
  const selectedImage = typeof campaignMetadata.propertyImageUrl === "string"
    ? campaignMetadata.propertyImageUrl
    : null

  return Array.from(new Set([selectedImage, ...propertyImages]
    .map((image) => image?.trim())
    .filter((image): image is string => Boolean(image))
    .filter((image) => !image.toLowerCase().includes("placeholder"))))
}

async function readPropertyImageBuffer(imageUrl: string, appOrigin: string) {
  if (imageUrl.startsWith("data:")) {
    const commaIndex = imageUrl.indexOf(",")
    if (commaIndex < 0 || !/;base64$/i.test(imageUrl.slice(0, commaIndex))) return null
    const buffer = Buffer.from(imageUrl.slice(commaIndex + 1), "base64")
    return buffer.byteLength > 0 && buffer.byteLength <= PROPERTY_RENDER_SOURCE_MAX_BYTES ? buffer : null
  }

  let resolvedUrl: string
  try {
    resolvedUrl = new URL(imageUrl, appOrigin).toString()
  } catch {
    return null
  }

  try {
    const response = await fetch(resolvedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return null

    const contentLength = Number(response.headers.get("content-length") || 0)
    if (contentLength > PROPERTY_RENDER_SOURCE_MAX_BYTES) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    return buffer.byteLength > 0 && buffer.byteLength <= PROPERTY_RENDER_SOURCE_MAX_BYTES ? buffer : null
  } catch {
    return null
  }
}

// librsvg does not reliably decode embedded WebP data URIs. Decode and re-encode each property
// photo as PNG, falling through to the next candidate when an imported remote URL is unavailable.
async function toPropertyImageDataUri(
  sharp: SharpFactory,
  imageUrls: string[],
  appOrigin: string,
) {
  for (const imageUrl of imageUrls) {
    const inputBuffer = await readPropertyImageBuffer(imageUrl, appOrigin)
    if (!inputBuffer) continue

    try {
      const pngBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({
          width: PROPERTY_RENDER_MAX_DIMENSION,
          height: PROPERTY_RENDER_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer()
      if (!pngBuffer.length) continue
      return `data:image/png;base64,${pngBuffer.toString("base64")}`
    } catch {
      continue
    }
  }

  return null
}

// Broker photo / agency logo need to render inside the server-side SVG creative regardless of
// what format they were originally uploaded/stored in — librsvg here has no WebP/AVIF decoder for
// embedded data URIs (confirmed: a broker photo stored as data:image/webp rendered as a blank box
// with no error anywhere, while an identically-sourced JPEG rendered fine). Re-encoding through
// sharp to a fixed PNG guarantees this always works regardless of source format. `fit: "inside"`
// (not "cover") preserves the original aspect ratio instead of force-cropping to a square — the
// broker avatar is drawn inside a circle via `preserveAspectRatio="slice"` in the SVG itself, and
// an agency logo is very often a wide wordmark, so a pre-crop here would clip it before it ever
// reaches the "meet" (contain) placement the footer watermark box already uses. The resize also
// doubles as a downscale: these only ever draw at ~100px, so there's no reason to embed a
// multi-megapixel original in the SVG payload.
const AVATAR_MAX_DIMENSION = 240

async function toAvatarDataUri(sharp: SharpFactory, imageUrl: string | null | undefined) {
  const normalized = imageUrl?.trim()
  if (!normalized) return null

  try {
    let inputBuffer: Buffer

    if (normalized.startsWith("data:")) {
      inputBuffer = Buffer.from(normalized.slice(normalized.indexOf(",") + 1), "base64")
    } else {
      const response = await fetch(normalized, { cache: "no-store" })
      if (!response.ok) return null
      inputBuffer = Buffer.from(await response.arrayBuffer())
    }

    if (!inputBuffer.length) return null

    const pngBuffer = await sharp(inputBuffer)
      .resize({ width: AVATAR_MAX_DIMENSION, height: AVATAR_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer()

    return `data:image/png;base64,${pngBuffer.toString("base64")}`
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
  italic: boolean
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
      const styleAttr = line.italic ? ` style="italic"` : ""
      const markup = `<span foreground="${escapeXml(line.color)}" size="${Math.round(fontSizePx * 1024)}"${letterSpacingAttr}${styleAttr}>${escapeXml(line.text)}</span>`

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
      italic: run.italic ?? false,
    }))
}

function resolveTextLeft(anchor: StudioTextRun["anchor"], x: number, width: number) {
  if (anchor === "middle") return x - width / 2
  if (anchor === "end") return x - width
  return x
}
