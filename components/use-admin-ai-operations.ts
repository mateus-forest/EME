"use client"

import { useCallback, useEffect, useState } from "react"

import type { AdminAiOperationsReport } from "@/lib/admin-ai-operations-contract"

export function useAdminAiOperations(period = 365) {
  const [data, setData] = useState<AdminAiOperationsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/ai-operations?period=${period}`, { cache: "no-store", signal })
      const payload: unknown = await response.json()
      if (!response.ok || !payload || typeof payload !== "object" || !("operations" in payload)) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Não foi possível carregar a telemetria de IA."
        throw new Error(message)
      }
      setData(payload as AdminAiOperationsReport)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar telemetria.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [period])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { data, loading, error, retry: () => load() }
}
