import "server-only"

import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"

export const studioOwnerGoals = [
  "Captar imovel para venda",
  "Captar imovel para locacao",
  "Captar imovel de alto padrao",
  "Captar lancamentos",
  "Captar imoveis comerciais",
] as const

export const studioOwnerProfiles = [
  "Proprietario particular",
  "Investidor",
  "Construtora",
  "Incorporadora",
] as const

export const studioOwnerRequestSchema = z.object({
  goal: z.enum(studioOwnerGoals),
  city: z.string().trim().min(1).max(80),
  neighborhood: z.string().trim().min(1).max(80),
  operationRadius: z.string().trim().min(1).max(80),
  ownerProfile: z.enum(studioOwnerProfiles),
  version: z.number().int().min(1).max(20).default(1),
})

export const studioOwnerResultSchema = z.object({
  audience: z.string().trim().min(1).max(220),
  approach: z.string().trim().min(1).max(900),
  adCopy: z.string().trim().min(1).max(900),
  instagramCaption: z.string().trim().min(1).max(900),
  videoScript: z.array(z.string().trim().min(1).max(240)).min(3).max(3),
  whatsappText: z.string().trim().min(1).max(900),
  cta: z.string().trim().min(1).max(120),
  timeline: z.array(z.string().trim().min(1).max(220)).min(3).max(3),
})

export type StudioOwnerRequest = z.infer<typeof studioOwnerRequestSchema>
export type StudioOwnerResult = z.infer<typeof studioOwnerResultSchema>

function buildOwnersPrompt(input: StudioOwnerRequest) {
  return [
    "Crie uma estrategia comercial pronta para captar proprietarios em portugues do Brasil.",
    `Objetivo da captacao: ${input.goal}.`,
    `Cidade principal: ${input.city}.`,
    `Bairro prioritario: ${input.neighborhood}.`,
    `Raio de atuacao: ${input.operationRadius}.`,
    `Perfil principal do proprietario: ${input.ownerProfile}.`,
    `Versao solicitada: ${input.version}. Gere uma abordagem nova mantendo coerencia comercial.`,
    "",
    "Regras:",
    "Escreva como um especialista em captacao imobiliaria no Brasil.",
    "Seja comercial, claro, convincente e pronto para revisao final pelo corretor.",
    "Nao mencione IA, prompt, algoritmo ou bastidores.",
    "Nao invente numeros, cases ou promessas irreais.",
    "O texto deve soar utilizavel em campanha, anuncio, roteiro e abordagem comercial reais.",
  ].join("\n")
}

export async function generateOwnerStrategy(input: StudioOwnerRequest) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const response = await client.responses.create({
    model,
    max_output_tokens: 1700,
    instructions:
      "Voce e o Studio IA do EME, especialista em captacao de proprietarios para corretores e imobiliarias. Entregue estrategias comerciais objetivas, sofisticadas e prontas para revisao final no mercado brasileiro.",
    input: buildOwnersPrompt(input),
    text: {
      format: {
        type: "json_schema",
        name: "studio_ia_owner_strategy",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            audience: { type: "string" },
            approach: { type: "string" },
            adCopy: { type: "string" },
            instagramCaption: { type: "string" },
            videoScript: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: { type: "string" },
            },
            whatsappText: { type: "string" },
            cta: { type: "string" },
            timeline: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: { type: "string" },
            },
          },
          required: ["audience", "approach", "adCopy", "instagramCaption", "videoScript", "whatsappText", "cta", "timeline"],
        },
      },
    },
  })

  return studioOwnerResultSchema.parse(JSON.parse(response.output_text))
}
