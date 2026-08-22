"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { AdminInsights } from "@/lib/admin-insights-contract"

export function useAdminInsights() {
  const [insights, setInsights] = useState<AdminInsights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/insights", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })

      const data = (await response.json().catch(() => null)) as { insights?: AdminInsights; error?: string } | null
      if (!response.ok || !data?.insights) {
        throw new Error(data?.error || "Não foi possível carregar os indicadores administrativos.")
      }

      if (requestId === requestIdRef.current) setInsights(data.insights)
    } catch (caughtError) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar os indicadores administrativos.")
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    return () => {
      controllerRef.current?.abort()
      requestIdRef.current += 1
    }
  }, [refresh])

  return { insights, isLoading, error, refresh }
}
