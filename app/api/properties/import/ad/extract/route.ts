import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import {
  consumeBrokerAiCredits,
  createInsufficientCreditsPayload,
  hasBrokerAiCredits,
  refundBrokerAiCredits,
} from "@/lib/eme-plan-service"
import { runWithAiOperationContext } from "@/lib/ai-operation-context"
import { getEmeCreditCost } from "@/lib/eme-plans"
import { AD_IMPORT_MAX_IMAGE_BYTES, AD_IMPORT_MAX_TEXT_LENGTH, extractPropertyFromAd } from "@/lib/property-ad-import"
import { buildAdImportCreditKeys } from "@/lib/property-ad-import-shared"
import { UserRole } from "@/lib/prisma-enums"

export const dynamic = "force-dynamic"

async function fileToDataUrl(file: File) {
  const contentType = file.type || "image/jpeg"
  const arrayBuffer = await file.arrayBuffer()
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const forbidden = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (forbidden) return forbidden

  let creditsConsumed = false
  let creditsUsed = 0
  let actionType = "smart_import_text"
  let operationId = crypto.randomUUID()

  try {
    const formData = await request.formData()
    const adText = typeof formData.get("adText") === "string" ? String(formData.get("adText")).trim() : ""
    const sourceUrl = typeof formData.get("sourceUrl") === "string" ? String(formData.get("sourceUrl")).trim() : ""
    const notes = typeof formData.get("notes") === "string" ? String(formData.get("notes")).trim() : ""
    const requestedOperationId = typeof formData.get("operationId") === "string" ? String(formData.get("operationId")).trim() : ""
    if (/^[a-zA-Z0-9:_-]{8,120}$/.test(requestedOperationId)) operationId = requestedOperationId
    const workflow = formData.get("workflow") === "new_property" ? "new_property" : "import"
    const image = formData.get("image")
    const hasImage = image instanceof File && image.size > 0
    actionType = hasImage ? "smart_import_image" : sourceUrl ? "smart_import_url" : "smart_import_text"
    creditsUsed = getEmeCreditCost(actionType)

    if (hasImage) {
      const validImage = ["image/jpeg", "image/png", "image/webp"].includes(image.type)
      if (!validImage) {
        return NextResponse.json({ error: "Envie uma imagem JPG, PNG ou WebP." }, { status: 400 })
      }

      if (image.size > AD_IMPORT_MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "A imagem deve ter ate 5 MB." }, { status: 400 })
      }
    }

    if (!adText && !sourceUrl && !notes && !hasImage) {
      return NextResponse.json(
        { error: "Informe um link, envie uma imagem ou escreva algum contexto para extrair os dados." },
        { status: 400 },
      )
    }

    if (adText.length > AD_IMPORT_MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "O texto do anuncio deve ter ate 12.000 caracteres." }, { status: 400 })
    }

    if (user.role === UserRole.BROKER && user.broker) {
      const credits = await hasBrokerAiCredits(user.broker.id, creditsUsed)
      if (!credits.allowed) {
        return NextResponse.json(createInsufficientCreditsPayload(), { status: 402 })
      }
    }

    const drafts = await runWithAiOperationContext(
      {
        route: "/api/properties/import/ad/extract",
        source: "portal",
        userId: user.id,
        brokerId: user.broker?.id ?? null,
        agencyId: user.ownedAgency?.id ?? null,
        planKey: user.plan ?? null,
        creditsConsumed: creditsUsed,
      },
      async () =>
        extractPropertyFromAd({
          adText,
          sourceUrl,
          notes,
          workflow,
          imageDataUrl: hasImage ? await fileToDataUrl(image) : "",
        }),
    )

    if (!Array.isArray(drafts) || drafts.length === 0) {
      throw new Error("AD_IMPORT_PREVIEW_EMPTY")
    }

    if (user.role === UserRole.BROKER && user.broker) {
      const creditKeys = buildAdImportCreditKeys(user.broker.id, operationId)
      const charge = await consumeBrokerAiCredits({
        brokerId: user.broker.id,
        amount: creditsUsed,
        actionType,
        idempotencyKey: creditKeys.usage,
        description: hasImage ? "Importacao inteligente por imagem" : "Importacao inteligente por anuncio",
        metadata: {
          source: "api/properties/import/ad/extract",
          operationId,
          hasImage,
          hasSourceUrl: Boolean(sourceUrl),
          hasNotes: Boolean(notes),
          workflow,
        },
      })
      creditsConsumed = charge.applied
    }

    const response = NextResponse.json({ drafts })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    if (creditsConsumed && user.role === UserRole.BROKER && user.broker) {
      try {
        const creditKeys = buildAdImportCreditKeys(user.broker.id, operationId)
        await refundBrokerAiCredits({
          brokerId: user.broker.id,
          amount: creditsUsed,
          actionType,
          idempotencyKey: creditKeys.refund,
          description: "Estorno automatico por falha na importacao inteligente",
          metadata: {
            source: "api/properties/import/ad/extract",
            operationId,
          },
        })
      } catch (refundError) {
        console.error("[api][properties][import][ad][extract][refund-failed]", {
          brokerId: user.broker.id,
          message: refundError instanceof Error ? refundError.message : "unknown",
        })
      }
    }

    console.error("[api][properties][import][ad][extract] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
      stack: caughtError instanceof Error ? caughtError.stack : undefined,
    })

    if (caughtError instanceof Error && caughtError.message.includes("OPENAI_DISABLED_OR_NOT_CONFIGURED")) {
      return NextResponse.json({ error: "A importacao inteligente com IA nao esta configurada neste ambiente." }, { status: 503 })
    }

    if (caughtError instanceof Error && caughtError.message.includes("SOURCE_URL_INVALID")) {
      return NextResponse.json({ error: "Informe um link valido para tentar a importacao pelo anuncio." }, { status: 400 })
    }

    if (caughtError instanceof Error && caughtError.message.includes("SOURCE_URL_BLOCKED")) {
      return NextResponse.json(
        { error: "O site do anuncio bloqueou a leitura automatica. Envie um print ou uma captura de tela para continuar." },
        { status: 403 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("SOURCE_URL_UNREACHABLE")) {
      return NextResponse.json(
        { error: "Nao foi possivel acessar esse link no momento. Verifique a URL ou tente com uma imagem do anuncio." },
        { status: 502 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("SOURCE_URL_FETCH_FAILED")) {
      return NextResponse.json(
        { error: "Nao foi possivel ler o conteudo desse link. Tente novamente ou use uma imagem do anuncio." },
        { status: 502 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("AD_IMPORT_EMPTY_INPUT")) {
      return NextResponse.json(
        { error: "Nao encontramos informacoes suficientes para montar a previa. Envie mais contexto antes de tentar novamente." },
        { status: 400 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("AD_IMPORT_PREVIEW_EMPTY")) {
      return NextResponse.json(
        {
          error:
            "A IA analisou o material, mas nao encontrou dados suficientes para montar uma previa editavel. Envie um print mais legivel ou um anuncio mais completo.",
        },
        { status: 422 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED")) {
      return NextResponse.json(
        {
          error: "A resposta estruturada da IA foi truncada por limite de tokens antes da conclusao da previa.",
          code: "OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED",
        },
        { status: 502 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("OPENAI_EMPTY_RESPONSE")) {
      return NextResponse.json(
        { error: "A IA nao retornou conteudo suficiente para a previa do imovel. Tente novamente em instantes." },
        { status: 502 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("PROPERTY_DESCRIPTION_TOO_SIMILAR")) {
      return NextResponse.json(
        {
          error: "A IA nao conseguiu produzir uma descricao comercial suficientemente nova. Tente novamente com mais detalhes do imovel.",
          code: "PROPERTY_DESCRIPTION_TOO_SIMILAR",
        },
        { status: 502 },
      )
    }

    if (caughtError instanceof Error && caughtError.message.includes("OPENAI_INVALID_JSON")) {
      return NextResponse.json(
        { error: "A resposta da IA veio em um formato invalido, mas nenhum dado recuperavel foi encontrado. Tente novamente em instantes." },
        { status: 502 },
      )
    }

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Nao foi possivel extrair os dados do anuncio." }, { status: 500 })
  }
}
