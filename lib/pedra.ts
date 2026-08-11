import "server-only"

import { z } from "zod"

import { getPedraEnv } from "@/lib/env.server"
import type { FurnishRoomRequest } from "@/lib/studio-property-preparation"

const PEDRA_API_BASE_URL = "https://app.pedra.ai/api"
const PEDRA_REQUEST_TIMEOUT_MS = 55_000

const furnishResponseSchema = z.object({
  output: z.array(z.object({ url: z.string().url() })).min(1),
})

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
    return new PedraApiError("PEDRA_INSUFFICIENT_PROVIDER_CREDITS", "O serviço de preparação visual está temporariamente indisponível.", 503)
  }
  if (status === 404) {
    return new PedraApiError("PEDRA_INVALID_API_KEY", "A preparação visual não está configurada corretamente neste ambiente.", 503)
  }

  return new PedraApiError("PEDRA_PROVIDER_ERROR", "Não foi possível concluir a preparação visual agora.", 502)
}

export async function furnishRoom(input: FurnishRoomRequest & { imageUrl: string }) {
  const apiKey = ensurePedraConfigured()

  let response: Response

  try {
    response = await fetch(`${PEDRA_API_BASE_URL}/furnish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        imageUrl: input.imageUrl,
        roomType: input.roomType,
        style: input.style,
        creativity: input.creativity,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(PEDRA_REQUEST_TIMEOUT_MS),
    })
  } catch (caughtError) {
    if (caughtError instanceof Error && (caughtError.name === "AbortError" || caughtError.name === "TimeoutError")) {
      throw new PedraApiError("PEDRA_TIMEOUT", "A preparação visual excedeu o tempo máximo desta tentativa.", 504)
    }
    throw new PedraApiError("PEDRA_PROVIDER_ERROR", "Não foi possível acessar o serviço de preparação visual.", 502)
  }

  if (!response.ok) {
    throw mapPedraHttpError(response.status)
  }

  const payload = await response.json().catch(() => null)
  const parsed = furnishResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new PedraApiError("PEDRA_INVALID_RESPONSE", "O serviço de preparação visual retornou um resultado inválido.", 502)
  }

  return { imageUrl: parsed.data.output[0].url }
}
