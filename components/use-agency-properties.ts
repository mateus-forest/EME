"use client"

import { useCallback, useEffect, useState } from "react"

import { getPropertyImage } from "@/lib/property-media"

export type AgencyProperty = {
  id: string
  titulo: string
  preco: string
  tipo: "Apartamento" | "Casa" | "Comercial"
  corretorId: string
  imobiliariaId?: string | null
  title: string
  city: string
  neighborhood: string
  location: string
  price: string
  bedrooms: number
  bathrooms: number
  parking: number
  status: "Publicado" | "Rascunho" | "Pausado"
  published: boolean
  marketplacePublished: boolean
  marketplaceSlug: string
  type: "Apartamento" | "Casa" | "Comercial"
  description: string
  broker: {
    id?: string
    name: string
    initials: string
  }
  views: number
  leads: number
  images: string[]
  image: string
  audioUrl: string
}

type PropertyApiItem = {
  id: string
  title: string
  description: string
  city: string
  neighborhood: string
  formattedPrice: string
  location: string
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  status: "Publicado" | "Rascunho" | "Pausado"
  published: boolean
  marketplacePublished: boolean
  marketplaceSlug: string
  type: "Apartamento" | "Casa" | "Comercial"
  brokerId: string
  agencyId: string | null
  broker: {
    id: string
    name: string
    initials: string
  }
  views: number
  leads: number
  images: string[]
  audioUrl: string
}

const PROPERTIES_UPDATED_EVENT = "eme-agency-properties-updated"

function normalizeAgencyProperty(property: PropertyApiItem): AgencyProperty {
  return {
    id: property.id,
    titulo: property.title,
    preco: property.formattedPrice,
    tipo: property.type,
    corretorId: property.brokerId,
    imobiliariaId: property.agencyId,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    location: property.location,
    price: property.formattedPrice,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parkingSpots,
    status: property.status,
    published: property.published,
    marketplacePublished: property.marketplacePublished,
    marketplaceSlug: property.marketplaceSlug,
    type: property.type,
    description: property.description,
    broker: property.broker,
    views: property.views,
    leads: property.leads,
    images: property.images,
    image: getPropertyImage(property.images[0], property.id),
    audioUrl: property.audioUrl,
  }
}

async function parsePropertiesResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | {
        error?: string
        properties?: PropertyApiItem[]
        property?: PropertyApiItem
      }
    | null

  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível carregar os imóveis da imobiliária.")
  }

  return data
}

async function parsePropertyResponse(response: Response) {
  const data = await parsePropertiesResponse(response)
  const property = data?.property ? normalizeAgencyProperty(data.property) : null

  if (!property) {
    throw new Error("Não foi possível sincronizar o imóvel.")
  }

  return property
}

export function useAgencyProperties() {
  const [properties, setProperties] = useState<AgencyProperty[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshProperties = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/properties/agency", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = await parsePropertiesResponse(response)
      const nextProperties = (data?.properties ?? []).map(normalizeAgencyProperty)
      setProperties(nextProperties)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProperties().catch(() => {
      setProperties([])
      setIsLoading(false)
    })

    function syncProperties() {
      refreshProperties().catch(() => null)
    }

    window.addEventListener(PROPERTIES_UPDATED_EVENT, syncProperties)
    return () => window.removeEventListener(PROPERTIES_UPDATED_EVENT, syncProperties)
  }, [refreshProperties])

  async function addProperty(property: Omit<AgencyProperty, "id" | "marketplacePublished" | "marketplaceSlug"> | AgencyProperty) {
    const response = await fetch("/api/properties/agency", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        title: property.title,
        description: property.description,
        price: property.price,
        city: property.city,
        neighborhood: property.neighborhood,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parkingSpots: property.parking,
        type: property.type,
        status: property.status,
        brokerId: property.broker.id || undefined,
        images: property.image ? [property.image] : [],
      }),
    })

    const data = await parsePropertiesResponse(response)
    const created = data?.property ? normalizeAgencyProperty(data.property) : null
    if (!created) {
      throw new Error("Não foi possível criar o imóvel.")
    }

    setProperties((current) => [created, ...current])
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: created }))
    return created
  }

  async function uploadPropertyImages(id: string, files: File[]) {
    const formData = new FormData()
    files.slice(0, 6).forEach((file) => formData.append("images", file))

    const response = await fetch(`/api/properties/${id}/images`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: formData,
    })

    const updated = await parsePropertyResponse(response)
    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    return updated
  }

  async function deletePropertyImage(id: string, imageUrl: string) {
    const response = await fetch(`/api/properties/${id}/images?imageUrl=${encodeURIComponent(imageUrl)}`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    })

    const updated = await parsePropertyResponse(response)
    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    return updated
  }

  async function updateProperty(id: string, updates: Partial<AgencyProperty>) {
    const response = await fetch(`/api/properties/agency/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        title: updates.title,
        description: updates.description,
        price: updates.price,
        neighborhood: updates.neighborhood,
        city: updates.city,
        bedrooms: updates.bedrooms,
        bathrooms: updates.bathrooms,
        parkingSpots: updates.parking,
        type: updates.type,
        brokerId: updates.broker?.id,
        images: updates.images ?? (updates.image ? [updates.image] : undefined),
      }),
    })

    const data = await parsePropertiesResponse(response)
    const updated = data?.property ? normalizeAgencyProperty(data.property) : null
    if (!updated) {
      throw new Error("Não foi possível atualizar o imóvel.")
    }

    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    return updated
  }

  async function deleteProperty(id: string) {
    const response = await fetch(`/api/properties/agency/${id}`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    })

    const data = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      throw new Error(data?.error || "Não foi possível excluir o imóvel.")
    }

    setProperties((current) => current.filter((property) => property.id !== id))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: { id } }))
  }

  async function publishProperty(id: string, status: AgencyProperty["status"]) {
    const response = await fetch(`/api/properties/agency/${id}/publish`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ status }),
    })

    const data = await parsePropertiesResponse(response)
    const updated = data?.property ? normalizeAgencyProperty(data.property) : null
    if (!updated) {
      throw new Error("Não foi possível atualizar o status do imóvel.")
    }

    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    return updated
  }

  async function publishPropertyToMarketplace(id: string, published: boolean) {
    const response = await fetch(`/api/properties/${id}/marketplace`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ published }),
    })

    const updated = await parsePropertyResponse(response)
    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    return updated
  }

  async function uploadPropertyAudio(id: string, file: File) {
    const formData = new FormData()
    formData.append("audio", file)

    const response = await fetch(`/api/properties/${id}/audio`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: formData,
    })

    const updated = await parsePropertyResponse(response)
    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    return updated
  }

  async function deletePropertyAudio(id: string) {
    const response = await fetch(`/api/properties/${id}/audio`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    })

    const updated = await parsePropertyResponse(response)
    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    return updated
  }

  return {
    properties,
    addProperty,
    updateProperty,
    deleteProperty,
    publishProperty,
    publishPropertyToMarketplace,
    uploadPropertyImages,
    deletePropertyImage,
    uploadPropertyAudio,
    deletePropertyAudio,
    refreshProperties,
    isLoading,
  }
}
