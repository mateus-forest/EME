"use client"

import { useCallback, useEffect, useState } from "react"

export type AgencySubscription = {
  planName: string
  status: "Ativa" | "Inativa"
  currentPrice: string
  basePrice: string
  brokerUnitPrice: string
  activeBrokerCount: number
  brokerRule: string
  nextCharge: string
  isActive: boolean
}

const defaultSubscription: AgencySubscription = {
  planName: "Plano Imobiliária",
  status: "Inativa",
  currentPrice: "R$ 109,90 / mês + uso",
  basePrice: "R$ 109,90 / mês",
  brokerUnitPrice: "Medidor configurado no Stripe",
  activeBrokerCount: 0,
  brokerRule: "0 corretores ativos medidos no Stripe",
  nextCharge: "Aguardando checkout Stripe",
  isActive: false,
}

export function useAgencySubscription() {
  const [subscription, setSubscription] = useState<AgencySubscription>(defaultSubscription)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSubscription = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/agencies/subscription", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = (await response.json().catch(() => null)) as { subscription?: AgencySubscription } | null

      if (!response.ok || !data?.subscription) {
        setSubscription(defaultSubscription)
        return
      }

      setSubscription(data.subscription)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSubscription().catch(() => {
      setSubscription(defaultSubscription)
      setIsLoading(false)
    })
  }, [refreshSubscription])

  return {
    subscription,
    refreshSubscription,
    isLoading,
  }
}
