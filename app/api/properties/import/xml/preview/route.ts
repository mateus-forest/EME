import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { mapXmlPropertyToAdImportDraft } from "@/lib/property-ad-import"
import { parsePropertiesXml, XML_IMPORT_MAX_BYTES } from "@/lib/property-xml-import"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

async function resolveXmlInput(formData: FormData) {
  const file = formData.get("file")
  const sourceUrl = typeof formData.get("sourceUrl") === "string" ? String(formData.get("sourceUrl")).trim() : ""

  if (file instanceof File) {
    const isXml = file.name.toLowerCase().endsWith(".xml") || ["text/xml", "application/xml"].includes(file.type)

    if (!isXml) {
      throw new Error("XML_FILE_INVALID_TYPE")
    }

    if (file.size > XML_IMPORT_MAX_BYTES) {
      throw new Error("XML_TOO_LARGE")
    }

    return await file.text()
  }

  if (!sourceUrl) {
    throw new Error("XML_MISSING_INPUT")
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(sourceUrl)
  } catch {
    throw new Error("XML_SOURCE_URL_INVALID")
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    throw new Error("XML_SOURCE_URL_INVALID")
  }

  const response = await fetch(parsedUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; EME XML Import/1.0)",
      Accept: "application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8",
    },
  }).catch(() => null)

  if (!response) {
    throw new Error("XML_SOURCE_URL_UNREACHABLE")
  }

  if ([401, 403, 429].includes(response.status)) {
    throw new Error("XML_SOURCE_URL_BLOCKED")
  }

  if (!response.ok) {
    throw new Error("XML_SOURCE_URL_FETCH_FAILED")
  }

  const xml = await response.text()
  if (Buffer.byteLength(xml, "utf8") > XML_IMPORT_MAX_BYTES) {
    throw new Error("XML_TOO_LARGE")
  }

  return xml
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    const formData = await request.formData()
    const xml = await resolveXmlInput(formData)
    const properties = parsePropertiesXml(xml)

    if (properties.length === 0) {
      return NextResponse.json(
        { error: "Não encontramos imóveis válidos neste XML. Revise o arquivo e tente novamente." },
        { status: 400 },
      )
    }

    const response = NextResponse.json({
      properties,
      drafts: properties.map(mapXmlPropertyToAdImportDraft),
      summary: {
        total: properties.length,
        ready: properties.filter((property) => property.status === "ready").length,
        needsReview: properties.filter((property) => property.status === "needs_review").length,
        invalid: properties.filter((property) => property.status === "invalid").length,
      },
    })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][import][xml][preview] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (caughtError instanceof Error && caughtError.message === "XML_FILE_INVALID_TYPE") {
      return NextResponse.json({ error: "O arquivo precisa estar no formato XML." }, { status: 400 })
    }

    if (caughtError instanceof Error && caughtError.message === "XML_TOO_LARGE") {
      return NextResponse.json({ error: "O XML deve ter até 5 MB." }, { status: 400 })
    }

    if (caughtError instanceof Error && caughtError.message === "XML_MISSING_INPUT") {
      return NextResponse.json({ error: "Envie um arquivo XML ou informe a URL do XML para analisar." }, { status: 400 })
    }

    if (caughtError instanceof Error && caughtError.message === "XML_SOURCE_URL_INVALID") {
      return NextResponse.json({ error: "Informe uma URL válida para o XML." }, { status: 400 })
    }

    if (caughtError instanceof Error && caughtError.message === "XML_SOURCE_URL_BLOCKED") {
      return NextResponse.json(
        { error: "O servidor do XML bloqueou a leitura automática. Baixe o arquivo e envie o XML manualmente." },
        { status: 403 },
      )
    }

    if (caughtError instanceof Error && caughtError.message === "XML_SOURCE_URL_UNREACHABLE") {
      return NextResponse.json({ error: "Não foi possível acessar a URL do XML no momento." }, { status: 502 })
    }

    if (caughtError instanceof Error && caughtError.message === "XML_SOURCE_URL_FETCH_FAILED") {
      return NextResponse.json({ error: "Não foi possível baixar esse XML. Verifique a URL e tente novamente." }, { status: 502 })
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Nao foi possivel analisar o XML." },
      { status: 400 },
    )
  }
}
