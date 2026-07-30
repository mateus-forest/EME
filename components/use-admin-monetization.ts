"use client"

import { useEffect, useState } from "react"

import type { AdminMonetizationReport } from "@/lib/admin-monetization-contract"

export function useAdminMonetization() {
  const [report, setReport] = useState<AdminMonetizationReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/admin/monetization", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const data = (await response.json().catch(() => null)) as { report?: AdminMonetizationReport; error?: string } | null
        if (!response.ok || !data?.report) {
          throw new Error(data?.error || "Nao foi possivel carregar o estudo de monetizacao.")
        }

        if (!ignore) setReport(data.report)
      } catch (caughtError) {
        if (!ignore) setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel carregar o estudo de monetizacao.")
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    void load()

    return () => {
      ignore = true
    }
  }, [])

  return { report, isLoading, error }
}
