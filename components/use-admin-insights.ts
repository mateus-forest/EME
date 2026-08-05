"use client"

import { useCallback, useEffect, useState } from "react"

import type { AdminInsights } from "@/lib/admin-insights-contract"

export function useAdminInsights() {
  const [insights, setInsights] = useState<AdminInsights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const response = await fetch("/api/admin/insights", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })

    const data = (await response.json().catch(() => null)) as { insights?: AdminInsights; error?: string } | null
    if (!response.ok || !data?.insights) {
      throw new Error(data?.error || "Nao foi possivel carregar os indicadores administrativos.")
    }

    setInsights(data.insights)
  }, [])

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        await refresh()
      } catch (caughtError) {
        if (!ignore) setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel carregar os indicadores administrativos.")
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [refresh])

  return { insights, isLoading, error, refresh }
}
