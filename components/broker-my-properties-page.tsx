"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Bath, BedDouble, BookOpenCheck, CarFront, CircleAlert, FileText, Filter, ImagePlus, MapPin, Mic, MoreHorizontal, PencilLine, Plus, Store, Trash2, X } from "lucide-react"
import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { BrokerPageShell } from "@/components/broker-page-shell"
import {
  isPropertyPublicationBlockedError,
  useBrokerProperties,
  type BrokerProperty as Property,
  type PropertyPublicationBlockedError,
} from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { lookupCep } from "@/lib/cep"
import { isEmeActivePropertyLabel } from "@/lib/eme-plans"
import type { EntityDocumentRecord, PropertyLegalData } from "@/lib/legal-entities"
import { requestPropertyAi } from "@/lib/property-ai-client"
import { getPropertyImage } from "@/lib/property-media"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type EditableProperty = {
  id: string
  title: string
  city: string
  neighborhood: string
  ownerName: string
  price: string
  images: string[]
  bedrooms: number
  bathrooms: number
  parking: number
  status: "Publicado" | "Rascunho" | "Pausado"
  type: Property["type"]
  purpose: Property["purpose"]
  description: string
  audioUrl: string
  legal: PropertyLegalData
  documents: EntityDocumentRecord[]
  completion: Property["completion"]
}

const propertyDocumentLabels = ["Matrícula", "Escritura", "IPTU", "Planta", "Convenção", "Outros"]

function mapPropertyToEditable(property: Property): EditableProperty {
  return {
    id: property.id,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    ownerName: property.ownerName,
    price: property.price,
    images: [...property.images],
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    status: property.status,
    type: property.type,
    purpose: property.purpose,
    description: property.description,
    audioUrl: property.audioUrl,
    legal: property.legal,
    documents: property.documents,
    completion: property.completion,
  }
}

function getPlanDisplayName(planName: string | null | undefined) {
  if (!planName) return "seu plano atual"
  return planName.replace(/^Plano EME\s+/i, "").replace(/^Plano\s+/i, "").trim()
}

