"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CopyPlus, Download, FilePenLine, FileSignature, PencilLine, Plus, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { contractTypeOptions, type ContractType } from "@/lib/contract-template"

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
  type: string
  purpose: string
}

type ContractRecord = {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
  kind: ContractType
  version: number
  authorName: string
  leadId: string | null
  propertyId: string | null
  leadName: string
  propertyTitle: string
  amountLabel: string
  textPreview: string
  content: {
    html?: string
    financial: {
      amountLabel?: string | null
      commissionPercent?: string | null
      startDate?: string | null
      endDate?: string | null
      dueDate?: string | null
      validity?: string | null
      additionalConditions?: string | null
    }
    clauses: string[]
    reviewNotes: string[]
  }
}

const statusOptions = [
  { label: "Todos", value: "all" },
  { label: "Rascunhos", value: "draft" },
  { label: "Gerados", value: "generated" },
  { label: "Assinados", value: "signed" },
] as const

const wizardSteps = [
  "Tipo",
  "Cliente",
  "Imovel",
  "Condicoes",
  "Rascunho",
  "Revisao",
] as const

type ContractDraft = {
  id: string
  title: string
  kind: ContractType
  leadId: string
  propertyId: string
  amount: string
  commissionPercent: string
  startDate: string
  endDate: string
  dueDate: string
  validity: string
  additionalConditions: string
  clausesText: string
  reviewNotesText: string
}

