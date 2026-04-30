"use client"

import { useCallback, useEffect, useState } from "react"

import { type DomainSubscription } from "@/lib/domain-entities"

export type BrokerSubscription = DomainSubscription & {
  planName: "Gratuito" | "Corretor" | "Equipe da imobiliária"
  ownerType: "broker"
  isUpgraded: boolean
  isAgencyLinked: boolean
  propertyLimit: number
  limitLabel: string
  billingPlan: "NONE" | "BROKER" | "AGENCY"
  billingStatus: "INACTIVE" | "ACTIVE"
  requiresRegularization: boolean
  currentPrice: string
  previousPrice: string
  nextCharge: string
  paymentMethod: string
}

const defaultSubscription: BrokerSubscription = {
  id: 5001,
  ownerId: 101,
  ownerType: "broker",
  tipoPlano: "Gratuito",
  ultimoPagamento: "Plano gratuito",
  proximaCobranca: "Plano gratuito ativo",
  planName: "Gratuito",
  isUpgraded: false,
  isAgencyLinked: false,
  propertyLimit: 3,
  limitLabel: "3 imóveis gratuitos",
  billingPlan: "NONE",
  billingStatus: "INACTIVE",
  requiresRegularization: false,
  currentPrice: "R$ 49,90",
  previousPrice: "R$ 89,90",
  status: "Ativo",
  nextCharge: "Plano gratuito ativo",
  paymentMethod: "Checkout Stripe",
}

export function useBrokerSubscription() {
  const [subscription, setSubscription] = useState<BrokerSubscription>(defaultSubscription)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSubscription = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/brokers/subscription", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = (await response.json().catch(() => null)) as { subscription?: BrokerSubscription } | null

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
