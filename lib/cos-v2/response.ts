import "server-only"

import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import {
  buildCosSimpleResponseViewModel,
  type CosResponseViewModel,
} from "@/lib/cos/response-view-model"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"
import type { CosKnowledgeContext } from "@/lib/cos/types"
import { getCosV2KnowledgeFacts } from "@/lib/cos-v2/knowledge"
import { getCosV2DomainOverview, getCosV2HelpAnswer } from "@/lib/cos-v2/presentation"
import { humanizeCosV2Response, humanizeCosV2Text } from "@/lib/cos-v2/response-language"
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
    .map((item) => humanizeCosV2Text(item.fact))
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
      .map((item) => ({
        purpose: item.layer === "DIAGNOSIS" ? "diagnóstico" : item.layer === "ACTION" ? "ajuda disponível" : "explicação",
        text: humanizeCosV2Text(item.fact),
      }))
      .filter((item) => item.text)
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
          "Use apenas as informações fornecidas, resumindo-as na linguagem cotidiana de um corretor. Nunca copie trechos crus nem invente funcionalidades.",
          "Nunca mostre nomes de campos, códigos, identificadores, enumerações, nomes de recursos internos, nomes de rotinas ou rótulos técnicos.",
          "Nunca misture inglês com português. Traduza conceitos técnicos e omita qualquer estrutura interna que não tenha uma tradução natural.",
          "KNOWLEDGE explica fatos e regras do produto; nunca use KNOWLEDGE para afirmar saldo, quantidade, status, agenda ou qualquer dado atual consultável do corretor.",
          "DIAGNOSIS indica dados e estados a verificar; só afirme uma causa concreta quando ela vier de resultado consultado, caso contrário diga objetivamente o que precisa ser verificado.",
          "ACTION descreve operações reais; uma ação só pode ser prometida quando houver capability disponível, com suas validações e confirmações.",
          "Para 'como funciona', responda apenas ao ponto perguntado. Para 'não consigo', explique a causa comprovada ou o próximo diagnóstico. Para 'faça', não simule execução.",
          "Em ajuda, explique o que a área faz, cite as principais possibilidades, diga como você pode ajudar e ofereça um próximo passo apenas se for útil.",
          "Não declare que uma operação foi executada. Termine com ajuda concreta apenas quando for útil.",
        ].join(" "),
        input: JSON.stringify({
          question: input.message,
          objective: humanizeCosV2Text(input.interpretation.objective.summary),
          helpGuidance: input.interpretation.helpTopic ? getCosV2HelpAnswer(input.interpretation.helpTopic) : null,
          facts,
          availableHelp: input.capabilityTitles.map((title) => humanizeCosV2Text(title)).filter(Boolean),
        }),
        text: { verbosity: "low", format: zodTextFormat(answerSchema, "cos_v2_natural_response") },
      },
    })
    const parsed = answerSchema.parse(parseOutput(response as { output_text?: string; output_parsed?: unknown }))
    return humanizeCosV2Response(buildCosSimpleResponseViewModel({
      kind: "explanation",
      text: humanizeCosV2Text(parsed.text, fallback),
    }))
  } catch {
    return humanizeCosV2Response(buildCosSimpleResponseViewModel({ kind: "explanation", text: fallback }))
  }
}
