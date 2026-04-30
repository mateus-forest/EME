"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Bath, BedDouble, CarFront, Filter, ImagePlus, MapPin, MessageCircle, Mic, PencilLine, Plus, Trash2, X } from "lucide-react"
import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { useBrokerProperties, type BrokerProperty as Property } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { requestPropertyAi } from "@/lib/property-ai-client"
import { getPropertyImage } from "@/lib/property-media"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type EditableProperty = {
  id: string
  title: string
  city: string
  neighborhood: string
  price: string
  images: string[]
  bedrooms: number
  bathrooms: number
  parking: number
  status: "Publicado" | "Rascunho"
  type: "Apartamento" | "Casa" | "Comercial"
  description: string
  audioUrl: string
}

export function BrokerMyPropertiesPage() {
  const router = useRouter()
  const { profile } = useBrokerProfile()
  const {
    properties,
    updateProperty,
    deleteProperty,
    publishProperty,
    uploadPropertyImages,
    deletePropertyImage,
    uploadPropertyAudio,
    deletePropertyAudio,
  } = useBrokerProperties()
  const { subscription } = useBrokerSubscription()
  const [search, setSearch] = useState("")
  const [statusFilters, setStatusFilters] = useState<Array<Property["status"]>>(["Publicado", "Rascunho"])
  const [typeFilters, setTypeFilters] = useState<Array<Property["type"]>>(["Casa", "Apartamento", "Comercial"])
  const [priceFilters, setPriceFilters] = useState<string[]>(["low", "mid", "high"])
  const [editingProperty, setEditingProperty] = useState<EditableProperty | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState("")
  const [listFeedback, setListFeedback] = useState("")
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiHighlights, setAiHighlights] = useState<string[]>([])
  const publishedPropertiesCount = useMemo(() => properties.filter((property) => property.status === "Publicado").length, [properties])
  const hasReachedLimit =
    !subscription.isUpgraded && !subscription.isAgencyLinked && publishedPropertiesCount >= subscription.propertyLimit
  const normalizedSearch = search.trim().toLowerCase()
  const filteredProperties = useMemo(
    () =>
      properties.filter((property) => {
        const matchesSearch = normalizedSearch ? [property.title, property.city, property.neighborhood].some((field) => field.toLowerCase().includes(normalizedSearch)) : true
        const matchesStatus = statusFilters.includes(property.status)
        const matchesType = typeFilters.includes(property.type)
        const numericPrice = Number(property.price.replace(/\D/g, "")) / 100
        const matchesPrice =
          priceFilters.length === 0 ||
          priceFilters.some((filter) => {
            if (filter === "low") return numericPrice <= 800000
            if (filter === "mid") return numericPrice > 800000 && numericPrice <= 2000000
            return numericPrice > 2000000
          })
        return matchesSearch && matchesStatus && matchesType && matchesPrice
      }),
    [properties, normalizedSearch, statusFilters, typeFilters, priceFilters],
  )
  const hasProperties = filteredProperties.length > 0
  const whatsAppUrl = createWhatsAppUrl(profile.whatsApp, "Olá, tenho interesse neste imóvel")
  const hasActiveFilters =
    normalizedSearch.length > 0 || statusFilters.length < 2 || typeFilters.length < 3 || priceFilters.length < 3

  function clearFilters() {
    setSearch("")
    setStatusFilters(["Publicado", "Rascunho"])
    setTypeFilters(["Casa", "Apartamento", "Comercial"])
    setPriceFilters(["low", "mid", "high"])
  }

  function toggleFilter<T extends string>(value: T, current: T[], onChange: (next: T[]) => void) {
    onChange(current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  function openEditModal(property: Property) {
    setEditingProperty({
      id: property.id,
      title: property.title,
      city: property.city,
      neighborhood: property.neighborhood,
      price: property.price,
      images: [...property.images],
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parking: property.parking,
      status: property.status,
      type: property.type,
      description: property.description,
      audioUrl: property.audioUrl,
    })
    setSaveFeedback("")
    setAiHighlights([])
    setIsEditModalOpen(true)
  }

  function closeEditModal(open: boolean) {
    setIsEditModalOpen(open)
    if (!open) {
      setTimeout(() => {
        setEditingProperty(null)
        setSaveFeedback("")
        setAiHighlights([])
      }, 150)
    }
  }

  function updateField<K extends keyof EditableProperty>(field: K, value: EditableProperty[K]) {
    setEditingProperty((current) => (current ? { ...current, [field]: value } : current))
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

  async function saveChanges() {
    if (!editingProperty) return
    try {
      const updatedProperty = await updateProperty(editingProperty.id, editingProperty)
      setEditingProperty({
        id: updatedProperty.id,
        title: updatedProperty.title,
        city: updatedProperty.city,
        neighborhood: updatedProperty.neighborhood,
        price: updatedProperty.price,
        images: [...updatedProperty.images],
        bedrooms: updatedProperty.bedrooms,
        bathrooms: updatedProperty.bathrooms,
        parking: updatedProperty.parking,
        status: updatedProperty.status,
        type: updatedProperty.type,
        description: updatedProperty.description,
        audioUrl: updatedProperty.audioUrl,
      })
      setSaveFeedback("Alterações salvas com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar as alterações.")
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
        bedrooms: editingProperty.bedrooms,
        bathrooms: editingProperty.bathrooms,
        parkingSpots: editingProperty.parking,
        description: editingProperty.description,
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

  async function togglePropertyStatus(property: Property) {
    const nextStatus = property.status === "Publicado" ? "Rascunho" : "Publicado"
    try {
      await publishProperty(property.id, nextStatus)
      setListFeedback(nextStatus === "Publicado" ? "Imóvel publicado com sucesso." : "Imóvel movido para rascunho.")
      window.setTimeout(() => setListFeedback(""), 2500)
    } catch (caughtError) {
      setListFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status do imóvel.")
      window.setTimeout(() => setListFeedback(""), 2500)
    }
  }

  async function toggleEditingPropertyStatus() {
    if (!editingProperty) return
    const nextStatus = editingProperty.status === "Publicado" ? "Rascunho" : "Publicado"
    try {
      await publishProperty(editingProperty.id, nextStatus)
      updateField("status", nextStatus)
      setSaveFeedback(nextStatus === "Publicado" ? "Imóvel publicado com sucesso." : "Imóvel movido para rascunho.")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status do imóvel.")
    }
  }

  const publishToggleChecked = useMemo(() => editingProperty?.status === "Publicado", [editingProperty])

  return (
    <>
      <BrokerPageShell
        title="Meus imóveis"
        searchPlaceholder="Buscar por imóvel, bairro ou código"
        searchValue={search}
        onSearchChange={setSearch}
        primaryActionLabel="Novo imóvel"
        primaryActionHref="/corretor/novo-imovel"
        primaryActionOnClick={hasReachedLimit ? () => setIsLimitModalOpen(true) : () => router.push("/corretor/novo-imovel")}
        headerControls={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8.5 rounded-xl border border-white/10 bg-white/5 px-4 text-white/75 hover:bg-white/10 hover:text-white">
                <Filter className="size-4" />
                Filtros
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 rounded-2xl border-white/[0.08] bg-[#101010]/96 p-2 text-white shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
              <DropdownMenuLabel className="text-white/50">Status</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={statusFilters.includes("Publicado")} onCheckedChange={() => toggleFilter("Publicado", statusFilters, setStatusFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">Publicado</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={statusFilters.includes("Rascunho")} onCheckedChange={() => toggleFilter("Rascunho", statusFilters, setStatusFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">Rascunho</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuLabel className="text-white/50">Tipo</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={typeFilters.includes("Casa")} onCheckedChange={() => toggleFilter("Casa", typeFilters, setTypeFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">Casa</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={typeFilters.includes("Apartamento")} onCheckedChange={() => toggleFilter("Apartamento", typeFilters, setTypeFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">Apartamento</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={typeFilters.includes("Comercial")} onCheckedChange={() => toggleFilter("Comercial", typeFilters, setTypeFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">Comercial</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuLabel className="text-white/50">Faixa de preço</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={priceFilters.includes("low")} onCheckedChange={() => toggleFilter("low", priceFilters, setPriceFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">Até R$ 800 mil</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={priceFilters.includes("mid")} onCheckedChange={() => toggleFilter("mid", priceFilters, setPriceFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">R$ 800 mil a R$ 2 mi</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={priceFilters.includes("high")} onCheckedChange={() => toggleFilter("high", priceFilters, setPriceFilters)} className="rounded-xl text-white/80 focus:bg-white/[0.06]">Acima de R$ 2 mi</DropdownMenuCheckboxItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <Button type="button" variant="ghost" onClick={clearFilters} className="mt-2 h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                Limpar filtros
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {listFeedback && (
          <div className="mb-4 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
            {listFeedback}
          </div>
        )}
        {hasReachedLimit && (
          <div className="mb-4 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
            Você atingiu o limite gratuito de 3 imóveis. Faça upgrade para continuar publicando.
          </div>
        )}
        {hasActiveFilters && (
          <div className="mb-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Filtrando resultados...</span>
              <Button type="button" variant="ghost" onClick={clearFilters} className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white">
                Limpar filtros
              </Button>
            </div>
          </div>
        )}

        {hasProperties ? (
          <section className="grid gap-4">
            {filteredProperties.map((property) => (
              <Card
                key={property.id}
                className="overflow-hidden rounded-[1.5rem] border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(0,0,0,0.22)]"
              >
                <CardContent className="grid gap-5 p-4 lg:grid-cols-[minmax(320px,42%)_minmax(0,1fr)_220px] lg:items-center">
                  <div className="relative min-h-[220px] overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] lg:min-h-[240px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getPropertyImage(property.images[0], property.id)} alt={property.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <Badge className={property.status === "Publicado" ? "rounded-full border border-[#00C853]/20 bg-black/60 px-2.5 py-1 text-[11px] text-[#69F0AE] backdrop-blur-md" : "rounded-full border border-white/[0.08] bg-black/60 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur-md"}>
                        {property.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col justify-center gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[1.35rem] font-semibold leading-tight text-white">{property.title}</h2>
                      <div className="mt-2 flex items-center gap-2 text-sm text-white/55">
                        <MapPin className="size-4 shrink-0 text-[#69F0AE]" />
                        <span className="truncate">{property.location}</span>
                      </div>
                      <p className="mt-4 text-[1.7rem] font-semibold tracking-tight text-white">{property.price}</p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-white/60">
                      <Spec icon={BedDouble} value={`${property.bedrooms} quartos`} />
                      <Spec icon={Bath} value={`${property.bathrooms} banheiros`} />
                      <Spec icon={CarFront} value={`${property.parking} vagas`} />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <MetricCard label="Visualizações" value={property.views} />
                      <MetricCard label="Leads" value={property.leads} />
                    </div>

                    <div className="grid gap-2">
                      <Button type="button" variant="ghost" onClick={() => togglePropertyStatus(property)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white">
                        {property.status === "Publicado" ? "Despublicar" : "Publicar"}
                      </Button>
                      <Button asChild className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
                        <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="size-4" />
                          WhatsApp
                        </a>
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" onClick={() => openEditModal(property)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/70 hover:bg-white/[0.08] hover:text-white">
                          <PencilLine className="size-4" />
                          Editar
                        </Button>
                        <Button variant="ghost" onClick={() => handleDeleteProperty(property.id)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/55 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300">
                          <Trash2 className="size-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_22px_50px_rgba(0,0,0,0.18)]">
            <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"><Plus className="size-6" /></div>
              <h2 className="mt-6 text-2xl font-semibold text-white">{properties.length > 0 ? "Nenhum imóvel encontrado" : "Você ainda não cadastrou imóveis"}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/55">{properties.length > 0 ? "Ajuste a busca ou os filtros para ver mais resultados." : "Comece agora e publique seu primeiro imóvel em segundos."}</p>
              <Button type="button" onClick={hasReachedLimit ? () => setIsLimitModalOpen(true) : () => router.push("/corretor/novo-imovel")} className="mt-6 h-11 rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
                Adicionar imóvel
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={isEditModalOpen} onOpenChange={closeEditModal}>
          <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-4xl">
            {editingProperty && (
              <>
                <div className="border-b border-white/[0.08] px-6 py-5">
                  <DialogTitle className="text-xl text-white">Editar imóvel</DialogTitle>
                  <DialogDescription className="mt-2 text-white/50">Atualize fotos, informações e status sem sair da tela.</DialogDescription>
                </div>
                <div className="max-h-[calc(92vh-168px)] overflow-y-auto px-6 py-5">
                  <div className="grid gap-6">
                    <section className="grid gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">Mídia</h3>
                        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
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
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {editingProperty.images.map((image, index) => (
                          <div key={`${image}-${index}`} className="group relative overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03]">
                            <div className="relative min-h-36">
                              <Image src={getPropertyImage(image, `${editingProperty.id}-${index}`)} alt={`Imagem ${index + 1}`} fill className="object-cover" />
                            </div>
                            <button type="button" onClick={() => removePhoto(index)} className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-200 group-hover:opacity-100">
                              <X className="size-4" />
                              <span className="sr-only">Remover foto</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="grid gap-4">
                      <h3 className="text-lg font-semibold text-white">Informações</h3>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Título"><Input value={editingProperty.title} onChange={(event) => updateField("title", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" /></Field>
                        <Field label="Preço"><Input value={editingProperty.price} onChange={(event) => updateField("price", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" /></Field>
                        <Field label="Tipo">
                          <Select value={editingProperty.type} onValueChange={(value) => updateField("type", value as EditableProperty["type"])}>
                            <SelectTrigger className="h-10 w-full rounded-xl border-white/[0.08] bg-white/[0.04] text-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="border-white/[0.08] bg-[#121212] text-white">
                              <SelectItem value="Apartamento">Apartamento</SelectItem>
                              <SelectItem value="Casa">Casa</SelectItem>
                              <SelectItem value="Comercial">Comercial</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Quartos"><CounterInput value={editingProperty.bedrooms} onChange={(value) => updateField("bedrooms", value)} /></Field>
                        <Field label="Banheiros"><CounterInput value={editingProperty.bathrooms} onChange={(value) => updateField("bathrooms", value)} /></Field>
                        <Field label="Vagas"><CounterInput value={editingProperty.parking} onChange={(value) => updateField("parking", value)} /></Field>
                        <Field label="Cidade"><Input value={editingProperty.city} onChange={(event) => updateField("city", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" /></Field>
                        <Field label="Bairro"><Input value={editingProperty.neighborhood} onChange={(event) => updateField("neighborhood", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" /></Field>
                      </div>
                    </section>

                    <section className="grid gap-4">
                      <h3 className="text-lg font-semibold text-white">Descrição</h3>
                      <Textarea value={editingProperty.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Descreva os principais diferenciais do imóvel..." className="min-h-32 rounded-[1.25rem] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30" />
                    </section>

                    <section className="grid gap-4">
                      <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">IA para anúncio</h3>
                          <p className="mt-1 text-sm text-white/50">Gere uma descrição comercial com os dados atuais do imóvel.</p>
                        </div>
                        <Button type="button" variant="ghost" onClick={generateDescriptionWithAi} disabled={isGeneratingAi} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white disabled:opacity-60">
                          {isGeneratingAi ? "Gerando..." : "Gerar descrição com IA"}
                        </Button>
                      </div>
                      {aiHighlights.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {aiHighlights.map((highlight) => (
                            <Badge key={highlight} className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs text-[#69F0AE]">
                              {highlight}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                        <h3 className="text-lg font-semibold text-white">Áudio (opcional)</h3>
                        <Button variant="ghost" className="mt-4 h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                          <Mic className="size-4" />
                          Gravar áudio
                        </Button>
                      </div>
                      <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                        <h3 className="text-lg font-semibold text-white">Status</h3>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-white/60">Status atual</p>
                            <p className="mt-1 font-medium text-white">{editingProperty.status}</p>
                          </div>
                          <Switch checked={publishToggleChecked} onCheckedChange={(checked) => updateField("status", checked ? "Publicado" : "Rascunho")} />
                        </div>
                        <Button type="button" variant="ghost" onClick={toggleEditingPropertyStatus} className="mt-3 h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white">
                          {publishToggleChecked ? "Despublicar imóvel" : "Publicar imóvel"}
                        </Button>
                      </div>
                    </section>

                    <section className="grid gap-3">
                      <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                        <h3 className="text-lg font-semibold text-white">Áudio real</h3>
                        <label className="mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white">
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
                            <Button variant="ghost" onClick={() => void removeAudio()} className="mt-3 h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                              Remover áudio
                            </Button>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-white/50">Nenhum áudio enviado para este imóvel.</p>
                        )}
                      </div>
                    </section>

                    {saveFeedback && <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">{saveFeedback}</div>}
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 border-t border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.98))] px-6 py-4 sm:justify-between">
                  <Button variant="ghost" onClick={() => handleDeleteProperty(editingProperty.id)} className="h-10 rounded-xl border border-red-500/12 bg-red-500/5 px-4 text-red-200 hover:bg-red-500/10 hover:text-red-100">
                    <Trash2 className="size-4" />
                    Excluir imóvel
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" variant="ghost" onClick={toggleEditingPropertyStatus} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">{publishToggleChecked ? "Despublicar" : "Publicar"}</Button>
                    <Button variant="ghost" onClick={() => closeEditModal(false)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">Cancelar</Button>
                    <Button onClick={saveChanges} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">Salvar alterações</Button>
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </BrokerPageShell>
      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
    </>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3"><p className="text-xs text-white/45">{label}</p><p className="mt-1.5 text-sm font-semibold text-white">{value}</p></div>
}

function Spec({ icon: Icon, value }: { icon: typeof BedDouble; value: string }) {
  return <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"><Icon className="size-4 text-[#69F0AE]" /><span>{value}</span></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2"><span className="text-sm font-medium text-white/70">{label}</span>{children}</label>
}

function CounterInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex h-10 items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-2">
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(Math.max(0, value - 1))} className="size-7 rounded-lg text-white/70 hover:bg-white/[0.08] hover:text-white">-</Button>
      <span className="text-sm font-semibold text-white">{value}</span>
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value + 1)} className="size-7 rounded-lg text-white/70 hover:bg-white/[0.08] hover:text-white">+</Button>
    </div>
  )
}
