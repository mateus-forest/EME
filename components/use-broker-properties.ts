"use client"

import { useCallback, useEffect, useState } from "react"

import { dispatchEntitySync, subscribeEntitySync } from "@/lib/entity-sync"
import { isEmeActivePropertyLabel } from "@/lib/eme-plans"
import type { CompletionSummary, EntityDocumentRecord, PropertyLegalData } from "@/lib/legal-entities"
import { getPropertyImages } from "@/lib/property-media"

export type BrokerPropertyType = "Apartamento" | "Casa" | "Comercial" | "Terreno" | "Sala comercial" | "Loja" | "Cobertura"
export type BrokerPropertyPurpose = "Venda" | "Locação"

export type BrokerProperty = {
  id: string
  publicCode: number | null
  titulo: string
  preco: string
  tipo: BrokerPropertyType
  corretorId: string
  imobiliariaId?: string | null
  title: string
  city: string
  neighborhood: string
  location: string
  ownerName: string
  priceValue: number
  price: string
  images: string[]
  bedrooms: number
  bathrooms: number
  parking: number
  status: "Publicado" | "Rascunho" | "Pausado"
  published: boolean
  views: string
  leads: string
  type: BrokerPropertyType
  purpose: BrokerPropertyPurpose
  description: string
  audioUrl: string
  legal: PropertyLegalData
  documents: EntityDocumentRecord[]
  completion: CompletionSummary
}

type BrokerPropertyInput = Omit<BrokerProperty, "id" | "publicCode" | "published" | "priceValue"> & {
  id?: string
  published?: boolean
}

type PropertyApiItem = {
  id: string
  publicCode: number | null
  title: string
  description: string
  price: number
  formattedPrice: string
  city: string
  neighborhood: string
  location: string
  ownerName: string
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  type: BrokerPropertyType
  purpose: BrokerPropertyPurpose
  status: "Publicado" | "Rascunho" | "Pausado"
  published: boolean
  images: string[]
  views: number
  leads: number
  brokerId: string
  agencyId: string | null
  audioUrl: string
  legal: PropertyLegalData
  documents: EntityDocumentRecord[]
  completion: CompletionSummary
}

const PROPERTIES_UPDATED_EVENT = "eme-broker-properties-updated"

function normalizeBrokerProperty(property: PropertyApiItem): BrokerProperty {
  const normalizedStatus = isEmeActivePropertyLabel(property.status) ? property.status : "Rascunho"

  return {
    id: property.id,
    publicCode: property.publicCode ?? null,
    titulo: property.title,
    preco: property.formattedPrice,
    tipo: property.type,
    corretorId: property.brokerId,
    imobiliariaId: null,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    location: property.location,
    ownerName: property.ownerName,
    priceValue: property.price,
    price: property.formattedPrice,
    images: getPropertyImages(property.images, property.id),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parkingSpots,
    status: normalizedStatus,
    published: property.published,
    views: String(property.views),
    leads: String(property.leads),
    type: property.type,
    purpose: property.purpose,
    description: property.description,
    audioUrl: property.audioUrl,
    legal: property.legal,
    documents: property.documents,
    completion: property.completion,
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
    const error = new Error(data?.error || "Não foi possível carregar os imóveis do corretor.") as Error & {
      status?: number
    }
    error.status = response.status
    throw error
  }

  return data
}

async function parsePropertyResponse(response: Response) {
  const data = await parsePropertiesResponse(response)
  const property = data?.property ? normalizeBrokerProperty(data.property) : null

  if (!property) {
    throw new Error("Não foi possível sincronizar o imóvel.")
  }

  return property
}

export function useBrokerProperties() {
  const [properties, setProperties] = useState<BrokerProperty[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshProperties = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/properties/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      const data = await parsePropertiesResponse(response)
      const nextProperties = (data?.properties ?? []).map(normalizeBrokerProperty)
      setProperties(nextProperties)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProperties().catch((caughtError) => {
      const status = caughtError instanceof Error ? (caughtError as Error & { status?: number }).status : undefined
      if (!(status && status >= 500)) {
        setProperties([])
      }
      setIsLoading(false)
    })

    function syncProperties() {
      refreshProperties().catch(() => null)
    }

    const unsubscribeEntitySync = subscribeEntitySync((message) => {
      if (message.type === "property") {
        refreshProperties().catch(() => null)
      }
    })

    window.addEventListener(PROPERTIES_UPDATED_EVENT, syncProperties)
    return () => {
      window.removeEventListener(PROPERTIES_UPDATED_EVENT, syncProperties)
      unsubscribeEntitySync()
    }
  }, [refreshProperties])

  async function addProperty(property: BrokerPropertyInput) {
    const response = await fetch("/api/properties", {
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
        purpose: property.purpose,
        status: property.status,
        images: property.images,
      }),
    })

    const data = await parsePropertiesResponse(response)
    const created = data?.property ? normalizeBrokerProperty(data.property) : null
    if (!created) {
      throw new Error("Não foi possível criar o imóvel.")
    }

    setProperties((current) => [created, ...current])
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: created }))
    dispatchEntitySync({ type: "property", entityId: created.id })
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
    dispatchEntitySync({ type: "property", entityId: id })
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
    dispatchEntitySync({ type: "property", entityId: id })
    return updated
  }

  async function updateProperty(id: string, updates: Partial<BrokerPropertyInput>) {
    const response = await fetch(`/api/properties/${id}`, {
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
        city: updates.city,
        neighborhood: updates.neighborhood,
        bedrooms: updates.bedrooms,
        bathrooms: updates.bathrooms,
        parkingSpots: updates.parking,
        type: updates.type,
        purpose: updates.purpose,
        images: updates.images,
      }),
    })

    const data = await parsePropertiesResponse(response)
    const updated = data?.property ? normalizeBrokerProperty(data.property) : null
    if (!updated) {
      throw new Error("Não foi possível atualizar o imóvel.")
    }

    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    dispatchEntitySync({ type: "property", entityId: id })
    return updated
  }

  async function deleteProperty(id: string) {
    const response = await fetch(`/api/properties/${id}`, {
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
    dispatchEntitySync({ type: "property", entityId: id })
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
    dispatchEntitySync({ type: "property", entityId: id })
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
    dispatchEntitySync({ type: "property", entityId: id })
    return updated
  }

  async function publishProperty(id: string, status: BrokerProperty["status"]) {
    const response = await fetch(`/api/properties/${id}/publish`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        status,
      }),
    })

    const data = await parsePropertiesResponse(response)
    const updated = data?.property ? normalizeBrokerProperty(data.property) : null
    if (!updated) {
      throw new Error("Não foi possível atualizar o status do imóvel.")
    }

    setProperties((current) => current.map((property) => (property.id === id ? updated : property)))
    window.dispatchEvent(new CustomEvent(PROPERTIES_UPDATED_EVENT, { detail: updated }))
    dispatchEntitySync({ type: "property", entityId: id })
    return updated
  }

  return {
    properties,
    addProperty,
    updateProperty,
    deleteProperty,
    publishProperty,
    uploadPropertyImages,
    deletePropertyImage,
    uploadPropertyAudio,
    deletePropertyAudio,
    refreshProperties,
    isLoading,
  }
}
