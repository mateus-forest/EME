"use client"

import { useCallback, useEffect, useState } from "react"

import { dispatchEntitySync, subscribeEntitySync } from "@/lib/entity-sync"

export type BrokerProfile = {
  id: string
  brokerId: string
  agencyId: string | null
  accountType: "BROKER_INDEPENDENT" | null
  fullName: string
  email: string
  creci: string
  whatsApp: string
  photoUrl: string
  description: string
  pinConfigured: boolean
}

const PROFILE_UPDATED_EVENT = "eme-broker-profile-updated"

const defaultProfile: BrokerProfile = {
  id: "",
  brokerId: "",
  agencyId: null,
  accountType: null,
  fullName: "",
  email: "",
  creci: "",
  whatsApp: "",
  photoUrl: "",
  description: "",
  pinConfigured: false,
}

function normalizeProfile(payload?: Partial<BrokerProfile>) {
  return {
    ...defaultProfile,
    ...payload,
  }
}

export function useBrokerProfile() {
  const [profile, setProfileState] = useState<BrokerProfile>(defaultProfile)
  const [isLoading, setIsLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/brokers/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = (await response.json().catch(() => null)) as
        | {
            profile?: {
              id: string
              brokerId: string
              agencyId: string | null
              accountType: "BROKER_INDEPENDENT"
              name: string
              email: string
              phone: string
              photoUrl: string
              creci: string
              description: string
              pinConfigured?: boolean
            }
          }
        | null

      if (response.status >= 500) {
        return
      }

      if (!response.ok || !data?.profile) {
        setProfileState(defaultProfile)
        return
      }

      setProfileState(
        normalizeProfile({
          id: data.profile.id,
          brokerId: data.profile.brokerId,
          agencyId: null,
          accountType: "BROKER_INDEPENDENT",
          fullName: data.profile.name,
          email: data.profile.email,
          creci: data.profile.creci,
          whatsApp: data.profile.phone,
          photoUrl: data.profile.photoUrl,
          description: data.profile.description,
          pinConfigured: Boolean(data.profile.pinConfigured),
        }),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProfile()

    function syncProfile() {
      refreshProfile().catch(() => null)
    }

    const unsubscribeEntitySync = subscribeEntitySync((message) => {
      if (message.type === "broker") {
        refreshProfile().catch(() => null)
      }
    })

    window.addEventListener(PROFILE_UPDATED_EVENT, syncProfile)

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, syncProfile)
      unsubscribeEntitySync()
    }
  }, [refreshProfile])

  async function saveProfile(
    updates: Partial<BrokerProfile> & {
      currentPassword?: string
      newPassword?: string
      pinAction?: "set" | "remove"
      currentPin?: string
      newPin?: string
    },
  ) {
    const response = await fetch("/api/brokers/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        name: updates.fullName,
        email: updates.email,
        phone: updates.whatsApp,
        creci: updates.creci,
        description: updates.description,
        photoUrl: updates.photoUrl,
        currentPassword: updates.currentPassword,
        newPassword: updates.newPassword,
        pinAction: updates.pinAction,
        currentPin: updates.currentPin,
        newPin: updates.newPin,
      }),
    })

    const data = (await response.json().catch(() => null)) as
      | {
          error?: string
          profile?: {
            id: string
            brokerId: string
            agencyId: string | null
            accountType: "BROKER_INDEPENDENT"
            name: string
            email: string
            phone: string
            creci: string
            description: string
            photoUrl: string
            pinConfigured?: boolean
          }
        }
      | null

    if (!response.ok || !data?.profile) {
      throw new Error(data?.error || "Não foi possível salvar a conta do corretor.")
    }

    const nextProfile = normalizeProfile({
      id: data.profile.id,
      brokerId: data.profile.brokerId,
      agencyId: null,
      accountType: "BROKER_INDEPENDENT",
      fullName: data.profile.name,
      email: data.profile.email,
      whatsApp: data.profile.phone,
      creci: data.profile.creci,
      description: data.profile.description,
      photoUrl: data.profile.photoUrl,
      pinConfigured: Boolean(data.profile.pinConfigured),
    })

    setProfileState(nextProfile)
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: nextProfile }))
    dispatchEntitySync({ type: "broker", entityId: nextProfile.brokerId })
    return nextProfile
  }

  return { profile, saveProfile, refreshProfile, isLoading }
}
