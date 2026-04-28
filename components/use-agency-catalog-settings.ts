"use client"

import { useEffect, useState } from "react"

export type AgencyCatalogSettings = {
  slug: string
  displayName: string
  logoUrl: string
  description: string
}

const STORAGE_KEY = "eme-agency-catalog-settings"
const SETTINGS_UPDATED_EVENT = "eme-agency-catalog-settings-updated"

const defaultSettings: AgencyCatalogSettings = {
  slug: "",
  displayName: "",
  logoUrl: "",
  description: "",
}

function clearLegacyCatalogStorage() {
  if (typeof window === "undefined") return

  window.localStorage.removeItem(STORAGE_KEY)
}

function notifyCatalogSettings(settings: AgencyCatalogSettings) {
  if (typeof window === "undefined") return

  clearLegacyCatalogStorage()
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: settings }))
}

export function useAgencyCatalogSettings() {
  const [settings, setSettingsState] = useState<AgencyCatalogSettings>(defaultSettings)

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/agencies/catalog", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const data = (await response.json().catch(() => null)) as
          | {
              settings?: AgencyCatalogSettings
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

  function saveSettings(updates: Partial<AgencyCatalogSettings>) {
    const nextSettings = {
      ...settings,
      ...updates,
      slug: settings.slug,
      displayName: settings.displayName,
    }

    setSettingsState(nextSettings)
    clearLegacyCatalogStorage()

    void fetch("/api/agencies/catalog", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        logoUrl: nextSettings.logoUrl,
        description: nextSettings.description,
      }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { settings?: AgencyCatalogSettings } | null

        if (response.ok && data?.settings) {
          setSettingsState(data.settings)
          notifyCatalogSettings(data.settings)
        }
      })
      .catch(() => null)
  }

  return { settings, saveSettings }
}
