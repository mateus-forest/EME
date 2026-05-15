import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { AD_IMPORT_MAX_IMAGE_BYTES, AD_IMPORT_MAX_TEXT_LENGTH, extractPropertyFromAd } from "@/lib/property-ad-import"

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
    const adText = typeof formData.get("adText") === "string" ? String(formData.get("adText")).trim() : ""
    const sourceUrl = typeof formData.get("sourceUrl") === "string" ? String(formData.get("sourceUrl")).trim() : ""
    const notes = typeof formData.get("notes") === "string" ? String(formData.get("notes")).trim() : ""
    const image = formData.get("image")

    if (image instanceof File && image.size > 0) {
      const validImage = ["image/jpeg", "image/png", "image/webp"].includes(image.type)
      if (!validImage) {
        return NextResponse.json({ error: "Envie uma imagem JPG, PNG ou WebP." }, { status: 400 })
      }

      if (image.size > AD_IMPORT_MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "A imagem deve ter ate 5 MB." }, { status: 400 })
      }

      if (!adText && !sourceUrl && !notes) {
        return NextResponse.json(
          { error: "Extracao por imagem sera ativada quando a IA visual estiver configurada." },
          { status: 501 },
        )
      }
    }

    if (!adText && !sourceUrl && !notes) {
      return NextResponse.json(
        { error: "Cole o texto do anuncio, informe um link ou adicione observacoes para extrair os dados." },
        { status: 400 },
      )
    }

    if (adText.length > AD_IMPORT_MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "O texto do anuncio deve ter ate 12.000 caracteres." }, { status: 400 })
    }

    const draft = await extractPropertyFromAd({ adText, sourceUrl, notes })
    const response = NextResponse.json({ draft })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][import][ad][extract] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    const isOpenAIUnavailable =
      caughtError instanceof Error && caughtError.message.includes("OPENAI_DISABLED_OR_NOT_CONFIGURED")

    if (isOpenAIUnavailable) {
      return NextResponse.json({ error: "A importacao inteligente precisa da IA ativada." }, { status: 503 })
    }

    return NextResponse.json({ error: "Nao foi possivel extrair os dados do anuncio." }, { status: 500 })
  }
}
