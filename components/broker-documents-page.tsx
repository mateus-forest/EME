"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Copy, Download, ExternalLink, FileText, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { proposalHtmlToText } from "@/lib/proposal-template"

type BrokerDocument = {
  id: string
  type: string
  title: string
  content: string
  status: string
  leadName: string
  propertyTitle: string
  createdAt: string
}

type LeadOption = {
  id: string
  name: string
  phone: string
  email: string
}

type PropertyOption = {
  id: string
  title: string
  formattedPrice: string
  city: string
  neighborhood: string
  bedrooms: number
  parkingSpots: number
  type: string
  purpose: string
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

function statusLabel(status: string) {
  if (status === "signed") return "Assinado"
  if (status === "generated") return "Gerado"
  if (status === "archived") return "Arquivado"
  return "Rascunho"
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
  const [draft, setDraft] = useState(emptyDraft)

  const loadDocuments = useCallback(async (nextStatus = status) => {
    setIsLoading(true)
    setFeedback("")
    try {
      const response = await fetch(`/api/brokers/documents?status=${nextStatus}`, { credentials: "include", cache: "no-store" })
      const data = (await response.json().catch(() => null)) as { documents?: BrokerDocument[]; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível carregar documentos.")
      setDocuments(data?.documents ?? [])
      setSelectedDocument((current) => current ?? data?.documents?.[0] ?? null)
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
      propertyCode: property?.id ?? current.propertyCode,
      propertyNeighborhood: property?.neighborhood ?? current.propertyNeighborhood,
      propertyCity: property?.city ?? current.propertyCity,
      propertyType: property?.type ?? current.propertyType,
      propertyPurpose: property ? purpose : current.propertyPurpose,
      propertyPrice: property?.formattedPrice ?? current.propertyPrice,
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
    const content = isHtmlDocument(selectedDocument.content)
      ? proposalHtmlToText(selectedDocument.content)
      : selectedDocument.content
    await navigator.clipboard.writeText(content).catch(() => null)
    setFeedback("Texto copiado.")
  }

  async function openDocument(shouldPrint = false) {
    if (!selectedDocument) return
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

  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
          <CardHeader className="px-5 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <FileText className="size-5 text-[#69F0AE]" />
              Documentos
            </CardTitle>
            <div className="flex flex-wrap gap-2 pt-3">
              {statuses.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatus(item.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${status === item.value ? "border-[#00C853]/25 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.07]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0">
            {feedback ? <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-[#69F0AE]">{feedback}</p> : null}
            {isLoading ? (
              <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Carregando documentos...</p>
            ) : documents.length > 0 ? (
              documents.map((document) => (
                <button key={document.id} type="button" onClick={() => setSelectedDocument(document)} className={`rounded-[1.25rem] border p-4 text-left transition ${selectedDocument?.id === document.id ? "border-[#00C853]/25 bg-[#00C853]/10" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <p className="truncate font-semibold text-white">{document.title}</p>
                  <p className="mt-1 text-sm text-white/50">{statusLabel(document.status)} {document.leadName ? `· ${document.leadName}` : ""}</p>
                </button>
              ))
            ) : (
              <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Nenhum documento encontrado.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-4">
          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Plus className="size-5 text-[#69F0AE]" />
                Gerar proposta
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Título da proposta" className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />

              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Dados do cliente</p>
                <select value={draft.leadId} onChange={(event) => selectLead(event.target.value)} className="h-10 min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white">
                  <option value="" className="bg-[#111]">Lead cadastrado ou preenchimento manual</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id} className="bg-[#111]">{lead.name || lead.phone || "Lead sem nome"}</option>
                  ))}
                </select>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} placeholder="Nome cliente" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.clientPhone} onChange={(event) => setDraft({ ...draft, clientPhone: event.target.value })} placeholder="Telefone" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.clientEmail} onChange={(event) => setDraft({ ...draft, clientEmail: event.target.value })} placeholder="E-mail" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Dados do imóvel</p>
                <select value={draft.propertyId} onChange={(event) => selectProperty(event.target.value)} className="h-10 min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white">
                  <option value="" className="bg-[#111]">Imóvel cadastrado ou preenchimento manual</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id} className="bg-[#111]">{property.title}</option>
                  ))}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={draft.propertyTitle} onChange={(event) => setDraft({ ...draft, propertyTitle: event.target.value })} placeholder="Imóvel" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyPrice} onChange={(event) => setDraft({ ...draft, propertyPrice: event.target.value })} placeholder="Valor" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyCode} onChange={(event) => setDraft({ ...draft, propertyCode: event.target.value })} placeholder="Código/ID" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyNeighborhood} onChange={(event) => setDraft({ ...draft, propertyNeighborhood: event.target.value })} placeholder="Bairro" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyCity} onChange={(event) => setDraft({ ...draft, propertyCity: event.target.value })} placeholder="Cidade" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyType} onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })} placeholder="Tipo" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyArea} onChange={(event) => setDraft({ ...draft, propertyArea: event.target.value })} placeholder="Metragem" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyBedrooms} onChange={(event) => setDraft({ ...draft, propertyBedrooms: event.target.value })} placeholder="Dormitórios" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.propertyParkingSpots} onChange={(event) => setDraft({ ...draft, propertyParkingSpots: event.target.value })} placeholder="Vagas" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <select value={draft.propertyPurpose} onChange={(event) => setDraft({ ...draft, propertyPurpose: event.target.value })} className="h-10 min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white">
                    <option value="venda" className="bg-[#111]">Venda</option>
                    <option value="locação" className="bg-[#111]">Locação</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Condições</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={draft.entry} onChange={(event) => setDraft({ ...draft, entry: event.target.value })} placeholder="Entrada" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.installments} onChange={(event) => setDraft({ ...draft, installments: event.target.value })} placeholder="Parcelamento" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value })} placeholder="Forma de pagamento" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
                  <Input value={draft.validity} onChange={(event) => setDraft({ ...draft, validity: event.target.value })} placeholder="Validade da proposta" className="h-10 min-w-0 rounded-xl border-white/[0.08] bg-white/[0.04] text-white md:col-span-2" />
                </div>
                <Textarea value={draft.conditions} onChange={(event) => setDraft({ ...draft, conditions: event.target.value })} placeholder="Observações" className="min-h-24 rounded-xl border-white/[0.08] bg-white/[0.04] text-white" />
              </div>

              <Button type="button" disabled={isSaving} onClick={createProposal} className="h-10 rounded-xl bg-[#00C853] text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60">
                {isSaving ? "Gerando..." : "Gerar proposta"}
              </Button>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-lg text-white">{selectedDocument?.title ?? "Documento"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0">
              {selectedDocument ? (
                <>
                  {isHtmlDocument(selectedDocument.content) ? (
                    <iframe
                      title={selectedDocument.title}
                      srcDoc={selectedDocument.content}
                      className="h-[520px] w-full rounded-[1.25rem] border border-white/[0.08] bg-white"
                    />
                  ) : (
                    <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-7 text-white/70">{selectedDocument.content}</pre>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button type="button" variant="ghost" onClick={() => void openDocument(false)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]">
                      <ExternalLink className="size-4" />
                      Abrir
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => void openDocument(true)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]">
                      <Download className="size-4" />
                      Baixar PDF
                    </Button>
                    <Button type="button" variant="ghost" onClick={copyContent} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]">
                      <Copy className="size-4" />
                      Copiar texto
                    </Button>
                    <Button type="button" variant="ghost" disabled={selectedDocument.status === "signed"} onClick={() => markSigned(selectedDocument.id)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]">
                      <CheckCircle2 className="size-4" />
                      {selectedDocument.status === "signed" ? "Assinado" : "Marcar assinado"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-white/55">Selecione ou gere um documento.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
