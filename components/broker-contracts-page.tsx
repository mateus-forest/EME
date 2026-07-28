"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  CopyPlus,
  Download,
  FilePenLine,
  FileSignature,
  PencilLine,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrencyBRLFromCents, parseCurrencyInputToCents } from "@/lib/currency"
import {
  createContractContent,
  type ContractStatus,
  contractTypeOptions,
  type ContractType,
} from "@/lib/contract-template"
import {
  contractStatusOptions,
  contracts,
  getContractStatusLabel,
  getContractStatusTone,
  type ContractDraft,
  type ContractFilterStatus,
  type ContractRecord,
} from "@/lib/contracts-client"
import type { LeadRecord } from "@/lib/lead-contract"
import type { PropertyApiItem } from "@/lib/property-contract"

type BrokerProfile = {
  id: string
  name: string
  email: string
  phone: string
  brokerId: string
  agencyId: string | null
  accountType: string
  creci: string
  description: string
}

type FinancialConfig = {
  commissionPercent: number
}

type CommercialFieldKey =
  | "amount"
  | "commissionPercent"
  | "startDate"
  | "endDate"
  | "dueDate"
  | "validity"
  | "additionalConditions"

type CommercialFieldDefinition = {
  id: string
  key: CommercialFieldKey
  label: string
  type: "currency" | "percent" | "date" | "textarea"
  placeholder: string
  hint?: string
  examples?: string[]
}

const DEFAULT_COMMISSION_PERCENT = 6

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

function normalizeTitle(kind: ContractType, lead?: LeadRecord | null, property?: PropertyApiItem | null) {
  const reference = lead?.name || property?.title || "rascunho"
  return `Contrato ${kind} - ${reference}`.slice(0, 160)
}

function parsePercentInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "")
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return Math.min(100, Math.max(0, parsed))
}

function formatPercentInput(value: string) {
  const parsed = parsePercentInput(value)
  if (parsed === null) return ""
  const integer = Number.isInteger(parsed)
  return integer ? String(parsed) : parsed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function maskDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parsePtBrDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dayRaw, monthRaw, yearRaw] = match
  const day = Number(dayRaw)
  const month = Number(monthRaw)
  const year = Number(yearRaw)
  const date = new Date(year, month - 1, day)
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function formatPtBrDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(value)
}

function withDocumentBase(html: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const previewStyles = `
    <base href="${origin}/" />
    <style>
      .contract-preview-empty {
        color: rgba(95,108,99,0.72);
        font-style: italic;
      }
      .document-brand__logo-image {
        height: 34px;
        width: auto;
        display: block;
      }
    </style>
  `
  return html.replace("</head>", `${previewStyles}</head>`)
}

function buildPlaceholderMap(input: {
  lead: LeadRecord | null
  property: PropertyApiItem | null
  broker: BrokerProfile | null
  draft: ContractDraft
}) {
  const { lead, property, broker, draft } = input
  const amount = draft.amount || property?.formattedPrice || ""
  const commission = draft.commissionPercent ? `${formatPercentInput(draft.commissionPercent)}%` : ""

  return {
    COMPRADOR: lead?.name || "",
    COMPRADOR_EMAIL: lead?.email || "",
    COMPRADOR_TELEFONE: lead?.phone || "",
    CORRETOR: broker?.name || "",
    CORRETOR_EMAIL: broker?.email || "",
    CORRETOR_TELEFONE: broker?.phone || "",
    CORRETOR_CRECI: broker?.creci || "",
    IMOVEL: property?.title || "",
    CODIGO_INTERNO: property?.publicCode ? String(property.publicCode) : "",
    TIPO_IMOVEL: property?.type || "",
    FINALIDADE: property?.purpose || "",
    BAIRRO: property?.neighborhood || "",
    CIDADE: property?.city || "",
    VALOR: amount,
    COMISSAO: commission,
    DATA_POSSE: draft.endDate || "",
    DATA_ASSINATURA: draft.validity || "",
    PRAZO_ESCRITURA: draft.startDate || "",
    PRAZO_REGISTRO: draft.dueDate || "",
    CRONOGRAMA_OBSERVACOES: draft.additionalConditions || "",
  } satisfies Record<string, string>
}