const emptyDraft: ContractDraft = {
  id: "",
  title: "",
  kind: contractTypeOptions[0],
  leadId: "",
  propertyId: "",
  amount: "",
  commissionPercent: "",
  startDate: "",
  endDate: "",
  dueDate: "",
  validity: "",
  additionalConditions: "",
  clausesText: "",
  reviewNotesText: "",
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

export function BrokerContractsPage() {
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>("all")
  const [kindFilter, setKindFilter] = useState<"all" | ContractType>("all")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft)

  const leadName = useMemo(
    () => leads.find((item) => item.id === draft.leadId)?.name || selectedContract?.leadName || "",
    [draft.leadId, leads, selectedContract?.leadName],
  )
  const propertyName = useMemo(
    () => properties.find((item) => item.id === draft.propertyId)?.title || selectedContract?.propertyTitle || "",
    [draft.propertyId, properties, selectedContract?.propertyTitle],
  )

  const loadContracts = useCallback(async () => {
    setIsLoading(true)
    setFeedback("")
    try {
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (status) params.set("status", status)
      if (kindFilter) params.set("kind", kindFilter)

      const response = await fetch(`/api/brokers/contracts?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as { contracts?: ContractRecord[]; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel carregar contratos.")
      const nextContracts = data?.contracts ?? []
      setContracts(nextContracts)
      setSelectedContract((current) => nextContracts.find((item) => item.id === current?.id) ?? nextContracts[0] ?? null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar contratos.")
    } finally {
      setIsLoading(false)
    }
  }, [kindFilter, query, status])

  useEffect(() => {
    void loadContracts()
  }, [loadContracts])

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

  function openCreateDialog() {
    setDraft(emptyDraft)
    setSelectedContract(null)
    setStep(0)
    setIsDialogOpen(true)
  }

  function openEditDialog(contract: ContractRecord) {
    setDraft({
      id: contract.id,
      title: contract.title,
      kind: contract.kind,
      leadId: contract.leadId ?? "",
      propertyId: contract.propertyId ?? "",
      amount: contract.content.financial.amountLabel ?? "",
      commissionPercent: contract.content.financial.commissionPercent ?? "",
      startDate: contract.content.financial.startDate ?? "",
      endDate: contract.content.financial.endDate ?? "",
      dueDate: contract.content.financial.dueDate ?? "",
      validity: contract.content.financial.validity ?? "",
      additionalConditions: contract.content.financial.additionalConditions ?? "",
      clausesText: contract.content.clauses.join("\n"),
      reviewNotesText: contract.content.reviewNotes.join("\n"),
    })
    setStep(0)
    setIsDialogOpen(true)
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, wizardSteps.length - 1))
  }

  function previousStep() {
    setStep((current) => Math.max(current - 1, 0))
  }

  async function saveContract() {
    setIsSaving(true)
    setFeedback("")
    try {
      const endpoint = draft.id ? `/api/brokers/contracts/${draft.id}` : "/api/brokers/contracts"
      const method = draft.id ? "PATCH" : "POST"
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      })
      const data = (await response.json().catch(() => null)) as { contract?: ContractRecord; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel salvar o contrato.")
      setFeedback(draft.id ? "Contrato atualizado com sucesso." : "Contrato salvo como rascunho.")
      setIsDialogOpen(false)
      setDraft(emptyDraft)
      await loadContracts()
      if (data?.contract) setSelectedContract(data.contract)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel salvar o contrato.")
    } finally {
      setIsSaving(false)
    }
  }

  async function duplicateContract(contractId: string) {
    try {
      const response = await fetch(`/api/brokers/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "duplicate" }),
      })
      const data = (await response.json().catch(() => null)) as { contract?: ContractRecord; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel duplicar o contrato.")
      setFeedback("Contrato duplicado.")
      await loadContracts()
      if (data?.contract) setSelectedContract(data.contract)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel duplicar o contrato.")
    }
  }

  async function deleteContract(contractId: string) {
    const shouldDelete = window.confirm("Excluir este contrato?")
    if (!shouldDelete) return

    try {
      const response = await fetch(`/api/brokers/contracts/${contractId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel excluir o contrato.")
      setFeedback("Contrato excluido.")
      if (selectedContract?.id === contractId) setSelectedContract(null)
      await loadContracts()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel excluir o contrato.")
    }
  }

  async function exportPdf() {
    if (!selectedContract) return

    const response = await fetch(`/api/brokers/contracts/${selectedContract.id}/pdf-credit`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) {
      setFeedback(data?.error || "Nao foi possivel preparar o PDF.")
      return
    }

    const popup = window.open("", "_blank")
    if (!popup) {
      setFeedback("Permita pop-ups para exportar o PDF.")
      return
    }

    popup.document.open()
    popup.document.write(
      selectedContract.content.html ||
        `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(selectedContract.title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;white-space:pre-wrap;color:#111}</style></head><body>${escapeHtml(selectedContract.textPreview)}</body></html>`,
    )
    popup.document.close()
    popup.onload = () => {
      popup.focus()
      popup.print()
    }
  }

  function renderStep() {
    if (step === 0) {
      return (
        <div className="grid gap-3">
          <label className="grid gap-2 text-sm text-[#5F6B7A]">
            Tipo de contrato
            <select
              value={draft.kind}
              onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as ContractType }))}
              className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
            >
              {contractTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      )
    }

    if (step === 1) {
      return (
        <label className="grid gap-2 text-sm text-[#5F6B7A]">
          Cliente
          <select
            value={draft.leadId}
            onChange={(event) => setDraft((current) => ({ ...current, leadId: event.target.value }))}
            className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
          >
            <option value="">Selecione um cliente real</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name || lead.phone || "Cliente sem nome"}
              </option>
            ))}
          </select>
        </label>
      )
    }

    if (step === 2) {
      return (
        <label className="grid gap-2 text-sm text-[#5F6B7A]">
          Imovel
          <select
            value={draft.propertyId}
            onChange={(event) => setDraft((current) => ({ ...current, propertyId: event.target.value }))}
            className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
          >
            <option value="">Selecione um imovel real</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.title}
              </option>
            ))}
          </select>
        </label>
      )
    }

    if (step === 3) {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Titulo do contrato" className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505] md:col-span-2" />
          <Input value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="Valor" className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
          <Input value={draft.commissionPercent} onChange={(event) => setDraft((current) => ({ ...current, commissionPercent: event.target.value }))} placeholder="Comissao %" className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
          <Input value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} placeholder="Data inicial" className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
          <Input value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} placeholder="Data final" className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
          <Input value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} placeholder="Vencimento" className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
          <Input value={draft.validity} onChange={(event) => setDraft((current) => ({ ...current, validity: event.target.value }))} placeholder="Validade" className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
          <Textarea value={draft.additionalConditions} onChange={(event) => setDraft((current) => ({ ...current, additionalConditions: event.target.value }))} placeholder="Condicoes e observacoes" className="min-h-28 rounded-xl border-black/[0.08] bg-white text-[#050505] md:col-span-2" />
        </div>
      )
    }

    if (step === 4) {
      return (
        <div className="grid gap-3">
          <Textarea value={draft.clausesText} onChange={(event) => setDraft((current) => ({ ...current, clausesText: event.target.value }))} placeholder="Cada linha vira uma clausula base do rascunho." className="min-h-36 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
          <Textarea value={draft.reviewNotesText} onChange={(event) => setDraft((current) => ({ ...current, reviewNotesText: event.target.value }))} placeholder="Cada linha vira uma nota de revisao." className="min-h-32 rounded-xl border-black/[0.08] bg-white text-[#050505]" />
        </div>
      )
    }

    return (
      <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm leading-7 text-[#4B5563]">
        <p className="font-semibold text-[#050505]">{draft.title || `Contrato ${draft.kind}`}</p>
        <p className="mt-2">Cliente: {leadName || "Nao selecionado"}</p>
        <p>Imovel: {propertyName || "Nao selecionado"}</p>
        <p>Valor: {draft.amount || "Nao informado"}</p>
        <p>Comissao: {draft.commissionPercent || "Nao informada"}</p>
        <p className="mt-3">Ao salvar, o documento fica como rascunho, com versao, autor e data registrados.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0">
        <CardHeader className="px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                <FileSignature className="size-5 text-[#009b3a]" />
                Contratos
              </CardTitle>
              <p className="mt-1 text-sm text-[#6B7280]">Rascunhos, revisoes e exportacao de contratos ligados a clientes e imoveis reais.</p>
            </div>
            <Button type="button" onClick={openCreateDialog} className="h-10 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]">
              <Plus className="size-4" />
              Novo contrato
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B95A1]" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por titulo, cliente ou imovel" className="h-11 rounded-xl border-black/[0.08] bg-white pl-10 text-[#050505]" />
            </div>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | ContractType)} className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]">
              <option value="all">Todos os tipos</option>
              {contractTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((item) => (
                <button key={item.value} type="button" onClick={() => setStatus(item.value)} className={`rounded-full border px-3 py-2 text-sm transition ${status === item.value ? "border-[#009b3a]/25 bg-[#009b3a]/10 text-[#009b3a]" : "border-black/[0.06] bg-[#fbfbf8] text-[#5F6B7A] hover:bg-[#f6f7f4]"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {feedback ? <p className="rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-3 text-sm text-[#009b3a]">{feedback}</p> : null}

          <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="grid gap-3">
              {isLoading ? (
                <Card className="rounded-[1.5rem] border-black/[0.06] bg-white/90">
                  <CardContent className="p-5">
                    <EmeLoading compact message="Carregando contratos..." />
                  </CardContent>
                </Card>
              ) : contracts.length > 0 ? (
                contracts.map((contract) => (
                  <button key={contract.id} type="button" onClick={() => setSelectedContract(contract)} className={`rounded-[1.25rem] border p-4 text-left transition ${selectedContract?.id === contract.id ? "border-[#009b3a]/25 bg-[#009b3a]/10" : "border-black/[0.06] bg-white hover:bg-[#f8faf7]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#050505]">{contract.title}</p>
                        <p className="mt-1 text-sm text-[#6B7280]">{contract.kind} · {statusLabel(contract.status)}</p>
                      </div>
                      <span className="rounded-full border border-black/[0.06] bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[#8B95A1]">
                        v{contract.version}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#5F6B7A]">{contract.textPreview}</p>
                  </button>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm text-[#6B7280]">
                  Nenhum contrato encontrado.
                </div>
              )}
            </div>

            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0">
              <CardHeader className="px-5 py-5">
                <CardTitle className="text-lg text-[#050505]">{selectedContract?.title ?? "Selecione um contrato"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 pt-0">
                {selectedContract ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Cliente</p>
                        <p className="mt-2 font-medium text-[#050505]">{selectedContract.leadName || "Nao informado"}</p>
                      </div>
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Imovel</p>
                        <p className="mt-2 font-medium text-[#050505]">{selectedContract.propertyTitle || "Nao informado"}</p>
                      </div>
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Valor</p>
                        <p className="mt-2 font-medium text-[#050505]">{selectedContract.amountLabel || "Nao informado"}</p>
                      </div>
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Autor</p>
                        <p className="mt-2 font-medium text-[#050505]">{selectedContract.authorName}</p>
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Resumo</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#4B5563]">{selectedContract.textPreview}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" onClick={() => openEditDialog(selectedContract)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                        <PencilLine className="size-4" />
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => void duplicateContract(selectedContract.id)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                        <CopyPlus className="size-4" />
                        Duplicar
                      </Button>
                      <Button type="button" variant="ghost" onClick={exportPdf} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                        <Download className="size-4" />
                        Exportar PDF
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => void deleteContract(selectedContract.id)} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#D14343] hover:bg-white">
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm text-[#6B7280]">
                    Abra um contrato existente ou crie um novo rascunho para revisar aqui.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-[#fcfcfa] p-0">
          <DialogHeader className="border-b border-black/[0.06] px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <FilePenLine className="size-5 text-[#009b3a]" />
              {draft.id ? "Editar contrato" : "Novo contrato"}
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Fluxo em etapas para gerar um rascunho estruturado antes da revisao final e da exportacao em PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-5">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {wizardSteps.map((item, index) => (
                <button key={item} type="button" onClick={() => setStep(index)} className={`rounded-2xl border px-3 py-3 text-left transition ${step === index ? "border-[#009b3a]/25 bg-[#009b3a]/10 text-[#009b3a]" : "border-black/[0.06] bg-white text-[#5F6B7A]"}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em]">{index + 1}</p>
                  <p className="mt-1 text-sm font-medium">{item}</p>
                </button>
              ))}
            </div>

            {renderStep()}
          </div>

          <DialogFooter className="border-t border-black/[0.06] px-6 py-5 sm:justify-between">
            <div className="text-sm text-[#6B7280]">
              {step === 5 ? "Revise os dados antes de salvar e exportar." : "Avance etapa por etapa para montar o rascunho."}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={previousStep} disabled={step === 0} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white">
                Voltar
              </Button>
              {step < wizardSteps.length - 1 ? (
                <Button type="button" onClick={nextStep} className="h-10 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">
                  Proxima etapa
                </Button>
              ) : (
                <Button type="button" onClick={() => void saveContract()} disabled={isSaving} className="h-10 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633] disabled:opacity-60">
                  {isSaving ? "Salvando..." : "Salvar rascunho"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
