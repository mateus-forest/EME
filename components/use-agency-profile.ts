"use client"

import { useCallback, useEffect, useState } from "react"

export type AgencyProfile = {
  id: string
  companyName: string
  ownerName: string
  email: string
  cnpj: string
  whatsApp: string
  logoUrl: string
}

const PROFILE_UPDATED_EVENT = "eme-agency-profile-updated"

const defaultProfile: AgencyProfile = {
  id: "",
  companyName: "",
  ownerName: "",
  email: "",
  cnpj: "",
  whatsApp: "",
  logoUrl: "",
}

function normalizeProfile(payload?: Partial<AgencyProfile>) {
  return {
    ...defaultProfile,
    ...payload,
  }
}

export function useAgencyProfile() {
  const [profile, setProfileState] = useState<AgencyProfile>(defaultProfile)
  const [isLoading, setIsLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/agencies/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = (await response.json().catch(() => null)) as
        | {
            profile?: {
              id: string
              companyName: string
              ownerName: string
              email: string
              phone: string
              cnpj: string
              logoUrl: string
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
          companyName: data.profile.companyName,
          ownerName: data.profile.ownerName,
          email: data.profile.email,
          cnpj: data.profile.cnpj,
          whatsApp: data.profile.phone,
          logoUrl: data.profile.logoUrl,
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
    updates: Partial<AgencyProfile> & {
      currentPassword?: string
      newPassword?: string
    },
  ) {
    const response = await fetch("/api/agencies/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        companyName: updates.companyName,
        ownerName: updates.ownerName,
        email: updates.email,
        phone: updates.whatsApp,
        cnpj: updates.cnpj,
        logoUrl: updates.logoUrl,
        currentPassword: updates.currentPassword,
        newPassword: updates.newPassword,
      }),
    })

    const data = (await response.json().catch(() => null)) as
      | { error?: string; profile?: { id: string; companyName: string; ownerName: string; email: string; phone: string; cnpj: string; logoUrl: string } }
      | null

    if (!response.ok || !data?.profile) {
      throw new Error(data?.error || "Não foi possível salvar a conta da imobiliária.")
    }

    const nextProfile = normalizeProfile({
      id: data.profile.id,
      companyName: data.profile.companyName,
      ownerName: data.profile.ownerName,
      email: data.profile.email,
      whatsApp: data.profile.phone,
      cnpj: data.profile.cnpj,
      logoUrl: data.profile.logoUrl,
    })

    setProfileState(nextProfile)
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: nextProfile }))
    return nextProfile
  }

  return { profile, saveProfile, refreshProfile, isLoading }
}
