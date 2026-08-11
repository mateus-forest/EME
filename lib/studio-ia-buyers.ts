import "server-only"

import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"

export const studioBuyerGenerationErrorCodes = {
  emptyResponse: "OPENAI_EMPTY_RESPONSE",
  incompleteResponse: "OPENAI_INCOMPLETE_RESPONSE",
  invalidStructuredResponse: "OPENAI_INVALID_STRUCTURED_RESPONSE",
  maxOutputTokensExceeded: "OPENAI_MAX_OUTPUT_TOKENS_EXCEEDED",
} as const

export const studioBuyerAudiences = [
  "Primeiro imovel",
  "Familia",
  "Investidor",
  "Alto padrao",
  "Imovel de praia",
  "Comercial",
] as const

export const studioBuyerChannels = [
  "Instagram",
  "Facebook",
  "Google",
  "WhatsApp",
  "Portais imobiliarios",
] as const

export const studioBuyerRequestSchema = z.object({
  propertyId: z.string().trim().min(1).max(191),
  audience: z.enum(studioBuyerAudiences),
  channel: z.enum(studioBuyerChannels),
  version: z.number().int().min(1).max(20).default(1),
})

export const studioBuyerResultSchema = z.object({
  audience: z.string().trim().min(1).max(220),
  strategy: z.string().trim().min(1).max(900),
  copy: z.string().trim().min(1).max(900),
  cta: z.string().trim().min(1).max(120),
  timeline: z.array(z.string().trim().min(1).max(220)).min(3).max(3),
  reach: z.string().trim().min(1).max(120),
  leads: z.string().trim().min(1).max(120),
})

export type StudioBuyerRequest = z.infer<typeof studioBuyerRequestSchema>
export type StudioBuyerResult = z.infer<typeof studioBuyerResultSchema>

export type StudioBuyerPropertyContext = {
  id: string
  title: string
  city: string
  neighborhood: string
  location: string
  type: string
  purpose: string
  price: string
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  description: string
  status: string
}

function buildBuyersPrompt(input: StudioBuyerRequest, property: StudioBuyerPropertyContext) {
  return [
    "Crie uma estrategia comercial imobiliaria pronta para atrair compradores em portugues do Brasil.",
    `Perfil principal do publico: ${input.audience}.`,
    `Canal principal da campanha: ${input.channel}.`,
    `Versao solicitada: ${input.version}. Gere uma nova abordagem mantendo coerencia com o contexto.`,
    "",
    "Contexto do imovel:",
    `Titulo: ${property.title}`,
    `Tipo: ${property.type}`,
    `Finalidade: ${property.purpose}`,
    `Localizacao: ${property.location}`,
    `Cidade: ${property.city}`,
    `Bairro: ${property.neighborhood}`,
    `Preco: ${property.price}`,
    `Quartos: ${property.bedrooms}`,
    `Banheiros: ${property.bathrooms}`,
    `Vagas: ${property.parkingSpots}`,
    `Status: ${property.status}`,
    `Descricao atual: ${property.description || "Nao informada"}`,
    "",
    "Regras:",
    "Nao invente informacoes factuais que nao estejam no contexto.",
    "Escreva com tom comercial, sofisticado e direto para um corretor de imoveis.",
    "Entregue conteudo pronto para revisao final e uso comercial.",
    "As estimativas de alcance e leads devem ser plausiveis, em texto curto, sem parecer dado tecnico exato.",
  ].join("\n")
}

export async function generateBuyerStrategy(
  input: StudioBuyerRequest,
  property: StudioBuyerPropertyContext,
) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const response = await createOpenAIResponse({
    client,
    operationKey: "studio.buyers",
    metadata: {
      propertyId: property.id,
      audience: input.audience,
      channel: input.channel,
      version: input.version,
    },
    request: {
      model,
      max_output_tokens: 2400,
      reasoning: {
        effort: "minimal",
      },
      instructions:
        "Voce e o Studio IA do EME, especialista em marketing imobiliario para corretores. Monte estrategias comerciais praticas e persuasivas para captar interesse de compradores no mercado brasileiro. Responda apenas com o JSON do schema solicitado, sem texto adicional.",
      input: buildBuyersPrompt(input, property),
      text: {
        verbosity: "low",
        format: zodTextFormat(studioBuyerResultSchema, "studio_ia_buyers_strategy"),
      },
    },
  })

  if (response.status === "incomplete") {
    console.error("[studio-ia][buyers][openai-response-truncated]", {
      message: response.incomplete_details?.reason === "max_output_tokens"
        ? studioBuyerGenerationErrorCodes.maxOutputTokensExceeded
        : studioBuyerGenerationErrorCodes.incompleteResponse,
      status: response.status,
      incompleteDetails: response.incomplete_details,
      rawResponseText: typeof response.output_text === "string" ? response.output_text.slice(0, 6000) : "",
      responseOutput: JSON.stringify(response.output ?? []).slice(0, 6000),
    })
    throw new Error(
      response.incomplete_details?.reason === "max_output_tokens"
        ? studioBuyerGenerationErrorCodes.maxOutputTokensExceeded
        : studioBuyerGenerationErrorCodes.incompleteResponse,
    )
  }

  const outputText = response.output_text.trim()
  if (!outputText) {
    throw new Error(studioBuyerGenerationErrorCodes.emptyResponse)
  }

  let parsedOutput: unknown
  try {
    parsedOutput = JSON.parse(outputText)
  } catch (caughtError) {
    console.error("[studio-ia][buyers][openai-invalid-json]", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
      status: response.status,
      rawResponseText: outputText.slice(0, 6000),
    })
    throw new Error(studioBuyerGenerationErrorCodes.invalidStructuredResponse, { cause: caughtError })
  }

  const parsedResult = studioBuyerResultSchema.safeParse(parsedOutput)
  if (!parsedResult.success) {
    console.error("[studio-ia][buyers][openai-invalid-structure]", {
      issues: parsedResult.error.issues,
      status: response.status,
    })
    throw new Error(studioBuyerGenerationErrorCodes.invalidStructuredResponse)
  }

  return parsedResult.data
}
