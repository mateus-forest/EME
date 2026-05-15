"use client"

import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"
import { Bath, Bed, Building2, Car, Eye, FileText, Keyboard, PencilLine, SlidersHorizontal, Sparkles, Upload, Users, type LucideIcon } from "lucide-react"

import { AdImportPanel } from "@/components/ad-import-panel"
import { AgencyPageShell } from "@/components/agency-page-shell"
import { useAgencyProperties, type AgencyProperty } from "@/components/use-agency-properties"
import { useAgencySubscription } from "@/components/use-agency-subscription"
import { isBillingBypassEnabled } from "@/lib/billing-config"
import { requestPropertyAi } from "@/lib/property-ai-client"
import { confirmPropertyXmlImport, previewPropertyXml, type XmlImportReport, type XmlImportSummary } from "@/lib/property-xml-import-client"
import type { ParsedXmlProperty } from "@/lib/property-xml-import"
import { formatCurrencyInput } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type EditableAgencyProperty = {
  id: string
  title: string
  city: string
  neighborhood: string
  price: string
  images: string[]
  bedrooms: number
  bathrooms: number
  parking: number
  type: AgencyProperty["type"]
  description: string
  audioUrl: string
}

type CreationMode = "ai" | "manual" | "import"

const statusFilters = ["Todos", "Publicado", "Rascunho", "Pausado"] as const
const typeFilters = ["Todos", "Casa", "Apartamento", "Comercial"] as const
const priceFilters = ["Todas", "Até R$ 1 mi", "R$ 1 mi a R$ 2 mi", "Acima de R$ 2 mi"] as const

