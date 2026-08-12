import "server-only"

import { z } from "zod"

import { getPedraEnv } from "@/lib/env.server"
import type { PropertyPreparationRequest } from "@/lib/studio-property-preparation"

const PEDRA_API_BASE_URL = "https://app.pedra.ai/api"
const PEDRA_REQUEST_TIMEOUT_MS = 55_000

const outputImageSchema = z.object({ url: z.string().url() })
const arrayResponseSchema = z.object({ output: z.array(outputImageSchema).min(1) })
const objectResponseSchema = z.object({ output: outputImageSchema })

export type PedraErrorCode =
  | "PEDRA_NOT_CONFIGURED"
  | "PEDRA_INVALID_REQUEST"
  | "PEDRA_INSUFFICIENT_PROVIDER_CREDITS"
  | "PEDRA_INVALID_API_KEY"
  | "PEDRA_TIMEOUT"
  | "PEDRA_INVALID_RESPONSE"
  | "PEDRA_PROVIDER_ERROR"

export class PedraApiError extends Error {
  constructor(
    public readonly code: PedraErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "PedraApiError"
  }
}

export function ensurePedraConfigured() {
  const { apiKey } = getPedraEnv()
  if (!apiKey) {
    throw new PedraApiError(
      "PEDRA_NOT_CONFIGURED",
      "A preparação visual ainda não está configurada neste ambiente.",
      503,
    )
  }

  return apiKey
}

function mapPedraHttpError(status: number) {
  if (status === 400) {
    return new PedraApiError("PEDRA_INVALID_REQUEST", "Não foi possível processar esta imagem com as opções selecionadas.", 400)
  }
  if (status === 403) {
    return new PedraApiError(
      "PEDRA_INSUFFICIENT_PROVIDER_CREDITS",
      "A IA especializada está temporariamente sem saldo. Escolha outra IA disponível ou tente novamente mais tarde.",
      503,
    )
  }
  if (status === 404) {
    return new PedraApiError("PEDRA_INVALID_API_KEY", "A preparação visual não está configurada corretamente neste ambiente.", 503)
  }

  return new PedraApiError("PEDRA_PROVIDER_ERROR", "Não foi possível concluir a preparação visual agora.", 502)
}

async function callPedraImageEndpoint(input: {
  endpoint: string
  payload: Record<string, unknown>
  outputShape: "array" | "object"
}) {
  const apiKey = ensurePedraConfigured()
  const startedAt = Date.now()
  let response: Response

  try {
    response = await fetch(`${PEDRA_API_BASE_URL}/${input.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, ...input.payload }),
      cache: "no-store",
      signal: AbortSignal.timeout(PEDRA_REQUEST_TIMEOUT_MS),
    })
  } catch (caughtError) {
    if (caughtError instanceof Error && (caughtError.name === "AbortError" || caughtError.name === "TimeoutError")) {
      throw new PedraApiError("PEDRA_TIMEOUT", "A preparação visual excedeu o tempo máximo desta tentativa.", 504)
    }
    throw new PedraApiError("PEDRA_PROVIDER_ERROR", "Não foi possível acessar o serviço de preparação visual.", 502)
  }

  if (!response.ok) throw mapPedraHttpError(response.status)

  const payload = await response.json().catch(() => null)
  const parsed = input.outputShape === "array"
    ? arrayResponseSchema.safeParse(payload)
    : objectResponseSchema.safeParse(payload)

  if (!parsed.success) {
    throw new PedraApiError("PEDRA_INVALID_RESPONSE", "O serviço de preparação visual retornou um resultado inválido.", 502)
  }

  const output = parsed.data.output
  return {
    imageUrl: Array.isArray(output) ? output[0].url : output.url,
    providerHttpStatus: response.status,
    providerDurationMs: Date.now() - startedAt,
  }
}

export async function executePropertyPreparation(input: PropertyPreparationRequest & { imageUrl: string; maskUrl?: string }) {
  switch (input.operation) {
    case "furnish":
      return callPedraImageEndpoint({
        endpoint: "furnish",
        outputShape: "array",
        payload: {
          imageUrl: input.imageUrl,
          roomType: input.roomType,
          style: input.style,
          creativity: input.creativity,
        },
      })
    case "empty_room":
      return callPedraImageEndpoint({ endpoint: "empty_room", outputShape: "array", payload: { imageUrl: input.imageUrl } })
    case "renovation":
      return callPedraImageEndpoint({
        endpoint: "renovation",
        outputShape: "array",
        payload: {
          imageUrl: input.imageUrl,
          style: input.style,
          preserveWindows: input.preserveWindows,
          furnish: input.furnish,
          ...(input.furnish ? { roomType: input.roomType } : {}),
          creativity: input.creativity,
        },
      })
    case "edit_via_prompt":
      return callPedraImageEndpoint({
        endpoint: "edit_via_prompt",
        outputShape: "object",
        payload: { imageUrl: input.imageUrl, prompt: input.prompt },
      })
    case "enhance":
      return callPedraImageEndpoint({
        endpoint: "enhance",
        outputShape: "array",
        payload: {
          imageUrl: input.imageUrl,
          highFidelity: input.highFidelity,
          preserveOriginalFraming: input.preserveOriginalFraming,
        },
      })
    case "enhance_and_correct_perspective":
      return callPedraImageEndpoint({
        endpoint: "enhance_and_correct_perspective",
        outputShape: "array",
        payload: {
          imageUrl: input.imageUrl,
          highFidelity: input.highFidelity,
          preserveOriginalFraming: input.preserveOriginalFraming,
        },
      })
    case "sky_blue":
      return callPedraImageEndpoint({
        endpoint: "sky_blue",
        outputShape: "object",
        payload: { imageUrl: input.imageUrl, skyStyle: input.skyStyle },
      })
    case "blur":
      return callPedraImageEndpoint({
        endpoint: "blur",
        outputShape: "object",
        payload: { imageUrl: input.imageUrl, objectsToBlur: input.objectsToBlur },
      })
    case "remove_object":
      if (!input.maskUrl) {
        throw new PedraApiError("PEDRA_INVALID_REQUEST", "Marque a área que deseja remover.", 400)
      }
      return callPedraImageEndpoint({
        endpoint: "remove_object",
        outputShape: "object",
        payload: { imageUrl: input.imageUrl, maskUrl: input.maskUrl },
      })
  }
}
