import React from "react"
import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import { CATALOG_OG_IMAGE_HEIGHT, CATALOG_OG_IMAGE_WIDTH } from "@/lib/public-catalog-metadata"

export const dynamic = "force-dynamic"

type OgImageRouteContext = {
  params: Promise<{ slug: string }>
}

function div(style: React.CSSProperties, ...children: React.ReactNode[]) {
  return React.createElement("div", { style }, ...children)
}

function text(value: string) {
  return value
}

async function remoteImageToDataUrl(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal }).catch(() => null)
    if (!response?.ok) return null

    const contentType = response.headers.get("content-type")?.trim() || "image/jpeg"
    if (!contentType.startsWith("image/")) return null

    const arrayBuffer = await response.arrayBuffer()
    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`
  } finally {
    clearTimeout(timeout)
  }
}

async function resolveBrokerPhotoDataUrl(photoUrl: string) {
  const normalized = photoUrl.trim()
  if (!normalized) return null

  if (normalized.startsWith("data:image/")) {
    return normalized
  }

  if (/^https?:\/\//i.test(normalized)) {
    return remoteImageToDataUrl(normalized)
  }

  return null
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "EM"
  )
}

function buildOgImageElement(input: {
  title: string
  description: string
  brokerName: string
  brokerPhoto: string | null
  brokerInitials: string
}) {
  const { title, description, brokerName, brokerPhoto, brokerInitials } = input

  const photoNode = brokerPhoto
    ? React.createElement("img", {
        src: brokerPhoto,
        alt: brokerName,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          display: "flex",
        },
      })
    : div(
        {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.72) 38%, rgba(233,244,236,1) 100%)",
          color: "#0f8b3e",
          fontSize: 112,
          fontWeight: 800,
          letterSpacing: -4,
        },
        text(brokerInitials),
      )

  return div(
    {
      width: "100%",
      height: "100%",
      display: "flex",
      background: "#ffffff",
      color: "#050505",
      fontFamily: "sans-serif",
    },
    div(
      {
        width: "48%",
        height: "100%",
        display: "flex",
        overflow: "hidden",
        background: brokerPhoto
          ? "#eef3ef"
          : "linear-gradient(135deg, rgba(0,155,58,0.16), rgba(15,23,42,0.05))",
      },
      photoNode,
    ),
    div(
      {
        width: "52%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "58px 60px",
        background:
          "radial-gradient(circle at 16% 18%, rgba(0,155,58,0.08), transparent 24%), linear-gradient(180deg, #ffffff 0%, #fbfdfb 100%)",
      },
      div(
        {
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#0f8b3e",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1.6,
          textTransform: "uppercase",
        },
        div({
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "#009b3a",
          display: "flex",
        }),
        text("EME"),
      ),
      div({
        width: 108,
        height: 4,
        marginTop: 28,
        borderRadius: 999,
        background: "#009b3a",
        display: "flex",
      }),
      React.createElement(
        "span",
        {
          style: {
            marginTop: 28,
            fontSize: 56,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: -2.2,
            color: "#050505",
            display: "flex",
          },
        },
        title,
      ),
      React.createElement(
        "span",
        {
          style: {
            marginTop: 18,
            fontSize: 26,
            lineHeight: 1.42,
            fontWeight: 500,
            color: "#5b6774",
            display: "flex",
          },
        },
        description,
      ),
      div(
        {
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 34,
          color: "#6b7280",
          fontSize: 24,
          fontWeight: 600,
        },
        div({
          width: 12,
          height: 12,
          borderRadius: 999,
          background: "#dce8df",
          display: "flex",
        }),
        text("www.meueme.com"),
      ),
    ),
  )
}

export async function GET(_request: NextRequest, { params }: OgImageRouteContext) {
  const { slug } = await params

  const broker = await prisma.broker.findFirst({
    where: { catalogSlug: slug },
    include: {
      user: {
        select: {
          name: true,
          photoUrl: true,
        },
      },
    },
  })

  const brokerName = broker?.user.name?.trim() || "EME"
  const description =
    broker?.catalogHeadline?.trim() ||
    broker?.description?.trim() ||
    "Encontre imoveis disponiveis, busque por bairro, valor ou estilo e fale diretamente com o corretor."
  const title = brokerName ? `Catalogo de imoveis | ${brokerName}` : "Catalogo de imoveis | EME"
  const brokerPhoto = await resolveBrokerPhotoDataUrl(broker?.user.photoUrl ?? "")
  const brokerInitials = getInitials(brokerName)

  return new ImageResponse(
    buildOgImageElement({
      title,
      description,
      brokerName,
      brokerPhoto,
      brokerInitials,
    }),
    {
      width: CATALOG_OG_IMAGE_WIDTH,
      height: CATALOG_OG_IMAGE_HEIGHT,
      headers: {
        // A URL inclui ?v=<hash da composicao>, entao um cache publico e seguro aqui:
        // qualquer troca de foto, titulo, descricao ou renderer gera uma URL nova. Isso garante
        // que crawlers recebam sempre os mesmos bytes para a mesma versao, em vez de arriscar uma
        // nova geracao (e uma eventual falha/timeout no fetch da foto remota) a cada crawl.
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  )
}