function replaceTechnicalPlaceholders(html: string, values: Record<string, string>) {
  const fallback = '<span class="contract-preview-empty">Nao informado</span>'
  return html.replace(/{{([A-Z0-9_]+)}}/g, (_match, key: string) => {
    const value = values[key]
    if (!value?.trim()) return fallback
    return escapeHtml(value.trim())
  })
}

function buildPreviewHtml(input: {
  draft: ContractDraft
  lead: LeadRecord | null
  property: PropertyApiItem | null
  broker: BrokerProfile | null
}) {
  const title = input.draft.title.trim() || normalizeTitle(input.draft.kind, input.lead, input.property)
  const content = createContractContent({
    kind: input.draft.kind,
    title,
    status: input.draft.status,
    authorName: input.broker?.name || "Corretor EME",
    authorEmail: input.broker?.email || "",
    lead: input.lead
      ? {
          id: input.lead.id,
          name: input.lead.name,
          phone: input.lead.phone,
          email: input.lead.email,
        }
      : null,
    property: input.property
      ? {
          id: input.property.id,
          publicCode: input.property.publicCode,
          title: input.property.title,
          city: input.property.city,
          neighborhood: input.property.neighborhood,
          type: input.property.type,
          purpose: input.property.purpose,
          price: input.property.price,
          bedrooms: input.property.bedrooms,
          parkingSpots: input.property.parkingSpots,
        }
      : null,
    financial: {
      amountLabel: input.draft.amount || input.property?.formattedPrice || null,
      amountCents:
        parseCurrencyInputToCents(input.draft.amount) ??
        (typeof input.property?.price === "number" ? input.property.price : null),
      commissionPercent: input.draft.commissionPercent || null,
      startDate: input.draft.startDate || null,
      endDate: input.draft.endDate || null,
      dueDate: input.draft.dueDate || null,
      validity: input.draft.validity || null,
      additionalConditions: input.draft.additionalConditions || null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const mapped = replaceTechnicalPlaceholders(
    content.html,
    buildPlaceholderMap({
      lead: input.lead,
      property: input.property,
      broker: input.broker,
      draft: input.draft,
    }),
  )

  return withDocumentBase(mapped)
}

function buildContractExportHtml(input: {
  contract: ContractRecord
  property: PropertyApiItem | null
  lead: LeadRecord | null
  broker: BrokerProfile | null
}) {
  const mapped = replaceTechnicalPlaceholders(
    input.contract.content.html ||
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${escapeHtml(input.contract.title)}</title></head><body>${escapeHtml(input.contract.textPreview)}</body></html>`,
    buildPlaceholderMap({
      draft: {
        ...emptyDraft,
        title: input.contract.title,
        kind: input.contract.kind,
        amount: input.contract.content.financial.amountLabel ?? "",
        commissionPercent: input.contract.content.financial.commissionPercent ?? "",
        startDate: input.contract.content.financial.startDate ?? "",
        endDate: input.contract.content.financial.endDate ?? "",
        dueDate: input.contract.content.financial.dueDate ?? "",
        validity: input.contract.content.financial.validity ?? "",
        additionalConditions: input.contract.content.financial.additionalConditions ?? "",
      },
      lead: input.lead,
      property: input.property,
      broker: input.broker,
    }),
  )

  return withDocumentBase(mapped)
}

function getCommercialFieldDefinitions(kind: ContractType): CommercialFieldDefinition[] {
  if (kind === "Locacao residencial" || kind === "Locacao comercial") {
    return [
      {
        id: "commercial.value",
        key: "amount",
        label: "Aluguel mensal",
        type: "currency",
        placeholder: "R$ 0,00",
      },
      {
        id: "commercial.commission",
        key: "commissionPercent",
        label: "Comissao",
        type: "percent",
        placeholder: "0",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Inicio da vigencia",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Fim da vigencia",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.dueDate",
        key: "dueDate",
        label: "Vencimento",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.validUntil",
        key: "validity",
        label: "Vigencia",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Observacoes comerciais (opcional)",
        type: "textarea",
        placeholder: "Caucao, garantia locaticia, reajuste, entrega das chaves.",
        examples: [
          "Caucao em 3 alugueis.",
          "Garantia por seguro fianca.",
          "Reajuste anual pelo indice contratual.",
        ],
      },
    ]
  }

  if (kind === "Reserva") {
    return [
      {
        id: "commercial.value",
        key: "amount",
        label: "Valor da reserva",
        type: "currency",
        placeholder: "R$ 0,00",
      },
      {
        id: "commercial.validUntil",
        key: "validity",
        label: "Validade da reserva",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Observacoes comerciais (opcional)",
        type: "textarea",
        placeholder: "Prazo para analise, sinal, condicoes especiais.",
      },
    ]
  }

  return [
    {
      id: "commercial.value",
      key: "amount",
      label: "Valor do imovel",
      type: "currency",
      placeholder: "R$ 0,00",
      hint: "Valor preenchido automaticamente pelo imovel.",
    },
    {
      id: "commercial.commission",
      key: "commissionPercent",
      label: "Comissao",
      type: "percent",
      placeholder: "0",
    },
    {
      id: "commercial.startDate",
      key: "startDate",
      label: "Data inicial",
      type: "date",
      placeholder: "dd/mm/aaaa",
    },
    {
      id: "commercial.endDate",
      key: "endDate",
      label: "Data final",
      type: "date",
      placeholder: "dd/mm/aaaa",
    },
    {
      id: "commercial.dueDate",
      key: "dueDate",
      label: "Vencimento",
      type: "date",
      placeholder: "dd/mm/aaaa",
    },
    {
      id: "commercial.validUntil",
      key: "validity",
      label: "Validade",
      type: "date",
      placeholder: "dd/mm/aaaa",
    },
    {
      id: "commercial.notes",
      key: "additionalConditions",
      label: "Observacoes comerciais (opcional)",
      type: "textarea",
      placeholder: "Entrada negociada diretamente.",
      examples: [
        "Entrada negociada diretamente.",
        "Utilizacao de FGTS.",
        "Entrega apos quitacao.",
        "Permanecem moveis planejados.",
      ],
    },
  ]
}

function PreviewInfo({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-black/[0.05] bg-[#fbfbf8] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8B95A1]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[#050505]">{value || "Nao informado"}</p>
    </div>
  )
}

function CommercialDateField({
  label,
  value,
  identifier,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  identifier: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const selectedDate = parsePtBrDate(value)

  return (
    <label className="grid gap-2 text-sm text-[#5F6B7A]">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="rounded-full bg-[#f4f7f3] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#8B95A1]">
          {identifier}
        </span>
      </div>
      <Popover>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(event) => onChange(maskDateInput(event.target.value))}
            placeholder={placeholder}
            inputMode="numeric"
            autoComplete="bday"
            className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-black/[0.08] bg-white px-3 text-[#4B5563]"
            >
              <CalendarDays className="size-4" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent align="end" className="w-auto rounded-2xl border-black/[0.06] p-0">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(date) => onChange(date ? formatPtBrDate(date) : "")}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </label>
  )
}

export function BrokerContractsPage() {
  const [contractsList, setContractsList] = useState<ContractRecord[]>([])
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [properties, setProperties] = useState<PropertyApiItem[]>([])
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null)
  const [financialConfig, setFinancialConfig] = useState<FinancialConfig | null>(null)
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
  const [titleCustomized, setTitleCustomized] = useState(false)
  const [amountCustomized, setAmountCustomized] = useState(false)
  const [commissionCustomized, setCommissionCustomized] = useState(false)

  const selectedContract = useMemo(
    () => contractsList.find((item) => item.id === selectedId) ?? null,
    [contractsList, selectedId],
  )
  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === draft.leadId) ?? null,
    [draft.leadId, leads],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === draft.propertyId) ?? null,
    [draft.propertyId, properties],
  )
  const selectedContractLead = useMemo(
    () => leads.find((lead) => lead.id === selectedContract?.leadId) ?? null,
    [leads, selectedContract?.leadId],
  )
  const selectedContractProperty = useMemo(
    () => properties.find((property) => property.id === selectedContract?.propertyId) ?? null,
    [properties, selectedContract?.propertyId],
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

    Promise.all([
      fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" }).then((response) =>
        response.json().catch(() => null).then((data) => ({ ok: response.ok, data })),
      ),
      fetch("/api/properties/me", { credentials: "include", cache: "no-store" }).then((response) =>
        response.json().catch(() => null).then((data) => ({ ok: response.ok, data })),
      ),
      fetch("/api/brokers/me", { credentials: "include", cache: "no-store" }).then((response) =>
        response.json().catch(() => null).then((data) => ({ ok: response.ok, data })),
      ),
      fetch("/api/brokers/financial", { credentials: "include", cache: "no-store" }).then((response) =>
        response.json().catch(() => null).then((data) => ({ ok: response.ok, data })),
      ),
    ])
      .then(([leadsResponse, propertiesResponse, brokerResponse, financialResponse]) => {
        if (ignore) return
        if (leadsResponse.ok) setLeads((leadsResponse.data?.leads ?? []) as LeadRecord[])
        if (propertiesResponse.ok) setProperties((propertiesResponse.data?.properties ?? []) as PropertyApiItem[])
        if (brokerResponse.ok) setBrokerProfile((brokerResponse.data?.profile ?? null) as BrokerProfile | null)
        if (financialResponse.ok) {
          setFinancialConfig({
            commissionPercent:
              Number(financialResponse.data?.config?.commissionPercent) || DEFAULT_COMMISSION_PERCENT,
          })
        }
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!isDialogOpen) return
    if (!selectedLead?.propertyId) return
    if (draft.propertyId) return
    setDraft((current) => ({ ...current, propertyId: selectedLead.propertyId ?? "" }))
  }, [draft.propertyId, isDialogOpen, selectedLead?.propertyId])

  useEffect(() => {
    if (!isDialogOpen || !selectedProperty || amountCustomized) return
    const nextAmount = selectedProperty.formattedPrice
    if (draft.amount === nextAmount) return
    setDraft((current) => ({ ...current, amount: nextAmount }))
  }, [amountCustomized, draft.amount, isDialogOpen, selectedProperty])

  useEffect(() => {
    if (!isDialogOpen || commissionCustomized) return
    const nextCommission = String(financialConfig?.commissionPercent ?? DEFAULT_COMMISSION_PERCENT)
    if (draft.commissionPercent === nextCommission) return
    setDraft((current) => ({ ...current, commissionPercent: nextCommission }))
  }, [commissionCustomized, draft.commissionPercent, financialConfig?.commissionPercent, isDialogOpen])

  useEffect(() => {
    if (!isDialogOpen || titleCustomized) return
    const nextTitle = normalizeTitle(draft.kind, selectedLead, selectedProperty)
    if (draft.title === nextTitle) return
    setDraft((current) => ({ ...current, title: nextTitle }))
  }, [draft.kind, draft.title, isDialogOpen, selectedLead, selectedProperty, titleCustomized])

  const overview = useMemo(() => {
    return {
      drafts: contractsList.filter((item) => item.status === "draft").length,
      awaiting: contractsList.filter((item) => item.status === "awaiting_signature").length,
      signed: contractsList.filter((item) => item.status === "signed").length,
    }
  }, [contractsList])

  const commercialFields = useMemo(() => getCommercialFieldDefinitions(draft.kind), [draft.kind])
  const previewHtml = useMemo(
    () =>
      buildPreviewHtml({
        draft,
        lead: selectedLead,
        property: selectedProperty,
        broker: brokerProfile,
      }),
    [brokerProfile, draft, selectedLead, selectedProperty],
  )

  const valueSourceLabel = amountCustomized
    ? "Valor personalizado."
    : selectedProperty
      ? "Valor preenchido automaticamente pelo imovel."
      : "Selecione um imovel para preencher o valor automaticamente."

  const commissionSourceLabel = commissionCustomized
    ? "Comissao personalizada."
    : financialConfig
      ? "Comissao preenchida automaticamente pela configuracao do corretor."
      : "Comissao padrao do sistema."

  const validationItems = useMemo(() => {
    return [
      { label: "Modelo selecionado", done: Boolean(draft.kind), detail: draft.kind || "Nao informado" },
      { label: "Cliente vinculado", done: Boolean(selectedLead), detail: selectedLead?.name || "Nao selecionado" },
      { label: "Imovel vinculado", done: Boolean(selectedProperty), detail: selectedProperty?.title || "Nao selecionado" },
      { label: "Valor comercial", done: Boolean(draft.amount), detail: draft.amount || "Nao informado" },
      {
        label: "Comissao",
        done: parsePercentInput(draft.commissionPercent) !== null,
        detail: draft.commissionPercent ? `${formatPercentInput(draft.commissionPercent)}%` : "Nao informado",
      },
      { label: "Dados do corretor", done: Boolean(brokerProfile), detail: brokerProfile?.name || "Nao carregado" },
    ]
  }, [brokerProfile, draft.amount, draft.commissionPercent, draft.kind, selectedLead, selectedProperty])

  function openCreateDialog() {
    setEditingId(null)
    setDraft({ ...emptyDraft })
    setTitleCustomized(false)
    setAmountCustomized(false)
    setCommissionCustomized(false)
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
    setTitleCustomized(true)
    setAmountCustomized(Boolean(contract.content.financial.amountLabel))
    setCommissionCustomized(Boolean(contract.content.financial.commissionPercent))
    setIsDialogOpen(true)
  }

  function openHtmlDocument(html: string) {
    const popup = window.open("", "_blank")
    if (!popup) {
      setFeedback("Permita pop-ups para abrir o documento em nova aba.")
      return
    }

    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    popup.focus()
  }

  async function saveContract() {
    setIsSaving(true)
    setFeedback("")
    try {
      const payload: ContractDraft = {
        ...draft,
        title: draft.title.trim() || normalizeTitle(draft.kind, selectedLead, selectedProperty),
        commissionPercent: formatPercentInput(draft.commissionPercent),
      }
      const contract = editingId ? await contracts.update(editingId, payload) : await contracts.create(payload)
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
      const html = buildContractExportHtml({
        contract: selectedContract,
        property: selectedContractProperty,
        lead: selectedContractLead,
        broker: brokerProfile,
      })
      openHtmlDocument(html)
      setFeedback("PDF preparado em nova aba para imprimir ou baixar.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel preparar o PDF.")
    }
  }

  function updateDraftField(key: keyof ContractDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
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
                Um editor de contratos que antecipa dados do imovel, do cliente e do corretor para manter o documento sempre sincronizado com o preview.
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
                      <PreviewInfo label="Cliente" value={selectedContract.leadName} />
                      <PreviewInfo label="Imovel" value={selectedContract.propertyTitle} />
                      <PreviewInfo label="Valor" value={selectedContract.amountLabel} />
                      <PreviewInfo label="Modelo" value={selectedContract.kind} />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                      <div className="rounded-[1.4rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Preview do documento</p>
                            <p className="mt-1 text-sm text-[#5F6B7A]">Abra o editor para revisar e sincronizar o contrato em tempo real.</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => openEditDialog(selectedContract)}
                            className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
                          >
                            <PencilLine className="size-4" />
                            Editar
                          </Button>
                        </div>
                        <div className="mt-4 aspect-[210/297] overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                          <iframe
                            title={`Preview de ${selectedContract.title}`}
                            srcDoc={buildContractExportHtml({
                              contract: selectedContract,
                              property: selectedContractProperty,
                              lead: selectedContractLead,
                              broker: brokerProfile,
                            })}
                            className="h-full w-full bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-[1.4rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Pendencias de revisao</p>
                          <div className="mt-3 grid gap-2">
                            {selectedContract.content.reviewNotes.slice(0, 4).map((item) => (
                              <div key={item} className="rounded-xl border border-black/[0.05] bg-white p-3 text-sm leading-6 text-[#4B5563]">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[1.4rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Acoes</p>
                          <div className="mt-3 flex flex-wrap gap-2">
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
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                    Escolha um contrato para revisar detalhes, atualizar status, abrir o editor inteligente ou gerar PDF.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[94vh] max-w-[96vw] overflow-y-auto rounded-[2rem] border-black/[0.06] bg-[#f7f7f3] p-0">
          <DialogHeader className="border-b border-black/[0.06] px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <FilePenLine className="size-5 text-[#009b3a]" />
              {editingId ? "Editor de contrato" : "Novo contrato"}
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              O EME preenche o que ja conhece, organiza as pendencias e mantem o documento sincronizado com o preview em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-5 py-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
            <div className="grid content-start gap-4">
              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#050505]">Propriedades do contrato</p>
                    <p className="text-sm text-[#6B7280]">Menos cadastro, mais confirmacao.</p>
                  </div>
                  <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">
                    Editor
                  </span>
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm text-[#5F6B7A]">
                    <div className="flex items-center justify-between gap-2">
                      <span>Titulo</span>
                      <span className="rounded-full bg-[#f4f7f3] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#8B95A1]">
                        document.title
                      </span>
                    </div>
                    <Input
                      value={draft.title}
                      onChange={(event) => {
                        setTitleCustomized(Boolean(event.target.value.trim()))
                        updateDraftField("title", event.target.value)
                      }}
                      placeholder="Titulo do contrato"
                      className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-[#5F6B7A]">
                    Modelo
                    <select
                      value={draft.kind}
                      onChange={(event) => updateDraftField("kind", event.target.value as ContractType)}
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
                    Cliente
                    <select
                      value={draft.leadId}
                      onChange={(event) => updateDraftField("leadId", event.target.value)}
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
                      onChange={(event) => {
                        setAmountCustomized(false)
                        updateDraftField("propertyId", event.target.value)
                      }}
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

                  <label className="grid gap-2 text-sm text-[#5F6B7A]">
                    Status
                    <select
                      value={draft.status ?? "draft"}
                      onChange={(event) => updateDraftField("status", event.target.value as ContractStatus)}
                      className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
                    >
                      {statusActions.map((item) => (
                        <option key={item} value={item}>
                          {getContractStatusLabel(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                <div>
                  <p className="text-sm font-semibold text-[#050505]">Condicoes comerciais</p>
                  <p className="text-sm text-[#6B7280]">Campos dinamicos com IDs estaveis para o COS.</p>
                </div>

                <div className="grid gap-4">
                  {commercialFields.map((field) => {
                    const value = draft[field.key] ?? ""

                    if (field.type === "currency") {
                      return (
                        <label key={field.id} className="grid gap-2 text-sm text-[#5F6B7A]">
                          <div className="flex items-center justify-between gap-2">
                            <span>{field.label}</span>
                            <span className="rounded-full bg-[#f4f7f3] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#8B95A1]">
                              {field.id}
                            </span>
                          </div>
                          <Input
                            value={value}
                            onChange={(event) => {
                              setAmountCustomized(true)
                              updateDraftField(field.key, event.target.value)
                            }}
                            onBlur={() => updateDraftField(field.key, value ? formatCurrencyBRLFromCents(parseCurrencyInputToCents(value) ?? 0) : "")}
                            placeholder={field.placeholder}
                            className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                          />
                          <p className="text-xs text-[#8B95A1]">{valueSourceLabel}</p>
                        </label>
                      )
                    }

                    if (field.type === "percent") {
                      return (
                        <label key={field.id} className="grid gap-2 text-sm text-[#5F6B7A]">
                          <div className="flex items-center justify-between gap-2">
                            <span>{field.label}</span>
                            <span className="rounded-full bg-[#f4f7f3] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#8B95A1]">
                              {field.id}
                            </span>
                          </div>
                          <Input
                            value={value}
                            onChange={(event) => {
                              setCommissionCustomized(true)
                              updateDraftField(field.key, event.target.value)
                            }}
                            onBlur={() => updateDraftField(field.key, formatPercentInput(value))}
                            placeholder={field.placeholder}
                            className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                          />
                          <p className="text-xs text-[#8B95A1]">{commissionSourceLabel}</p>
                        </label>
                      )
                    }

                    if (field.type === "date") {
                      return (
                        <CommercialDateField
                          key={field.id}
                          label={field.label}
                          value={value}
                          identifier={field.id}
                          placeholder={field.placeholder}
                          onChange={(nextValue) => updateDraftField(field.key, nextValue)}
                        />
                      )
                    }

                    return (
                      <label key={field.id} className="grid gap-2 text-sm text-[#5F6B7A]">
                        <div className="flex items-center justify-between gap-2">
                          <span>{field.label}</span>
                          <span className="rounded-full bg-[#f4f7f3] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#8B95A1]">
                            {field.id}
                          </span>
                        </div>
                        <Textarea
                          value={value}
                          onChange={(event) => updateDraftField(field.key, event.target.value)}
                          placeholder={field.placeholder}
                          className="min-h-28 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                        />
                        {field.examples?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {field.examples.map((example) => (
                              <button
                                key={example}
                                type="button"
                                onClick={() =>
                                  updateDraftField(
                                    field.key,
                                    value.trim() ? `${value.trim()}\n${example}` : example,
                                  )
                                }
                                className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-2.5 py-1 text-xs text-[#6B7280] transition hover:bg-[#f2f6f2]"
                              >
                                {example}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              </section>
            </div>

            <div className="grid content-start gap-4">
              <section className="rounded-[1.6rem] border border-black/[0.06] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-2 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-[#050505]">Preview A4</p>
                    <p className="text-sm text-[#6B7280]">Atualizacao automatica a cada alteracao.</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/20 bg-[#009b3a]/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#009b3a]">
                    <Sparkles className="size-3.5" />
                    Sincronizado
                  </span>
                </div>
                <div className="mt-4 aspect-[210/297] overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[#f4f4f1]">
                  <iframe title="Preview do contrato" srcDoc={previewHtml} className="h-full w-full bg-white" />
                </div>
              </section>
            </div>

            <div className="grid content-start gap-4">
              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                <div>
                  <p className="text-sm font-semibold text-[#050505]">Pendencias e validacoes</p>
                  <p className="text-sm text-[#6B7280]">O sistema destaca o que ainda precisa de confirmacao.</p>
                </div>

                <div className="grid gap-3">
                  {validationItems.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-[1rem] border p-3 ${
                        item.done ? "border-[#009b3a]/15 bg-[#eff8f1]" : "border-[#f0dcb1] bg-[#fffaf0]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {item.done ? (
                          <CheckCircle2 className="mt-0.5 size-4 text-[#009b3a]" />
                        ) : (
                          <AlertCircle className="mt-0.5 size-4 text-[#c58917]" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-[#050505]">{item.label}</p>
                          <p className="mt-1 text-sm text-[#6B7280]">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                <div>
                  <p className="text-sm font-semibold text-[#050505]">Comentarios do editor</p>
                  <p className="text-sm text-[#6B7280]">O corretor confirma informacoes; o sistema faz o trabalho pesado.</p>
                </div>

                <div className="rounded-[1rem] border border-black/[0.05] bg-[#fbfbf8] p-4 text-sm leading-6 text-[#5F6B7A]">
                  O preview nunca mostra placeholders tecnicos. Quando faltarem dados reais, o documento exibe um estado neutro e continua editavel.
                </div>
                <div className="rounded-[1rem] border border-dashed border-black/[0.08] bg-[#fcfcfa] p-4 text-sm leading-6 text-[#6B7280]">
                  Futuro painel do COS: sugestoes de clausulas, validacoes juridicas, comentarios contextuais e preenchimento automatico dos campos comerciais por tipo de contrato.
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="border-t border-black/[0.06] px-6 py-5 sm:justify-between">
            <p className="text-sm text-[#6B7280]">
              O contrato permanece revisavel enquanto o preview acompanha todas as alteracoes em tempo real.
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
