import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { UserRole } from "@/lib/prisma-enums"
import { prisma } from "@/lib/prisma"
import {
  deleteBrokerCatalogStorageFile,
  saveBrokerCatalogBanner,
  saveBrokerCatalogVideo,
} from "@/lib/property-storage"

const BANNER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"])
// Keep multipart requests below Vercel's Function body limit. Larger videos
// remain supported through the public HTTPS URL field in Portal > Catálogo.
const MAX_BANNER_BYTES = 4 * 1024 * 1024
const MAX_VIDEO_BYTES = 4 * 1024 * 1024

type MediaKind = "banner" | "video"

function isMediaKind(value: unknown): value is MediaKind {
  return value === "banner" || value === "video"
}

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  let uploadedUrl = ""
  try {
    const formData = await request.formData().catch(() => null)
    const kind = formData?.get("kind")
    const file = formData?.get("file")
    if (!isMediaKind(kind) || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Envie um arquivo válido para o catálogo." }, { status: 400 })
    }

    const allowedTypes = kind === "banner" ? BANNER_TYPES : VIDEO_TYPES
    const maximumBytes = kind === "banner" ? MAX_BANNER_BYTES : MAX_VIDEO_BYTES
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({
        error: kind === "banner"
          ? "Use uma imagem JPG, PNG ou WebP."
          : "Use um vídeo MP4, WebM ou MOV.",
      }, { status: 400 })
    }
    if (file.size > maximumBytes) {
      return NextResponse.json({
        error: `O arquivo excede o limite de ${Math.round(maximumBytes / 1024 / 1024)} MB.`,
      }, { status: 400 })
    }

    uploadedUrl = kind === "banner"
      ? await saveBrokerCatalogBanner(user.broker.id, file)
      : await saveBrokerCatalogVideo(user.broker.id, file)
    const previousUrl = kind === "banner" ? user.broker.catalogBannerUrl : user.broker.catalogVideoUrl

    await prisma.broker.update({
      where: { id: user.broker.id },
      data: kind === "banner" ? { catalogBannerUrl: uploadedUrl } : { catalogVideoUrl: uploadedUrl },
    })
    if (previousUrl && previousUrl !== uploadedUrl) {
      await deleteBrokerCatalogStorageFile(user.broker.id, previousUrl)
    }

    const response = NextResponse.json({ kind, mediaUrl: uploadedUrl }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caught) {
    if (uploadedUrl) await deleteBrokerCatalogStorageFile(user.broker.id, uploadedUrl)
    if (isPrismaUnavailable(caught)) {
      return NextResponse.json({ error: "O serviço de catálogo está indisponível." }, { status: 503 })
    }
    console.error("[api][brokers][catalog][media] upload failed", {
      message: caught instanceof Error ? caught.message : "unknown",
    })
    return NextResponse.json({ error: "Não foi possível enviar o arquivo." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  const forbidden = ensureRole(user.role, [UserRole.BROKER])
  if (forbidden) return forbidden
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  try {
    const kind = request.nextUrl.searchParams.get("kind")
    if (!isMediaKind(kind)) {
      return NextResponse.json({ error: "Tipo de mídia inválido." }, { status: 400 })
    }
    const previousUrl = kind === "banner" ? user.broker.catalogBannerUrl : user.broker.catalogVideoUrl
    await prisma.broker.update({
      where: { id: user.broker.id },
      data: kind === "banner" ? { catalogBannerUrl: null } : { catalogVideoUrl: null },
    })
    if (previousUrl) await deleteBrokerCatalogStorageFile(user.broker.id, previousUrl)

    const response = NextResponse.json({ kind, mediaUrl: "" })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caught) {
    if (isPrismaUnavailable(caught)) {
      return NextResponse.json({ error: "O serviço de catálogo está indisponível." }, { status: 503 })
    }
    console.error("[api][brokers][catalog][media] removal failed", {
      message: caught instanceof Error ? caught.message : "unknown",
    })
    return NextResponse.json({ error: "Não foi possível remover o arquivo." }, { status: 500 })
  }
}
