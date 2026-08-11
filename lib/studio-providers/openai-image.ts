import "server-only"

import { toFile } from "openai"

import { getOpenAIClient } from "@/lib/openai-server"
import type {
  StudioImageEditProviderInput,
  StudioImageProviderOutput,
  StudioProviderResult,
} from "@/lib/studio-providers/types"

const MAX_SOURCE_BYTES = 20 * 1024 * 1024

export const OPENAI_IMAGE_MODEL = "gpt-image-2"

export class OpenAIImageProviderError extends Error {
  code:
    | "OPENAI_IMAGE_NOT_CONFIGURED"
    | "OPENAI_IMAGE_SOURCE_UNAVAILABLE"
    | "OPENAI_IMAGE_INVALID_RESPONSE"
    | "OPENAI_IMAGE_PROVIDER_ERROR"
  status: number

  constructor(code: OpenAIImageProviderError["code"], message: string, status = 500) {
    super(message)
    this.name = "OpenAIImageProviderError"
    this.code = code
    this.status = status
  }
}

async function downloadSourceImage(imageUrl: string) {
  let response: Response
  try {
    response = await fetch(imageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_SOURCE_UNAVAILABLE",
      "Não foi possível acessar a imagem original.",
      400,
    )
  }

  if (!response.ok) {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_SOURCE_UNAVAILABLE",
      "Não foi possível acessar a imagem original.",
      400,
    )
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"
  if (!contentType.startsWith("image/")) {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_SOURCE_UNAVAILABLE",
      "A imagem original possui um formato inválido.",
      400,
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_SOURCE_BYTES) {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_SOURCE_UNAVAILABLE",
      "A imagem original não pôde ser processada.",
      400,
    )
  }

  return { buffer, contentType }
}

export async function editOpenAIImage(
  input: StudioImageEditProviderInput,
): Promise<StudioProviderResult<StudioImageProviderOutput>> {
  const client = getOpenAIClient()
  if (!client) {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_NOT_CONFIGURED",
      "A edição com OpenAI não está configurada neste ambiente.",
      503,
    )
  }

  const startedAt = Date.now()
  const source = await downloadSourceImage(input.imageUrl)

  try {
    const response = await client.images.edit({
      model: OPENAI_IMAGE_MODEL,
      image: await toFile(source.buffer, "studio-source.png", { type: source.contentType }),
      prompt: input.prompt,
      n: 1,
      quality: "medium",
      output_format: "png",
      size: "1536x1024",
    })
    const image = response.data?.[0]
    if (!image?.b64_json) {
      throw new OpenAIImageProviderError(
        "OPENAI_IMAGE_INVALID_RESPONSE",
        "A OpenAI não retornou uma imagem válida.",
        502,
      )
    }

    return {
      provider: "openai",
      model: OPENAI_IMAGE_MODEL,
      capability: "image.edit",
      status: "completed",
      data: {
        base64: image.b64_json,
        mimeType: "image/png",
        revisedPrompt: null,
      },
      durationMs: Date.now() - startedAt,
      externalRequestId: null,
      costUsd: null,
      costSource: "unavailable",
    }
  } catch (caughtError) {
    if (caughtError instanceof OpenAIImageProviderError) throw caughtError
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_PROVIDER_ERROR",
      "Não foi possível concluir a edição com OpenAI agora.",
      502,
    )
  }
}
