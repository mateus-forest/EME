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

function buildDescription(name: string, description: string) {
  const normalizedDescription = description.trim()
  if (normalizedDescription) return normalizedDescription
  return `Confira os imoveis publicados por ${name}.`
}

function buildOgImageElement(input: {
  brokerName: string
  brokerDescription: string
  brokerPhoto: string | null
  brokerInitials: string
}) {
  const { brokerName, brokerDescription, brokerPhoto, brokerInitials } = input

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
      background:
        "radial-gradient(circle at top left, rgba(0,155,58,0.14), transparent 30%), radial-gradient(circle at bottom right, rgba(0,155,58,0.12), transparent 32%), linear-gradient(135deg, #f7f4ee 0%, #fcfcfa 48%, #f5fbf6 100%)",
      color: "#050505",
      padding: 42,
      fontFamily: "sans-serif",
    },
    div(
      {
        width: "100%",
        height: "100%",
        display: "flex",
        borderRadius: 36,
        overflow: "hidden",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 26px 80px rgba(15,23,42,0.12)",
        border: "1px solid rgba(15,23,42,0.06)",
      },
      div(
        {
          width: 660,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px 54px 48px 54px",
        },
        div(
          {
            display: "flex",
            flexDirection: "column",
            gap: 26,
          },
          div(
            {
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(0,155,58,0.08)",
              color: "#009b3a",
              fontSize: 24,
              fontWeight: 700,
              width: "fit-content",
            },
            text("Catalogo de imoveis"),
          ),
          div(
            {
              display: "flex",
              flexDirection: "column",
              gap: 12,
            },
            div(
              {
                fontSize: 64,
                lineHeight: 1.02,
                fontWeight: 800,
                letterSpacing: -2.2,
              },
              text(brokerName),
            ),
            div(
              {
                fontSize: 28,
                lineHeight: 1.45,
                color: "#5f6b7a",
                maxWidth: 520,
              },
              text(brokerDescription),
            ),
          ),
        ),
        div(
          {
            display: "flex",
            flexDirection: "column",
            gap: 18,
          },
          div(
            {
              display: "flex",
              alignItems: "center",
              gap: 12,
            },
            div({
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#00b447",
              display: "flex",
            }),
            div(
              {
                fontSize: 22,
                color: "#3d4a59",
              },
              text("Link compartilhavel com visual oficial do corretor"),
            ),
          ),
          div(
            {
              fontSize: 22,
              color: "#7b8491",
            },
            text("www.meueme.com"),
          ),
        ),
      ),
      div(
        {
          flex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background:
            "radial-gradient(circle at center, rgba(0,155,58,0.08), transparent 52%), linear-gradient(180deg, rgba(255,255,255,0.9), rgba(245,249,246,0.94))",
        },
        div({
          position: "absolute",
          inset: 42,
          borderRadius: 34,
          border: "1px solid rgba(0,155,58,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,250,248,0.86))",
          display: "flex",
        }),
        div(
          {
            position: "relative",
            width: 260,
            height: 260,
            borderRadius: 999,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: brokerPhoto
              ? "#edf4ef"
              : "linear-gradient(135deg, rgba(0,155,58,0.14), rgba(15,23,42,0.04))",
            border: "12px solid rgba(255,255,255,0.92)",
            boxShadow: "0 22px 50px rgba(15,23,42,0.16)",
          },
          photoNode,
        ),
        div(
          {
            position: "absolute",
            bottom: 86,
            right: 86,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15,23,42,0.06)",
            color: "#4b5563",
            fontSize: 18,
          },
          text("Foto oficial do perfil"),
        ),
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
  const brokerDescription = buildDescription(brokerName, broker?.description ?? "")
  const brokerPhoto = await resolveBrokerPhotoDataUrl(broker?.user.photoUrl ?? "")
  const brokerInitials = getInitials(brokerName)

  return new ImageResponse(
    buildOgImageElement({
      brokerName,
      brokerDescription,
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
