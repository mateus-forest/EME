"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type BrokerCatalogSettings = {
  slug: string
  displayName: string
  photoUrl: string
  description: string
  bannerUrl: string
  headline: string
  bio: string
  experienceYears: number | null
  soldProperties: number | null
  serviceArea: string
  cities: string[]
  priceRange: string
  specialties: string[]
  differentials: string[]
  videoUrl: string
  creci: string
  creciUf: string
  creciValidationStatus: string
  creciVerified: boolean
  email: string
  whatsApp: string
}

const STORAGE_KEY = "eme-broker-catalog-settings"

const defaultSettings: BrokerCatalogSettings = {
  slug: "",
  displayName: "",
  photoUrl: "",
  description: "",
  bannerUrl: "",
  headline: "",
  bio: "",
  experienceYears: null,
  soldProperties: null,
  serviceArea: "",
  cities: [],
  priceRange: "",
  specialties: [],
  differentials: [],
  videoUrl: "",
  creci: "",
  creciUf: "",
  creciValidationStatus: "PENDING",
  creciVerified: false,
  email: "",
  whatsApp: "",
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
}

function normalizeSettings(value: unknown): BrokerCatalogSettings {
  const candidate = value && typeof value === "object" ? value as Partial<BrokerCatalogSettings> : {}
  return {
    ...defaultSettings,
    ...candidate,
    experienceYears: typeof candidate.experienceYears === "number" ? candidate.experienceYears : null,
    soldProperties: typeof candidate.soldProperties === "number" ? candidate.soldProperties : null,
    cities: normalizeList(candidate.cities),
    specialties: normalizeList(candidate.specialties),
    differentials: normalizeList(candidate.differentials),
    creciVerified: candidate.creciVerified === true,
  }
}

function clearLegacyCatalogStorage() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function useBrokerCatalogSettings() {
  const [settings, setSettingsState] = useState<BrokerCatalogSettings>(defaultSettings)
  const persistedSettingsRef = useRef<BrokerCatalogSettings>(defaultSettings)

  const commitSettings = useCallback((value: unknown) => {
    const normalized = normalizeSettings(value)
    persistedSettingsRef.current = normalized
    setSettingsState(normalized)
    return normalized
  }, [])

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/brokers/catalog", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })
        const data = await response.json().catch(() => null) as { settings?: unknown } | null
        commitSettings(data?.settings)
      } catch {
        commitSettings(defaultSettings)
      }
    }

    loadSettings()

    function syncSettings() {
      loadSettings().catch(() => null)
    }

    window.addEventListener("storage", syncSettings)
    return () => {
      window.removeEventListener("storage", syncSettings)
    }
  }, [commitSettings])

  async function saveSettings(updates: Partial<BrokerCatalogSettings>) {
    const nextSettings = normalizeSettings({ ...persistedSettingsRef.current, ...updates })
    clearLegacyCatalogStorage()

    const response = await fetch("/api/brokers/catalog", {
      method: "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: nextSettings.displayName,
        slug: nextSettings.slug,
        photoUrl: nextSettings.photoUrl,
        description: nextSettings.description,
        bannerUrl: nextSettings.bannerUrl,
        headline: nextSettings.headline,
        bio: nextSettings.bio,
        experienceYears: nextSettings.experienceYears,
        soldProperties: nextSettings.soldProperties,
        serviceArea: nextSettings.serviceArea,
        cities: nextSettings.cities,
        priceRange: nextSettings.priceRange,
        specialties: nextSettings.specialties,
        differentials: nextSettings.differentials,
        videoUrl: nextSettings.videoUrl,
      }),
    })

    const data = await response.json().catch(() => null) as { settings?: unknown; error?: string } | null
    if (!response.ok || !data?.settings) {
      throw new Error(data?.error ?? "Não foi possível salvar o catálogo.")
    }

    const savedSettings = commitSettings(data.settings)
    clearLegacyCatalogStorage()
    return savedSettings
  }

  function applyPersistedSettings(updates: Partial<BrokerCatalogSettings>) {
    persistedSettingsRef.current = normalizeSettings({ ...persistedSettingsRef.current, ...updates })
    clearLegacyCatalogStorage()
    return persistedSettingsRef.current
  }

  return { settings, saveSettings, applyPersistedSettings }
}
