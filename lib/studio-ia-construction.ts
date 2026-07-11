import "server-only"

import type OpenAI from "openai"
import { z } from "zod"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { savePropertyGeneratedImage } from "@/lib/property-storage"

export const studioConstructionStyles = [
  "Moderno",
  "Minimalista",
  "Alto padrao",
  "Industrial",
  "Classico",
] as const

export const studioConstructionRequestSchema = z.object({
  propertyId: z.string().trim().min(1).max(191),
  imageUrl: z.string().trim().url(),
  style: z.enum(studioConstructionStyles),
})

export type StudioConstructionStyle = (typeof studioConstructionStyles)[number]
export type StudioConstructionRequest = z.infer<typeof studioConstructionRequestSchema>

const stylePromptMap: Record<StudioConstructionStyle, string> = {
  Moderno: "acabamentos modernos, fachada valorizada, paisagismo atual e visual contemporaneo",
  Minimalista: "acabamentos minimalistas, linhas limpas, paleta neutra e visual sofisticado e discreto",
  "Alto padrao": "acabamentos de alto padrao, materiais nobres, iluminacao elegante e apresentacao premium",
  Industrial: "acabamentos industriais, concreto aparente equilibrado, metais escuros e linguagem urbana refinada",
  Classico: "acabamentos classicos, composicao elegante, detalhes atemporais e visual residencial tradicional",
}

function buildTransformationPrompt(style: StudioConstructionStyle) {
  return [
    "Transforme a obra da imagem em um imovel pronto para venda.",
    `Aplique o estilo ${style}: ${stylePromptMap[style]}.`,
    "Preserve fielmente o enquadramento da camera.",
    "Preserve a estrutura do imovel, geometria, volumetria, pavimentos, portas, janelas, acessos e proporcoes.",
    "Nao altere angulo, nao remova elementos arquitetonicos reais e nao invente novas construcoes.",
    "Finalize apenas acabamentos, pintura, iluminacao, paisagismo e detalhes de apresentacao coerentes com o estilo.",
    "Entregue uma imagem fotografica realista, pronta para uso comercial no mercado imobiliario brasileiro.",
  ].join("\n")
}

async function fetchImageAsDataUrl(imageUrl: string) {
  const response = await fetch(imageUrl, { cache: "no-store" })

  if (!response.ok) {
    throw new Error("Nao foi possivel acessar a imagem de referencia do imovel.")
  }

  const contentType = response.headers.get("content-type")?.trim() || "image/jpeg"
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  return `data:${contentType};base64,${base64}`
}

function extractGeneratedImageBase64(response: OpenAI.Responses.Response) {
  const imageOutput = response.output.find((item) => item.type === "image_generation_call")
  if (!imageOutput || !("result" in imageOutput) || !imageOutput.result) {
    throw new Error("A geracao da imagem nao retornou nenhum resultado.")
  }

  return imageOutput.result
}

export async function generateConstructionToListingImage(input: StudioConstructionRequest) {
  const client = getOpenAIClient()

  if (!client) {
    throw new Error("OPENAI_DISABLED_OR_NOT_CONFIGURED")
  }

  const { model } = getOpenAIEnv()
  const referenceImage = await fetchImageAsDataUrl(input.imageUrl)
  const response = await client.responses.create({
    model,
    stream: false,
    tools: [{ type: "image_generation" }],
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: buildTransformationPrompt(input.style) },
          { type: "input_image", image_url: referenceImage, detail: "high" },
        ],
      },
    ],
  })

  const resultBase64 = extractGeneratedImageBase64(response)
  const imageBuffer = Buffer.from(resultBase64, "base64")
  const savedUrl = await savePropertyGeneratedImage(input.propertyId, imageBuffer, "image/png")

  return {
    imageUrl: savedUrl,
  }
}
