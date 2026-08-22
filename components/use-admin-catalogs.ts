"use client"

import { useCallback, useEffect, useState } from "react"

import type { AdminCatalogsReport } from "@/lib/admin-catalogs-contract"

export function useAdminCatalogs() {
  const [data, setData] = useState<AdminCatalogsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/catalogs", { cache: "no-store", signal })
      const payload: unknown = await response.json()
      if (!response.ok || !payload || typeof payload !== "object" || !("catalogs" in payload)) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Não foi possível carregar os catálogos."
        throw new Error(message)
      }
      setData(payload as AdminCatalogsReport)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar catálogos.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { data, loading, error, retry: () => load() }
}
