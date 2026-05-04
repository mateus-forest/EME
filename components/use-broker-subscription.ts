"use client"

import { useCallback, useEffect, useState } from "react"

import { type DomainSubscription } from "@/lib/domain-entities"

export type BrokerSubscription = DomainSubscription & {
  planName: "Sincronizando" | "Gratuito" | "Corretor" | "Equipe da imobiliária"
  ownerType: "broker"
  brokerId: string | null
  agencyId: string | null
  accountType: "BROKER_INDEPENDENT" | "BROKER_AGENCY_LINKED" | null
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
  brokerId: null,
  agencyId: null,
  accountType: null,
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

      const nextSubscription = { ...data.subscription, isProfileResolved: true }
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
