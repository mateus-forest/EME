"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Copy, Download, ExternalLink, FileText, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import { Textarea } from "@/components/ui/textarea"
import { proposalHtmlToText } from "@/lib/proposal-template"
import { formatPhone } from "@/lib/structured-fields"

type BrokerDocument = {
  id: string
  type: string
  title: string
  content: string
  status: string
  leadId: string | null
  propertyId: string | null
  leadName: string
  propertyTitle: string
  createdAt: string
}

type LeadOption = {
  id: string
  name: string
  phone: string
  email: string
  identification?: {
    cpfCnpj?: string
  }
  documents?: Array<{
    id: string
    label: string
    name: string
  }>
}

type PropertyOption = {
  id: string
  publicCode: number | null
  title: string
  formattedPrice: string
  location?: string
  city: string
  neighborhood: string
  bedrooms: number
  parkingSpots: number
  type: string
  purpose: string
  legal?: {
    street?: string
    number?: string
    privateArea?: string
    totalArea?: string
  }
}

const statuses = [
  { label: "Todos", value: "all" },
  { label: "Rascunhos", value: "draft" },
  { label: "Gerados", value: "generated" },
  { label: "Assinados", value: "signed" },
] as const

function isHtmlDocument(content: string) {
  return /<!doctype html|<html|<main|<section/i.test(content)
}

function isVideoDocument(document: BrokerDocument | null) {
  return document?.type === "studio_ia_video"
}

function parseVideoDocumentContent(content: string) {
  try {
    const parsed = JSON.parse(content) as { videoUrl?: string }
    return typeof parsed.videoUrl === "string" ? parsed.videoUrl : ""
  } catch {
    return ""
  }
}

function statusLabel(status: string) {
  if (status === "signed") return "Assinado"
  if (status === "generated") return "Gerado"
  if (status === "archived") return "Arquivado"
  return "Rascunho"
}

function propertyTypeLabel(value: string) {
  const labels: Record<string, string> = {
    APARTMENT: "Apartamento",
    HOUSE: "Casa",
    COMMERCIAL: "Comercial",
    LAND: "Terreno",
    RURAL: "Rural",
    OTHER: "Outro",
  }
  return labels[value.toUpperCase()] ?? value
}

