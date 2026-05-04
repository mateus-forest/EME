"use client"

import { useCallback, useEffect, useState } from "react"

export type BrokerProfile = {
  id: string
  brokerId: string
  agencyId: string | null
  accountType: "BROKER_INDEPENDENT" | "BROKER_AGENCY_LINKED" | null
  fullName: string
  email: string
  creci: string
  whatsApp: string
  photoUrl: string
  description: string
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
              accountType: "BROKER_INDEPENDENT" | "BROKER_AGENCY_LINKED"
              name: string
              email: string
              phone: string
              photoUrl: string
              creci: string
              description: string
            }
          }
        | null

      if (!response.ok || !data?.profile) {
        setProfileState(defaultProfile)
        return
      }

      setProfileState(
        normalizeProfile({
          id: data.profile.id,
          brokerId: data.profile.brokerId,
          agencyId: data.profile.agencyId,
          accountType: data.profile.accountType,
          fullName: data.profile.name,
          email: data.profile.email,
          creci: data.profile.creci,
          whatsApp: data.profile.phone,
          photoUrl: data.profile.photoUrl,
          description: data.profile.description,
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

    window.addEventListener(PROFILE_UPDATED_EVENT, syncProfile)

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, syncProfile)
    }
  }, [refreshProfile])

  async function saveProfile(
    updates: Partial<BrokerProfile> & {
      currentPassword?: string
      newPassword?: string
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
      }),
    })

    const data = (await response.json().catch(() => null)) as
      | {
          error?: string
          profile?: {
            id: string
            brokerId: string
            agencyId: string | null
            accountType: "BROKER_INDEPENDENT" | "BROKER_AGENCY_LINKED"
            name: string
            email: string
            phone: string
            creci: string
            description: string
            photoUrl: string
          }
        }
      | null

    if (!response.ok || !data?.profile) {
      throw new Error(data?.error || "Não foi possível salvar a conta do corretor.")
    }

    const nextProfile = normalizeProfile({
      id: data.profile.id,
      brokerId: data.profile.brokerId,
      agencyId: data.profile.agencyId,
      accountType: data.profile.accountType,
      fullName: data.profile.name,
      email: data.profile.email,
      whatsApp: data.profile.phone,
      creci: data.profile.creci,
      description: data.profile.description,
      photoUrl: data.profile.photoUrl,
    })

    setProfileState(nextProfile)
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: nextProfile }))
    return nextProfile
  }

  return { profile, saveProfile, refreshProfile, isLoading }
}
