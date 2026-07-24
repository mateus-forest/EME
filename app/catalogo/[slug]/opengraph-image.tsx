import { readFile } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

import {
  getBrokerCatalogPreferredVisualSource,
  getBrokerCatalogTitle,
  PREMIUM_FALLBACK_IMAGE_PATH,
} from "@/lib/public-catalog-metadata"
import { getPublicBrokerCatalogPageState } from "@/lib/public-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const contentType = "image/png"
export const size = {
  width: 1200,
  height: 630,
}

type OpenGraphImageProps = {
  params: Promise<{
    slug: string
  }>
}

async function fileToDataUrl(relativePath: string) {
  const filePath = path.join(process.cwd(), "public", relativePath.replace(/^\/+/, ""))
  const buffer = await readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()
  const mimeType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png"
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

async function fetchToDataUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" }).catch(() => null)
  if (!response?.ok) return ""

  const contentTypeHeader = response.headers.get("content-type") || "image/png"
  const arrayBuffer = await response.arrayBuffer()
  return `data:${contentTypeHeader};base64,${Buffer.from(arrayBuffer).toString("base64")}`
}

async function resolveImageDataUrl(source: string, fallbackDataUrl: string) {
  if (!source) return fallbackDataUrl
  if (source.startsWith("data:image/")) return source
  if (/^https?:\/\//i.test(source)) {
    return (await fetchToDataUrl(source)) || fallbackDataUrl
  }
  if (source.startsWith("/")) {
    return fileToDataUrl(source)
  }

  return fallbackDataUrl
}

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { slug } = await params
  const fallbackImageDataUrl = await fileToDataUrl(PREMIUM_FALLBACK_IMAGE_PATH)
  const emeLogoDataUrl = await fileToDataUrl("/images/eme-logo-official.png")
  const state = slug ? await getPublicBrokerCatalogPageState(slug) : null
  const catalog = state?.status === "ready" ? state.catalog : null
  const selectedImageSource = getBrokerCatalogPreferredVisualSource(catalog)
  const selectedImageDataUrl = await resolveImageDataUrl(selectedImageSource, fallbackImageDataUrl)
  const title = getBrokerCatalogTitle(catalog)
  const description =
    catalog?.description?.trim() || "Selecao publica de imoveis com atendimento direto pelo corretor."
  const displayName = catalog?.displayName?.trim() || "EME"

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #f8f5ef 0%, #f3efe7 52%, #ebe5da 100%)",
          color: "#111111",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top right, rgba(0, 200, 83, 0.14), transparent 28%), radial-gradient(circle at bottom left, rgba(17, 24, 39, 0.08), transparent 30%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 48,
            right: 52,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 18px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.86)",
            boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
          }}
        >
          <img
            src={emeLogoDataUrl}
            alt="EME"
            width={44}
            height={44}
            style={{ objectFit: "contain" }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 13,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#6b7280",
              }}
            >
              EME
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              Compartilhamento premium
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            padding: "56px 56px 48px 56px",
            gap: 28,
          }}
        >
          <div
            style={{
              width: 360,
              display: "flex",
              flexDirection: "column",
              borderRadius: 34,
              overflow: "hidden",
              background: "rgba(255,255,255,0.88)",
              boxShadow: "0 22px 60px rgba(15,23,42,0.12)",
              border: "1px solid rgba(17,24,39,0.06)",
            }}
          >
            <div
              style={{
                height: 410,
                width: "100%",
                display: "flex",
                background: "#e8ece7",
              }}
            >
              <img
                src={selectedImageDataUrl}
                alt={displayName}
                width={360}
                height={410}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "22px 24px",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "#6b7280",
                }}
              >
                Catalogo de imoveis
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {displayName}
              </span>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              paddingTop: 64,
              paddingBottom: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 22,
                maxWidth: 660,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  letterSpacing: "0.36em",
                  textTransform: "uppercase",
                  color: "#6b7280",
                }}
              >
                Catalogo de imoveis
              </span>
                <h1
                  style={{
                    margin: 0,
                  fontSize: 64,
                  lineHeight: 1,
                  letterSpacing: "-0.05em",
                  color: "#101418",
                }}
              >
                {displayName}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 28,
                  lineHeight: 1.38,
                  color: "#46515f",
                }}
              >
                {description.length > 180 ? `${description.slice(0, 177)}...` : description}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#6b7280",
                  }}
                >
                  Compartilhe com seus clientes
                </span>
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Atendimento direto, vitrine elegante e link publico
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  minWidth: 196,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  padding: "20px 26px",
                  background: "#111111",
                  color: "#ffffff",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                EME
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
