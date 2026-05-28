import { readFile } from "node:fs/promises"
import path from "node:path"

import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type OgImageRouteContext = {
  params: Promise<{ slug: string }>
}

function dataUrlToResponse(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=3600",
    },
  })
}

async function fallbackLogoResponse() {
  const logo = await readFile(path.join(process.cwd(), "public", "images", "eme-logo.png"))
  return new NextResponse(logo, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

export async function GET(_request: NextRequest, { params }: OgImageRouteContext) {
  const { slug } = await params
  const broker = await prisma.broker.findFirst({
    where: { catalogSlug: slug },
    include: { user: { select: { photoUrl: true } } },
  })

  const photoUrl = broker?.user.photoUrl?.trim() ?? ""
  if (/^https?:\/\//i.test(photoUrl)) {
    return NextResponse.redirect(photoUrl)
  }

  if (photoUrl.startsWith("data:image/")) {
    const response = dataUrlToResponse(photoUrl)
    if (response) return response
  }

  return fallbackLogoResponse()
}
