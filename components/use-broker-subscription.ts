"use client"

import { useCallback, useEffect, useState } from "react"

import { type DomainSubscription } from "@/lib/domain-entities"

export type BrokerSubscription = DomainSubscription & {
  planName: string
  ownerType: "broker"
  brokerId: string | null
  agencyId: string | null
  accountType: "BROKER_INDEPENDENT" | null
  isUpgraded: boolean
  isAgencyLinked: boolean
  propertyLimit: number | null
  limitLabel: string
  billingPlan: "NONE" | "BROKER" | "AGENCY"
  billingStatus: "INACTIVE" | "ACTIVE"
  requiresRegularization: boolean
  isProfileResolved: boolean
  currentPrice: string
  previousPrice: string | null
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
  propertyLimit: 5,
  limitLabel: "5 imoveis ativos",
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

type SubscriptionResponse = { subscription?: BrokerSubscription } | null
type SubscriptionRequestResult = { status: number; ok: boolean; data: SubscriptionResponse }

let subscriptionRequest: Promise<SubscriptionRequestResult> | null = null

function requestBrokerSubscription() {
  if (!subscriptionRequest) {
    subscriptionRequest = fetch("/api/brokers/subscription", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => ({
        status: response.status,
        ok: response.ok,
        data: (await response.json().catch(() => null)) as SubscriptionResponse,
      }))
      .finally(() => {
        subscriptionRequest = null
      })
  }
  return subscriptionRequest
}

export function useBrokerSubscription(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [subscription, setSubscription] = useState<BrokerSubscription>(defaultSubscription)
  const [isLoading, setIsLoading] = useState(enabled)

  const refreshSubscription = useCallback(async () => {
    setIsLoading(true)

    try {
      const { status, ok, data } = await requestBrokerSubscription()

      if (status >= 500) {
        return
      }

      if (!ok || !data?.subscription) {
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
    if (!enabled) return

    refreshSubscription().catch(() => {
      setIsLoading(false)
    })
  }, [enabled, refreshSubscription])

  return {
    subscription,
    refreshSubscription,
    isLoading,
  }
}
