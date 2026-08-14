import "server-only"

import { APIError, toFile } from "openai"

import { getOpenAIClient } from "@/lib/openai-server"
import type {
  StudioImageEditProviderInput,
  StudioImageProviderOutput,
  StudioProviderResult,
} from "@/lib/studio-providers/types"

const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_OPENAI_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_OPENAI_MASK_BYTES = 50 * 1024 * 1024

export const OPENAI_IMAGE_MODEL = "gpt-image-2"

export class OpenAIImageProviderError extends Error {
  code:
    | "OPENAI_IMAGE_NOT_CONFIGURED"
    | "OPENAI_IMAGE_SOURCE_UNAVAILABLE"
    | "OPENAI_IMAGE_INVALID_RESPONSE"
    | "OPENAI_IMAGE_PROVIDER_ERROR"
  status: number
  providerStatus: number | null
  providerCode: string | null
  providerParam: string | null
  requestId: string | null

  constructor(
    code: OpenAIImageProviderError["code"],
    message: string,
    status = 500,
    providerDetails?: {
      status?: number | null
      code?: string | null
      param?: string | null
      requestId?: string | null
    },
  ) {
    super(message)
    this.name = "OpenAIImageProviderError"
    this.code = code
    this.status = status
    this.providerStatus = providerDetails?.status ?? null
    this.providerCode = providerDetails?.code ?? null
    this.providerParam = providerDetails?.param ?? null
    this.requestId = providerDetails?.requestId ?? null
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

async function normalizeOpenAIEditSource(source: { buffer: Buffer; contentType: string }) {
  try {
    const sharp = (await import("sharp")).default
    const { data, info } = await sharp(source.buffer)
      .rotate()
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true })

    if (!info.width || !info.height || data.byteLength === 0 || data.byteLength > MAX_OPENAI_IMAGE_BYTES) {
      throw new Error("invalid normalized source")
    }

    return {
      buffer: data,
      contentType: "image/png" as const,
      width: info.width,
      height: info.height,
    }
  } catch {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_SOURCE_UNAVAILABLE",
      "A imagem original não pôde ser preparada para edição.",
      400,
    )
  }
}

async function downloadOpenAIEditMask(
  maskUrl: string,
  expected: { width: number; height: number },
) {
  const source = await downloadSourceImage(maskUrl)
  if (source.contentType !== "image/png") {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_SOURCE_UNAVAILABLE",
      "A seleção da área possui um formato inválido.",
      400,
    )
  }

  try {
    const sharp = (await import("sharp")).default
    const { data, info } = await sharp(source.buffer).greyscale().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== expected.width || info.height !== expected.height) {
      throw new Error("mask dimensions mismatch")
    }
    const rgba = Buffer.alloc(info.width * info.height * 4)
    for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
      const value = data[pixel]
      const offset = pixel * 4
      rgba[offset] = 0
      rgba[offset + 1] = 0
      rgba[offset + 2] = 0
      // EME/Pedra: white = edit. OpenAI: transparent = edit.
      rgba[offset + 3] = value >= 128 ? 0 : 255
    }
    const buffer = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_OPENAI_MASK_BYTES) throw new Error("mask too large")
    return buffer
  } catch {
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_SOURCE_UNAVAILABLE",
      "A seleção da área não pôde ser preparada.",
      400,
    )
  }
}

function getProviderErrorDetails(caughtError: unknown) {
  if (!(caughtError instanceof APIError)) {
    return { status: null, code: null, param: null, requestId: null }
  }

  return {
    status: caughtError.status ?? null,
    code: typeof caughtError.code === "string" ? caughtError.code : null,
    param: typeof caughtError.param === "string" ? caughtError.param : null,
    requestId: caughtError.requestID ?? null,
  }
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
  const downloadedSource = await downloadSourceImage(input.imageUrl)
  const source = await normalizeOpenAIEditSource(downloadedSource)
  const mask = input.maskUrl
    ? await downloadOpenAIEditMask(input.maskUrl, { width: source.width, height: source.height })
    : null

  try {
    const { data: response, request_id: requestId } = await client.images.edit({
      model: OPENAI_IMAGE_MODEL,
      image: await toFile(source.buffer, "studio-source.png", { type: "image/png" }),
      ...(mask ? { mask: await toFile(mask, "studio-mask.png", { type: "image/png" }) } : {}),
      prompt: input.prompt,
      n: 1,
      quality: "medium",
      output_format: "png",
      size: "auto",
    }).withResponse()
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
      externalRequestId: requestId ?? null,
      costUsd: null,
      costSource: "unavailable",
      metadata: {
        sourceMimeType: downloadedSource.contentType,
        providerInputMimeType: "image/png",
        sourceBytes: downloadedSource.buffer.byteLength,
        providerInputBytes: source.buffer.byteLength,
        sourceWidth: source.width,
        sourceHeight: source.height,
        maskIncluded: Boolean(mask),
        maskBytes: mask?.byteLength ?? null,
      },
    }
  } catch (caughtError) {
    if (caughtError instanceof OpenAIImageProviderError) throw caughtError
    const providerDetails = getProviderErrorDetails(caughtError)
    console.error("[studio-provider][openai-image] edit failed", {
      model: OPENAI_IMAGE_MODEL,
      providerStatus: providerDetails.status,
      providerCode: providerDetails.code,
      providerParam: providerDetails.param,
      requestId: providerDetails.requestId,
    })
    throw new OpenAIImageProviderError(
      "OPENAI_IMAGE_PROVIDER_ERROR",
      "Não foi possível concluir a edição com OpenAI agora.",
      502,
      providerDetails,
    )
  }
}
