import "server-only"

import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import {
  buildCosSimpleResponseViewModel,
  sanitizeCosResponseText,
  type CosResponseViewModel,
} from "@/lib/cos/response-view-model"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"
import type { CosKnowledgeContext } from "@/lib/cos/types"
import { getCosV2KnowledgeFacts } from "@/lib/cos-v2/knowledge"
import { getCosV2DomainOverview, getCosV2HelpAnswer } from "@/lib/cos-v2/presentation"
import type { CosV2Interpretation } from "@/lib/cos-v2/types"

export {
  buildCosV2CancelledResponse,
  buildCosV2ConfirmationResponse,
  buildCosV2ContextResponse,
  buildCosV2ExecutionResponse,
  buildCosV2ValidationResponse,
} from "@/lib/cos-v2/presentation"

const answerSchema = z.object({
  text: z.string().trim().min(1).max(700),
})

function parseOutput(response: { output_text?: string; output_parsed?: unknown }) {
  if (response.output_parsed) return response.output_parsed
  if (!response.output_text?.trim()) return null
  return JSON.parse(response.output_text)
}

function compactFallbackAnswer(input: {
  interpretation: CosV2Interpretation
  knowledge: CosKnowledgeContext | null
  message: string
}) {
  if (input.interpretation.helpTopic) return getCosV2HelpAnswer(input.interpretation.helpTopic)
  if (input.interpretation.responseFocus === "overview") return getCosV2DomainOverview(input.interpretation.primaryDomain)
  const facts = getCosV2KnowledgeFacts(input.knowledge, input.message)
    .map((item) => sanitizeCosResponseText(item.fact))
    .filter(Boolean)
    .slice(0, 2)
  if (facts.length > 0) {
    const text = facts.map((fact) => /[.!?]$/.test(fact) ? fact : `${fact}.`).join(" ")
    return `${text} Se quiser, posso ajudar com o próximo passo.`
  }
  return getCosV2DomainOverview(input.interpretation.primaryDomain)
}

export async function buildCosV2Answer(input: {
  message: string
  interpretation: CosV2Interpretation
  knowledge: CosKnowledgeContext | null
  capabilityTitles: string[]
}): Promise<CosResponseViewModel> {
  const fallback = compactFallbackAnswer(input)
  try {
    const environment = getOpenAIEnv()
    const client = getOpenAIClient()
    if (!environment.enabled || !client) return buildCosSimpleResponseViewModel({ kind: "explanation", text: fallback })
    const facts = getCosV2KnowledgeFacts(input.knowledge, input.message)
    const response = await createOpenAIResponse({
      client,
      operationKey: "cos.v2.response",
      metadata: { runtimeVersion: "v2", responseKind: "answer" },
      request: {
        model: environment.model,
        max_output_tokens: 500,
        reasoning: { effort: "minimal" },
        instructions: [
          "Responda em português do Brasil de forma direta, natural e curta.",
          "Use apenas os fatos e recursos fornecidos. Não copie trechos crus, não cite estruturas internas e não invente funcionalidades.",
          "Quando helpTopic estiver preenchido, responda somente ao tópico indicado; não substitua a resposta por um resumo geral do EME.",
          "Não declare que uma operação foi executada. Termine com ajuda concreta apenas quando for útil.",
        ].join(" "),
        input: JSON.stringify({
          question: input.message,
          objective: input.interpretation.objective.summary,
          helpTopic: input.interpretation.helpTopic,
          facts,
          availableResources: input.capabilityTitles,
        }),
        text: { verbosity: "low", format: zodTextFormat(answerSchema, "cos_v2_natural_response") },
      },
    })
    const parsed = answerSchema.parse(parseOutput(response as { output_text?: string; output_parsed?: unknown }))
    return buildCosSimpleResponseViewModel({ kind: "explanation", text: parsed.text })
  } catch {
    return buildCosSimpleResponseViewModel({ kind: "explanation", text: fallback })
  }
}
