import OpenAI from "openai"

import { getOpenAIEnv } from "@/lib/env.server"

let openaiClient: OpenAI | null = null

export function getOpenAIClient() {
  const { enabled, apiKey } = getOpenAIEnv()

  if (!enabled || !apiKey) {
    return null
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey })
  }

  return openaiClient
}