export function BrokerMyPropertiesPage({ initialPropertyId }: { initialPropertyId?: string }) {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const routePropertyId = initialPropertyId ?? (typeof params?.id === "string" ? params.id : undefined)
  const {
    properties,
    updateProperty,
    deleteProperty,
    publishProperty,
    publishPropertyToMarketplace,
    uploadPropertyImages,
    deletePropertyImage,
    uploadPropertyAudio,
    deletePropertyAudio,
    isLoading: isLoadingProperties,
  } = useBrokerProperties()
  const { subscription } = useBrokerSubscription()
  const [search, setSearch] = useState("")
  const allPropertyTypes: Array<Property["type"]> = ["Casa", "Apartamento", "Comercial", "Terreno", "Sala comercial", "Loja", "Cobertura"]
  const [typeFilters, setTypeFilters] = useState<Array<Property["type"]>>(allPropertyTypes)
  const [priceFilters, setPriceFilters] = useState<string[]>(["low", "mid", "high"])
  const [editingProperty, setEditingProperty] = useState<EditableProperty | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saveSuccessFeedback, setSaveSuccessFeedback] = useState("")
  const [listFeedback, setListFeedback] = useState("")
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [isLoadingCep, setIsLoadingCep] = useState(false)
  const [aiHighlights, setAiHighlights] = useState<string[]>([])
  const [publicationBlock, setPublicationBlock] = useState<{
    property: Property
    error: PropertyPublicationBlockedError
  } | null>(null)
  const dismissedRoutePropertyIdRef = useRef<string | null>(null)
  const pendingRoutePropertyIdRef = useRef<string | null>(null)
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activePropertiesCount = useMemo(
    () => properties.filter((property) => isEmeActivePropertyLabel(property.status)).length,
    [properties],
  )
  const propertyLimit = subscription.propertyLimit ?? 5
  const hasReachedLimit = subscription.isProfileResolved && activePropertiesCount >= propertyLimit
  const currentPlanName = getPlanDisplayName(subscription.planName)
  const propertyLimitMessage = `Você atingiu o limite de ${propertyLimit} imóveis ativos do plano ${currentPlanName}.`
  const propertyLimitDescription = "Faça upgrade para publicar novos imóveis e desbloquear mais capacidade na sua operação."
  const normalizedSearch = search.trim().toLowerCase()
  const filteredProperties = useMemo(
    () =>
      properties.filter((property) => {
        const matchesSearch = normalizedSearch ? [property.title, property.city, property.neighborhood, property.publicCode ? String(property.publicCode) : ""].some((field) => field.toLowerCase().includes(normalizedSearch)) : true
        const matchesType = typeFilters.includes(property.type)
        const numericPrice = Number(property.price.replace(/\D/g, "")) / 100
        const matchesPrice =
          priceFilters.length === 0 ||
          priceFilters.some((filter) => {
            if (filter === "low") return numericPrice <= 800000
            if (filter === "mid") return numericPrice > 800000 && numericPrice <= 2000000
            return numericPrice > 2000000
          })
        return matchesSearch && matchesType && matchesPrice
      }),
    [properties, normalizedSearch, typeFilters, priceFilters],
  )
  const hasProperties = filteredProperties.length > 0
  const hasActiveFilters =
    normalizedSearch.length > 0 || typeFilters.length < allPropertyTypes.length || priceFilters.length < 3

  const openEditModal = useCallback((property: Property) => {
    dismissedRoutePropertyIdRef.current = null
    setEditingProperty(mapPropertyToEditable(property))
    setSaveFeedback("")
    setSaveError("")
    setAiHighlights([])
    setIsEditModalOpen(true)
    if (routePropertyId !== property.id) {
      pendingRoutePropertyIdRef.current = property.id
      router.push(`/corretor/imoveis/${property.id}`, { scroll: false })
    } else {
      pendingRoutePropertyIdRef.current = null
    }
  }, [routePropertyId, router])

  const showSaveSuccess = useCallback((message: string) => {
    if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current)
    setSaveSuccessFeedback(message)
    saveSuccessTimeoutRef.current = setTimeout(() => setSaveSuccessFeedback(""), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (saveSuccessTimeoutRef.current) clearTimeout(saveSuccessTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!routePropertyId) {
      if (pendingRoutePropertyIdRef.current && pendingRoutePropertyIdRef.current === editingProperty?.id) return
      dismissedRoutePropertyIdRef.current = null
      if (editingProperty || isEditModalOpen) {
        setIsEditModalOpen(false)
        setEditingProperty(null)
        setSaveFeedback("")
        setAiHighlights([])
      }
      return
    }

    if (pendingRoutePropertyIdRef.current === routePropertyId) pendingRoutePropertyIdRef.current = null
    if (dismissedRoutePropertyIdRef.current === routePropertyId) return

    const routeProperty = properties.find((item) => item.id === routePropertyId) ?? null
    if (!routeProperty) {
      if (!isLoadingProperties) {
        dismissedRoutePropertyIdRef.current = routePropertyId
        router.replace("/corretor/imoveis", { scroll: false })
      }
      return
    }

    if (editingProperty?.id !== routePropertyId) {
      setEditingProperty(mapPropertyToEditable(routeProperty))
      setSaveFeedback("")
      setAiHighlights([])
    }
    if (!isEditModalOpen) setIsEditModalOpen(true)
  }, [editingProperty, isEditModalOpen, isLoadingProperties, properties, routePropertyId, router])

  function clearFilters() {
    setSearch("")
    setTypeFilters(allPropertyTypes)
    setPriceFilters(["low", "mid", "high"])
  }

  function toggleFilter<T extends string>(value: T, current: T[], onChange: (next: T[]) => void) {
    onChange(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  function closeEditModal(open: boolean) {
    setIsEditModalOpen(open)
    if (!open) {
      dismissedRoutePropertyIdRef.current = editingProperty?.id ?? routePropertyId ?? null
      pendingRoutePropertyIdRef.current = null
      if (routePropertyId || editingProperty) {
        router.replace("/corretor/imoveis", { scroll: false })
      }
      setEditingProperty(null)
      setSaveFeedback("")
      setSaveError("")
      setAiHighlights([])
    }
  }

  function updateField<K extends keyof EditableProperty>(field: K, value: EditableProperty[K]) {
    setEditingProperty((current) => (current ? { ...current, [field]: value } : current))
  }

  function updateLegalField<K extends keyof PropertyLegalData>(field: K, value: PropertyLegalData[K]) {
    setEditingProperty((current) =>
      current
        ? {
            ...current,
            legal: {
              ...current.legal,
              [field]: value,
            },
          }
        : current,
    )
  }

  async function addPropertyPhotos(files: FileList | null) {
    if (!editingProperty || !files) return

    try {
      const updatedProperty = await uploadPropertyImages(editingProperty.id, Array.from(files))
      updateField("images", updatedProperty.images)
      setSaveFeedback("Imagens enviadas com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível enviar as imagens.")
    }
  }

  async function removePhoto(index: number) {
    if (!editingProperty) return

    try {
      const imageUrl = editingProperty.images[index]
      const updatedProperty = await deletePropertyImage(editingProperty.id, imageUrl)
      updateField("images", updatedProperty.images)
      setSaveFeedback("Imagem removida com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível remover a imagem.")
    }
  }

  async function makeCover(index: number) {
    if (!editingProperty) return
    const nextImages = [...editingProperty.images]
    const [image] = nextImages.splice(index, 1)
    if (!image) return
    nextImages.unshift(image)
    updateField("images", nextImages)
    try {
      const updatedProperty = await updateProperty(editingProperty.id, { images: nextImages })
      updateField("images", updatedProperty.images)
      setSaveFeedback("Imagem principal atualizada")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar a imagem principal.")
    }
  }

  async function saveChanges() {
    if (!editingProperty) return
    setSaveError("")
    try {
      await updateProperty(editingProperty.id, editingProperty)
      closeEditModal(false)
      showSaveSuccess("Alterações salvas com sucesso.")
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar as alterações.")
    }
  }

  async function uploadAudio(files: FileList | null) {
    if (!editingProperty || !files?.[0]) return

    try {
      const updatedProperty = await uploadPropertyAudio(editingProperty.id, files[0])
      updateField("audioUrl", updatedProperty.audioUrl)
      setSaveFeedback("Áudio enviado com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível enviar o áudio.")
    }
  }

  async function removeAudio() {
    if (!editingProperty?.audioUrl) return

    try {
      const updatedProperty = await deletePropertyAudio(editingProperty.id)
      updateField("audioUrl", updatedProperty.audioUrl)
      setSaveFeedback("Áudio removido com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível remover o áudio.")
    }
  }

  async function generateDescriptionWithAi() {
    if (!editingProperty) return

    setIsGeneratingAi(true)
    setSaveFeedback("")

    try {
      const generated = await requestPropertyAi({
        title: editingProperty.title,
        type: editingProperty.type,
        city: editingProperty.city,
        neighborhood: editingProperty.neighborhood,
        price: editingProperty.price,
        purpose: editingProperty.purpose,
        bedrooms: editingProperty.bedrooms,
        bathrooms: editingProperty.bathrooms,
        parkingSpots: editingProperty.parking,
        description: editingProperty.description,
        address: [editingProperty.legal.street, editingProperty.legal.number].filter(Boolean).join(", "),
        state: editingProperty.legal.state,
        privateArea: editingProperty.legal.privateArea,
        totalArea: editingProperty.legal.totalArea,
        condominiumName: editingProperty.legal.condominiumName,
      })

      updateField("description", generated.description)

      if (!editingProperty.title.trim() && generated.suggestedTitle) {
        updateField("title", generated.suggestedTitle)
      }

      setAiHighlights(generated.highlights)
      setSaveFeedback("Descrição gerada com IA")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível gerar a descrição com IA.")
    } finally {
      setIsGeneratingAi(false)
    }
  }

  async function handleDeleteProperty(id: string) {
    const confirmed = window.confirm("Tem certeza que deseja excluir?")
    if (!confirmed) return
    try {
      await deleteProperty(id)
      setListFeedback("Imóvel excluído com sucesso.")
      window.setTimeout(() => setListFeedback(""), 2500)
      if (editingProperty?.id === id) closeEditModal(false)
    } catch (caughtError) {
      setListFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o imóvel.")
      window.setTimeout(() => setListFeedback(""), 2500)
    }
  }

  function handlePublicationFailure(caughtError: unknown, property: Property, fallback: string) {
    if (isPropertyPublicationBlockedError(caughtError)) {
      setPublicationBlock({ property, error: caughtError })
      setListFeedback("")
      return
    }

    setListFeedback(caughtError instanceof Error ? caughtError.message : fallback)
    window.setTimeout(() => setListFeedback(""), 2500)
  }

  async function toggleCatalog(property: Property) {
    const nextStatus = property.published ? "Rascunho" : "Publicado"
    try {
      await publishProperty(property.id, nextStatus)
      setListFeedback(property.published ? "Imóvel despublicado do Catálogo." : "Imóvel publicado no Catálogo.")
      window.setTimeout(() => setListFeedback(""), 2500)
    } catch (caughtError) {
      handlePublicationFailure(caughtError, property, "Não foi possível atualizar o Catálogo.")
    }
  }

  async function toggleMarketplace(property: Property) {
    try {
      const nextPublished = !property.marketplacePublished
      await publishPropertyToMarketplace(property.id, nextPublished)
      setListFeedback(nextPublished ? 'Imóvel publicado no Marketplace.' : 'Imóvel removido do Marketplace.')
      window.setTimeout(() => setListFeedback(''), 2500)
    } catch (caughtError) {
      handlePublicationFailure(caughtError, property, 'Não foi possível atualizar o Marketplace.')
    }
  }

  async function applyPropertyCep() {
    if (!editingProperty) return
    setIsLoadingCep(true)

    try {
      const result = await lookupCep(editingProperty.legal.cep)
      setEditingProperty((current) =>
        current
          ? {
              ...current,
              city: result.city || current.city,
              neighborhood: result.district || current.neighborhood,
              legal: {
                ...current.legal,
                cep: result.cep,
                street: result.street || current.legal.street,
                complement: current.legal.complement || result.complement,
                district: result.district || current.legal.district,
                city: result.city || current.legal.city,
                state: result.state || current.legal.state,
              },
            }
          : current,
      )
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível localizar o CEP.")
    } finally {
      setIsLoadingCep(false)
    }
  }

  async function addPropertyDocuments(label: string, files: FileList | null) {
    if (!editingProperty || !files?.length) return

    const nextDocuments = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: crypto.randomUUID(),
        label,
        name: file.name,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        url: await readFileAsDataUrl(file),
      })),
    )

    setEditingProperty((current) =>
      current
        ? {
            ...current,
            documents: [...current.documents, ...nextDocuments],
          }
        : current,
    )
  }

  return (
    <>
      {saveSuccessFeedback ? (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-[100] flex justify-center px-4" role="status" aria-live="polite">
          <div className="w-fit max-w-[calc(100vw-2rem)] rounded-full border border-[#009b3a]/15 bg-[#eef9f1]/95 px-4 py-2.5 text-sm font-medium text-[#0b7a33] shadow-[0_20px_40px_rgba(15,23,42,0.10)] backdrop-blur-md">
            {saveSuccessFeedback}
          </div>
        </div>
      ) : null}
      <BrokerPageShell
        title="Imóveis"
        searchPlaceholder="Buscar por imóvel, bairro ou código"
        searchValue={search}
        onSearchChange={setSearch}
        primaryActionLabel="Novo imóvel"
        primaryActionHref="/corretor/novo-imovel"
        primaryActionOnClick={hasReachedLimit ? () => setIsLimitModalOpen(true) : () => router.push("/corretor/novo-imovel")}
        headerControls={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8.5 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]">
                <Filter className="size-4" />
                Filtros
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 rounded-2xl border-black/[0.06] bg-white/95 p-2 text-[#050505] shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <DropdownMenuLabel className="text-[#6B7280]">Tipo</DropdownMenuLabel>
              {allPropertyTypes.map((type) => (
                <DropdownMenuCheckboxItem key={type} checked={typeFilters.includes(type)} onCheckedChange={() => toggleFilter(type, typeFilters, setTypeFilters)} className="rounded-xl text-[#050505]/80 focus:bg-[#f6f7f4]">{type}</DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator className="bg-white" />
              <DropdownMenuLabel className="text-[#6B7280]">Faixa de preço</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={priceFilters.includes("low")} onCheckedChange={() => toggleFilter("low", priceFilters, setPriceFilters)} className="rounded-xl text-[#050505]/80 focus:bg-[#f6f7f4]">Até R$ 800 mil</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={priceFilters.includes("mid")} onCheckedChange={() => toggleFilter("mid", priceFilters, setPriceFilters)} className="rounded-xl text-[#050505]/80 focus:bg-[#f6f7f4]">R$ 800 mil a R$ 2 mi</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={priceFilters.includes("high")} onCheckedChange={() => toggleFilter("high", priceFilters, setPriceFilters)} className="rounded-xl text-[#050505]/80 focus:bg-[#f6f7f4]">Acima de R$ 2 mi</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white" />
              <Button type="button" variant="ghost" onClick={clearFilters} className="mt-2 h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]">
                Limpar filtros
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {listFeedback && (
          <div className="mb-4 rounded-[1.25rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
            {listFeedback}
          </div>
        )}
        {hasReachedLimit && (
          <div className="hidden">
            Você atingiu o limite gratuito de 3 imóveis. Faça upgrade para continuar publicando.
          </div>
        )}
        {hasReachedLimit && (
          <div className="mb-4 rounded-[1.35rem] border border-[#009b3a]/14 bg-[linear-gradient(180deg,rgba(0,155,58,0.05)_0%,rgba(0,155,58,0.02)_100%)] px-4 py-4 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-[#050505]">Você atingiu o limite do seu plano.</p>
                <p className="text-[#5F6B7A]">{propertyLimitDescription}</p>
                <p className="text-[#009b3a]">{propertyLimitMessage}</p>
              </div>
              <Button asChild variant="ghost" className="h-9 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]">
                <Link href="/corretor/plano">Ver planos</Link>
              </Button>
            </div>
          </div>
        )}
        {hasActiveFilters && (
          <div className="mb-4 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Filtrando resultados...</span>
              <Button type="button" variant="ghost" onClick={clearFilters} className="h-8 rounded-lg border border-black/[0.06] bg-white/80 px-3 text-xs text-[#4B5563] hover:bg-white hover:text-[#050505]">
                Limpar filtros
              </Button>
            </div>
          </div>
        )}

        {hasProperties ? (
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 min-[1380px]:grid-cols-4">
            {filteredProperties.map((property) => (
              <Card
                key={property.id}
                className="flex h-full min-w-0 flex-col overflow-hidden rounded-[1.15rem] border-black/[0.065] bg-white/94 py-0 shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition-all hover:-translate-y-0.5 hover:border-[#009b3a]/14 hover:shadow-[0_16px_38px_rgba(15,23,42,0.07)]"
              >
                <CardContent className="flex h-full min-w-0 flex-col gap-3 p-2.5 sm:p-3">
                  <div className={`relative min-h-0 w-full overflow-hidden rounded-[0.9rem] border border-black/[0.055] ${getPropertyImage(property.images?.[0] ?? null, property.id) ? "aspect-[16/9] bg-[#fbfbf8]" : "aspect-[16/9] bg-[linear-gradient(180deg,#f8faf8_0%,#f3f5f2_100%)]"}`}>
                    {getPropertyImage(property.images?.[0] ?? null, property.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getPropertyImage(property.images?.[0] ?? null, property.id)} alt={property.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl border border-black/[0.05] bg-white/70">
                          <ImagePlus className="size-5 text-[#8B95A1]" />
                        </div>
                        <p className="mt-2 text-xs font-medium text-[#5F6B7A]">Sem imagem cadastrada</p>
                      </div>
                    )}
                    {getPropertyImage(property.images?.[0] ?? null, property.id) ? <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" /> : null}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
                      {property.published ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#009b3a]/16 bg-white/92 px-2 py-0.5 text-[10px] font-semibold text-[#008633] backdrop-blur-md">
                          <BookOpenCheck className="size-3" /> Catálogo
                        </span>
                      ) : null}
                      {property.marketplacePublished ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#009b3a]/16 bg-white/92 px-2 py-0.5 text-[10px] font-semibold text-[#008633] backdrop-blur-md">
                          <Store className="size-3" /> Marketplace
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-0.5">
                    <div className="min-w-0">
                      {property.publicCode ? (
                        <span className="mb-1.5 inline-flex rounded-full border border-[#009b3a]/14 bg-[#009b3a]/7 px-2 py-0.5 text-[10px] font-semibold text-[#008633]">
                          Imóvel {property.publicCode}
                        </span>
                      ) : null}
                      <h2 className="line-clamp-1 text-base font-semibold leading-tight text-[#111827]">{property.title}</h2>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#667085]">
                        <MapPin className="size-3.5 shrink-0 text-[#009b3a]" />
                        <span className="truncate">{property.location}</span>
                      </div>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-[#111827]">{property.price}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs text-[#667085]">
                      <Spec icon={BedDouble} value={`${property.bedrooms} quartos`} />
                      <Spec icon={Bath} value={`${property.bathrooms} banheiros`} />
                      <Spec icon={CarFront} value={`${property.parking} vagas`} />
                    </div>
                  </div>

                  <div className="mt-auto flex min-w-0 flex-col gap-2.5 px-0.5 pb-0.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <MetricCard label="Visualizações" value={property.views} />
                      <MetricCard label="Leads" value={property.leads} />
                    </div>

                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Button asChild className="h-8 min-w-0 rounded-lg bg-[#009b3a] px-3 text-xs font-semibold text-white shadow-none hover:bg-[#008633]">
                        <Link href={`/corretor/imoveis/${property.id}`} scroll={false}>
                          Ver imóvel
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg border border-black/[0.07] bg-white text-[#667085] hover:bg-[#f7f8f5] hover:text-[#111827]">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Mais ações para {property.title}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl border-black/[0.07] bg-white p-1.5 text-[#344054]">
                          <DropdownMenuItem onSelect={() => openEditModal(property)} className="rounded-lg"><PencilLine className="size-4" />Editar imóvel</DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-black/[0.06]" />
                          <DropdownMenuItem onSelect={() => void toggleCatalog(property)} className="rounded-lg"><BookOpenCheck className="size-4" />{property.published ? "Despublicar do Catálogo" : "Publicar no Catálogo"}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void toggleMarketplace(property)} className="rounded-lg"><Store className="size-4" />{property.marketplacePublished ? "Despublicar do Marketplace" : "Publicar no Marketplace"}</DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-black/[0.06]" />
                          <DropdownMenuItem asChild className="rounded-lg"><Link href="/corretor/documentos"><FileText className="size-4" />Propostas</Link></DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-black/[0.06]" />
                          <DropdownMenuItem onSelect={() => handleDeleteProperty(property.id)} className="rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700"><Trash2 className="size-4" />Excluir imóvel</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]"><Plus className="size-6" /></div>
              <h2 className="mt-6 text-2xl font-semibold text-[#050505]">{properties.length > 0 ? "Nenhum imóvel encontrado" : "Você ainda não cadastrou imóveis"}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#6B7280]">{properties.length > 0 ? "Ajuste a busca ou os filtros para ver mais resultados." : "Comece agora e publique seu primeiro imóvel em segundos."}</p>
              <Button type="button" onClick={hasReachedLimit ? () => setIsLimitModalOpen(true) : () => router.push("/corretor/novo-imovel")} className="mt-6 h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
                Adicionar imóvel
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={isEditModalOpen} onOpenChange={closeEditModal}>
          <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 p-0 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:max-w-4xl">
            {editingProperty && (
              <>
                <div className="border-b border-black/[0.06] px-6 py-5">
                  <DialogTitle className="text-xl text-[#050505]">Editar imóvel</DialogTitle>
                  <DialogDescription className="mt-2 text-[#6B7280]">Atualize fotos e informações sem sair da tela.</DialogDescription>
                </div>
                <div className="max-h-[calc(92vh-168px)] overflow-y-auto px-6 py-5">
                  <div className="grid gap-6">
                    <section className="grid gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-[#050505]">Mídia</h3>
                        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] transition-colors hover:bg-white hover:text-[#050505]">
                          <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(event) => {
                              void addPropertyPhotos(event.target.files)
                              event.currentTarget.value = ""
                            }}
                          />
                          <ImagePlus className="size-4" />
                          Adicionar fotos
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {editingProperty.images.map((image, index) => (
                          <div key={`${image}-${index}`} className="group relative w-full min-w-0 overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8]">
                            <div className="relative w-full overflow-hidden aspect-[4/3] sm:max-h-36">
                              {getPropertyImage(image, `${editingProperty.id}-${index}`) ? (
                                <Image src={getPropertyImage(image, `${editingProperty.id}-${index}`)} alt={`Imagem ${index + 1}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <ImagePlus className="size-7 text-[#8B95A1]" />
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => removePhoto(index)} className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#344054] opacity-100 shadow-sm transition-opacity hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                              <X className="size-4" />
                              <span className="sr-only">Remover foto</span>
                            </button>
                            <button type="button" onClick={() => void makeCover(index)} className="absolute bottom-2 left-2 rounded-full bg-white/90 px-3 py-1 text-xs text-[#344054] opacity-100 shadow-sm transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                              {index === 0 ? "Capa" : "Usar capa"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="grid gap-4">
                      <h3 className="text-lg font-semibold text-[#050505]">Informações</h3>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Título"><Input value={editingProperty.title} onChange={(event) => updateField("title", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Preço"><StructuredInput kind="currency" value={editingProperty.price} onValueChange={(value) => updateField("price", value)} aria-label="Preço" className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Tipo">
                          <Select value={editingProperty.type} onValueChange={(value) => updateField("type", value as EditableProperty["type"])}>
                            <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.06] bg-white/80 text-[#050505]"><SelectValue /></SelectTrigger>
                            <SelectContent className="border-black/[0.06] bg-white text-[#050505]">
                              <SelectItem value="Apartamento">Apartamento</SelectItem>
                              <SelectItem value="Casa">Casa</SelectItem>
                              <SelectItem value="Comercial">Comercial</SelectItem>
                              <SelectItem value="Terreno">Terreno</SelectItem>
                              <SelectItem value="Sala comercial">Sala comercial</SelectItem>
                              <SelectItem value="Loja">Loja</SelectItem>
                              <SelectItem value="Cobertura">Cobertura</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Finalidade">
                          <Select value={editingProperty.purpose} onValueChange={(value) => updateField("purpose", value as EditableProperty["purpose"])}>
                            <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.06] bg-white/80 text-[#050505]"><SelectValue /></SelectTrigger>
                            <SelectContent className="border-black/[0.06] bg-white text-[#050505]">
                              <SelectItem value="Venda">Venda</SelectItem>
                              <SelectItem value="Locação">Locação</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Quartos"><CounterInput value={editingProperty.bedrooms} onChange={(value) => updateField("bedrooms", value)} /></Field>
                        <Field label="Banheiros"><CounterInput value={editingProperty.bathrooms} onChange={(value) => updateField("bathrooms", value)} /></Field>
                        <Field label="Vagas"><CounterInput value={editingProperty.parking} onChange={(value) => updateField("parking", value)} /></Field>
                        <Field label="Área privativa"><StructuredInput kind="decimal" value={editingProperty.legal.privateArea} onValueChange={(value) => updateLegalField("privateArea", value)} aria-label="Área privativa em metros quadrados" className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="CEP">
                          <div className="flex gap-2">
                            <StructuredInput kind="cep" value={editingProperty.legal.cep} onValueChange={(value) => updateLegalField("cep", value)} aria-label="CEP comercial" className="h-10 min-w-0 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" />
                            <Button type="button" variant="ghost" onClick={() => void applyPropertyCep()} disabled={isLoadingCep} className="h-10 shrink-0 rounded-xl border border-black/[0.06] bg-white/80 px-3 text-[#4B5563]">
                              {isLoadingCep ? "Buscando..." : "Buscar CEP"}
                            </Button>
                          </div>
                        </Field>
                        <Field label="Cidade"><Input value={editingProperty.city} onChange={(event) => updateField("city", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Bairro"><Input value={editingProperty.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Rua / endereço"><Input value={editingProperty.legal.street} onChange={(event) => updateLegalField("street", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Estado / UF"><Input value={editingProperty.legal.state} onChange={(event) => updateLegalField("state", event.target.value.toUpperCase().slice(0, 2))} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Proprietário"><Input value={editingProperty.ownerName} onChange={(event) => updateField("ownerName", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                      </div>
                    </section>

                    <section className="grid gap-4 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-[#050505]">Cadastro jurídico</h3>
                          <p className="mt-1 text-sm text-[#6B7280]">O contrato consome matrícula, cartório, endereço e áreas diretamente daqui.</p>
                        </div>
                        <div className="rounded-[1rem] border border-black/[0.06] bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-[#8B95A1]">Cadastro</p>
                          <p className="mt-1 text-2xl font-semibold text-[#050505]">{editingProperty.completion.score}%</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[180px_auto]">
                        <Field label="CEP">
                          <div className="flex gap-2">
                            <StructuredInput kind="cep" value={editingProperty.legal.cep} onValueChange={(value) => updateLegalField("cep", value)} aria-label="CEP" className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" />
                            <Button type="button" variant="ghost" onClick={() => void applyPropertyCep()} disabled={isLoadingCep} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563]">
                              {isLoadingCep ? "Buscando..." : "Buscar CEP"}
                            </Button>
                          </div>
                        </Field>
                        <Field label="Rua"><Input value={editingProperty.legal.street} onChange={(event) => updateLegalField("street", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Número"><Input value={editingProperty.legal.number} onChange={(event) => updateLegalField("number", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Complemento"><Input value={editingProperty.legal.complement} onChange={(event) => updateLegalField("complement", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Bairro jurídico"><Input value={editingProperty.legal.district} onChange={(event) => updateLegalField("district", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Estado"><Input value={editingProperty.legal.state} onChange={(event) => updateLegalField("state", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Cidade jurídica"><Input value={editingProperty.legal.city} onChange={(event) => updateLegalField("city", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Matrícula"><Input value={editingProperty.legal.registryNumber} onChange={(event) => updateLegalField("registryNumber", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Cartório"><Input value={editingProperty.legal.registryOffice} onChange={(event) => updateLegalField("registryOffice", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Livro"><Input value={editingProperty.legal.registryBook} onChange={(event) => updateLegalField("registryBook", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Folha"><Input value={editingProperty.legal.registryPage} onChange={(event) => updateLegalField("registryPage", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Cadastro municipal"><Input value={editingProperty.legal.municipalRegistration} onChange={(event) => updateLegalField("municipalRegistration", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Inscrição imobiliária"><Input value={editingProperty.legal.taxRegistration} onChange={(event) => updateLegalField("taxRegistration", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="IPTU"><Input value={editingProperty.legal.iptuValue} onChange={(event) => updateLegalField("iptuValue", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Área total"><StructuredInput kind="decimal" value={editingProperty.legal.totalArea} onValueChange={(value) => updateLegalField("totalArea", value)} aria-label="Área total em metros quadrados" className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Fração ideal"><Input value={editingProperty.legal.idealFraction} onChange={(event) => updateLegalField("idealFraction", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Condomínio"><Input value={editingProperty.legal.condominiumName} onChange={(event) => updateLegalField("condominiumName", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Taxa de condomínio"><Input value={editingProperty.legal.condominiumFee} onChange={(event) => updateLegalField("condominiumFee", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                        <Field label="Taxas adicionais"><Input value={editingProperty.legal.additionalFees} onChange={(event) => updateLegalField("additionalFees", event.target.value)} className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" /></Field>
                      </div>

                      <Field label="Observações jurídicas">
                        <Textarea value={editingProperty.legal.legalNotes} onChange={(event) => updateLegalField("legalNotes", event.target.value)} className="min-h-24 rounded-[1rem] border-black/[0.06] bg-white/80 text-[#050505]" />
                      </Field>

                      <div className="grid gap-3">
                        <div className="flex flex-wrap gap-2">
                          {propertyDocumentLabels.map((label) => (
                            <label key={label} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm text-[#4B5563]">
                              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => void addPropertyDocuments(label, event.target.files)} />
                              <ImagePlus className="size-4" />
                              {label}
                            </label>
                          ))}
                        </div>
                        <PropertyDocumentsList documents={editingProperty.documents} />
                      </div>
                    </section>

                    <section className="grid gap-4">
                      <h3 className="text-lg font-semibold text-[#050505]">Descrição</h3>
                      <Textarea value={editingProperty.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Descreva os principais diferenciais do imóvel..." className="min-h-32 rounded-[1.25rem] border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]" />
                    </section>

                    <section className="grid gap-4">
                      <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <div>
                          <h3 className="text-lg font-semibold text-[#050505]">IA para anúncio</h3>
                          <p className="mt-1 text-sm text-[#6B7280]">Gere uma descrição comercial com os dados atuais do imóvel.</p>
                        </div>
                        <Button type="button" variant="ghost" onClick={generateDescriptionWithAi} disabled={isGeneratingAi} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:opacity-60">
                          {isGeneratingAi ? "Gerando..." : "Gerar descrição com IA"}
                        </Button>
                      </div>
                      {aiHighlights.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {aiHighlights.map((highlight) => (
                            <Badge key={highlight} className="rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs text-[#009b3a]">
                              {highlight}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section className="grid gap-3">
                      <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <h3 className="text-lg font-semibold text-[#050505]">Áudio</h3>
                        <label className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] transition-colors hover:bg-white hover:text-[#050505]">
                          <input
                            type="file"
                            accept="audio/*"
                            className="sr-only"
                            onChange={(event) => {
                              void uploadAudio(event.target.files)
                              event.currentTarget.value = ""
                            }}
                          />
                          <Mic className="size-4" />
                          Enviar áudio
                        </label>
                        {editingProperty.audioUrl ? (
                          <>
                            <audio controls src={editingProperty.audioUrl} className="mt-3 w-full">
                              Seu navegador não suporta reprodução de áudio.
                            </audio>
                            <Button variant="ghost" onClick={() => void removeAudio()} className="mt-3 h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]">
                              Remover áudio
                            </Button>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-[#6B7280]">Nenhum áudio enviado para este imóvel.</p>
                        )}
                      </div>
                    </section>

                    {saveFeedback && <div className="rounded-[1.25rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">{saveFeedback}</div>}
                    {saveError && <div role="alert" className="rounded-[1.25rem] border border-red-500/20 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>}
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 border-t border-black/[0.06] bg-white/90 px-6 py-4 sm:justify-between">
                  <Button variant="ghost" onClick={() => handleDeleteProperty(editingProperty.id)} className="h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-red-600 hover:bg-red-100 hover:text-red-700">
                    <Trash2 className="size-4" />
                    Excluir imóvel
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="ghost" onClick={() => closeEditModal(false)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]">Cancelar</Button>
                    <Button onClick={saveChanges} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">Salvar alterações</Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(publicationBlock)} onOpenChange={(open) => !open && setPublicationBlock(null)}>
          <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.35rem] border-black/[0.07] bg-white p-0 text-[#111827] shadow-[0_24px_70px_rgba(15,23,42,0.14)] sm:max-w-lg">
            {publicationBlock ? (
              <>
                <div className="flex items-start gap-3 border-b border-black/[0.06] px-5 py-4">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <CircleAlert className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-semibold text-[#111827]">
                      Este imóvel ainda não atende ao padrão de publicação do EME.
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm leading-5 text-[#667085]">
                      Complete os itens abaixo antes de publicar no {publicationBlock.error.channel === "catalog" ? "Catálogo" : "Marketplace"}.
                    </DialogDescription>
                  </div>
                </div>

                <div className="max-h-[52vh] overflow-y-auto px-5 py-4">
                  <ul className="grid gap-2.5" data-testid="publication-readiness-issues">
                    {publicationBlock.error.channelReadiness.issues.map((item) => (
                      <li key={`${item.code}:${item.field}`} className="flex gap-2.5 rounded-xl border border-black/[0.055] bg-[#fbfbf8] px-3 py-2.5 text-sm text-[#475467]">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{item.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <DialogFooter className="border-t border-black/[0.06] px-5 py-4 sm:justify-between">
                  {publicationBlock.error.channelReadiness.issues.some((item) => item.scope === "broker") ? (
                    <Button asChild variant="ghost" className="h-10 rounded-xl border border-black/[0.07] bg-white px-4 text-[#475467] hover:bg-[#f7f8f5] hover:text-[#111827]">
                      <Link href="/corretor/conta" onClick={() => setPublicationBlock(null)}>Verificar CRECI</Link>
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => setPublicationBlock(null)} className="h-10 rounded-xl px-4 text-[#667085]">
                      Agora não
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => {
                      const currentProperty = properties.find((item) => item.id === publicationBlock.property.id) ?? publicationBlock.property
                      setPublicationBlock(null)
                      openEditModal(currentProperty)
                    }}
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633]"
                  >
                    Corrigir imóvel
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </BrokerPageShell>
      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
    </>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-black/[0.055] bg-[#fbfbf8] px-2.5 py-2"><p className="text-[10px] text-[#7B8491]">{label}</p><p className="mt-0.5 text-xs font-semibold text-[#111827]">{value}</p></div>
}

function Spec({ icon: Icon, value }: { icon: typeof BedDouble; value: string }) {
  return <div className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.055] bg-[#fbfbf8] px-2 py-1"><Icon className="size-3.5 text-[#009b3a]" /><span>{value}</span></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2"><span className="text-sm font-medium text-[#5F6B7A]">{label}</span>{children}</label>
}

function CounterInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex h-10 items-center justify-between rounded-xl border border-black/[0.06] bg-white/80 px-2">
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(Math.max(0, value - 1))} className="size-7 rounded-lg text-[#5F6B7A] hover:bg-white hover:text-[#050505]">-</Button>
      <span className="text-sm font-semibold text-[#050505]">{value}</span>
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value + 1)} className="size-7 rounded-lg text-[#5F6B7A] hover:bg-white hover:text-[#050505]">+</Button>
    </div>
  )
}

function PropertyDocumentsList({ documents }: { documents: EntityDocumentRecord[] }) {
  if (!documents.length) {
    return <p className="text-sm text-[#8B95A1]">Nenhum documento anexado ainda.</p>
  }

  return (
    <div className="grid gap-2">
      {documents.map((document) => (
        <a
          key={document.id}
          href={document.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm text-[#4B5563]"
        >
          {document.label}: {document.name}
        </a>
      ))}
    </div>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."))
    reader.readAsDataURL(file)
  })
}
