import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { parsePropertiesXml, XML_IMPORT_MAX_BYTES } from "@/lib/property-xml-import"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (forbidden) return forbidden

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo XML para analisar." }, { status: 400 })
    }

    const isXml =
      file.name.toLowerCase().endsWith(".xml") ||
      ["text/xml", "application/xml"].includes(file.type)

    if (!isXml) {
      return NextResponse.json({ error: "O arquivo precisa estar no formato XML." }, { status: 400 })
    }

    if (file.size > XML_IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "O XML deve ter ate 5 MB." }, { status: 400 })
    }

    const xml = await file.text()
    const properties = parsePropertiesXml(xml)

    if (properties.length === 0) {
      return NextResponse.json(
        { error: "Nao encontramos imoveis validos neste XML. Revise o arquivo e tente novamente." },
        { status: 400 },
      )
    }

    const response = NextResponse.json({
      properties,
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

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Nao foi possivel analisar o XML." },
      { status: 400 },
    )
  }
}
