"use client"

import { useCallback, useEffect, useState } from "react"

import { type AgencyBroker } from "@/components/agency-brokers-data"

const BROKERS_UPDATED_EVENT = "eme-agency-brokers-updated"

type AgencyBrokerPayload = {
  fullName?: string
  name?: string
  email: string
  whatsApp?: string
  phone?: string
  creci: string
  note?: string
}

async function parseAgencyBrokersResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string
        brokers?: AgencyBroker[]
        broker?: AgencyBroker
      }
    | null

  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível sincronizar os corretores da imobiliária.")
  }

  return data
}

export function useAgencyBrokers() {
  const [brokers, setBrokers] = useState<AgencyBroker[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshBrokers = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/agency/brokers", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = await parseAgencyBrokersResponse(response)
      setBrokers(data?.brokers ?? [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshBrokers().catch(() => {
      setBrokers([])
      setIsLoading(false)
    })

    function syncBrokers() {
      refreshBrokers().catch(() => null)
    }

    window.addEventListener(BROKERS_UPDATED_EVENT, syncBrokers)
    return () => window.removeEventListener(BROKERS_UPDATED_EVENT, syncBrokers)
  }, [refreshBrokers])

  async function addBroker(broker: AgencyBrokerPayload) {
    const response = await fetch("/api/agency/brokers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        fullName: broker.fullName ?? broker.name ?? "",
        email: broker.email,
        whatsApp: broker.whatsApp ?? broker.phone ?? "",
        creci: broker.creci,
      }),
    })

    const data = await parseAgencyBrokersResponse(response)

    if (!data?.broker) {
      throw new Error("Não foi possível criar o corretor.")
    }

    setBrokers((current) => [data.broker!, ...current])
    window.dispatchEvent(new CustomEvent(BROKERS_UPDATED_EVENT, { detail: data.broker }))
    return data.broker
  }

  async function updateBroker(id: string, updates: Partial<AgencyBroker>) {
    const response = await fetch(`/api/agency/brokers/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name: updates.name,
        email: updates.email,
        whatsApp: updates.whatsApp,
        creci: updates.creci,
        status: updates.status,
      }),
    })

    const data = await parseAgencyBrokersResponse(response)

    if (!data?.broker) {
      throw new Error("Não foi possível atualizar o corretor.")
    }

    setBrokers((current) => current.map((broker) => (broker.id === id ? data.broker! : broker)))
    window.dispatchEvent(new CustomEvent(BROKERS_UPDATED_EVENT, { detail: data.broker }))
    return data.broker
  }

  async function deleteBroker(id: string) {
    const response = await fetch(`/api/agency/brokers/${id}`, {
      method: "DELETE",
      credentials: "include",
    })

    const data = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      throw new Error(data?.error || "Não foi possível excluir o corretor.")
    }

    setBrokers((current) => current.filter((broker) => broker.id !== id))
    window.dispatchEvent(new CustomEvent(BROKERS_UPDATED_EVENT, { detail: { id } }))
  }

  return { brokers, addBroker, updateBroker, deleteBroker, refreshBrokers, isLoading }
}
