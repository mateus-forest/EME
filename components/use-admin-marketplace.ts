"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { AdminMarketplaceReport } from "@/lib/admin-marketplace-contract"

export function useAdminMarketplace() {
  const [report, setReport] = useState<AdminMarketplaceReport | null>(null)
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
      const response = await fetch("/api/admin/marketplace", { credentials: "include", cache: "no-store", signal: controller.signal })
      const data = (await response.json().catch(() => null)) as { report?: AdminMarketplaceReport; error?: string } | null
      if (!response.ok || !data?.report) throw new Error(data?.error || "Não foi possível carregar o Marketplace.")
      setReport(data.report)
    } catch (caughtError) {
      if (!controller.signal.aborted) setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar o Marketplace.")
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
