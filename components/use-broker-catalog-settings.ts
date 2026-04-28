"use client"

import { useEffect, useState } from "react"

export type BrokerCatalogSettings = {
  slug: string
  displayName: string
  photoUrl: string
  description: string
}

const STORAGE_KEY = "eme-broker-catalog-settings"
const SETTINGS_UPDATED_EVENT = "eme-broker-catalog-settings-updated"

const defaultSettings: BrokerCatalogSettings = {
  slug: "",
  displayName: "",
  photoUrl: "",
  description: "",
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

  function saveSettings(updates: Partial<BrokerCatalogSettings>) {
    const nextSettings = {
      ...settings,
      ...updates,
      slug: settings.slug,
      displayName: settings.displayName,
    }

    setSettingsState(nextSettings)
    clearLegacyCatalogStorage()

    void fetch("/api/brokers/catalog", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photoUrl: nextSettings.photoUrl,
        description: nextSettings.description,
      }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { settings?: BrokerCatalogSettings } | null

        if (response.ok && data?.settings) {
          setSettingsState(data.settings)
          notifyCatalogSettings(data.settings)
        }
      })
      .catch(() => null)
  }

  return { settings, saveSettings }
}