export function AgencyPropertiesPage() {
  const {
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
  } = useAgencyProperties()
  const { subscription } = useAgencySubscription()
  const [selectedProperty, setSelectedProperty] = useState<AgencyProperty | null>(null)
  const [editingProperty, setEditingProperty] = useState<EditableAgencyProperty | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateChoiceOpen, setIsCreateChoiceOpen] = useState(false)
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null)
  const [importFeedback, setImportFeedback] = useState("")
  const [xmlPreview, setXmlPreview] = useState<ParsedXmlProperty[]>([])
  const [xmlSummary, setXmlSummary] = useState<XmlImportSummary | null>(null)
  const [xmlReport, setXmlReport] = useState<XmlImportReport | null>(null)
  const [isAnalyzingXml, setIsAnalyzingXml] = useState(false)
  const [isImportingXml, setIsImportingXml] = useState(false)
  const [draftImageFiles, setDraftImageFiles] = useState<File[]>([])
  const [draftImagePreviews, setDraftImagePreviews] = useState<string[]>([])
  const [saveFeedback, setSaveFeedback] = useState("")
  const [actionFeedback, setActionFeedback] = useState("")
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [aiHighlights, setAiHighlights] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("Todos")
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("Todos")
  const [brokerFilter, setBrokerFilter] = useState("Todos")
  const [priceFilter, setPriceFilter] = useState<(typeof priceFilters)[number]>("Todas")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [search, setSearch] = useState("")
  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "Todos" ||
    typeFilter !== "Todos" ||
    brokerFilter !== "Todos" ||
    priceFilter !== "Todas"
  const billingBypassEnabled = isBillingBypassEnabled()
  const isPlanBlocked = !billingBypassEnabled && !subscription.isActive

  const brokers = useMemo(
    () => ["Todos", ...Array.from(new Set(properties.map((property) => property.broker.name)))],
    [properties],
  )

  const filteredProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return properties.filter((property) => {
      const matchesStatus = statusFilter === "Todos" || property.status === statusFilter
      const matchesType = typeFilter === "Todos" || property.type === typeFilter
      const matchesBroker = brokerFilter === "Todos" || property.broker.name === brokerFilter
      const matchesSearch = normalizedSearch
        ? property.title.toLowerCase().includes(normalizedSearch) ||
          property.location.toLowerCase().includes(normalizedSearch) ||
          property.broker.name.toLowerCase().includes(normalizedSearch)
        : true
      const priceValue = Number(property.price.replace(/[^\d]/g, "")) / 100
      const matchesPrice =
        priceFilter === "Todas" ||
        (priceFilter === "Até R$ 1 mi" && priceValue <= 1000000) ||
        (priceFilter === "R$ 1 mi a R$ 2 mi" && priceValue > 1000000 && priceValue <= 2000000) ||
        (priceFilter === "Acima de R$ 2 mi" && priceValue > 2000000)
      return matchesStatus && matchesType && matchesBroker && matchesPrice && matchesSearch
    })
  }, [brokerFilter, priceFilter, properties, search, statusFilter, typeFilter])

  const summary = useMemo(
    () => ({
      active: properties.filter((property) => property.status === "Publicado").length,
      draft: properties.filter((property) => property.status === "Rascunho").length,
      views: properties.reduce((sum, property) => sum + property.views, 0),
      leads: properties.reduce((sum, property) => sum + property.leads, 0),
    }),
    [properties],
  )

  function handleOpenCreateChoice() {
    if (isPlanBlocked) {
      setActionFeedback("Seu plano da imobiliaria nao esta ativo para criar novos imoveis. Ative ou regularize sua assinatura para continuar.")
      return
    }

    setSelectedProperty(null)
    setCreationMode(null)
    setImportFeedback("")
    setIsCreateChoiceOpen(true)
  }

  async function handleCreateProperty(mode: Exclude<CreationMode, "import"> = "manual") {
    if (isPlanBlocked) {
      setActionFeedback("Seu plano da imobiliária não está ativo para criar novos imóveis. Ative ou regularize sua assinatura para continuar.")
      return
    }

    setSelectedProperty(null)
    setCreationMode(mode)
    setIsCreateChoiceOpen(false)
    setEditingProperty({
      id: "",
      title: "",
      city: "",
      neighborhood: "",
      price: "",
      images: [],
      bedrooms: 0,
      bathrooms: 0,
      parking: 0,
      type: "Apartamento",
      description: "",
      audioUrl: "",
    })
    setSaveFeedback("")
    setAiHighlights([])
    setDraftImageFiles([])
    setDraftImagePreviews([])
    setIsEditModalOpen(true)
  }

  async function handleAgencyXmlImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const isXml = file.name.toLowerCase().endsWith(".xml") || ["text/xml", "application/xml"].includes(file.type)
    if (!isXml) {
      setImportFeedback("Envie um arquivo XML valido para revisar antes de importar.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setImportFeedback("O XML deve ter ate 5 MB.")
      return
    }

    setIsAnalyzingXml(true)
    setImportFeedback("")
    setXmlPreview([])
    setXmlSummary(null)
    setXmlReport(null)

    try {
      const result = await previewPropertyXml(file)
      setXmlPreview(result.properties)
      setXmlSummary(result.summary)
      setImportFeedback("XML analisado. Revise os imoveis antes de importar.")
    } catch (caughtError) {
      setImportFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel analisar o XML.")
    } finally {
      setIsAnalyzingXml(false)
    }
  }

  async function handleConfirmAgencyXmlImport() {
    const importableProperties = xmlPreview.filter((property) => property.status !== "invalid")
    if (importableProperties.length === 0) {
      setImportFeedback("Nenhum imovel esta pronto para importar.")
      return
    }

    setIsImportingXml(true)
    setImportFeedback("")

    try {
      const result = await confirmPropertyXmlImport(importableProperties)
      setXmlReport(result.report)
      setImportFeedback("Importacao finalizada.")
      await refreshProperties()
    } catch (caughtError) {
      setImportFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel importar os imoveis.")
    } finally {
      setIsImportingXml(false)
    }
  }

  async function handleTogglePublish(property: AgencyProperty) {
    const nextStatus = property.status === "Publicado" ? "Pausado" : "Publicado"

    try {
      const updatedProperty = await publishProperty(property.id, nextStatus)
      setSelectedProperty((current) => (current?.id === property.id ? updatedProperty : current))
    } catch (caughtError) {
      window.alert(
        caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o status do imóvel.",
      )
    }
  }

  async function handleDelete(property: AgencyProperty) {
    if (!window.confirm(`Tem certeza que deseja excluir ${property.title}?`)) return
    try {
      await deleteProperty(property.id)
      setSelectedProperty((current) => (current?.id === property.id ? null : current))
    } catch (caughtError) {
      window.alert(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o imóvel.")
    }
  }

  function handleEdit(property: AgencyProperty) {
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
      type: property.type,
      description: property.description,
      audioUrl: property.audioUrl,
    })
    setSaveFeedback("")
    setAiHighlights([])
    setDraftImageFiles([])
    setDraftImagePreviews([])
    setIsEditModalOpen(true)
  }

  function clearFilters() {
    setSearch("")
    setStatusFilter("Todos")
    setTypeFilter("Todos")
    setBrokerFilter("Todos")
    setPriceFilter("Todas")
  }

  function closeEditModal(open: boolean) {
    setIsEditModalOpen(open)
    if (!open) {
      window.setTimeout(() => {
        setEditingProperty(null)
        setSaveFeedback("")
        setAiHighlights([])
        setDraftImageFiles([])
        setDraftImagePreviews([])
      }, 150)
    }
  }

  function updateEditingField<K extends keyof EditableAgencyProperty>(field: K, value: EditableAgencyProperty[K]) {
    setEditingProperty((current) => (current ? { ...current, [field]: value } : current))
  }

  function addDraftPropertyPhotos(files: FileList | null) {
    if (!files) return

    const nextFiles = Array.from(files).slice(0, 8)
    setDraftImageFiles(nextFiles)
    setDraftImagePreviews(nextFiles.map((file) => URL.createObjectURL(file)))
    setSaveFeedback("")
  }

  function removeDraftPropertyPhoto(imageUrl: string) {
    setDraftImagePreviews((current) => current.filter((image) => image !== imageUrl))
    setDraftImageFiles((current) => current.filter((_, index) => draftImagePreviews[index] !== imageUrl))
  }

  async function saveChanges() {
    if (!editingProperty) return

    try {
      if (!editingProperty.id) {
        const createdProperty = await addProperty({
          id: "",
          titulo: editingProperty.title,
          preco: editingProperty.price,
          tipo: editingProperty.type,
          corretorId: "",
          imobiliariaId: null,
          title: editingProperty.title,
          city: editingProperty.city,
          neighborhood: editingProperty.neighborhood,
          location: `${editingProperty.neighborhood}, ${editingProperty.city}`,
          price: editingProperty.price,
          bedrooms: editingProperty.bedrooms,
          bathrooms: editingProperty.bathrooms,
          parking: editingProperty.parking,
          status: "Rascunho",
          published: false,
          type: editingProperty.type,
          description: editingProperty.description,
          broker: { id: "", name: "", initials: "" },
          views: 0,
          leads: 0,
          images: [],
          image: "",
          audioUrl: "",
        })
        if (draftImageFiles.length > 0) {
          await uploadPropertyImages(createdProperty.id, draftImageFiles)
        }
        setActionFeedback("Imóvel criado com sucesso.")
        closeEditModal(false)
        setSelectedProperty(null)
        return
      }

      const updatedProperty = await updateProperty(editingProperty.id, editingProperty)
      setSelectedProperty((current) => (current?.id === updatedProperty.id ? updatedProperty : current))
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
        type: updatedProperty.type,
        description: updatedProperty.description,
        audioUrl: updatedProperty.audioUrl,
      })
      setSaveFeedback("Alterações salvas com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar as alterações.")
    }
  }

  async function addPropertyPhotos(files: FileList | null) {
    if (!editingProperty || !files) return

    try {
      const updatedProperty = await uploadPropertyImages(editingProperty.id, Array.from(files))
      updateEditingField("images", updatedProperty.images)
      setSelectedProperty((current) => (current?.id === updatedProperty.id ? updatedProperty : current))
      setSaveFeedback("Imagens enviadas com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível enviar as imagens.")
    }
  }

  async function removePropertyPhoto(imageUrl: string) {
    if (!editingProperty) return

    try {
      const updatedProperty = await deletePropertyImage(editingProperty.id, imageUrl)
      updateEditingField("images", updatedProperty.images)
      setSelectedProperty((current) => (current?.id === updatedProperty.id ? updatedProperty : current))
      setSaveFeedback("Imagem removida com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível remover a imagem.")
    }
  }

  async function addPropertyAudio(files: FileList | null) {
    if (!editingProperty || !files?.[0]) return

    try {
      const updatedProperty = await uploadPropertyAudio(editingProperty.id, files[0])
      updateEditingField("audioUrl", updatedProperty.audioUrl)
      setSelectedProperty((current) => (current?.id === updatedProperty.id ? updatedProperty : current))
      setSaveFeedback("Áudio enviado com sucesso")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível enviar o áudio.")
    }
  }

  async function removePropertyAudio() {
    if (!editingProperty?.audioUrl) return

    try {
      const updatedProperty = await deletePropertyAudio(editingProperty.id)
      updateEditingField("audioUrl", updatedProperty.audioUrl)
      setSelectedProperty((current) => (current?.id === updatedProperty.id ? updatedProperty : current))
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

      if (!editingProperty.description.trim() || window.confirm("Substituir a descricao atual pela sugestao da IA?")) {
        updateEditingField("description", generated.description)
      }

      if (!editingProperty.title.trim() && generated.suggestedTitle) {
        updateEditingField("title", generated.suggestedTitle)
      }

      setAiHighlights(generated.highlights)
      setSaveFeedback("Descrição gerada com IA")
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ""
      setSaveFeedback(
        message.toLowerCase().includes("ia ainda")
          ? "A geracao com IA ainda nao esta ativada."
          : message || "Não foi possível gerar a descrição com IA.",
      )
    } finally {
      setIsGeneratingAi(false)
    }
  }

  return (
    <AgencyPageShell
      title="Imóveis"
      subtitle="Gerencie os imóveis da sua operação"
      searchPlaceholder="Buscar imóvel, bairro ou corretor"
      searchValue={search}
      onSearchChange={setSearch}
      primaryActionLabel="Novo imóvel"
      primaryActionOnClick={handleOpenCreateChoice}
      headerControls={
        <Button type="button" variant="ghost" onClick={() => setFiltersOpen((current) => !current)} className="h-8.5 rounded-xl border border-white/10 bg-white/5 px-4 text-white/75 hover:bg-white/10 hover:text-white">
          <SlidersHorizontal className="size-4" />
          Filtros
        </Button>
      }
    >
      {billingBypassEnabled ? (
        <section className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          Ambiente local com billing em modo de teste. A criação de imóveis está liberada sem bloqueio de plano.
        </section>
      ) : null}

      {isPlanBlocked ? (
        <section className="flex flex-col gap-3 rounded-[1.25rem] border border-[#ffb74d]/20 bg-[#ffb74d]/10 px-4 py-4 text-sm text-[#ffd180]">
          <p>Seu plano da imobiliária não está ativo para criar novos imóveis. Ative ou regularize sua assinatura para continuar.</p>
          <div>
            <Button
              asChild
              className="h-9 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
            >
              <Link href="/imobiliaria/plano">Ativar assinatura</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {actionFeedback ? (
        <section className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          {actionFeedback}
        </section>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Imóveis ativos" value={String(summary.active)} icon={Building2} />
        <SummaryCard label="Imóveis em rascunho" value={String(summary.draft)} icon={PencilLine} />
        <SummaryCard label="Visualizações totais" value={summary.views.toLocaleString("pt-BR")} icon={Eye} />
        <SummaryCard label="Leads gerados" value={String(summary.leads)} icon={Users} />
      </section>

      {filtersOpen && (
        <section className="rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
          <div className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
            <FilterGroup title="Status">
              {statusFilters.map((filter) => (
                <FilterButton key={filter} active={statusFilter === filter} onClick={() => setStatusFilter(filter)} label={filter} />
              ))}
            </FilterGroup>
            <FilterGroup title="Tipo">
              {typeFilters.map((filter) => (
                <FilterButton key={filter} active={typeFilter === filter} onClick={() => setTypeFilter(filter)} label={filter} />
              ))}
            </FilterGroup>
            <div className="grid gap-2">
              <p className="text-sm font-medium text-white/65">Corretor</p>
              <div className="flex flex-wrap gap-2">
                {brokers.map((broker) => (
                  <FilterButton key={broker} active={brokerFilter === broker} onClick={() => setBrokerFilter(broker)} label={broker} />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium text-white/65">Faixa de preço</p>
              <div className="flex flex-wrap gap-2">
                {priceFilters.map((filter) => (
                  <FilterButton key={filter} active={priceFilter === filter} onClick={() => setPriceFilter(filter)} label={filter} />
                ))}
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="ghost" onClick={clearFilters} className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white">
                Limpar filtros
              </Button>
            </div>
          )}
        </section>
      )}

      {filteredProperties.length === 0 ? (
        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <h3 className="text-2xl font-semibold text-white">Você ainda não cadastrou imóveis</h3>
          <p className="mt-3 text-sm leading-7 text-white/55">Adicione imóveis para começar a operar e alimentar seu catálogo institucional.</p>
          <Button onClick={handleOpenCreateChoice} className="mt-6 h-10 rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
            Adicionar primeiro imóvel
          </Button>
        </section>
      ) : (
        <section className="grid items-start gap-6 md:grid-cols-2 2xl:grid-cols-2">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <div className="relative h-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={property.image} alt={property.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute left-4 bottom-4">
                  <p className="text-lg font-bold text-white">{property.price}</p>
                </div>
              </div>
              <CardContent className="grid gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{property.title}</p>
                    <p className="mt-1 text-sm text-white/45">{property.location}</p>
                  </div>
                  <StatusBadge status={property.status} />
                </div>

                <div className="flex items-center gap-4">
                  <Feature icon={Bed} value={property.bedrooms} />
                  <Feature icon={Bath} value={property.bathrooms} />
                  <Feature icon={Car} value={property.parking} />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/[0.08] bg-black/20 px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-[#00C853]/15 text-xs font-semibold text-[#69F0AE]">
                      {property.broker.initials}
                    </div>
                    <div>
                      <p className="text-xs text-white/40">Publicado por</p>
                      <p className="text-sm font-medium text-white">{property.broker.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">Visualizações</p>
                    <p className="text-sm font-semibold text-white">{property.views}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">Leads</p>
                    <p className="text-sm font-semibold text-white">{property.leads}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setSelectedProperty(property)} className="h-9 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
                    Ver detalhes
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleEdit(property)} className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                    Editar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleTogglePublish(property)} className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                    {property.status === "Publicado" ? "Despublicar" : "Publicar"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handleDelete(property)} className="h-9 rounded-xl border border-[#ff6b6b]/15 bg-[#ff6b6b]/8 px-4 text-[#ff9b9b] hover:bg-[#ff6b6b]/12 hover:text-[#ffc1c1]">
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Dialog open={isCreateChoiceOpen} onOpenChange={setIsCreateChoiceOpen}>
        <DialogContent showCloseButton className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-4xl">
          <DialogTitle className="text-2xl text-white">Como voce quer criar este imovel?</DialogTitle>
          <DialogDescription className="mt-2 text-white/55">
            Escolha o melhor ponto de partida. Voce sempre podera revisar antes de publicar.
          </DialogDescription>
          {creationMode === "import" ? (
            <AgencyImportPanel
              feedback={importFeedback}
              preview={xmlPreview}
              summary={xmlSummary}
              report={xmlReport}
              isAnalyzing={isAnalyzingXml}
              isImporting={isImportingXml}
              onImported={refreshProperties}
              onBack={() => {
                setCreationMode(null)
                setImportFeedback("")
              }}
              onXmlImport={handleAgencyXmlImport}
              onConfirmImport={handleConfirmAgencyXmlImport}
            />
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <AgencyCreationOption
                icon={Sparkles}
                title="Criar com IA"
                description="Envie fotos, audio ou uma descricao e gere um anuncio automaticamente."
                onClick={() => void handleCreateProperty("ai")}
              />
              <AgencyCreationOption
                icon={Keyboard}
                title="Criar manualmente"
                description="Ideal para anuncios ja existentes ou preenchimento completo."
                onClick={() => void handleCreateProperty("manual")}
              />
              <AgencyCreationOption
                icon={FileText}
                title="Importar imoveis"
                description="Importe imoveis via XML, planilha ou anuncio existente."
                onClick={() => {
                  setCreationMode("import")
                  setImportFeedback("")
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent showCloseButton className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-4xl">
          {selectedProperty && (
            <div className="grid max-h-[92vh] overflow-y-auto lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-white/[0.08] lg:border-r lg:border-b-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedProperty.image} alt={selectedProperty.title} className="h-full w-full object-cover" />
              </div>
              <div className="p-5 lg:p-6">
                <DialogTitle className="text-2xl font-semibold text-white">{selectedProperty.title}</DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-6 text-white/55">
                  Visão resumida do imóvel para gestão da operação.
                </DialogDescription>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <InfoBlock label="Localização" value={selectedProperty.location} />
                  <InfoBlock label="Preço" value={selectedProperty.price} />
                  <InfoBlock label="Status" value={selectedProperty.status} />
                  <InfoBlock label="Tipo" value={selectedProperty.type} />
                  <InfoBlock label="Visualizações" value={String(selectedProperty.views)} />
                  <InfoBlock label="Leads" value={String(selectedProperty.leads)} />
                </div>

                <div className="mt-6 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-[#00C853]/15 text-sm font-semibold text-[#69F0AE]">
                      {selectedProperty.broker.initials}
                    </div>
                    <div>
                      <p className="text-sm text-white/45">Publicado por</p>
                      <p className="font-medium text-white">{selectedProperty.broker.name}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => handleEdit(selectedProperty)} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
                    Editar imóvel
                  </Button>
                  <Button variant="ghost" onClick={() => handleTogglePublish(selectedProperty)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                    {selectedProperty.status === "Publicado" ? "Despublicar" : "Publicar"}
                  </Button>
                  <Button variant="ghost" onClick={() => handleDelete(selectedProperty)} className="h-10 rounded-xl border border-[#ff6b6b]/15 bg-[#ff6b6b]/8 px-4 text-[#ff9b9b] hover:bg-[#ff6b6b]/12 hover:text-[#ffc1c1]">
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={closeEditModal}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-3xl">
          {editingProperty && (
            <>
              <div className="border-b border-white/[0.08] px-6 py-5">
                <DialogTitle className="text-xl text-white">{editingProperty.id ? "Editar imóvel" : "Novo imóvel"}</DialogTitle>
                <DialogDescription className="mt-2 text-white/50">
                  {editingProperty.id
                    ? "Atualize os dados principais do imóvel sem sair da operação da imobiliária."
                    : "Preencha os dados principais para cadastrar um novo imóvel da imobiliária."}
                </DialogDescription>
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
                            if (editingProperty.id) {
                              void addPropertyPhotos(event.target.files)
                            } else {
                              addDraftPropertyPhotos(event.target.files)
                            }
                            event.currentTarget.value = ""
                          }}
                        />
                        Adicionar fotos
                      </label>
                    </div>

                    {(editingProperty.id ? editingProperty.images : draftImagePreviews).length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {(editingProperty.id ? editingProperty.images : draftImagePreviews).map((image, index) => (
                          <div key={`${image}-${index}`} className="group relative overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image} alt={`Imagem ${index + 1}`} className="h-36 w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                if (editingProperty.id) {
                                  void removePropertyPhoto(image)
                                } else {
                                  removeDraftPropertyPhoto(image)
                                }
                              }}
                              className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity hover:bg-red-500/30 group-hover:opacity-100"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-sm text-white/55">
                        Nenhuma imagem selecionada ainda para este imovel.
                      </div>
                    )}
                  </section>

                  <section className="grid gap-4">
                    <h3 className="text-lg font-semibold text-white">Informações principais</h3>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Título">
                        <Input value={editingProperty.title} onChange={(event) => updateEditingField("title", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                      </Field>
                      <Field label="Preço">
                        <Input value={editingProperty.price} onChange={(event) => updateEditingField("price", formatCurrencyInput(event.target.value))} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                      </Field>
                      <Field label="Tipo">
                        <Select value={editingProperty.type} onValueChange={(value) => updateEditingField("type", value as EditableAgencyProperty["type"])}>
                          <SelectTrigger className="h-10 w-full rounded-xl border-white/[0.08] bg-white/[0.04] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-white/[0.08] bg-[#121212] text-white">
                            <SelectItem value="Apartamento">Apartamento</SelectItem>
                            <SelectItem value="Casa">Casa</SelectItem>
                            <SelectItem value="Comercial">Comercial</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Quartos">
                        <CounterInput value={editingProperty.bedrooms} onChange={(value) => updateEditingField("bedrooms", value)} />
                      </Field>
                      <Field label="Banheiros">
                        <CounterInput value={editingProperty.bathrooms} onChange={(value) => updateEditingField("bathrooms", value)} />
                      </Field>
                      <Field label="Vagas">
                        <CounterInput value={editingProperty.parking} onChange={(value) => updateEditingField("parking", value)} />
                      </Field>
                      <Field label="Bairro">
                        <Input value={editingProperty.neighborhood} onChange={(event) => updateEditingField("neighborhood", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                      </Field>
                      <Field label="Cidade">
                        <Input value={editingProperty.city} onChange={(event) => updateEditingField("city", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                      </Field>
                    </div>
                  </section>

                  <section className="grid gap-4">
                    <h3 className="text-lg font-semibold text-white">Descrição</h3>
                    <Textarea value={editingProperty.description} onChange={(event) => updateEditingField("description", event.target.value)} placeholder="Descreva os principais diferenciais do imóvel..." className="min-h-32 rounded-[1.25rem] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30" />
                  </section>

                  {!editingProperty.id ? <AgencyDraftPreview property={editingProperty} /> : null}

                  <section className="grid gap-4">
                    <h3 className="text-lg font-semibold text-white">Áudio</h3>
                    {editingProperty.id && (
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white">
                        <input
                          type="file"
                          accept="audio/*"
                          className="sr-only"
                          onChange={(event) => {
                            void addPropertyAudio(event.target.files)
                            event.currentTarget.value = ""
                          }}
                        />
                        Enviar áudio
                      </label>
                    )}

                    {editingProperty.audioUrl ? (
                      <>
                        <audio controls src={editingProperty.audioUrl} className="w-full">
                          Seu navegador não suporta reprodução de áudio.
                        </audio>
                        <Button type="button" variant="ghost" onClick={() => void removePropertyAudio()} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                          Remover áudio
                        </Button>
                      </>
                    ) : (
                      <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-sm text-white/55">
                        {editingProperty.id
                          ? "Nenhum áudio enviado ainda para este imóvel."
                          : "Cadastre o imóvel primeiro para enviar áudio."}
                      </div>
                    )}
                  </section>

                  {(editingProperty.id || creationMode === "ai") ? (
                  <section className="grid gap-3">
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
                          <span key={highlight} className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs text-[#69F0AE]">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </section>
                  ) : null}

                  {saveFeedback && (
                    <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
                      {saveFeedback}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="sticky bottom-0 border-t border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.98))] px-6 py-4 sm:justify-end">
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="ghost" onClick={() => closeEditModal(false)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                    Cancelar
                  </Button>
                  <Button onClick={saveChanges} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
                    {editingProperty.id ? "Salvar alterações" : "Cadastrar imóvel"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AgencyPageShell>
  )
}

function AgencyCreationOption({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-48 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-colors hover:border-[#00C853]/30 hover:bg-[#00C853]/[0.06]"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/55">{description}</p>
    </button>
  )
}

function AgencyImportPanel({
  feedback,
  preview,
  summary,
  report,
  isAnalyzing,
  isImporting,
  onImported,
  onBack,
  onXmlImport,
  onConfirmImport,
}: {
  feedback: string
  preview: ParsedXmlProperty[]
  summary: XmlImportSummary | null
  report: XmlImportReport | null
  isAnalyzing: boolean
  isImporting: boolean
  onImported: () => void | Promise<void>
  onBack: () => void
  onXmlImport: (files: FileList | null) => void | Promise<void>
  onConfirmImport: () => void | Promise<void>
}) {
  return (
    <div className="mt-6 grid gap-4">
      <Button type="button" variant="ghost" onClick={onBack} className="h-10 w-fit rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
        Voltar
      </Button>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="min-h-44 cursor-pointer rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5 transition-colors hover:border-[#00C853]/30 hover:bg-[#00C853]/[0.06]">
          <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={(event) => void onXmlImport(event.target.files)} />
          <Upload className="size-8 text-[#69F0AE]" />
          <h3 className="mt-5 text-lg font-semibold text-white">Importar XML</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">Envie um arquivo XML de imoveis para revisar antes de importar.</p>
        </label>
        <AgencyImportSoon title="Importar planilha" />
        <div className="min-h-44 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
          <Sparkles className="size-8 text-[#69F0AE]" />
          <h3 className="mt-5 text-lg font-semibold text-white">Importar de anuncio</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">Cole texto, informe um link ou envie um print para extrair com IA.</p>
        </div>
      </div>
      <AdImportPanel onImported={onImported} />
      {isAnalyzing ? <p className="text-sm text-white/55">Analisando XML...</p> : null}
      {summary ? (
        <AgencyXmlImportPreview
          preview={preview}
          summary={summary}
          report={report}
          isImporting={isImporting}
          onConfirmImport={onConfirmImport}
        />
      ) : null}
      {feedback ? <p className="rounded-[1rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">{feedback}</p> : null}
    </div>
  )
}

function AgencyXmlImportPreview({
  preview,
  summary,
  report,
  isImporting,
  onConfirmImport,
}: {
  preview: ParsedXmlProperty[]
  summary: XmlImportSummary
  report: XmlImportReport | null
  isImporting: boolean
  onConfirmImport: () => void | Promise<void>
}) {
  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Preview da importacao</h3>
          <p className="mt-1 text-sm text-white/55">
            {summary.total} encontrados · {summary.ready} prontos · {summary.needsReview} para revisar · {summary.invalid} invalidos
          </p>
        </div>
        <Button type="button" onClick={() => void onConfirmImport()} disabled={isImporting || summary.ready + summary.needsReview === 0} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60">
          {isImporting ? "Importando..." : "Confirmar importacao"}
        </Button>
      </div>
      <div className="grid gap-3">
        {preview.slice(0, 12).map((property, index) => (
          <div key={`${property.title}-${index}`} className="rounded-[1rem] border border-white/[0.08] bg-black/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{property.title || "Imovel sem titulo"}</p>
                <p className="mt-1 text-sm text-white/50">{[property.neighborhood, property.city].filter(Boolean).join(", ") || "Localizacao pendente"}</p>
              </div>
              <AgencyImportStatusBadge status={property.status} />
            </div>
            <p className="mt-2 text-sm text-white/70">{property.price || "Preco pendente"}</p>
            {property.images.length > 0 ? <p className="mt-1 text-xs text-white/45">{property.images.length} imagem(ns) por URL</p> : null}
            {property.issues.length > 0 ? <p className="mt-2 text-xs text-white/45">Revisar: {property.issues.join(", ")}</p> : null}
          </div>
        ))}
      </div>
      {report ? (
        <div className="rounded-[1rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          Importados: {report.imported}. Duplicados ignorados: {report.duplicates}. Com erro: {report.errors}.
        </div>
      ) : null}
    </div>
  )
}

function AgencyImportStatusBadge({ status }: { status: ParsedXmlProperty["status"] }) {
  const label =
    status === "ready" ? "Pronto para importar" : status === "needs_review" ? "Precisa revisar" : "Invalido"

  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/70">
      {label}
    </span>
  )
}

function AgencyImportSoon({ title }: { title: string }) {
  return (
    <div className="min-h-44 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
      <FileText className="size-8 text-white/40" />
      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/55">Em breve.</p>
    </div>
  )
}

function AgencyDraftPreview({ property }: { property: EditableAgencyProperty }) {
  const location = [property.neighborhood.trim(), property.city.trim()].filter(Boolean).join(", ")
  const hasData = Boolean(property.title.trim() || property.price.trim() || location || property.description.trim())

  return (
    <section className="grid gap-3">
      <h3 className="text-lg font-semibold text-white">Preview</h3>
      {!hasData ? (
        <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-sm text-white/55">
          Preencha os dados para visualizar o anuncio.
        </div>
      ) : (
        <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
          {property.title.trim() ? <p className="text-lg font-semibold text-white">{property.title}</p> : null}
          {location ? <p className="mt-1 text-sm text-white/50">{location}</p> : null}
          <p className="mt-3 text-xl font-semibold text-white">{property.price || "Consulte valor"}</p>
          {property.description.trim() ? <p className="mt-3 text-sm leading-6 text-white/60">{property.description}</p> : null}
        </div>
      )}
    </section>
  )
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Building2 }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-2.5 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-white/65">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" onClick={onClick} className={`h-9 rounded-full border px-4 text-sm ${active ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE] hover:bg-[#00C853]/14" : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"}`}>
      {label}
    </Button>
  )
}

function Feature({ icon: Icon, value }: { icon: typeof Bed; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-white/40" />
      <span className="text-xs text-white/55">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: AgencyProperty["status"] }) {
  const tone =
    status === "Publicado"
      ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"
      : status === "Rascunho"
        ? "border-[#ffd54f]/20 bg-[#ffd54f]/10 text-[#ffe082]"
        : "border-white/[0.08] bg-white/[0.04] text-white/65"

  return <span className={`rounded-full border px-3 py-1 text-xs ${tone}`}>{status}</span>
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  )
}

function CounterInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex h-10 items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-2">
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(Math.max(0, value - 1))} className="size-7 rounded-lg text-white/70 hover:bg-white/[0.08] hover:text-white">
        -
      </Button>
      <span className="text-sm font-semibold text-white">{value}</span>
      <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value + 1)} className="size-7 rounded-lg text-white/70 hover:bg-white/[0.08] hover:text-white">
        +
      </Button>
    </div>
  )
}
