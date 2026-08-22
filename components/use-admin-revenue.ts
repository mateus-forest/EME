"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AdminRevenueReport } from "@/lib/admin-revenue-contract"

export function useAdminRevenue() {
  const [report, setReport] = useState<AdminRevenueReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/revenue", { credentials: "include", cache: "no-store", signal: controller.signal })
      const data = (await response.json().catch(() => null)) as { report?: AdminRevenueReport; error?: string } | null
      if (!response.ok || !data?.report) throw new Error(data?.error || "Não foi possível carregar a receita.")
      setReport(data.report)
    } catch (caughtError) {
      if (!controller.signal.aborted) setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar a receita.")
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => controllerRef.current?.abort()
  }, [refresh])

  return { report, isLoading, error, refresh }
}
