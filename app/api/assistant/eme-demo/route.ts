import { NextRequest, NextResponse } from "next/server"

import { cleanText, type AssessorAction } from "@/lib/eme-backend"
import { formatCosCapabilityResponse, planCosCapability } from "@/lib/cos"

type LandingDemoMode = "create_ad" | "generate_video" | "create_catalog" | "search_property" | "chat_cos"

type LandingDemoRequest = {
  message?: string
  mode?: LandingDemoMode
}

type LandingDemoRateEntry = {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 6

const modeActionMap: Record<LandingDemoMode, string | undefined> = {
  create_ad: "create_ad",
  generate_video: undefined,
  create_catalog: "analyze_catalog",
  search_property: "match_properties",
  chat_cos: undefined,
}

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown-agent"
  return `${forwardedFor || "unknown-ip"}:${userAgent}`
}

function getRateStore() {
  const globalStore = globalThis as typeof globalThis & {
    __emeLandingDemoRateStore?: Map<string, LandingDemoRateEntry>
  }

  if (!globalStore.__emeLandingDemoRateStore) {
    globalStore.__emeLandingDemoRateStore = new Map<string, LandingDemoRateEntry>()
  }

  return globalStore.__emeLandingDemoRateStore
}

function isValidMode(value: unknown): value is LandingDemoMode {
  return value === "create_ad" || value === "generate_video" || value === "create_catalog" || value === "search_property" || value === "chat_cos"
}

function buildDemoActionResponse(mode: LandingDemoMode, message: string, action: AssessorAction) {
  switch (mode) {
    case "create_ad":
      return [
        "Modo demonstração pública, sem acessar imóveis reais ou salvar dados.",
        `Pedido recebido: ${message}`,
        "Entregue ao corretor um anúncio enxuto com foco comercial, destacando diferenciais, localização, faixa de valor e CTA para visita.",
      ].join("\n")
    case "generate_video":
      return [
        "Modo demonstração pública, sem gerar vídeo real nem consumir créditos.",
        `Briefing recebido: ${message}`,
        "Monte um roteiro de vídeo curto com abertura forte, destaques do imóvel, cenas sugeridas, CTA final e orientação de formato para redes sociais.",
      ].join("\n")
    case "create_catalog":
      return [
        "Modo demonstração pública, sem criar catálogo real nem puxar dados privados.",
        `Solicitação recebida: ${message}`,
        "Sugira uma estrutura de catálogo premium com capa, destaques, ordem dos imóveis, tom comercial e CTA de contato.",
      ].join("\n")
    case "search_property":
      return [
        "Modo demonstração pública, sem consultar carteira real.",
        `Busca recebida: ${message}`,
        "Responda como COS explicando os critérios entendidos, o tipo de imóvel ideal e qual seria o próximo passo para refinar a busca dentro do portal.",
      ].join("\n")
    case "chat_cos":
    default:
      return [
        "Modo demonstração pública do COS, sem executar ações nem consultar dados internos.",
        `Pedido recebido: ${message}`,
        `Ação inferida: ${action}.`,
        "Responda de forma prática, comercial e direta, mostrando como o COS ajudaria o corretor no sistema real e sugerindo o próximo passo mais útil.",
      ].join("\n")
  }
}

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request)
  const rateStore = getRateStore()
  const now = Date.now()
  const currentEntry = rateStore.get(clientKey)

  if (currentEntry && currentEntry.resetAt > now && currentEntry.count >= MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      {
        error: "Limite temporário da demonstração atingido. Aguarde um instante para continuar.",
        rateLimited: true,
      },
      { status: 429 },
    )
  }

  rateStore.set(clientKey, {
    count: currentEntry && currentEntry.resetAt > now ? currentEntry.count + 1 : 1,
    resetAt: currentEntry && currentEntry.resetAt > now ? currentEntry.resetAt : now + WINDOW_MS,
  })

  try {
    const body = (await request.json()) as LandingDemoRequest
    const message = cleanText(body?.message, 600)
    const mode = isValidMode(body?.mode) ? body.mode : "chat_cos"

    if (!message) {
      return NextResponse.json({ error: "Envie uma solicitação para testar o COS." }, { status: 400 })
    }

    const plan = planCosCapability({
      message,
      requestedAction: modeActionMap[mode],
      pendingInput: null,
      surface: "demo",
    })

    const actionResponse = buildDemoActionResponse(mode, message, plan.action)
    const response = await formatCosCapabilityResponse({
      message,
      action: plan.action,
      capability: plan.capability,
      actionResponse,
    })

    return NextResponse.json(
      {
        response,
        action: plan.action,
        demo: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    )
  } catch (error) {
    console.error("[api][assistant][eme-demo] failed", {
      message: error instanceof Error ? error.message : "unknown",
    })

    return NextResponse.json(
      {
        error: "Não foi possível gerar a demonstração do COS agora.",
      },
      { status: 500 },
    )
  }
}
