"use client"

import { useEffect, useState } from "react"

import type { AdminInsights } from "@/lib/admin-insights-contract"

export function useAdminInsights() {
  const [insights, setInsights] = useState<AdminInsights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/insights", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const data = (await response.json().catch(() => null)) as { insights?: AdminInsights; error?: string } | null
        if (!response.ok || !data?.insights) {
          throw new Error(data?.error || "Nao foi possivel carregar os indicadores administrativos.")
        }

        if (!ignore) setInsights(data.insights)
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
  }, [])

  return { insights, isLoading, error }
}
