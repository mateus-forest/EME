"use client"

import { useCallback, useEffect, useState } from "react"

import { type DomainSubscription } from "@/lib/domain-entities"

export type BrokerSubscription = DomainSubscription & {
  planName: "Sincronizando" | "Gratuito" | "Corretor" | "Equipe da imobiliária"
  ownerType: "broker"
  isUpgraded: boolean
  isAgencyLinked: boolean
  propertyLimit: number
  limitLabel: string
  billingPlan: "NONE" | "BROKER" | "AGENCY"
  billingStatus: "INACTIVE" | "ACTIVE"
  requiresRegularization: boolean
  isProfileResolved: boolean
  currentPrice: string
  previousPrice: string
  nextCharge: string
  paymentMethod: string
}

const defaultSubscription: BrokerSubscription = {
  id: 5001,
  ownerId: 101,
  ownerType: "broker",
  tipoPlano: "Sincronizando",
  ultimoPagamento: "Sincronizando",
  proximaCobranca: "Sincronizando",
  planName: "Sincronizando",
  isUpgraded: false,
  isAgencyLinked: false,
  propertyLimit: 3,
  limitLabel: "3 imóveis gratuitos",
  billingPlan: "NONE",
  billingStatus: "INACTIVE",
  requiresRegularization: false,
  isProfileResolved: false,
  currentPrice: "-",
  previousPrice: "",
  status: "Ativo",
  nextCharge: "Sincronizando",
  paymentMethod: "Sincronizando",
}

let latestBrokerSubscription: BrokerSubscription | null = null

export function useBrokerSubscription() {
  const [subscription, setSubscription] = useState<BrokerSubscription>(latestBrokerSubscription ?? defaultSubscription)
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
        return
      }

      const nextSubscription = { ...data.subscription, isProfileResolved: true }
      latestBrokerSubscription = nextSubscription
      setSubscription(nextSubscription)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSubscription().catch(() => {
      setIsLoading(false)
    })
  }, [refreshSubscription])

  return {
    subscription,
    refreshSubscription,
    isLoading,
  }
}
