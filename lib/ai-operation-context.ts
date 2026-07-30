import { AsyncLocalStorage } from "node:async_hooks"

import type { AiTelemetryContext } from "@/lib/ai-cost-contract"

const aiOperationContextStorage = new AsyncLocalStorage<AiTelemetryContext>()

export function runWithAiOperationContext<T>(context: AiTelemetryContext, callback: () => T) {
  const current = aiOperationContextStorage.getStore() ?? {}
  return aiOperationContextStorage.run(
    {
      ...current,
      ...context,
      metadata: {
        ...(current.metadata ?? {}),
        ...(context.metadata ?? {}),
      },
    },
    callback,
  )
}

export function getAiOperationContext() {
  return aiOperationContextStorage.getStore() ?? null
}
