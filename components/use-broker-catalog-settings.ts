"use client"

import { useEffect, useState } from "react"

export type BrokerCatalogSettings = {
  slug: string
  displayName: string
  photoUrl: string
  description: string
  specialty: string
  region: string
  transactions: 'SALE' | 'RENT' | 'BOTH'
  about: string
  featured: boolean
  rating: number
  reviewCount: number
  activeListings: number
  marketplaceProfileAvailable: boolean
}

const STORAGE_KEY = "eme-broker-catalog-settings"
const SETTINGS_UPDATED_EVENT = "eme-broker-catalog-settings-updated"

const defaultSettings: BrokerCatalogSettings = {
  slug: "",
  displayName: "",
  photoUrl: "",
  description: "",
  specialty: "",
  region: "",
  transactions: "BOTH",
  about: "",
  featured: false,
  rating: 0,
  reviewCount: 0,
  activeListings: 0,
  marketplaceProfileAvailable: false,
}

function clearLegacyCatalogStorage() {
  if (typeof window === "undefined") return

  window.localStorage.removeItem(STORAGE_KEY)
}

function notifyCatalogSettings(settings: BrokerCatalogSettings) {
  if (typeof window === "undefined") return

  clearLegacyCatalogStorage()
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }))
}

export function useBrokerCatalogSettings() {
  const [settings, setSettingsState] = useState<BrokerCatalogSettings>(defaultSettings)

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/brokers/catalog", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const data = (await response.json().catch(() => null)) as
          | {
              settings?: BrokerCatalogSettings
            }
          | null

        setSettingsState(data?.settings ?? defaultSettings)
      } catch {
        setSettingsState(defaultSettings)
      }
    }

    loadSettings()

    function syncSettings() {
      loadSettings().catch(() => null)
    }

    window.addEventListener("storage", syncSettings)
    window.addEventListener(SETTINGS_UPDATED_EVENT, syncSettings)

    return () => {
      window.removeEventListener("storage", syncSettings)
      window.removeEventListener(SETTINGS_UPDATED_EVENT, syncSettings)
    }
  }, [])

  async function saveSettings(updates: Partial<BrokerCatalogSettings>) {
    const nextSettings = {
      ...settings,
      ...updates,
    }

    setSettingsState(nextSettings)
    clearLegacyCatalogStorage()

    const response = await fetch("/api/brokers/catalog", {
      method: "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: nextSettings.displayName,
        slug: nextSettings.slug,
        photoUrl: nextSettings.photoUrl,
        description: nextSettings.description,
        specialty: nextSettings.specialty,
        region: nextSettings.region,
        transactions: nextSettings.transactions,
        about: nextSettings.about,
      }),
    })

    const data = (await response.json().catch(() => null)) as
      | { settings?: BrokerCatalogSettings; error?: string }
      | null

    if (!response.ok || !data?.settings) {
      setSettingsState(settings)
      throw new Error(data?.error ?? "Nao foi possivel salvar o catalogo.")
    }

    setSettingsState(data.settings)
    notifyCatalogSettings(data.settings)
    return data.settings
  }

  return { settings, saveSettings }
}