function propertyPurposeLabel(value: string) {
  return value.toLowerCase().includes("loc") || value.toUpperCase() === "RENT" ? "Locação" : "Venda"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const emptyDraft = {
  title: "",
  leadId: "",
  propertyId: "",
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  propertyTitle: "",
  propertyCode: "",
  propertyNeighborhood: "",
  propertyCity: "",
  propertyType: "",
  propertyPurpose: "venda",
  propertyPrice: "",
  propertyArea: "",
  propertyBedrooms: "",
  propertyParkingSpots: "",
  entry: "",
  financing: "",
  installments: "",
  paymentMethod: "",
  conditions: "",
  validity: "",
}

export function BrokerDocumentsPage() {
  const [documents, setDocuments] = useState<BrokerDocument[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [selectedDocument, setSelectedDocument] = useState<BrokerDocument | null>(null)
  const [status, setStatus] = useState<(typeof statuses)[number]["value"]>("all")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const composerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isComposerOpen) return

    const frame = window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      composerRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isComposerOpen])

  const loadDocuments = useCallback(async (nextStatus = status) => {
    setIsLoading(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/brokers/documents?status=${nextStatus}&type=proposal`, { credentials: "include", cache: "no-store" })
      const data = (await response.json().catch(() => null)) as { documents?: BrokerDocument[]; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível carregar documentos.")
      const nextDocuments = data?.documents ?? []
      setDocuments(nextDocuments)
      setSelectedDocument((current) => nextDocuments.find((document) => document.id === current?.id) ?? nextDocuments[0] ?? null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar documentos.")
    } finally {
      setIsLoading(false)
    }
  }, [status])

  useEffect(() => {
    loadDocuments(status)
  }, [status, loadDocuments])

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadOption[] } | null
        if (!ignore && response.ok) setLeads(data?.leads ?? [])
      })
      .catch(() => null)

    fetch("/api/properties/me", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { properties?: PropertyOption[] } | null
        if (!ignore && response.ok) setProperties(data?.properties ?? [])
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  function selectLead(leadId: string) {
    const lead = leads.find((item) => item.id === leadId)
    setDraft((current) => ({
      ...current,
      leadId,
      clientName: lead?.name ?? current.clientName,
      clientPhone: lead?.phone ?? current.clientPhone,
      clientEmail: lead?.email ?? current.clientEmail,
    }))
  }

  function selectProperty(propertyId: string) {
    const property = properties.find((item) => item.id === propertyId)
    const purpose = property?.purpose?.toLowerCase().includes("loc") ? "locação" : "venda"
    setDraft((current) => ({
      ...current,
      propertyId,
      propertyTitle: property?.title ?? current.propertyTitle,
      propertyCode: property ? String(property.publicCode ?? property.id) : current.propertyCode,
      propertyNeighborhood: property?.neighborhood ?? current.propertyNeighborhood,
      propertyCity: property?.city ?? current.propertyCity,
      propertyType: property?.type ?? current.propertyType,
      propertyPurpose: property ? purpose : current.propertyPurpose,
      propertyPrice: property?.formattedPrice ?? current.propertyPrice,
      propertyArea: property ? property.legal?.privateArea || property.legal?.totalArea || "" : current.propertyArea,
      propertyBedrooms: property ? String(property.bedrooms) : current.propertyBedrooms,
      propertyParkingSpots: property ? String(property.parkingSpots) : current.propertyParkingSpots,
    }))
  }

  async function createProposal() {
    setIsSaving(true)
    setFeedback("")
    try {
      const response = await fetch("/api/brokers/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      })
      const data = (await response.json().catch(() => null)) as { document?: BrokerDocument; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível gerar a proposta.")
      setDraft(emptyDraft)
      setFeedback("Proposta gerada e pronta para baixar.")
      await loadDocuments()
      if (data?.document) setSelectedDocument(data.document)
      setIsComposerOpen(false)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível gerar a proposta.")
    } finally {
      setIsSaving(false)
    }
  }

  async function markSigned(id: string) {
    try {
      const response = await fetch("/api/brokers/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status: "signed" }),
      })
      const data = (await response.json().catch(() => null)) as { document?: BrokerDocument; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível atualizar o documento.")
      setDocuments((current) => current.map((document) => document.id === id ? { ...document, status: "signed" } : document))
      setSelectedDocument((current) => current?.id === id ? { ...current, status: "signed" } : current)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o documento.")
    }
  }

  async function copyContent() {
    if (!selectedDocument) return
    if (isVideoDocument(selectedDocument)) {
      const videoUrl = parseVideoDocumentContent(selectedDocument.content)
      await navigator.clipboard.writeText(videoUrl).catch(() => null)
      setFeedback("Link do vídeo copiado.")
      return
    }

    const content = isHtmlDocument(selectedDocument.content)
      ? proposalHtmlToText(selectedDocument.content)
      : selectedDocument.content
    await navigator.clipboard.writeText(content).catch(() => null)
    setFeedback("Texto copiado.")
  }

  async function openDocument(shouldPrint = false) {
    if (!selectedDocument) return
    if (isVideoDocument(selectedDocument)) {
      const videoUrl = parseVideoDocumentContent(selectedDocument.content)
      if (!videoUrl) {
        setFeedback("Não foi possível localizar o arquivo de vídeo.")
        return
      }

      window.open(videoUrl, "_blank", "noopener,noreferrer")
      return
    }

    const printableContent = isHtmlDocument(selectedDocument.content)
      ? selectedDocument.content
      : `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(selectedDocument.title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;white-space:pre-wrap;color:#111}</style></head><body>${escapeHtml(selectedDocument.content)}</body></html>`
    const popup = window.open("", "_blank")
    if (!popup) {
      setFeedback("Permita pop-ups para abrir o documento.")
      return
    }
    if (shouldPrint) {
      const response = await fetch(`/api/brokers/documents/${selectedDocument.id}/pdf-credit`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        popup.close()
        setFeedback(data?.error || "Não foi possível preparar o PDF.")
        return
      }
    }
    popup.document.open()
    popup.document.write(printableContent)
    popup.document.close()
    if (shouldPrint) {
      popup.onload = () => {
        popup.focus()
        popup.print()
      }
    }
  }

  const selectedLead = leads.find((lead) => lead.id === draft.leadId)
  const selectedProperty = properties.find((property) => property.id === draft.propertyId)
  const selectedPropertyLocation = selectedProperty?.location || [draft.propertyNeighborhood, draft.propertyCity].filter(Boolean).join(", ")
  const selectedPropertyFeatures = [
    draft.propertyArea ? `${draft.propertyArea} m²` : "",
    Number(draft.propertyBedrooms) > 0 ? `${draft.propertyBedrooms} dormitório${Number(draft.propertyBedrooms) === 1 ? "" : "s"}` : "",
    Number(draft.propertyParkingSpots) > 0 ? `${draft.propertyParkingSpots} vaga${Number(draft.propertyParkingSpots) === 1 ? "" : "s"}` : "",
  ].filter(Boolean)

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
      <section data-testid="proposal-workspace" className="grid min-w-0 max-w-full gap-3 xl:h-[calc(100dvh-8rem)] xl:min-h-[34rem] xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-stretch">
        <Card className="flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
          <CardHeader className="gap-2.5 border-b border-[var(--broker-border)] px-3 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg text-[#050505]">
                <FileText className="size-4 text-[#009b3a]" />
                Propostas
              </CardTitle>
              <Button type="button" onClick={() => setIsComposerOpen(true)} className="h-9 rounded-xl bg-[#009b3a] px-3 text-xs font-semibold text-white hover:bg-[#008633]">
                <Plus className="size-4" />
                Nova
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatus(item.value)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${status === item.value ? "border-[#009b3a]/25 bg-[#009b3a]/10 text-[#007f31]" : "border-[var(--broker-border)] bg-[var(--broker-surface-muted)] text-[#5F6B7A] hover:bg-[#f2f5f1]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="eme-subtle-scrollbar grid max-h-[32rem] min-h-0 content-start gap-1 overflow-y-auto overscroll-contain p-2 xl:max-h-none xl:flex-1">
            {feedback ? <p className="rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-3 text-sm text-[#009b3a]">{feedback}</p> : null}
            {isLoading ? (
              <EmeLoading compact message="Carregando documentos..." />
            ) : documents.length > 0 ? (
              documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  aria-pressed={selectedDocument?.id === document.id}
                  onClick={() => setSelectedDocument(document)}
                  className={`min-w-0 max-w-full rounded-xl border px-2.5 py-1.5 text-left transition ${selectedDocument?.id === document.id ? "border-[#009b3a]/25 bg-[#009b3a]/[0.08]" : "border-[var(--broker-border)] bg-[var(--broker-surface-muted)] hover:bg-[#f2f5f1]"}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-4 text-[#050505]">{document.title}</p>
                    <span className="shrink-0 rounded-full border border-black/[0.06] bg-white/75 px-1.5 py-0.5 text-[10px] font-medium leading-3.5 text-[#667085]">
                      {statusLabel(document.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] leading-4 text-[#6B7280]">
                    {document.leadName || "Cliente não informado"}{document.propertyTitle ? ` · ${document.propertyTitle}` : ""}
                  </p>
                </button>
              ))
            ) : (
              <p className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280]">Nenhum documento encontrado.</p>
            )}
          </CardContent>
        </Card>

        <div className="eme-subtle-scrollbar flex min-h-0 min-w-0 max-w-full flex-col gap-3 overflow-x-hidden pb-2 xl:h-full xl:max-h-full xl:overflow-y-auto xl:overscroll-y-contain xl:pr-1 xl:[scrollbar-gutter:stable]">
          <Card
            ref={composerRef}
            tabIndex={-1}
            className={`${isComposerOpen ? "grid" : "hidden"} min-w-0 shrink-0 scroll-mt-4 overflow-hidden rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)] outline-none`}
          >
            <CardHeader className="flex-row items-center justify-between gap-3 border-b border-[var(--broker-border)] px-4 py-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-[#050505]">
                  <Plus className="size-4 text-[#009b3a]" />
                  Gerar proposta
                </CardTitle>
                <p className="mt-1 text-xs text-[#667085]">Preencha apenas os dados necessários para criar uma nova proposta.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsComposerOpen(false)} aria-label="Fechar formulário de proposta" className="size-9 rounded-full border border-[var(--broker-border)] text-[#475467] hover:bg-[var(--broker-surface-muted)]">
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 p-4">
              <label className="grid gap-1.5 text-xs font-medium text-[#475467]">
                Título
                <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Título da proposta" className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505]" />
              </label>

              <div className="grid items-start gap-3 lg:grid-cols-2">
                <div className="grid gap-2.5 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-3.5">
                  <p className="text-sm font-semibold text-[#050505]">Cliente</p>
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Selecionar cliente
                    <select value={draft.leadId} onChange={(event) => selectLead(event.target.value)} className="h-10 min-w-0 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#050505]">
                      <option value="" className="bg-white">Cliente cadastrado ou preenchimento manual</option>
                      {leads.map((lead) => (
                        <option key={lead.id} value={lead.id} className="bg-white">{lead.name || formatPhone(lead.phone) || "Cliente sem nome"}</option>
                      ))}
                    </select>
                  </label>
                  {selectedLead ? (
                    <div className="grid gap-2 rounded-xl border border-[#009b3a]/10 bg-white/80 p-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98A2B3]">Nome</p>
                        <p className="mt-0.5 break-words text-xs font-semibold text-[#344054]">{selectedLead.name || "Não informado"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98A2B3]">Telefone</p>
                        <p className="mt-0.5 break-words text-xs text-[#475467]">{formatPhone(selectedLead.phone) || "Não informado"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98A2B3]">E-mail</p>
                        <p className="mt-0.5 break-all text-xs text-[#475467]">{selectedLead.email || "Não informado"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98A2B3]">CPF / CNPJ</p>
                        <p className="mt-0.5 break-words text-xs text-[#475467]">{selectedLead.identification?.cpfCnpj || "Não informado"}</p>
                      </div>
                      {selectedLead.documents?.length ? (
                        <div className="min-w-0 sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98A2B3]">Documentos</p>
                          <p className="mt-0.5 break-words text-xs text-[#475467]">{selectedLead.documents.map((document) => document.label || document.name).join(", ")}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <details className="group rounded-xl border border-black/[0.05] bg-white/70 px-3 py-2">
                    <summary className="cursor-pointer list-none text-xs font-medium text-[#667085] marker:hidden">
                      <span className="group-open:hidden">Preencher ou ajustar dados do cliente</span>
                      <span className="hidden group-open:inline">Ocultar dados manuais do cliente</span>
                    </summary>
                    <div className="grid gap-2 pt-3">
                      <Input value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} placeholder="Nome do cliente" aria-label="Nome do cliente" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <StructuredInput kind="phone" value={draft.clientPhone} onValueChange={(value) => setDraft({ ...draft, clientPhone: value })} placeholder="Telefone" aria-label="Telefone do cliente" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <Input value={draft.clientEmail} onChange={(event) => setDraft({ ...draft, clientEmail: event.target.value })} placeholder="E-mail" aria-label="E-mail do cliente" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                    </div>
                  </details>
                </div>

                <div className="grid gap-2.5 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-3.5">
                  <p className="text-sm font-semibold text-[#050505]">Imóvel</p>
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Selecionar imóvel
                    <select value={draft.propertyId} onChange={(event) => selectProperty(event.target.value)} className="h-10 min-w-0 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#050505]">
                      <option value="" className="bg-white">Imóvel cadastrado ou preenchimento manual</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id} className="bg-white">{property.title}</option>
                      ))}
                    </select>
                  </label>
                  {selectedProperty && draft.propertyTitle ? (
                    <div className="grid gap-2 rounded-xl border border-[#009b3a]/10 bg-white/80 p-3">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-xs font-semibold text-[#344054]">{draft.propertyTitle}</p>
                          <p className="mt-0.5 break-words text-[11px] leading-4 text-[#667085]">{selectedPropertyLocation || "Localização não informada"}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#009b3a]/10 px-2 py-1 text-[10px] font-semibold text-[#007f31]">{draft.propertyPrice || "Valor não informado"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] text-[#475467]">
                        <span className="rounded-full border border-black/[0.06] bg-white px-2 py-1">{propertyPurposeLabel(draft.propertyPurpose)}</span>
                        <span className="rounded-full border border-black/[0.06] bg-white px-2 py-1">{propertyTypeLabel(draft.propertyType)}</span>
                        {selectedPropertyFeatures.map((feature) => <span key={feature} className="rounded-full border border-black/[0.06] bg-white px-2 py-1">{feature}</span>)}
                      </div>
                    </div>
                  ) : null}
                  <details className="group rounded-xl border border-black/[0.05] bg-white/70 px-3 py-2">
                    <summary className="cursor-pointer list-none text-xs font-medium text-[#667085] marker:hidden">
                      <span className="group-open:hidden">Preencher ou ajustar dados do imóvel</span>
                      <span className="hidden group-open:inline">Ocultar dados manuais do imóvel</span>
                    </summary>
                    <div className="grid gap-2 pt-3 sm:grid-cols-2">
                      <Input value={draft.propertyTitle} onChange={(event) => setDraft({ ...draft, propertyTitle: event.target.value })} placeholder="Imóvel" aria-label="Nome do imóvel" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <Input value={draft.propertyCode} onChange={(event) => setDraft({ ...draft, propertyCode: event.target.value })} placeholder="Código" aria-label="Código do imóvel" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <Input value={draft.propertyNeighborhood} onChange={(event) => setDraft({ ...draft, propertyNeighborhood: event.target.value })} placeholder="Bairro" aria-label="Bairro do imóvel" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <Input value={draft.propertyCity} onChange={(event) => setDraft({ ...draft, propertyCity: event.target.value })} placeholder="Cidade" aria-label="Cidade do imóvel" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <Input value={draft.propertyType} onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })} placeholder="Tipo" aria-label="Tipo do imóvel" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <StructuredInput kind="decimal" value={draft.propertyArea} onValueChange={(value) => setDraft({ ...draft, propertyArea: value })} placeholder="Metragem" aria-label="Área do imóvel" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <StructuredInput kind="quantity" value={draft.propertyBedrooms} onValueChange={(value) => setDraft({ ...draft, propertyBedrooms: value })} placeholder="Dormitórios" aria-label="Dormitórios" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <StructuredInput kind="quantity" value={draft.propertyParkingSpots} onValueChange={(value) => setDraft({ ...draft, propertyParkingSpots: value })} placeholder="Vagas" aria-label="Vagas" className="h-9 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                      <select aria-label="Finalidade do imóvel" value={draft.propertyPurpose} onChange={(event) => setDraft({ ...draft, propertyPurpose: event.target.value })} className="h-9 min-w-0 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#050505] sm:col-span-2">
                        <option value="venda" className="bg-white">Venda</option>
                        <option value="locação" className="bg-white">Locação</option>
                      </select>
                    </div>
                  </details>
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-3.5">
                <div>
                  <p className="text-sm font-semibold text-[#050505]">Condições da proposta</p>
                  <p className="mt-0.5 text-xs text-[#667085]">O valor do imóvel selecionado pode ser ajustado para esta proposta.</p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Valor da proposta
                    <StructuredInput kind="currency" value={draft.propertyPrice} onValueChange={(value) => setDraft({ ...draft, propertyPrice: value })} placeholder="R$ 0,00" aria-label="Valor da proposta" className="h-10 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Valor da entrada
                    <StructuredInput kind="currency" value={draft.entry} onValueChange={(value) => setDraft({ ...draft, entry: value })} placeholder="R$ 0,00" className="h-10 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Valor financiado / financiamento
                    <StructuredInput kind="currency" value={draft.financing} onValueChange={(value) => setDraft({ ...draft, financing: value })} placeholder="R$ 0,00" className="h-10 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Quantidade / valor das parcelas
                    <Input value={draft.installments} onChange={(event) => setDraft({ ...draft, installments: event.target.value })} placeholder="Ex.: 24x de R$ 5.000" className="h-10 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Forma de pagamento
                    <Input value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value })} placeholder="Ex.: financiamento" className="h-10 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                    Validade
                    <Input value={draft.validity} onChange={(event) => setDraft({ ...draft, validity: event.target.value })} placeholder="Ex.: 10 dias" className="h-10 min-w-0 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                  </label>
                </div>
                <label className="grid gap-1.5 text-xs font-medium text-[#667085]">
                  Observações
                  <Textarea value={draft.conditions} onChange={(event) => setDraft({ ...draft, conditions: event.target.value })} placeholder="Condições adicionais e observações da proposta" className="min-h-20 rounded-xl border-black/[0.06] bg-white text-[#050505]" />
                </label>
              </div>

              <div className="-mx-4 -mb-4 mt-1 border-t border-black/[0.05] bg-white p-4">
                <Button type="button" disabled={isSaving} onClick={createProposal} className="h-10 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60">
                  {isSaving ? "Gerando..." : "Gerar e salvar proposta"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 max-w-full shrink-0 overflow-hidden rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-4">
              <CardTitle className="break-words text-lg text-[#050505] [overflow-wrap:anywhere]">{selectedDocument?.title ?? "Prévia da proposta"}</CardTitle>
              <p className="text-xs text-[#667085]">Revise o documento selecionado antes de baixar ou marcar como assinado.</p>
            </CardHeader>
            <CardContent className="grid min-w-0 max-w-full gap-3 overflow-hidden p-4">
              {selectedDocument ? (
                <>
                  {isVideoDocument(selectedDocument) ? (
                    <video
                      controls
                      src={parseVideoDocumentContent(selectedDocument.content)}
                      className="block h-[clamp(20rem,54vh,34rem)] max-h-[34rem] min-h-0 w-full max-w-full rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-black object-contain"
                    />
                  ) : isHtmlDocument(selectedDocument.content) ? (
                    <iframe
                      title={selectedDocument.title}
                      srcDoc={selectedDocument.content}
                      className="pointer-events-none block h-[clamp(20rem,54vh,34rem)] max-h-[34rem] min-h-0 w-full max-w-full rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-white"
                    />
                  ) : (
                    <pre data-testid="proposal-preview" className="max-w-full whitespace-pre-wrap break-words rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm leading-7 text-[#5F6B7A] [overflow-wrap:anywhere]">{selectedDocument.content}</pre>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button type="button" variant="ghost" onClick={() => void openDocument(false)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                      <ExternalLink className="size-4" />
                      {isVideoDocument(selectedDocument) ? "Abrir arquivo" : "Abrir"}
                    </Button>
                    {isVideoDocument(selectedDocument) ? null : (
                      <Button type="button" variant="ghost" onClick={() => void openDocument(true)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                        <Download className="size-4" />
                        Baixar PDF
                      </Button>
                    )}
                    <Button type="button" variant="ghost" onClick={copyContent} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                      <Copy className="size-4" />
                      {isVideoDocument(selectedDocument) ? "Copiar link" : "Copiar texto"}
                    </Button>
                    {isVideoDocument(selectedDocument) ? null : (
                      <Button type="button" variant="ghost" disabled={selectedDocument.status === "signed"} onClick={() => markSigned(selectedDocument.id)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                        <CheckCircle2 className="size-4" />
                        {selectedDocument.status === "signed" ? "Assinado" : "Marcar assinado"}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280]">Selecione ou gere um documento.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
