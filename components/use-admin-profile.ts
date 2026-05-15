"use client"

import { useCallback, useEffect, useState } from "react"

export const ADMIN_PROFILE_STORAGE_KEY = "eme-admin-profile"
const ADMIN_PROFILE_UPDATED_EVENT = "eme-admin-profile-updated"

export type AdminProfile = {
  id: string
  name: string
  email: string
  whatsApp: string
  role: string
}

const defaultAdminProfile: AdminProfile = {
  id: "",
  name: "",
  email: "",
  whatsApp: "",
  role: "Gestão da plataforma",
}

function normalizeProfile(payload?: Partial<AdminProfile>) {
  return {
    ...defaultAdminProfile,
    ...payload,
  }
}

export function useAdminProfile() {
  const [profile, setProfile] = useState<AdminProfile>(defaultAdminProfile)
  const [isLoading, setIsLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = (await response.json().catch(() => null)) as
        | {
            profile?: {
              id: string
              name: string
              email: string
              phone: string
            }
          }
        | null

      if (!response.ok || !data?.profile) {
        setProfile(defaultAdminProfile)
        return
      }

      setProfile(
        normalizeProfile({
          id: data.profile.id,
          name: data.profile.name,
          email: data.profile.email,
          whatsApp: data.profile.phone,
        }),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProfile()

    function handleProfileUpdated() {
      refreshProfile().catch(() => null)
    }

    window.addEventListener(ADMIN_PROFILE_UPDATED_EVENT, handleProfileUpdated)

    return () => {
      window.removeEventListener(ADMIN_PROFILE_UPDATED_EVENT, handleProfileUpdated)
    }
  }, [refreshProfile])

  async function saveProfile(
    nextProfile: Partial<AdminProfile> & {
      currentPassword?: string
      newPassword?: string
    },
  ) {
    const response = await fetch("/api/admin/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        name: nextProfile.name,
        email: nextProfile.email,
        phone: nextProfile.whatsApp,
        currentPassword: nextProfile.currentPassword,
        newPassword: nextProfile.newPassword,
      }),
    })

    const data = (await response.json().catch(() => null)) as
      | { error?: string; profile?: { id: string; name: string; email: string; phone: string } }
      | null

    if (!response.ok || !data?.profile) {
      throw new Error(data?.error || "Não foi possível salvar a conta administrativa.")
    }

    const normalizedProfile = normalizeProfile({
      id: data.profile.id,
      name: data.profile.name,
      email: data.profile.email,
      whatsApp: data.profile.phone,
    })

    setProfile(normalizedProfile)
    window.dispatchEvent(new CustomEvent(ADMIN_PROFILE_UPDATED_EVENT, { detail: normalizedProfile }))
    return normalizedProfile
  }

  return { profile, saveProfile, refreshProfile, isLoading }
}
