"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCheck,
  CopyPlus,
  Download,
  FilePenLine,
  FileSignature,
  PencilLine,
  Plus,
  Search,
  Send,
  Trash2,
  XCircle,
} from "lucide-react"

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
import {
  contractStatusOptions,
  contracts,
  getContractStatusLabel,
  getContractStatusTone,
  type ContractDraft,
  type ContractFilterStatus,
  type ContractRecord,
} from "@/lib/contracts-client"
import { contractTypeOptions, type ContractStatus, type ContractType } from "@/lib/contract-template"

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

const emptyDraft: ContractDraft = {
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

const statusActions: ContractStatus[] = [
  "draft",
  "awaiting_signature",
  "signed",
  "completed",
  "cancelled",
]

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function BrokerContractsPage() {
  const [contractsList, setContractsList] = useState<ContractRecord[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ContractFilterStatus>("all")
  const [kindFilter, setKindFilter] = useState<"all" | ContractType>("all")
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isStatusSaving, setIsStatusSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft)

  const selectedContract = useMemo(
    () => contractsList.find((item) => item.id === selectedId) ?? null,
    [contractsList, selectedId],
  )

  const loadContracts = useCallback(
    async (preferredId?: string | null) => {
      setIsLoading(true)
      setFeedback("")
      try {
        const nextContracts = await contracts.list({ query, status, kind: kindFilter })
        setContractsList(nextContracts)
        setSelectedId((current) => {
          const candidateId = preferredId ?? current
          if (candidateId && nextContracts.some((item) => item.id === candidateId)) {
            return candidateId
          }
          return nextContracts[0]?.id ?? null
        })
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Nao foi possivel carregar contratos.")
      } finally {
        setIsLoading(false)
      }
    },
    [kindFilter, query, status],
  )

  useEffect(() => {
    void loadContracts()
  }, [loadContracts])

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { leads?: LeadOption[] } | null
        if (!ignore && response.ok) {
          setLeads(data?.leads ?? [])
        }
      })
      .catch(() => null)

    fetch("/api/properties/me", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { properties?: PropertyOption[] } | null
        if (!ignore && response.ok) {
          setProperties(data?.properties ?? [])
        }
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  const overview = useMemo(() => {
    return {
      drafts: contractsList.filter((item) => item.status === "draft").length,
      awaiting: contractsList.filter((item) => item.status === "awaiting_signature").length,
      signed: contractsList.filter((item) => item.status === "signed").length,
    }
  }, [contractsList])

  function openCreateDialog() {
    setEditingId(null)
    setDraft(emptyDraft)
    setIsDialogOpen(true)
  }

  function openEditDialog(contract: ContractRecord) {
    setEditingId(contract.id)
    setDraft({
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
      status: contract.status,
    })
    setIsDialogOpen(true)
  }

  async function saveContract() {
    setIsSaving(true)
    setFeedback("")
    try {
      const contract = editingId ? await contracts.update(editingId, draft) : await contracts.create(draft)
      setFeedback(editingId ? "Contrato atualizado com sucesso." : "Contrato criado com sucesso.")
      setIsDialogOpen(false)
      setDraft(emptyDraft)
      setEditingId(null)
      await loadContracts(contract.id)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel salvar o contrato.")
    } finally {
      setIsSaving(false)
    }
  }

  async function updateContractStatus(nextStatus: ContractStatus) {
    if (!selectedContract) return

    setIsStatusSaving(true)
    setFeedback("")
    try {
      const contract =
        nextStatus === "awaiting_signature"
          ? await contracts.send(selectedContract.id)
          : nextStatus === "signed"
            ? await contracts.sign(selectedContract.id)
            : nextStatus === "cancelled"
              ? await contracts.cancel(selectedContract.id)
              : await contracts.update(selectedContract.id, { status: nextStatus })

      setFeedback(`Status atualizado para ${getContractStatusLabel(contract.status).toLowerCase()}.`)
      await loadContracts(contract.id)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar o status.")
    } finally {
      setIsStatusSaving(false)
    }
  }

  async function duplicateContract(contractId: string) {
    try {
      const contract = await contracts.duplicate(contractId)
      setFeedback("Contrato duplicado.")
      await loadContracts(contract.id)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel duplicar o contrato.")
    }
  }

  async function deleteContract(contractId: string) {
    if (!window.confirm("Excluir este contrato?")) return

    try {
      await contracts.delete(contractId)
      setFeedback("Contrato excluido.")
      await loadContracts(selectedId === contractId ? null : selectedId)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel excluir o contrato.")
    }
  }

  async function exportPdf() {
    if (!selectedContract) return

    try {
      await contracts.generate(selectedContract.id)
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
      setFeedback("Contrato preparado para exportacao.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel preparar o PDF.")
    }
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden rounded-[1.9rem] border-black/[0.06] bg-white/90 py-0">
        <CardHeader className="border-b border-black/[0.06] px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <CardTitle className="flex items-center gap-2 text-xl text-[#050505]">
                <FileSignature className="size-5 text-[#009b3a]" />
                Contratos
              </CardTitle>
              <p className="mt-1 text-sm leading-6 text-[#6B7280]">
                Contratos com fluxo direto de criacao, revisao e gestao de status, prontos para evoluir com geracao assistida no futuro.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[430px]">
              <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Rascunhos</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#050505]">{overview.drafts}</p>
              </div>
              <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Em andamento</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#050505]">{overview.awaiting}</p>
              </div>
              <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Assinados</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#050505]">{overview.signed}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B95A1]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por titulo, cliente, imovel ou resumo"
                  className="h-11 rounded-xl border-black/[0.08] bg-white pl-10 text-[#050505]"
                />
              </div>

              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as "all" | ContractType)}
                className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
              >
                <option value="all">Todos os modelos</option>
                {contractTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              onClick={openCreateDialog}
              className="h-11 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]"
            >
              <Plus className="size-4" />
              Novo contrato
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {contractStatusOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatus(item.value)}
                className={`rounded-full border px-3 py-2 text-sm transition ${
                  status === item.value
                    ? "border-[#009b3a]/25 bg-[#009b3a]/10 text-[#009b3a]"
                    : "border-black/[0.06] bg-[#fbfbf8] text-[#5F6B7A] hover:bg-[#f6f7f4]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {feedback ? (
            <p className="rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-3 text-sm text-[#009b3a]">
              {feedback}
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="grid gap-3">
              {isLoading ? (
                <Card className="rounded-[1.5rem] border-black/[0.06] bg-white/90">
                  <CardContent className="p-5">
                    <EmeLoading compact message="Carregando contratos..." />
                  </CardContent>
                </Card>
              ) : contractsList.length > 0 ? (
                contractsList.map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    onClick={() => setSelectedId(contract.id)}
                    className={`rounded-[1.4rem] border p-4 text-left transition ${
                      selectedContract?.id === contract.id
                        ? "border-[#009b3a]/25 bg-[#009b3a]/10"
                        : "border-black/[0.06] bg-white hover:bg-[#f8faf7]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[#050505]">{contract.title}</p>
                        <p className="mt-1 text-sm text-[#6B7280]">{contract.kind}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getContractStatusTone(contract.status)}`}
                      >
                        {getContractStatusLabel(contract.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-[#5F6B7A]">
                      <p className="truncate">Cliente: {contract.leadName || "Nao informado"}</p>
                      <p className="truncate">Imovel: {contract.propertyTitle || "Nao informado"}</p>
                      <div className="flex items-center justify-between gap-3 text-[#8B95A1]">
                        <span>{contract.amountLabel || "Valor nao informado"}</span>
                        <span>{formatDateTime(contract.updatedAt)}</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                  Nenhum contrato encontrado. Crie o primeiro rascunho para iniciar o fluxo de revisao e assinatura.
                </div>
              )}
            </div>

            <Card className="rounded-[1.9rem] border-black/[0.06] bg-white/90 py-0">
              <CardHeader className="border-b border-black/[0.06] px-5 py-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <CardTitle className="text-xl tracking-[-0.04em] text-[#050505]">
                      {selectedContract?.title ?? "Selecione um contrato"}
                    </CardTitle>
                    {selectedContract ? (
                      <p className="mt-2 text-sm text-[#6B7280]">
                        Versao {selectedContract.version} por {selectedContract.authorName} · atualizado em{" "}
                        {formatDateTime(selectedContract.updatedAt)}
                      </p>
                    ) : null}
                  </div>

                  {selectedContract ? (
                    <span
                      className={`w-fit rounded-full border px-3 py-1.5 text-sm font-medium ${getContractStatusTone(
                        selectedContract.status,
                      )}`}
                    >
                      {getContractStatusLabel(selectedContract.status)}
                    </span>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="grid gap-5 p-5 pt-5">
                {selectedContract ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Cliente</p>
                        <p className="mt-2 font-medium text-[#050505]">{selectedContract.leadName || "Nao informado"}</p>
                      </div>
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Imovel</p>
                        <p className="mt-2 font-medium text-[#050505]">
                          {selectedContract.propertyTitle || "Nao informado"}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Valor</p>
                        <p className="mt-2 font-medium text-[#050505]">
                          {selectedContract.amountLabel || "Nao informado"}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Modelo</p>
                        <p className="mt-2 font-medium text-[#050505]">{selectedContract.kind}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[1.4rem] border border-black/[0.06] bg-[#fcfcfa] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Status do contrato</p>
                          <p className="mt-1 text-sm text-[#5F6B7A]">
                            Troque o estado sem sair da visualizacao. A geracao por IA pode entrar depois neste mesmo fluxo.
                          </p>
                        </div>
                        {isStatusSaving ? <span className="text-sm text-[#8B95A1]">Atualizando...</span> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {statusActions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            disabled={isStatusSaving}
                            onClick={() => void updateContractStatus(item)}
                            className={`rounded-full border px-3 py-2 text-sm transition ${
                              selectedContract.status === item
                                ? "border-[#009b3a]/25 bg-[#009b3a]/10 text-[#009b3a]"
                                : "border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-[#f7f8f5]"
                            }`}
                          >
                            {getContractStatusLabel(item)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                      <div className="rounded-[1.4rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Resumo</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#4B5563]">
                          {selectedContract.textPreview}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-[1.4rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Clausulas base</p>
                          <div className="mt-3 grid gap-2">
                            {selectedContract.content.clauses.slice(0, 3).map((item) => (
                              <p key={item} className="text-sm leading-6 text-[#4B5563]">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[1.4rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Pendencias de revisao</p>
                          <div className="mt-3 grid gap-2">
                            {selectedContract.content.reviewNotes.slice(0, 3).map((item) => (
                              <p key={item} className="text-sm leading-6 text-[#4B5563]">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openEditDialog(selectedContract)}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
                      >
                        <PencilLine className="size-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void duplicateContract(selectedContract.id)}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
                      >
                        <CopyPlus className="size-4" />
                        Duplicar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={exportPdf}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
                      >
                        <Download className="size-4" />
                        Gerar PDF
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void updateContractStatus("awaiting_signature")}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
                      >
                        <Send className="size-4" />
                        Enviar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void updateContractStatus("signed")}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
                      >
                        <CheckCheck className="size-4" />
                        Assinar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void updateContractStatus("cancelled")}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#D14343] hover:bg-white"
                      >
                        <XCircle className="size-4" />
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void deleteContract(selectedContract.id)}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#D14343] hover:bg-white"
                      >
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                    Escolha um contrato para revisar detalhes, alterar status, duplicar, gerar PDF ou concluir a edicao.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-[1.9rem] border-black/[0.06] bg-[#fcfcfa] p-0">
          <DialogHeader className="border-b border-black/[0.06] px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <FilePenLine className="size-5 text-[#009b3a]" />
              {editingId ? "Editar contrato" : "Novo contrato"}
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Edite o contrato em um unico fluxo, com dados comerciais, condicoes e texto-base prontos para revisao.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 px-6 py-5">
            <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#050505]">Base do contrato</p>
                  <p className="text-sm text-[#6B7280]">Defina o modelo, as partes e o titulo principal.</p>
                </div>
                <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">
                  CRUD completo
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Titulo do contrato"
                  className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505] lg:col-span-2"
                />

                <label className="grid gap-2 text-sm text-[#5F6B7A]">
                  Modelo
                  <select
                    value={draft.kind}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, kind: event.target.value as ContractType }))
                    }
                    className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
                  >
                    {contractTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-[#5F6B7A]">
                  Status
                  <select
                    value={draft.status ?? "draft"}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, status: event.target.value as ContractStatus }))
                    }
                    className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
                  >
                    {statusActions.map((item) => (
                      <option key={item} value={item}>
                        {getContractStatusLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-[#5F6B7A]">
                  Cliente
                  <select
                    value={draft.leadId}
                    onChange={(event) => setDraft((current) => ({ ...current, leadId: event.target.value }))}
                    className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
                  >
                    <option value="">Selecione um cliente</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.name || lead.phone || "Cliente sem nome"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-[#5F6B7A]">
                  Imovel
                  <select
                    value={draft.propertyId}
                    onChange={(event) => setDraft((current) => ({ ...current, propertyId: event.target.value }))}
                    className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
                  >
                    <option value="">Selecione um imovel</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
              <div>
                <p className="text-sm font-semibold text-[#050505]">Condicoes comerciais</p>
                <p className="text-sm text-[#6B7280]">Mantenha apenas o que importa para o rascunho e a assinatura.</p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Input
                  value={draft.amount}
                  onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="Valor"
                  className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
                <Input
                  value={draft.commissionPercent}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, commissionPercent: event.target.value }))
                  }
                  placeholder="Comissao %"
                  className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
                <Input
                  value={draft.startDate}
                  onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                  placeholder="Data inicial"
                  className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
                <Input
                  value={draft.endDate}
                  onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                  placeholder="Data final"
                  className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
                <Input
                  value={draft.dueDate}
                  onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                  placeholder="Vencimento"
                  className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
                <Input
                  value={draft.validity}
                  onChange={(event) => setDraft((current) => ({ ...current, validity: event.target.value }))}
                  placeholder="Validade"
                  className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
                <Textarea
                  value={draft.additionalConditions}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, additionalConditions: event.target.value }))
                  }
                  placeholder="Condicoes adicionais e observacoes essenciais"
                  className="min-h-28 rounded-xl border-black/[0.08] bg-white text-[#050505] lg:col-span-2"
                />
              </div>
            </section>

            <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
              <div>
                <p className="text-sm font-semibold text-[#050505]">Texto base para revisao</p>
                <p className="text-sm text-[#6B7280]">
                  Cada linha vira uma clausula ou nota de revisao. Isso prepara o modulo para geracao assistida depois.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Textarea
                  value={draft.clausesText}
                  onChange={(event) => setDraft((current) => ({ ...current, clausesText: event.target.value }))}
                  placeholder="Cada linha vira uma clausula."
                  className="min-h-40 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
                <Textarea
                  value={draft.reviewNotesText}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, reviewNotesText: event.target.value }))
                  }
                  placeholder="Cada linha vira uma nota de revisao."
                  className="min-h-40 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                />
              </div>
            </section>
          </div>

          <DialogFooter className="border-t border-black/[0.06] px-6 py-5 sm:justify-between">
            <p className="text-sm text-[#6B7280]">
              O contrato sempre permanece revisavel antes de gerar PDF, enviar ou concluir.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void saveContract()}
                disabled={isSaving}
                className="h-10 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]"
              >
                {isSaving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Criar contrato"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
