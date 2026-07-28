import React from "react"
import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type OgImageRouteContext = {
  params: Promise<{ slug: string }>
}

const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

function div(style: React.CSSProperties, ...children: React.ReactNode[]) {
  return React.createElement("div", { style }, ...children)
}

function text(value: string) {
  return value
}

async function remoteImageToDataUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" }).catch(() => null)
  if (!response?.ok) return null

  const contentType = response.headers.get("content-type")?.trim() || "image/jpeg"
  if (!contentType.startsWith("image/")) return null

  const arrayBuffer = await response.arrayBuffer()
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`
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
  brokerName: string
  brokerPhoto: string | null
  brokerInitials: string
}) {
  const { brokerName, brokerPhoto, brokerInitials } = input

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
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0.62) 38%, rgba(233,244,236,0.96) 100%)",
          color: "#0f8b3e",
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: -3,
        },
        text(brokerInitials),
      )

  return div(
    {
      width: "100%",
      height: "100%",
      display: "flex",
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      background:
        "radial-gradient(circle at 18% 22%, rgba(0,155,58,0.12), transparent 24%), radial-gradient(circle at 82% 78%, rgba(0,155,58,0.08), transparent 26%), linear-gradient(180deg, #ffffff 0%, #fbfdfb 100%)",
      color: "#050505",
      fontFamily: "sans-serif",
    },
    div(
      {
        width: 420,
        height: 420,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        overflow: "hidden",
        background: brokerPhoto
          ? "rgba(255,255,255,0.98)"
          : "linear-gradient(135deg, rgba(0,155,58,0.12), rgba(15,23,42,0.04))",
        border: "14px solid rgba(255,255,255,0.96)",
        boxShadow: "0 30px 90px rgba(15,23,42,0.14)",
      },
      photoNode,
    ),
    div(
      {
        position: "absolute",
        right: 42,
        bottom: 34,
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "rgba(15,23,42,0.42)",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: -0.4,
      },
      div({
        width: 12,
        height: 12,
        borderRadius: 999,
        background: "#009b3a",
        display: "flex",
      }),
      text("EME"),
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
  const brokerPhoto = await resolveBrokerPhotoDataUrl(broker?.user.photoUrl ?? "")
  const brokerInitials = getInitials(brokerName)

  return new ImageResponse(
    buildOgImageElement({
      brokerName,
      brokerPhoto,
      brokerInitials,
    }),
    {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    },
  )
}
