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
import { subscribeEntitySync } from "@/lib/entity-sync"
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
  agencyName?: string
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
  | "paymentMethod"
  | "guaranteeType"
  | "inspectionReport"
  | "commercialPurpose"
  | "adjustmentTerm"
  | "worksScope"
  | "fitOutScope"
  | "additionalConditions"

type CommercialFieldDefinition = {
  id: string
  key: CommercialFieldKey
  label: string
  type: "currency" | "percent" | "date" | "text" | "textarea"
  placeholder: string
  hint?: string
  examples?: string[]
}

type WorkspaceEntityKey = "client" | "property" | "broker" | "agency" | "landlord" | "owner"

type WorkspaceEntityItem = {
  label: string
  value: string
}

type WorkspaceEntitySection = {
  key: WorkspaceEntityKey
  title: string
  route: string
  actionLabel: string
  summary: string
  items: WorkspaceEntityItem[]
}

type WorkspaceEntityStatus = WorkspaceEntityItem & {
  done: boolean
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
  paymentMethod: "",
  guaranteeType: "",
  inspectionReport: "",
  commercialPurpose: "",
  adjustmentTerm: "",
  worksScope: "",
  fitOutScope: "",
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

function isResidentialLease(kind: ContractType) {
  return kind === "Locacao residencial"
}

function isCommercialLease(kind: ContractType) {
  return kind === "Locacao comercial"
}

function isLease(kind: ContractType) {
  return isResidentialLease(kind) || isCommercialLease(kind)
}

function isSaleAuthorization(kind: ContractType) {
  return kind === "Autorizacao de venda"
}

function isExclusivity(kind: ContractType) {
  return kind === "Exclusividade"
}

function isVisitTerm(kind: ContractType) {
  return kind === "Termo de visita"
}

function isReservation(kind: ContractType) {
  return kind === "Reserva"
}

function isAmendment(kind: ContractType) {
  return kind === "Aditivo"
}

function isTermination(kind: ContractType) {
  return kind === "Distrato"
}

function buildAmendmentReference(lead?: LeadRecord | null, property?: PropertyApiItem | null) {
  const tokens = [
    "Contrato original",
    lead?.name || null,
    property?.title || null,
    property?.legal.city || property?.city || null,
  ].filter(Boolean)

  return tokens.join(" • ")
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

function resolveLeaseTerm(startDate: string, endDate: string, fallback: string) {
  if (fallback.trim()) return fallback
  if (startDate.trim() && endDate.trim()) return `${startDate} a ${endDate}`
  return ""
}

function withDocumentBase(html: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const previewStyles = `
    <base href="${origin}/" />
    <style>
      .contract-preview-empty {
        display: inline-flex;
        width: 100%;
        min-width: 96px;
        min-height: 1.2em;
        border-bottom: 1px solid rgba(16,33,23,0.14);
        opacity: 0.66;
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
  const propertyAddress = [property?.legal.street, property?.legal.number, property?.legal.district, property?.legal.city]
    .filter(Boolean)
    .join(", ")

  return {
    VENDEDOR: property?.ownerName || "",
    VENDEDOR_CPF_CNPJ: "",
    VENDEDOR_RG: "",
    VENDEDOR_ESTADO_CIVIL: "",
    VENDEDOR_PROFISSAO: "",
    VENDEDOR_NACIONALIDADE: "",
    VENDEDOR_ENDERECO: [property?.legal.street, property?.legal.number, property?.legal.district, property?.legal.city]
      .filter(Boolean)
      .join(", "),
    VENDEDOR_TELEFONE: "",
    VENDEDOR_EMAIL: "",
    COMPRADOR: lead?.name || "",
    COMPRADOR_CPF_CNPJ: lead?.identification.cpfCnpj || "",
    COMPRADOR_RG: lead?.identification.rg || "",
    COMPRADOR_ESTADO_CIVIL: lead?.identification.maritalStatus || "",
    COMPRADOR_PROFISSAO: lead?.identification.profession || "",
    COMPRADOR_NACIONALIDADE: lead?.identification.nationality || "",
    COMPRADOR_ENDERECO: [lead?.address.street, lead?.address.number, lead?.address.district, lead?.address.city]
      .filter(Boolean)
      .join(", "),
    COMPRADOR_EMAIL: lead?.email || "",
    COMPRADOR_TELEFONE: lead?.whatsApp || lead?.phone || "",
    LOCADOR: property?.ownerName || "",
    LOCADOR_CPF_CNPJ: "",
    LOCADOR_RG: "",
    LOCADOR_ESTADO_CIVIL: "",
    LOCADOR_PROFISSAO: "",
    LOCADOR_ENDERECO: propertyAddress,
    LOCATARIO: lead?.name || "",
    LOCATARIO_CPF_CNPJ: lead?.identification.cpfCnpj || "",
    LOCATARIO_RG: lead?.identification.rg || "",
    LOCATARIO_ESTADO_CIVIL: lead?.identification.maritalStatus || "",
    LOCATARIO_PROFISSAO: lead?.identification.profession || "",
    LOCATARIO_ENDERECO: [lead?.address.street, lead?.address.number, lead?.address.district, lead?.address.city]
      .filter(Boolean)
      .join(", "),
    INTERESSADO: lead?.name || "",
    INTERESSADO_CPF_CNPJ: lead?.identification.cpfCnpj || "",
    INTERESSADO_RG: lead?.identification.rg || "",
    INTERESSADO_TELEFONE: lead?.whatsApp || lead?.phone || "",
    INTERESSADO_EMAIL: lead?.email || "",
    INTERESSADO_ENDERECO: [lead?.address.street, lead?.address.number, lead?.address.district, lead?.address.city]
      .filter(Boolean)
      .join(", "),
    PROPRIETARIO: property?.ownerName || lead?.name || "",
    PROPRIETARIO_CPF_CNPJ: lead?.identification.cpfCnpj || "",
    PROPRIETARIO_RG: lead?.identification.rg || "",
    PROPRIETARIO_ESTADO_CIVIL: lead?.identification.maritalStatus || "",
    PROPRIETARIO_PROFISSAO: lead?.identification.profession || "",
    PROPRIETARIO_ENDERECO: [lead?.address.street, lead?.address.number, lead?.address.district, lead?.address.city]
      .filter(Boolean)
      .join(", ") || propertyAddress,
    VISITANTE: lead?.name || "",
    VISITANTE_CPF_CNPJ: lead?.identification.cpfCnpj || "",
    VISITANTE_RG: lead?.identification.rg || "",
    VISITANTE_TELEFONE: lead?.whatsApp || lead?.phone || "",
    VISITANTE_EMAIL: lead?.email || "",
    VISITANTE_ENDERECO: [lead?.address.street, lead?.address.number, lead?.address.district, lead?.address.city]
      .filter(Boolean)
      .join(", "),
    CORRETOR: broker?.name || "",
    CORRETOR_EMAIL: broker?.email || "",
    CORRETOR_TELEFONE: broker?.phone || "",
    CORRETOR_CRECI: broker?.creci || "",
    IMOBILIARIA: broker?.agencyName || "",
    IMOVEL: property?.title || "",
    IMOVEL_COMERCIAL: property?.title || "",
    IMOVEL_VISITADO: property?.title || "",
    CODIGO_INTERNO: property?.publicCode ? String(property.publicCode) : "",
    TIPO_IMOVEL: property?.type || "",
    FINALIDADE: property?.purpose || "",
    FINALIDADE_COMERCIAL: draft.commercialPurpose || "",
    IMOVEL_ENDERECO: [property?.legal.street, property?.legal.number, property?.legal.complement].filter(Boolean).join(", "),
    BAIRRO: property?.neighborhood || "",
    CIDADE: property?.legal.city || property?.city || "",
    ESTADO: property?.legal.state || "",
    CEP: property?.legal.cep || "",
    MATRICULA: property?.legal.registryNumber || "",
    CARTORIO_REGISTRO: property?.legal.registryOffice || "",
    INSCRICAO_IMOBILIARIA: property?.legal.taxRegistration || "",
    AREA_PRIVATIVA: property?.legal.privateArea || "",
    AREA_TOTAL: property?.legal.totalArea || "",
    VAGAS: typeof property?.parkingSpots === "number" ? String(property.parkingSpots) : "",
    BENFEITORIAS: "",
    UNIDADE_COMPLEMENTO: "",
    ESTADO_IMOVEL: property?.description || "",
    VALOR: amount,
    VALOR_AUTORIZADO: amount,
    VALOR_ALUGUEL: amount,
    VALOR_RESERVA: amount,
    DATA_INICIO: draft.startDate || "",
    DATA_FIM: draft.endDate || "",
    PRAZO_LOCACAO: resolveLeaseTerm(draft.startDate, draft.endDate, draft.validity),
    PRAZO_RESERVA: resolveLeaseTerm(draft.startDate, draft.endDate, draft.validity),
    DIA_VENCIMENTO: draft.dueDate || "",
    CONVERSAO_RESERVA: draft.dueDate || "",
    CONDICOES_RESERVA: draft.additionalConditions || "",
    CONTRATO_ORIGINAL_REFERENCIA: draft.paymentMethod || buildAmendmentReference(lead, property),
    ALTERACOES_ADITIVO: draft.additionalConditions || "",
    CLAUSULAS_MODIFICADAS: draft.validity || "",
    VIGENCIA_INICIO_ADITIVO: draft.startDate || "",
    VIGENCIA_FIM_ADITIVO: draft.endDate || "",
    FORO_ADITIVO: draft.dueDate || property?.legal.city || property?.city || "",
    REFERENCIA_DISTRATO: draft.paymentMethod || buildAmendmentReference(lead, property),
    MOTIVO_ENCERRAMENTO: draft.additionalConditions || "",
    QUITACAO_DISTRATO: draft.validity || "",
    OBRIGACOES_REMANESCENTES: draft.guaranteeType || "",
    FORO_DISTRATO: draft.dueDate || property?.legal.city || property?.city || "",
    FORMA_PAGAMENTO: draft.paymentMethod || "",
    TIPO_GARANTIA: draft.guaranteeType || "",
    LAUDO_VISTORIA: draft.inspectionReport || "",
    REAJUSTE_LOCACAO: draft.adjustmentTerm || "",
    OBRAS_LOCACAO: draft.worksScope || "",
    ADEQUACOES_LOCACAO: draft.fitOutScope || "",
    COMISSAO_AUTORIZACAO: commission,
    PRAZO_AUTORIZACAO: resolveLeaseTerm(draft.startDate, draft.endDate, draft.validity),
    CONDICOES_INTERMEDIACAO: draft.additionalConditions || "",
    COMISSAO_EXCLUSIVIDADE: commission,
    PRAZO_EXCLUSIVIDADE: resolveLeaseTerm(draft.startDate, draft.endDate, draft.validity),
    CONDICOES_EXCLUSIVIDADE: draft.additionalConditions || "",
    DATA_VISITA: draft.startDate || "",
    HORA_VISITA: draft.dueDate || "",
    CIENCIA_INTERMEDIACAO: draft.validity || "",
    DECLARACOES_VISITA: draft.additionalConditions || "",
    ENTRADA: "",
    PARCELAS: "",
    BANCO_FINANCIAMENTO: "",
    FGTS: "",
    RECURSOS_PROPRIOS: "",
    ARRAS_VALOR: "",
    COMISSAO: commission,
    RESPONSAVEL_COMISSAO: "",
    FORMA_PAGAMENTO_COMISSAO: "",
    MOMENTO_COMISSAO: "",
    FORMA_ENTREGA_POSSE: "",
    CONDICAO_ENTREGA: "",
    DATA_POSSE: draft.endDate || "",
    DATA_ASSINATURA: draft.validity || "",
    DATA_DOCUMENTO: "",
    PRAZO_ESCRITURA: draft.startDate || "",
    PRAZO_REGISTRO: draft.dueDate || "",
    RESP_ITBI: "",
    OBS_ITBI: "",
    RESP_ESCRITURA: "",
    OBS_ESCRITURA: "",
    RESP_REGISTRO: "",
    OBS_REGISTRO: "",
    RESP_CERTIDOES: "",
    OBS_CERTIDOES: "",
    RESP_BANCARIAS: "",
    OBS_BANCARIAS: "",
    RESP_CONDOMINIO: "",
    OBS_CONDOMINIO: "",
    RESP_IPTU: "",
    OBS_IPTU: "",
    RESP_OUTRAS_TAXAS: "",
    OBS_OUTRAS_TAXAS: "",
    OBS_TRIBUTOS_DESPESAS: "",
    OUTRAS_CONDICOES_SUSPENSIVAS: "",
    MULTA_INADIMPLEMENTO: "",
    JUROS_INADIMPLEMENTO: "",
    INDICE_CORRECAO: "",
    CANAL_PRIVACIDADE: "",
    CORRETOR_ENDERECO: "",
    PLATAFORMA_ASSINATURA: "",
    COMARCA: property?.legal.city || property?.city || "",
    LOCAL_ASSINATURA: "",
    ADICIONAIS_LOCACAO: draft.additionalConditions || "",
    ASSINATURA_PROPRIETARIO: "",
    ASSINATURA_INTERESSADO: "",
    ASSINATURA_VISITANTE: "",
    ASSINATURA_LOCADOR: "",
    ASSINATURA_LOCATARIO: "",
    ASSINATURA_VENDEDOR: "",
    ASSINATURA_COMPRADOR: "",
    ASSINATURA_CORRETOR: "",
    TESTEMUNHA_1: "",
    TESTEMUNHA_1_CPF: "",
    ASSINATURA_TESTEMUNHA_1: "",
    TESTEMUNHA_2: "",
    TESTEMUNHA_2_CPF: "",
    ASSINATURA_TESTEMUNHA_2: "",
    CRONOGRAMA_OBSERVACOES: draft.additionalConditions || "",
  } satisfies Record<string, string>
}

function replaceTechnicalPlaceholders(html: string, values: Record<string, string>) {
  const fallback = '<span class="contract-preview-empty" aria-hidden="true"></span>'
  return html.replace(/{{([A-Z0-9_]+)}}/g, (_match, key: string) => {
    const value = values[key]
    if (!value?.trim()) return fallback
    return escapeHtml(value.trim())
  })
}

function buildWorkspaceSections(input: {
  lead: LeadRecord | null
  property: PropertyApiItem | null
  broker: BrokerProfile | null
  kind: ContractType
}) {
  const { lead, property, broker, kind } = input

  if (isLease(kind)) {
    return [
      {
        key: "landlord",
        title: "Locador",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary: property?.ownerName || "Vincule um imovel com locador definido para iniciar a minuta.",
        items: [
          { label: "Nome", value: property?.ownerName || "" },
          { label: "Imovel vinculado", value: property?.title || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
        ],
      },
      {
        key: "client",
        title: "Locatario",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary: lead?.name || "Selecione um locatario para compor o contrato.",
        items: [
          { label: "Nome", value: lead?.name || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Estado civil", value: lead?.identification.maritalStatus || "" },
          { label: "Profissao", value: lead?.identification.profession || "" },
          { label: "Endereco", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: isCommercialLease(kind) ? "Imovel comercial" : "Imovel",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary:
          property?.title ||
          (isCommercialLease(kind)
            ? "Selecione um imovel comercial para alimentar a locacao."
            : "Selecione um imovel para alimentar a locacao residencial."),
        items: [
          { label: "Titulo", value: property?.title || "" },
          { label: "Endereco", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "CEP", value: property?.legal.cep || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
          { label: "Cartorio", value: property?.legal.registryOffice || "" },
          { label: "Valor anunciado", value: property?.formattedPrice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliaria",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediacao pode ser vinculada a uma imobiliaria quando disponivel.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsavel", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda nao carregados.",
        items: [
          { label: "Nome", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
          { label: "Telefone", value: broker?.phone || "" },
          { label: "E-mail", value: broker?.email || "" },
        ],
      },
    ] satisfies WorkspaceEntitySection[]
  }

  if (isSaleAuthorization(kind) || isExclusivity(kind)) {
    return [
      {
        key: "client",
        title: "Proprietario",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary:
          lead?.name ||
          property?.ownerName ||
          (isExclusivity(kind)
            ? "Selecione o proprietario para compor o contrato de exclusividade."
            : "Selecione o proprietario para compor a autorizacao."),
        items: [
          { label: "Nome", value: lead?.name || property?.ownerName || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Estado civil", value: lead?.identification.maritalStatus || "" },
          { label: "Profissao", value: lead?.identification.profession || "" },
          { label: "Endereco", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imovel",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary:
          property?.title ||
          (isExclusivity(kind)
            ? "Selecione um imovel para alimentar o contrato de exclusividade."
            : "Selecione um imovel para alimentar a autorizacao de venda."),
        items: [
          { label: "Titulo", value: property?.title || "" },
          { label: "Endereco", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
          { label: "Cartorio", value: property?.legal.registryOffice || "" },
          { label: "Valor anunciado", value: property?.formattedPrice || "" },
          { label: "Proprietario no imovel", value: property?.ownerName || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliaria",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediacao pode ser vinculada a uma imobiliaria quando disponivel.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsavel", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda nao carregados.",
        items: [
          { label: "Nome", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
          { label: "Telefone", value: broker?.phone || "" },
          { label: "E-mail", value: broker?.email || "" },
        ],
      },
    ] satisfies WorkspaceEntitySection[]
  }

  if (isReservation(kind)) {
    return [
      {
        key: "client",
        title: "Interessado",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary: lead?.name || "Selecione o interessado para compor a reserva do imovel.",
        items: [
          { label: "Nome", value: lead?.name || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Estado civil", value: lead?.identification.maritalStatus || "" },
          { label: "Profissao", value: lead?.identification.profession || "" },
          { label: "Endereco", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "owner",
        title: "Proprietario",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary: property?.ownerName || "Vincule um imovel com proprietario identificado para formalizar a reserva.",
        items: [
          { label: "Nome", value: property?.ownerName || "" },
          { label: "Imovel vinculado", value: property?.title || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
        ],
      },
      {
        key: "property",
        title: "Imovel",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary: property?.title || "Selecione um imovel para alimentar a reserva.",
        items: [
          { label: "Titulo", value: property?.title || "" },
          { label: "Endereco", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "CEP", value: property?.legal.cep || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
          { label: "Cartorio", value: property?.legal.registryOffice || "" },
          { label: "Valor anunciado", value: property?.formattedPrice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliaria",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediacao pode ser vinculada a uma imobiliaria quando disponivel.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsavel", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda nao carregados.",
        items: [
          { label: "Nome", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
          { label: "Telefone", value: broker?.phone || "" },
          { label: "E-mail", value: broker?.email || "" },
        ],
      },
    ] satisfies WorkspaceEntitySection[]
  }

  if (isAmendment(kind)) {
    return [
      {
        key: "client",
        title: "Cliente vinculado",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary: lead?.name || "Selecione o cliente vinculado ao contrato original.",
        items: [
          { label: "Nome", value: lead?.name || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Endereco", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imovel do contrato original",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary: property?.title || "Selecione o imovel vinculado ao contrato que sera aditado.",
        items: [
          { label: "Titulo", value: property?.title || "" },
          { label: "Endereco", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
          { label: "Cartorio", value: property?.legal.registryOffice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliaria",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediacao pode ser vinculada a uma imobiliaria quando disponivel.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsavel", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda nao carregados.",
        items: [
          { label: "Nome", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
          { label: "Telefone", value: broker?.phone || "" },
          { label: "E-mail", value: broker?.email || "" },
        ],
      },
    ] satisfies WorkspaceEntitySection[]
  }

  if (isTermination(kind)) {
    return [
      {
        key: "client",
        title: "Cliente vinculado",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary: lead?.name || "Selecione o cliente vinculado ao contrato original.",
        items: [
          { label: "Nome", value: lead?.name || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Endereco", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imovel do contrato original",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary: property?.title || "Selecione o imovel vinculado ao contrato que sera encerrado.",
        items: [
          { label: "Titulo", value: property?.title || "" },
          { label: "Endereco", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
          { label: "Cartorio", value: property?.legal.registryOffice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliaria",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediacao pode ser vinculada a uma imobiliaria quando disponivel.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsavel", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda nao carregados.",
        items: [
          { label: "Nome", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
          { label: "Telefone", value: broker?.phone || "" },
          { label: "E-mail", value: broker?.email || "" },
        ],
      },
    ] satisfies WorkspaceEntitySection[]
  }

  if (isVisitTerm(kind)) {
    return [
      {
        key: "client",
        title: "Visitante",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary: lead?.name || "Selecione o visitante para compor o termo de visita.",
        items: [
          { label: "Nome", value: lead?.name || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Endereco", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imovel visitado",
        route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
        actionLabel: "Editar imovel",
        summary: property?.title || "Selecione o imovel para registrar a visita.",
        items: [
          { label: "Titulo", value: property?.title || "" },
          { label: "Endereco", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "CEP", value: property?.legal.cep || "" },
          { label: "Matricula", value: property?.legal.registryNumber || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda nao carregados.",
        items: [
          { label: "Nome", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
          { label: "Telefone", value: broker?.phone || "" },
          { label: "E-mail", value: broker?.email || "" },
        ],
      },
    ] satisfies WorkspaceEntitySection[]
  }

  return [
    {
      key: "client",
      title: "Cliente",
      route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
      actionLabel: "Editar cliente",
      summary: lead?.name || "Selecione um cliente para compor o contrato.",
      items: [
        { label: "Nome", value: lead?.name || "" },
        { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
        { label: "E-mail", value: lead?.email || "" },
        { label: "CPF", value: lead?.identification.cpfCnpj || "" },
        { label: "RG", value: lead?.identification.rg || "" },
        { label: "Estado civil", value: lead?.identification.maritalStatus || "" },
        { label: "Regime de bens", value: lead?.identification.propertyRegime || "" },
        { label: "Nacionalidade", value: lead?.identification.nationality || "" },
        { label: "Profissao", value: lead?.identification.profession || "" },
        { label: "Endereco", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
      ],
    },
    {
      key: "property",
      title: "Imovel",
      route: property ? `/corretor/imoveis/${property.id}` : "/corretor/imoveis",
      actionLabel: "Editar imovel",
      summary: property?.title || "Selecione um imovel para alimentar o documento.",
      items: [
        { label: "Titulo", value: property?.title || "" },
        { label: "Cidade", value: property?.legal.city || property?.city || "" },
        { label: "Bairro", value: property?.neighborhood || "" },
        { label: "Valor anunciado", value: property?.formattedPrice || "" },
        { label: "Matricula", value: property?.legal.registryNumber || "" },
        { label: "Area privativa", value: property?.legal.privateArea || "" },
        { label: "Cartorio", value: property?.legal.registryOffice || "" },
        { label: "CEP", value: property?.legal.cep || "" },
        { label: "Endereco", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
        { label: "Proprietario / vendedor", value: property?.ownerName || "" },
      ],
    },
    {
      key: "broker",
      title: "Corretor",
      route: "/corretor/conta",
      actionLabel: "Editar corretor",
      summary: broker?.name || "Dados do corretor ainda nao carregados.",
      items: [
        { label: "Nome", value: broker?.name || "" },
        { label: "CRECI", value: broker?.creci || "" },
        { label: "Telefone", value: broker?.phone || "" },
        { label: "E-mail", value: broker?.email || "" },
      ],
    },
  ] satisfies WorkspaceEntitySection[]
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
      paymentMethod: input.draft.paymentMethod || null,
      guaranteeType: input.draft.guaranteeType || null,
      inspectionReport: input.draft.inspectionReport || null,
      commercialPurpose: input.draft.commercialPurpose || null,
      adjustmentTerm: input.draft.adjustmentTerm || null,
      worksScope: input.draft.worksScope || null,
      fitOutScope: input.draft.fitOutScope || null,
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
        paymentMethod: input.contract.content.financial.paymentMethod ?? "",
        guaranteeType: input.contract.content.financial.guaranteeType ?? "",
        inspectionReport: input.contract.content.financial.inspectionReport ?? "",
        commercialPurpose: input.contract.content.financial.commercialPurpose ?? "",
        adjustmentTerm: input.contract.content.financial.adjustmentTerm ?? "",
        worksScope: input.contract.content.financial.worksScope ?? "",
        fitOutScope: input.contract.content.financial.fitOutScope ?? "",
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
  if (kind === "Locacao residencial") {
    return [
      {
        id: "commercial.value",
        key: "amount",
        label: "Aluguel mensal",
        type: "currency",
        placeholder: "R$ 0,00",
        hint: "Valor preenchido automaticamente pelo imovel.",
      },
      {
        id: "commercial.commission",
        key: "commissionPercent",
        label: "Comissao da intermediacao (opcional)",
        type: "percent",
        placeholder: "0",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Inicio",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Termino",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.term",
        key: "validity",
        label: "Prazo da locacao",
        type: "text",
        placeholder: "30 meses",
      },
      {
        id: "commercial.dueDay",
        key: "dueDate",
        label: "Dia do vencimento",
        type: "text",
        placeholder: "Todo dia 10",
      },
      {
        id: "commercial.paymentMethod",
        key: "paymentMethod",
        label: "Forma de pagamento",
        type: "text",
        placeholder: "Pix, boleto ou transferencia",
      },
      {
        id: "commercial.guaranteeType",
        key: "guaranteeType",
        label: "Garantia",
        type: "text",
        placeholder: "Caucao, fiador, seguro fianca...",
      },
      {
        id: "commercial.inspectionReport",
        key: "inspectionReport",
        label: "Laudo de vistoria",
        type: "text",
        placeholder: "Laudo inicial assinado em 29/07/2026",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Encargos e observacoes (opcional)",
        type: "textarea",
        placeholder: "IPTU por conta do locatario. Entrega das chaves apos vistoria final.",
        examples: [
          "Condominio e consumo por conta do locatario.",
          "Reajuste anual pelo indice contratual.",
          "Entrega das chaves mediante vistoria final.",
        ],
      },
    ]
  }

  if (kind === "Locacao comercial") {
    return [
      {
        id: "commercial.value",
        key: "amount",
        label: "Aluguel mensal",
        type: "currency",
        placeholder: "R$ 0,00",
        hint: "Valor preenchido automaticamente pelo imovel.",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Inicio",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Termino",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.term",
        key: "validity",
        label: "Prazo da locacao",
        type: "text",
        placeholder: "60 meses",
      },
      {
        id: "commercial.purpose",
        key: "commercialPurpose",
        label: "Finalidade comercial",
        type: "text",
        placeholder: "Loja, clinica, escritorio, operacao varejista...",
      },
      {
        id: "commercial.dueDay",
        key: "dueDate",
        label: "Dia do vencimento",
        type: "text",
        placeholder: "Todo dia 5",
      },
      {
        id: "commercial.paymentMethod",
        key: "paymentMethod",
        label: "Forma de pagamento",
        type: "text",
        placeholder: "Boleto, pix, transferencia...",
      },
      {
        id: "commercial.adjustmentTerm",
        key: "adjustmentTerm",
        label: "Reajuste",
        type: "text",
        placeholder: "Anual pelo indice contratual",
      },
      {
        id: "commercial.guaranteeType",
        key: "guaranteeType",
        label: "Garantia",
        type: "text",
        placeholder: "Fianca, caucao, seguro fianca...",
      },
      {
        id: "commercial.inspectionReport",
        key: "inspectionReport",
        label: "Laudo de vistoria",
        type: "text",
        placeholder: "Laudo comercial inicial assinado em 29/07/2026",
      },
      {
        id: "commercial.works",
        key: "worksScope",
        label: "Obras",
        type: "textarea",
        placeholder: "Obras estruturais, prazo, responsabilidade financeira e autorizacoes.",
        examples: [
          "Adequacao eletrica sob responsabilidade do locatario.",
          "Obras estruturais somente com autorizacao previa do locador.",
        ],
      },
      {
        id: "commercial.fitOut",
        key: "fitOutScope",
        label: "Adequacoes",
        type: "textarea",
        placeholder: "Layout, fachada, climatizacao, acessibilidade e demais adequacoes do ponto.",
        examples: [
          "Fachada aprovada previamente pelo locador e condominio.",
          "Instalacoes internas conforme atividade licenciada.",
        ],
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Encargos e observacoes (opcional)",
        type: "textarea",
        placeholder: "IPTU, condominio, taxas operacionais e condicoes especiais da locacao.",
        examples: [
          "IPTU e condominio por conta do locatario.",
          "Taxas de licenciamento operacional sob responsabilidade do locatario.",
          "Repasses extraordinarios dependem de aprovacao expressa.",
        ],
      },
    ]
  }

  if (kind === "Autorizacao de venda") {
    return [
      {
        id: "commercial.value",
        key: "amount",
        label: "Valor autorizado",
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
        label: "Inicio",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Termino",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.validity",
        key: "validity",
        label: "Prazo da autorizacao",
        type: "text",
        placeholder: "90 dias",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Condicoes da intermediacao",
        type: "textarea",
        placeholder: "Escopo da captacao, formato das visitas, divulgacao e regras comerciais.",
        examples: [
          "Visitas somente com agendamento previo.",
          "Divulgacao autorizada nos canais digitais do corretor e da imobiliaria.",
          "Negociacoes devem respeitar o valor autorizado e a comissao pactuada.",
        ],
      },
    ]
  }

  if (kind === "Exclusividade") {
    return [
      {
        id: "commercial.value",
        key: "amount",
        label: "Valor de referencia",
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
        label: "Inicio",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Termino",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.validity",
        key: "validity",
        label: "Prazo de exclusividade",
        type: "text",
        placeholder: "120 dias",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Direitos e obrigacoes",
        type: "textarea",
        placeholder: "Escopo da exclusividade, divulgacao autorizada, visitas e regras comerciais.",
        examples: [
          "Captacao exclusiva durante todo o prazo contratado.",
          "Visitas somente com acompanhamento do corretor responsavel.",
          "Negociacoes devem observar a comissao e o valor de referencia pactuados.",
        ],
      },
    ]
  }

  if (kind === "Termo de visita") {
    return [
      {
        id: "commercial.visitDate",
        key: "startDate",
        label: "Data da visita",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.visitTime",
        key: "dueDate",
        label: "Hora da visita",
        type: "text",
        placeholder: "14:30",
      },
      {
        id: "commercial.awareness",
        key: "validity",
        label: "Ciencia da intermediacao",
        type: "text",
        placeholder: "Visitante ciente da intermediacao do corretor.",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Declaracoes",
        type: "textarea",
        placeholder: "Declaracoes complementares sobre a visita realizada.",
        examples: [
          "Visitante conheceu o imovel por intermédio do corretor.",
          "Visitante ciente da intermediacao para eventual proposta futura.",
        ],
      },
    ]
  }

  if (kind === "Aditivo") {
    return [
      {
        id: "commercial.originalContract",
        key: "paymentMethod",
        label: "Referencia ao contrato original",
        type: "text",
        placeholder: "Contrato original vinculado ao cliente e ao imovel.",
        hint: "Preenchido automaticamente a partir do cliente e do imovel selecionados.",
      },
      {
        id: "commercial.changes",
        key: "additionalConditions",
        label: "Alteracoes",
        type: "textarea",
        placeholder: "Descreva exatamente o que esta sendo ajustado neste aditivo.",
        examples: [
          "Prorrogacao do prazo originalmente pactuado.",
          "Atualizacao do valor e da forma de pagamento.",
          "Inclusao de nova condicao comercial acordada entre as partes.",
        ],
      },
      {
        id: "commercial.modifiedClauses",
        key: "validity",
        label: "Clausulas modificadas",
        type: "text",
        placeholder: "Ex.: Clausulas 3, 5 e 8.",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Vigencia inicial",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Vigencia final",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.forum",
        key: "dueDate",
        label: "Foro",
        type: "text",
        placeholder: "Comarca aplicavel ao aditivo.",
      },
    ]
  }

  if (kind === "Distrato") {
    return [
      {
        id: "commercial.originalContract",
        key: "paymentMethod",
        label: "Referencia ao contrato original",
        type: "text",
        placeholder: "Contrato original vinculado ao cliente e ao imovel.",
        hint: "Preenchido automaticamente a partir do cliente e do imovel selecionados.",
      },
      {
        id: "commercial.terminationReason",
        key: "additionalConditions",
        label: "Motivo do encerramento",
        type: "textarea",
        placeholder: "Descreva o motivo do encerramento e o contexto do distrato.",
        examples: [
          "Encerramento consensual por alteracao de estrategia comercial.",
          "Rescisao amigavel por impossibilidade de continuidade da negociacao.",
          "Distrato firmado apos acordo integral entre as partes.",
        ],
      },
      {
        id: "commercial.release",
        key: "validity",
        label: "Quitacao",
        type: "text",
        placeholder: "Ex.: Quitacao plena entre as partes.",
      },
      {
        id: "commercial.remainingObligations",
        key: "guaranteeType",
        label: "Obrigacoes remanescentes",
        type: "text",
        placeholder: "Ex.: Devolucao de documentos, pagamentos pendentes, entrega de chaves.",
      },
      {
        id: "commercial.forum",
        key: "dueDate",
        label: "Foro",
        type: "text",
        placeholder: "Comarca aplicavel ao distrato.",
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
        id: "commercial.startDate",
        key: "startDate",
        label: "Inicio da reserva",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.validUntil",
        key: "validity",
        label: "Prazo da reserva",
        type: "text",
        placeholder: "Ex.: 5 dias corridos",
      },
      {
        id: "commercial.conversionDate",
        key: "dueDate",
        label: "Conversao ate",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Condicoes da reserva",
        type: "textarea",
        placeholder: "Sinal, analise documental, aprovacao financeira e demais condicoes comerciais.",
        examples: [
          "Reserva condicionada a analise documental do imovel.",
          "Sinal convertido integralmente na assinatura do contrato definitivo.",
          "Prazo comercial contado em dias corridos a partir da assinatura.",
        ],
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
    <div className="rounded-[1.1rem] bg-[#f7f7f4] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8B95A1]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[#050505]">{value || "—"}</p>
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
  const [amendmentReferenceCustomized, setAmendmentReferenceCustomized] = useState(false)

  const loadEntitySources = useCallback(async () => {
    const [leadsResponse, propertiesResponse, brokerResponse, financialResponse] = await Promise.all([
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

    if (leadsResponse.ok) setLeads((leadsResponse.data?.leads ?? []) as LeadRecord[])
    if (propertiesResponse.ok) setProperties((propertiesResponse.data?.properties ?? []) as PropertyApiItem[])
    if (brokerResponse.ok) setBrokerProfile((brokerResponse.data?.profile ?? null) as BrokerProfile | null)
    if (financialResponse.ok) {
      setFinancialConfig({
        commissionPercent: Number(financialResponse.data?.config?.commissionPercent) || DEFAULT_COMMISSION_PERCENT,
      })
    }
  }, [])

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

    loadEntitySources().catch(() => null)

    const unsubscribeEntitySync = subscribeEntitySync((message) => {
      if (ignore) return
      if (message.type === "lead" || message.type === "property" || message.type === "broker") {
        loadEntitySources().catch(() => null)
      }
    })

    return () => {
      ignore = true
      unsubscribeEntitySync()
    }
  }, [loadEntitySources])

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

  useEffect(() => {
    if (!isDialogOpen || (!isAmendment(draft.kind) && !isTermination(draft.kind)) || amendmentReferenceCustomized) return
    const nextReference = buildAmendmentReference(selectedLead, selectedProperty)
    if (!nextReference || draft.paymentMethod === nextReference) return
    setDraft((current) => ({ ...current, paymentMethod: nextReference }))
  }, [amendmentReferenceCustomized, draft.kind, draft.paymentMethod, isDialogOpen, selectedLead, selectedProperty])

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

  const workspaceSections = useMemo(() => {
    return buildWorkspaceSections({
      kind: draft.kind,
      lead: selectedLead,
      property: selectedProperty,
      broker: brokerProfile,
    }).map((section) => {
      const items = section.items.map((item) => ({
        ...item,
        done: Boolean(item.value.trim()),
      }))

      return {
        ...section,
        items,
        completedCount: items.filter((item) => item.done).length,
        pendingCount: items.filter((item) => !item.done).length,
      }
    })
  }, [brokerProfile, draft.kind, selectedLead, selectedProperty])

  const pendingSummary = useMemo(() => {
    const pendingCount = workspaceSections.reduce((total, section) => total + section.pendingCount, 0)
    const completedCount = workspaceSections.reduce((total, section) => total + section.completedCount, 0)
    return { pendingCount, completedCount }
  }, [workspaceSections])

  const selectedWorkspaceSections = useMemo(() => {
    return buildWorkspaceSections({
      kind: selectedContract?.kind ?? draft.kind,
      lead: selectedContractLead,
      property: selectedContractProperty,
      broker: brokerProfile,
    }).map((section) => {
      const items = section.items.map((item) => ({
        ...item,
        done: Boolean(item.value.trim()),
      }))

      return {
        ...section,
        items,
        completedCount: items.filter((item) => item.done).length,
        pendingCount: items.filter((item) => !item.done).length,
      }
    })
  }, [brokerProfile, draft.kind, selectedContract?.kind, selectedContractLead, selectedContractProperty])

  const contractHealthIndicators = useMemo(() => {
    const clientScore = scoreSection(selectedWorkspaceSections.find((section) => section.key === "client")?.items ?? [])
    const landlordScore = scoreSection(
      selectedWorkspaceSections.find((section) => section.key === "landlord")?.items ?? [],
    )
    const ownerScore = scoreSection(selectedWorkspaceSections.find((section) => section.key === "owner")?.items ?? [])
    const propertyScore = scoreSection(
      selectedWorkspaceSections.find((section) => section.key === "property")?.items ?? [],
    )
    const documentationScore = scoreSection([
      {
        label: "Matrícula",
        value: selectedContractProperty?.legal.registryNumber || "",
        done: Boolean(selectedContractProperty?.legal.registryNumber),
      },
      {
        label: "Cartório",
        value: selectedContractProperty?.legal.registryOffice || "",
        done: Boolean(selectedContractProperty?.legal.registryOffice),
      },
      {
        label: "Notas de revisão",
        value: selectedContract?.content.reviewNotes.length ? "ok" : "",
        done: selectedContract ? selectedContract.content.reviewNotes.length > 0 : false,
      },
    ])
    const negotiationScore = scoreSection([
      {
        label: "Valor",
        value: selectedContract?.amountLabel || "",
        done: Boolean(selectedContract?.amountLabel),
      },
      {
        label: "Modelo",
        value: selectedContract?.kind || "",
        done: Boolean(selectedContract?.kind),
      },
      {
        label: "Cliente",
        value: selectedContract?.leadName || "",
        done: Boolean(selectedContract?.leadName),
      },
      {
        label: "Imóvel",
        value: selectedContract?.propertyTitle || "",
        done: Boolean(selectedContract?.propertyTitle),
      },
    ])
    const signatureScore = selectedContract
      ? selectedContract.status === "signed" || selectedContract.status === "completed"
        ? 100
        : selectedContract.status === "awaiting_signature"
          ? 80
          : 64
      : 0

    const leaseDocumentationScore = scoreSection([
      {
        label: "Matricula",
        value: selectedContractProperty?.legal.registryNumber || "",
        done: Boolean(selectedContractProperty?.legal.registryNumber),
      },
      {
        label: "Cartorio",
        value: selectedContractProperty?.legal.registryOffice || "",
        done: Boolean(selectedContractProperty?.legal.registryOffice),
      },
      {
        label: "Laudo de vistoria",
        value: selectedContract?.content.financial.inspectionReport || "",
        done: Boolean(selectedContract?.content.financial.inspectionReport),
      },
      {
        label: "Notas de revisao",
        value: selectedContract?.content.reviewNotes.length ? "ok" : "",
        done: selectedContract ? selectedContract.content.reviewNotes.length > 0 : false,
      },
    ])
    const leaseFinancialScore = scoreSection([
      {
        label: "Valor",
        value: selectedContract?.amountLabel || "",
        done: Boolean(selectedContract?.amountLabel),
      },
      {
        label: "Vencimento",
        value: selectedContract?.content.financial.dueDate || "",
        done: Boolean(selectedContract?.content.financial.dueDate),
      },
      {
        label: "Forma de pagamento",
        value: selectedContract?.content.financial.paymentMethod || "",
        done: Boolean(selectedContract?.content.financial.paymentMethod),
      },
    ])
    const guaranteeScore = scoreSection([
      {
        label: "Garantia",
        value: selectedContract?.content.financial.guaranteeType || "",
        done: Boolean(selectedContract?.content.financial.guaranteeType),
      },
      {
        label: "Encargos e observacoes",
        value: selectedContract?.content.financial.additionalConditions || "",
        done: Boolean(selectedContract?.content.financial.additionalConditions),
      },
    ])
    const reservationFinancialScore = scoreSection([
      {
        label: "Valor da reserva",
        value: selectedContract?.amountLabel || "",
        done: Boolean(selectedContract?.amountLabel),
      },
      {
        label: "Prazo da reserva",
        value: selectedContract?.content.financial.validity || "",
        done: Boolean(selectedContract?.content.financial.validity),
      },
      {
        label: "Conversao da reserva",
        value: selectedContract?.content.financial.dueDate || "",
        done: Boolean(selectedContract?.content.financial.dueDate),
      },
    ])
    const reservationConversionScore = scoreSection([
      {
        label: "Condicoes da reserva",
        value: selectedContract?.content.financial.additionalConditions || "",
        done: Boolean(selectedContract?.content.financial.additionalConditions),
      },
      {
        label: "Corretor responsavel",
        value: brokerProfile?.name || "",
        done: Boolean(brokerProfile?.name),
      },
      {
        label: "Imobiliaria",
        value: brokerProfile?.agencyName || "",
        done: Boolean(brokerProfile?.agencyName),
      },
    ])
    const amendmentGovernanceScore = scoreSection([
      {
        label: "Contrato original",
        value: selectedContract?.content.financial.paymentMethod || "",
        done: Boolean(selectedContract?.content.financial.paymentMethod),
      },
      {
        label: "Clausulas modificadas",
        value: selectedContract?.content.financial.validity || "",
        done: Boolean(selectedContract?.content.financial.validity),
      },
      {
        label: "Alteracoes",
        value: selectedContract?.content.financial.additionalConditions || "",
        done: Boolean(selectedContract?.content.financial.additionalConditions),
      },
    ])
    const amendmentTermScore = scoreSection([
      {
        label: "Vigencia inicial",
        value: selectedContract?.content.financial.startDate || "",
        done: Boolean(selectedContract?.content.financial.startDate),
      },
      {
        label: "Vigencia final",
        value: selectedContract?.content.financial.endDate || "",
        done: Boolean(selectedContract?.content.financial.endDate),
      },
      {
        label: "Foro",
        value: selectedContract?.content.financial.dueDate || "",
        done: Boolean(selectedContract?.content.financial.dueDate),
      },
    ])
    const terminationGovernanceScore = scoreSection([
      {
        label: "Contrato original",
        value: selectedContract?.content.financial.paymentMethod || "",
        done: Boolean(selectedContract?.content.financial.paymentMethod),
      },
      {
        label: "Motivo do encerramento",
        value: selectedContract?.content.financial.additionalConditions || "",
        done: Boolean(selectedContract?.content.financial.additionalConditions),
      },
      {
        label: "Quitacao",
        value: selectedContract?.content.financial.validity || "",
        done: Boolean(selectedContract?.content.financial.validity),
      },
    ])
    const terminationSettlementScore = scoreSection([
      {
        label: "Obrigacoes remanescentes",
        value: selectedContract?.content.financial.guaranteeType || "",
        done: Boolean(selectedContract?.content.financial.guaranteeType),
      },
      {
        label: "Foro",
        value: selectedContract?.content.financial.dueDate || "",
        done: Boolean(selectedContract?.content.financial.dueDate),
      },
      {
        label: "Corretor responsavel",
        value: brokerProfile?.name || "",
        done: Boolean(brokerProfile?.name),
      },
    ])

    if (selectedContract?.kind === "Locacao comercial") {
      return [
        { label: "Locador", score: landlordScore },
        { label: "Locatario", score: clientScore },
        { label: "Imovel comercial", score: propertyScore },
        { label: "Financeiro", score: leaseFinancialScore },
        { label: "Garantias", score: guaranteeScore },
        { label: "Documentacao", score: leaseDocumentationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Autorizacao de venda") {
      return [
        { label: "Proprietario", score: clientScore },
        { label: "Imovel", score: propertyScore },
        { label: "Documentacao", score: documentationScore },
        { label: "Intermediacao", score: negotiationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Exclusividade") {
      return [
        { label: "Proprietario", score: clientScore },
        { label: "Imovel", score: propertyScore },
        { label: "Documentacao", score: documentationScore },
        { label: "Exclusividade", score: negotiationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Termo de visita") {
      return [
        { label: "Visitante", score: clientScore },
        { label: "Imovel visitado", score: propertyScore },
        { label: "Documentacao", score: documentationScore },
        { label: "Intermediacao", score: negotiationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Reserva") {
      return [
        { label: "Interessado", score: clientScore },
        { label: "Proprietario", score: ownerScore },
        { label: "Imovel", score: propertyScore },
        { label: "Financeiro", score: reservationFinancialScore },
        { label: "Conversao", score: reservationConversionScore },
        { label: "Documentacao", score: documentationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Aditivo") {
      return [
        { label: "Cliente", score: clientScore },
        { label: "Imovel", score: propertyScore },
        { label: "Documentacao", score: documentationScore },
        { label: "Contrato original", score: amendmentGovernanceScore },
        { label: "Vigencia", score: amendmentTermScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Distrato") {
      return [
        { label: "Cliente", score: clientScore },
        { label: "Imovel", score: propertyScore },
        { label: "Documentacao", score: documentationScore },
        { label: "Contrato original", score: terminationGovernanceScore },
        { label: "Quitacao", score: terminationSettlementScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Locacao residencial") {
      return [
        { label: "Locador", score: landlordScore },
        { label: "Locatario", score: clientScore },
        { label: "Imovel", score: propertyScore },
        { label: "Financeiro", score: leaseFinancialScore },
        { label: "Garantias", score: guaranteeScore },
        { label: "Documentacao", score: leaseDocumentationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    return [
      { label: "Cliente", score: clientScore },
      { label: "Imóvel", score: propertyScore },
      { label: "Documentação", score: documentationScore },
      { label: "Negociação", score: negotiationScore },
      { label: "Assinaturas", score: signatureScore },
    ]
  }, [brokerProfile?.agencyName, brokerProfile?.name, selectedContract, selectedContractProperty, selectedWorkspaceSections])

  const contractHealthScore = useMemo(() => {
    if (!selectedContract) return 0

    return Math.round(
      contractHealthIndicators.reduce((total, item) => total + item.score, 0) / contractHealthIndicators.length,
    )
  }, [contractHealthIndicators, selectedContract])

  const contractPendingHighlights = useMemo(() => {
    if (!selectedContract) return []

    if (selectedContract.kind === "Locacao residencial") {
      return [
        !selectedContractProperty?.ownerName ? "Locador vinculado ao imovel" : null,
        !selectedContractLead?.identification.rg ? "RG do locatario" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matricula" : null,
        !selectedContract.content.financial.guaranteeType ? "Garantia locaticia" : null,
        !selectedContract.content.financial.inspectionReport ? "Laudo de vistoria" : null,
        selectedContract.status === "draft" ? "Fluxo de assinatura" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Locacao comercial") {
      return [
        !selectedContractProperty?.ownerName ? "Locador vinculado ao imovel" : null,
        !selectedContract.content.financial.commercialPurpose ? "Finalidade comercial" : null,
        !selectedContract.content.financial.adjustmentTerm ? "Regra de reajuste" : null,
        !selectedContract.content.financial.guaranteeType ? "Garantia locaticia" : null,
        !selectedContract.content.financial.worksScope ? "Obras previstas" : null,
        !selectedContract.content.financial.fitOutScope ? "Adequacoes do ponto" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Autorizacao de venda") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do proprietario" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matricula" : null,
        !selectedContract.amountLabel ? "Valor autorizado" : null,
        !selectedContract.content.financial.commissionPercent ? "Comissao" : null,
        !selectedContract.content.financial.additionalConditions ? "Condicoes da intermediacao" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Exclusividade") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do proprietario" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matricula" : null,
        !selectedContract.amountLabel ? "Valor de referencia" : null,
        !selectedContract.content.financial.commissionPercent ? "Comissao" : null,
        !selectedContract.content.financial.validity ? "Prazo de exclusividade" : null,
        !selectedContract.content.financial.additionalConditions ? "Direitos e obrigacoes" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Termo de visita") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do visitante" : null,
        !selectedContractProperty?.title ? "Imovel visitado" : null,
        !selectedContract.content.financial.startDate ? "Data da visita" : null,
        !selectedContract.content.financial.dueDate ? "Hora da visita" : null,
        !selectedContract.content.financial.validity ? "Ciencia da intermediacao" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Reserva") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do interessado" : null,
        !selectedContractProperty?.ownerName ? "Proprietario do imovel" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matricula" : null,
        !selectedContract.amountLabel ? "Valor da reserva" : null,
        !selectedContract.content.financial.validity ? "Prazo da reserva" : null,
        !selectedContract.content.financial.dueDate ? "Conversao da reserva" : null,
        !selectedContract.content.financial.additionalConditions ? "Condicoes da reserva" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Aditivo") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do cliente vinculado" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matricula do imovel" : null,
        !selectedContract.content.financial.paymentMethod ? "Referencia do contrato original" : null,
        !selectedContract.content.financial.additionalConditions ? "Alteracoes do aditivo" : null,
        !selectedContract.content.financial.validity ? "Clausulas modificadas" : null,
        !selectedContract.content.financial.startDate ? "Vigencia inicial" : null,
        !selectedContract.content.financial.endDate ? "Vigencia final" : null,
        !selectedContract.content.financial.dueDate ? "Foro" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Distrato") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do cliente vinculado" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matricula do imovel" : null,
        !selectedContract.content.financial.paymentMethod ? "Referencia do contrato original" : null,
        !selectedContract.content.financial.additionalConditions ? "Motivo do encerramento" : null,
        !selectedContract.content.financial.validity ? "Quitacao" : null,
        !selectedContract.content.financial.guaranteeType ? "Obrigacoes remanescentes" : null,
        !selectedContract.content.financial.dueDate ? "Foro" : null,
      ].filter((item): item is string => Boolean(item))
    }

    return [
      !selectedContractProperty?.legal.registryNumber ? "Matrícula" : null,
      !selectedContractProperty?.legal.registryOffice ? "Cartório" : null,
      !selectedContractLead?.identification.rg ? "RG do cliente" : null,
      !selectedContract.amountLabel ? "Valor negociado" : null,
      selectedContract.status === "draft" ? "Fluxo de assinatura" : null,
    ].filter((item): item is string => Boolean(item))
  }, [
    selectedContract,
    selectedContractLead?.identification.cpfCnpj,
    selectedContractLead?.identification.rg,
    selectedContractProperty?.legal.registryNumber,
    selectedContractProperty?.legal.registryOffice,
    selectedContractProperty?.ownerName,
    selectedContractProperty?.title,
  ])

  const contractValidationItems = useMemo(() => {
    if (!selectedContract) return []

    if (selectedContract.kind === "Locacao residencial") {
      return [
        {
          label: "Locador validado",
          detail: selectedContractProperty?.ownerName || "Locador ainda nao identificado no imovel.",
          done: Boolean(selectedContractProperty?.ownerName),
        },
        {
          label: "Locatario validado",
          detail: selectedContract.leadName || "Locatario ainda nao vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Garantia definida",
          detail: selectedContract.content.financial.guaranteeType || "Garantia locaticia pendente.",
          done: Boolean(selectedContract.content.financial.guaranteeType),
        },
        {
          label: "Laudo de vistoria",
          detail: selectedContract.content.financial.inspectionReport || "Laudo inicial nao informado.",
          done: Boolean(selectedContract.content.financial.inspectionReport),
        },
        {
          label: "Financeiro confirmado",
          detail:
            selectedContract.amountLabel && selectedContract.content.financial.dueDate
              ? `${selectedContract.amountLabel} • ${selectedContract.content.financial.dueDate}`
              : "Aluguel e vencimento ainda exigem confirmacao.",
          done: Boolean(selectedContract.amountLabel && selectedContract.content.financial.dueDate),
        },
      ]
    }

    if (selectedContract.kind === "Locacao comercial") {
      return [
        {
          label: "Locador validado",
          detail: selectedContractProperty?.ownerName || "Locador ainda nao identificado no imovel.",
          done: Boolean(selectedContractProperty?.ownerName),
        },
        {
          label: "Finalidade comercial",
          detail: selectedContract.content.financial.commercialPurpose || "Uso comercial ainda nao definido.",
          done: Boolean(selectedContract.content.financial.commercialPurpose),
        },
        {
          label: "Reajuste definido",
          detail: selectedContract.content.financial.adjustmentTerm || "Regra de reajuste pendente.",
          done: Boolean(selectedContract.content.financial.adjustmentTerm),
        },
        {
          label: "Garantia definida",
          detail: selectedContract.content.financial.guaranteeType || "Garantia locaticia pendente.",
          done: Boolean(selectedContract.content.financial.guaranteeType),
        },
        {
          label: "Obras e adequacoes",
          detail:
            selectedContract.content.financial.worksScope || selectedContract.content.financial.fitOutScope
              ? "Escopo operacional registrado."
              : "Obras e adequacoes ainda nao detalhadas.",
          done: Boolean(
            selectedContract.content.financial.worksScope || selectedContract.content.financial.fitOutScope,
          ),
        },
      ]
    }

    if (selectedContract.kind === "Autorizacao de venda") {
      return [
        {
          label: "Proprietario validado",
          detail: selectedContract.leadName || selectedContractProperty?.ownerName || "Proprietario ainda nao vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imovel validado",
          detail: selectedContract.propertyTitle || "Imovel ainda nao vinculado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Valor autorizado",
          detail: selectedContract.amountLabel || "Valor autorizado ainda nao informado.",
          done: Boolean(selectedContract.amountLabel),
        },
        {
          label: "Comissao definida",
          detail:
            selectedContract.content.financial.commissionPercent
              ? `${selectedContract.content.financial.commissionPercent}%`
              : "Comissao ainda nao informada.",
          done: Boolean(selectedContract.content.financial.commissionPercent),
        },
        {
          label: "Intermediacao registrada",
          detail:
            selectedContract.content.financial.additionalConditions ||
            "Condicoes da intermediacao ainda nao registradas.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Exclusividade") {
      return [
        {
          label: "Proprietario validado",
          detail: selectedContract.leadName || selectedContractProperty?.ownerName || "Proprietario ainda nao vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imovel validado",
          detail: selectedContract.propertyTitle || "Imovel ainda nao vinculado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Prazo de exclusividade",
          detail: selectedContract.content.financial.validity || "Prazo exclusivo ainda nao informado.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Comissao definida",
          detail:
            selectedContract.content.financial.commissionPercent
              ? `${selectedContract.content.financial.commissionPercent}%`
              : "Comissao ainda nao informada.",
          done: Boolean(selectedContract.content.financial.commissionPercent),
        },
        {
          label: "Direitos e obrigacoes",
          detail:
            selectedContract.content.financial.additionalConditions ||
            "Direitos e obrigacoes ainda nao registrados.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Termo de visita") {
      return [
        {
          label: "Visitante validado",
          detail: selectedContract.leadName || "Visitante ainda nao vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imovel visitado",
          detail: selectedContract.propertyTitle || "Imovel ainda nao vinculado.",
          done: Boolean(selectedContract.propertyTitle),
        },
        {
          label: "Data e hora",
          detail:
            selectedContract.content.financial.startDate && selectedContract.content.financial.dueDate
              ? `${selectedContract.content.financial.startDate} / ${selectedContract.content.financial.dueDate}`
              : "Data ou hora da visita ainda nao informadas.",
          done: Boolean(selectedContract.content.financial.startDate && selectedContract.content.financial.dueDate),
        },
        {
          label: "Ciencia da intermediacao",
          detail:
            selectedContract.content.financial.validity || "Ciencia da intermediacao ainda nao registrada.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Declaracoes registradas",
          detail:
            selectedContract.content.financial.additionalConditions || "Declaracoes da visita ainda nao registradas.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Reserva") {
      return [
        {
          label: "Interessado validado",
          detail: selectedContract.leadName || "Interessado ainda nao vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Proprietario identificado",
          detail: selectedContractProperty?.ownerName || "Proprietario ainda nao identificado no imovel.",
          done: Boolean(selectedContractProperty?.ownerName),
        },
        {
          label: "Imovel validado",
          detail: selectedContract.propertyTitle || "Imovel ainda nao vinculado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Prazo e conversao",
          detail:
            selectedContract.content.financial.validity && selectedContract.content.financial.dueDate
              ? `${selectedContract.content.financial.validity} • ${selectedContract.content.financial.dueDate}`
              : "Prazo e conversao da reserva ainda exigem confirmacao.",
          done: Boolean(selectedContract.content.financial.validity && selectedContract.content.financial.dueDate),
        },
        {
          label: "Condicoes registradas",
          detail:
            selectedContract.content.financial.additionalConditions || "Condicoes da reserva ainda nao registradas.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Aditivo") {
      return [
        {
          label: "Contrato original referenciado",
          detail: selectedContract.content.financial.paymentMethod || "Referencia do contrato original ainda nao informada.",
          done: Boolean(selectedContract.content.financial.paymentMethod),
        },
        {
          label: "Cliente validado",
          detail: selectedContract.leadName || "Cliente vinculado ainda nao selecionado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imovel validado",
          detail: selectedContract.propertyTitle || "Imovel vinculado ainda nao selecionado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Clausulas modificadas",
          detail: selectedContract.content.financial.validity || "Clausulas alteradas ainda nao registradas.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Vigencia e foro",
          detail:
            selectedContract.content.financial.startDate &&
            selectedContract.content.financial.endDate &&
            selectedContract.content.financial.dueDate
              ? `${selectedContract.content.financial.startDate} • ${selectedContract.content.financial.endDate} • ${selectedContract.content.financial.dueDate}`
              : "Vigencia ou foro ainda exigem confirmacao.",
          done: Boolean(
            selectedContract.content.financial.startDate &&
              selectedContract.content.financial.endDate &&
              selectedContract.content.financial.dueDate,
          ),
        },
      ]
    }

    if (selectedContract.kind === "Distrato") {
      return [
        {
          label: "Contrato original referenciado",
          detail: selectedContract.content.financial.paymentMethod || "Referencia do contrato original ainda nao informada.",
          done: Boolean(selectedContract.content.financial.paymentMethod),
        },
        {
          label: "Cliente validado",
          detail: selectedContract.leadName || "Cliente vinculado ainda nao selecionado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imovel validado",
          detail: selectedContract.propertyTitle || "Imovel vinculado ainda nao selecionado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Quitacao definida",
          detail: selectedContract.content.financial.validity || "Quitacao ainda nao registrada.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Obrigacoes remanescentes",
          detail:
            selectedContract.content.financial.guaranteeType || "Obrigacoes remanescentes ainda nao registradas.",
          done: Boolean(selectedContract.content.financial.guaranteeType),
        },
      ]
    }

    return [
      {
        label: "Cliente validado",
        detail: selectedContract.leadName || "Cliente ainda nao vinculado.",
        done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
      },
      {
        label: "Matrícula",
        detail: selectedContractProperty?.legal.registryNumber || "Matrícula pendente.",
        done: Boolean(selectedContractProperty?.legal.registryNumber),
      },
      {
        label: "Valor confirmado",
        detail: selectedContract.amountLabel || "Valor negociado ainda nao informado.",
        done: Boolean(selectedContract.amountLabel),
      },
      {
        label: "Cartório",
        detail: selectedContractProperty?.legal.registryOffice || "Cartório nao informado.",
        done: Boolean(selectedContractProperty?.legal.registryOffice),
      },
      {
        label: "Documento consistente",
        detail:
          selectedContract.content.reviewNotes[0] ||
          "Revisao estruturada pronta para acompanhamento automatico.",
        done: selectedContract.content.reviewNotes.length > 0,
      },
    ]
  }, [
    selectedContract,
    selectedContractLead?.identification.cpfCnpj,
    selectedContractProperty?.legal.registryNumber,
    selectedContractProperty?.legal.registryOffice,
    selectedContractProperty?.ownerName,
  ])

  const negotiationChecks = useMemo(() => {
    return [
      {
        label: "Modelo",
        detail: draft.kind,
        done: Boolean(draft.kind),
      },
      {
        label: "Cliente",
        detail: selectedLead?.name || "Selecione um cliente",
        done: Boolean(selectedLead),
      },
      {
        label: "Imovel",
        detail: selectedProperty?.title || "Selecione um imovel",
        done: Boolean(selectedProperty),
      },
      {
        label: "Valor negociado",
        detail: draft.amount || "Defina a condicao comercial",
        done: Boolean(draft.amount.trim()),
      },
      {
        label: "Comissao",
        detail:
          parsePercentInput(draft.commissionPercent) !== null
            ? `${formatPercentInput(draft.commissionPercent)}%`
            : "Defina a comissao",
        done: parsePercentInput(draft.commissionPercent) !== null,
      },
    ]
  }, [draft.amount, draft.commissionPercent, draft.kind, selectedLead, selectedProperty])

  function openCreateDialog() {
    setEditingId(null)
    setDraft({ ...emptyDraft })
    setTitleCustomized(false)
    setAmountCustomized(false)
    setCommissionCustomized(false)
    setAmendmentReferenceCustomized(false)
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
      paymentMethod: contract.content.financial.paymentMethod ?? "",
      guaranteeType: contract.content.financial.guaranteeType ?? "",
      inspectionReport: contract.content.financial.inspectionReport ?? "",
      commercialPurpose: contract.content.financial.commercialPurpose ?? "",
      adjustmentTerm: contract.content.financial.adjustmentTerm ?? "",
      worksScope: contract.content.financial.worksScope ?? "",
      fitOutScope: contract.content.financial.fitOutScope ?? "",
      additionalConditions: contract.content.financial.additionalConditions ?? "",
      clausesText: contract.content.clauses.join("\n"),
      reviewNotesText: contract.content.reviewNotes.join("\n"),
      status: contract.status,
    })
    setTitleCustomized(true)
    setAmountCustomized(Boolean(contract.content.financial.amountLabel))
    setCommissionCustomized(Boolean(contract.content.financial.commissionPercent))
    setAmendmentReferenceCustomized(Boolean(contract.content.financial.paymentMethod))
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

  function openWorkspaceRoute(route: string) {
    window.open(route, "_blank", "noopener,noreferrer")
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
      <Card className="overflow-hidden rounded-[2rem] border-black/[0.05] bg-white/92 py-0 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
        <CardHeader className="border-b border-black/[0.05] px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[42rem]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#9AA4B2]">Workspace de documentos</p>
              <CardTitle className="mt-2 flex items-center gap-2 text-[2rem] tracking-[-0.05em] text-[#050505]">
                <FileSignature className="size-5 text-[#009b3a]" />
                Contratos
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                Um workspace premium para negociar, revisar e assinar documentos com o preview sempre no centro da atencao.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[360px]">
              <div className="rounded-[1.15rem] bg-[#f8f8f5] px-4 py-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Rascunhos</p>
                <p className="mt-1.5 text-[1.6rem] font-semibold tracking-[-0.05em] text-[#050505]">{overview.drafts}</p>
              </div>
              <div className="rounded-[1.15rem] bg-[#f8f8f5] px-4 py-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Em andamento</p>
                <p className="mt-1.5 text-[1.6rem] font-semibold tracking-[-0.05em] text-[#050505]">{overview.awaiting}</p>
              </div>
              <div className="rounded-[1.15rem] bg-[#f8f8f5] px-4 py-3.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Assinados</p>
                <p className="mt-1.5 text-[1.6rem] font-semibold tracking-[-0.05em] text-[#050505]">{overview.signed}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 p-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B95A1]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por titulo, cliente, imovel ou resumo"
                  className="h-11 rounded-xl border-black/[0.06] bg-[#fbfbf8] pl-10 text-[#050505]"
                />
              </div>

              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as "all" | ContractType)}
                className="h-11 rounded-xl border border-black/[0.06] bg-[#fbfbf8] px-3 text-[#050505]"
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
              className="h-11 rounded-xl bg-[#009b3a] px-4 text-white shadow-[0_10px_24px_rgba(0,155,58,0.18)] hover:bg-[#008633]"
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
                    ? "border-[#009b3a]/20 bg-[#edf8f1] text-[#009b3a]"
                    : "border-black/[0.05] bg-[#fbfbf8] text-[#5F6B7A] hover:bg-[#f6f7f4]"
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

          <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
            <div className="min-h-0">
              {isLoading ? (
                <Card className="rounded-[1.5rem] border-black/[0.06] bg-white/90">
                  <CardContent className="p-5">
                    <EmeLoading compact message="Carregando contratos..." />
                  </CardContent>
                </Card>
              ) : contractsList.length > 0 ? (
                <div className="grid max-h-[calc(100vh-22rem)] gap-2.5 overflow-y-auto pr-1">
                  {contractsList.map((contract) => (
                    <button
                      key={contract.id}
                      type="button"
                      onClick={() => setSelectedId(contract.id)}
                      className={`rounded-[1.35rem] border px-4 py-3.5 text-left transition ${
                        selectedContract?.id === contract.id
                          ? "border-[#009b3a]/22 bg-[#f5fbf7] shadow-[0_12px_26px_rgba(0,155,58,0.08)]"
                          : "border-black/[0.05] bg-[#fcfcfa] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${getContractStatusTone(contract.status)}`}
                        >
                          {getContractStatusLabel(contract.status)}
                        </span>
                        <span className="text-xs text-[#9AA4B2]">{new Intl.DateTimeFormat("pt-BR").format(new Date(contract.updatedAt))}</span>
                      </div>

                      <p className="mt-3 line-clamp-2 text-[0.95rem] font-semibold leading-6 text-[#050505]">
                        {contract.title}
                      </p>

                      <div className="mt-3 grid gap-1.5 text-sm text-[#667085]">
                        <p className="truncate">{contract.leadName || "Cliente nao vinculado"}</p>
                        <p className="truncate">{contract.propertyTitle || "Imovel nao vinculado"}</p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-[#111111]">{contract.amountLabel || "Valor pendente"}</span>
                        <span className="text-[#9AA4B2]">{formatDateTime(contract.updatedAt).slice(0, 10)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                  Nenhum contrato encontrado. Crie o primeiro rascunho para iniciar o fluxo de revisao e assinatura.
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="grid gap-4">
                <div className="flex flex-col gap-3 border-b border-black/[0.05] pb-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <CardTitle className="text-[1.8rem] tracking-[-0.05em] text-[#050505]">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`w-fit rounded-full border px-3 py-1.5 text-sm font-medium ${getContractStatusTone(
                          selectedContract.status,
                        )}`}
                      >
                        {getContractStatusLabel(selectedContract.status)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openEditDialog(selectedContract)}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white text-[#111111] hover:bg-white"
                      >
                        <PencilLine className="size-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        onClick={exportPdf}
                        className="h-10 rounded-xl bg-[#111111] px-4 text-white hover:bg-[#050505]"
                      >
                        <Download className="size-4" />
                        Gerar PDF
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void updateContractStatus("signed")}
                        className="h-10 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]"
                      >
                        <CheckCheck className="size-4" />
                        Assinar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5">
                {selectedContract ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <PreviewInfo label="Cliente" value={selectedContract.leadName} />
                      <PreviewInfo label="Imovel" value={selectedContract.propertyTitle} />
                      <PreviewInfo label="Valor" value={selectedContract.amountLabel} />
                      <PreviewInfo label="Modelo" value={selectedContract.kind} />
                    </div>

                    <div className="grid gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Preview do documento</p>
                          <p className="mt-1 text-sm text-[#5F6B7A]">
                            A folha A4 permanece no centro enquanto a negociacao e as validacoes acompanham o contrato.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void duplicateContract(selectedContract.id)}
                            className="h-10 rounded-xl border border-black/[0.06] bg-white text-[#4B5563] hover:bg-white"
                          >
                            <CopyPlus className="size-4" />
                            Duplicar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void updateContractStatus("awaiting_signature")}
                            className="h-10 rounded-xl border border-black/[0.06] bg-white text-[#4B5563] hover:bg-white"
                          >
                            <Send className="size-4" />
                            Enviar
                          </Button>
                        </div>
                      </div>

                      <div className="aspect-[210/297] overflow-hidden rounded-[1.6rem] bg-[#f3f3ef] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] sm:p-4">
                        <div className="h-full overflow-hidden rounded-[1.25rem] bg-white shadow-[0_24px_50px_rgba(15,23,42,0.08)]">
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
                    </div>
                  </>
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                    Escolha um contrato para revisar detalhes, atualizar status, abrir o editor inteligente ou gerar PDF.
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0">
              {selectedContract ? (
                <div className="grid gap-4">
                  <section className="rounded-[1.7rem] border border-black/[0.05] bg-[#fbfbf8] p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Painel contextual</p>
                    <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.04em] text-[#050505]">
                      Saude deste contrato
                    </h3>
                    <div className="mt-5 rounded-[1.35rem] bg-white px-4 py-4">
                      <p className="text-[2.25rem] font-semibold tracking-[-0.06em] text-[#050505]">
                        {contractHealthScore}%
                      </p>
                      <div className="mt-3 h-2 rounded-full bg-black/[0.06]">
                        <div className="h-full rounded-full bg-[#009b3a]" style={{ width: `${contractHealthScore}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {contractHealthIndicators.map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-[1rem] bg-white px-3.5 py-3">
                          <span className="text-sm text-[#4B5563]">{item.label}</span>
                          <span className="text-sm font-semibold text-[#050505]">{item.score}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 border-t border-black/[0.06] pt-5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Pendencias</p>
                      <div className="mt-3 grid gap-2">
                        {contractPendingHighlights.length > 0 ? (
                          contractPendingHighlights.map((item) => (
                            <div key={item} className="flex items-start gap-2 text-sm leading-6 text-[#5F6B7A]">
                              <span className="mt-2 size-1.5 rounded-full bg-[#c58917]" />
                              <span>{item}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-start gap-2 text-sm leading-6 text-[#5F6B7A]">
                            <CheckCircle2 className="mt-0.5 size-4 text-[#009b3a]" />
                            <span>Sem pendencias estruturais neste momento.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-5 h-10 w-full rounded-xl border border-black/[0.06] bg-white text-[#111111] hover:bg-white"
                    >
                      <Sparkles className="size-4" />
                      Conversar com o COS
                    </Button>
                  </section>

                  <section className="rounded-[1.7rem] border border-black/[0.05] bg-white p-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Validacao automatica</p>
                      <h3 className="mt-3 text-base font-semibold text-[#050505]">Revisao contextual</h3>
                    </div>
                    <div className="mt-4 grid gap-2.5">
                      {contractValidationItems.map((item) => (
                        <div key={item.label} className="rounded-[1rem] bg-[#fbfbf8] px-3.5 py-3">
                          <div className="flex items-start gap-3">
                            {item.done ? (
                              <CheckCircle2 className="mt-0.5 size-4 text-[#009b3a]" />
                            ) : (
                              <AlertCircle className="mt-0.5 size-4 text-[#c58917]" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-[#050505]">{item.label}</p>
                              <p className="mt-1 text-sm leading-6 text-[#6B7280]">{item.detail}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.7rem] border border-black/[0.05] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Notas de revisao</p>
                        <h3 className="mt-3 text-base font-semibold text-[#050505]">Checklist juridico e comercial</h3>
                      </div>
                      <span className="rounded-full bg-[#f5fbf7] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[#009b3a]">
                        {selectedContract.content.reviewNotes.length || 0} itens
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {selectedContract.content.reviewNotes.length > 0 ? (
                        selectedContract.content.reviewNotes.slice(0, 5).map((item) => (
                          <div key={item} className="rounded-[1rem] bg-[#fbfbf8] px-3.5 py-3 text-sm leading-6 text-[#4B5563]">
                            {item}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1rem] bg-[#fbfbf8] px-3.5 py-3 text-sm leading-6 text-[#6B7280]">
                          Este contrato ainda nao possui notas de revisao registradas.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void updateContractStatus("cancelled")}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white text-[#D14343] hover:bg-white"
                      >
                        <XCircle className="size-4" />
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void deleteContract(selectedContract.id)}
                        className="h-10 rounded-xl border border-black/[0.06] bg-white text-[#D14343] hover:bg-white"
                      >
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                  Selecione um contrato para visualizar saude, validacoes e pendencias deste workspace.
                </div>
              )}
            </div>
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
                    <p className="text-sm text-[#6B7280]">O contrato consome dados do cliente, do imovel e do corretor.</p>
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
                      placeholder="Titulo da negociacao"
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
                  <p className="text-sm text-[#6B7280]">
                    Somente os dados especificos desta negociacao ficam no contrato. O restante vem das entidades.
                  </p>
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

                    if (field.type === "text") {
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
                              if ((isAmendment(draft.kind) || isTermination(draft.kind)) && field.key === "paymentMethod") {
                                setAmendmentReferenceCustomized(true)
                              }
                              updateDraftField(field.key, event.target.value)
                            }}
                            placeholder={field.placeholder}
                            className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                          />
                          {field.hint ? <p className="text-xs text-[#8B95A1]">{field.hint}</p> : null}
                        </label>
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
                  <p className="text-sm font-semibold text-[#050505]">Pendencias das entidades</p>
                  <p className="text-sm text-[#6B7280]">
                    {pendingSummary.pendingCount
                      ? `Faltam ${pendingSummary.pendingCount} informacoes nas fontes oficiais.`
                      : "Todas as fontes principais estao completas para este contrato."}
                  </p>
                </div>

                <div className="grid gap-3">
                  {workspaceSections.map((section) => (
                    <div
                      key={section.key}
                      className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#050505]">{section.title}</p>
                          <p className="mt-1 text-sm text-[#6B7280]">{section.summary}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => openWorkspaceRoute(section.route)}
                          className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-xs text-[#4B5563] hover:bg-white"
                        >
                          {section.actionLabel}
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#edf7ef] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[#009b3a]">
                          {section.completedCount} completos
                        </span>
                        {section.pendingCount ? (
                          <span className="rounded-full bg-[#fff4dc] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[#c58917]">
                            {section.pendingCount} pendentes
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-2">
                        {section.items.map((item) => (
                          <button
                            key={`${section.key}-${item.label}`}
                            type="button"
                            onClick={() => openWorkspaceRoute(section.route)}
                            className="flex items-center justify-between rounded-[0.95rem] border border-black/[0.05] bg-white px-3 py-2 text-left transition hover:border-[#009b3a]/18 hover:bg-[#f8fbf8]"
                          >
                            <span className="text-sm text-[#050505]">{item.label}</span>
                            <span className="inline-flex items-center gap-2 text-xs text-[#6B7280]">
                              {item.done ? (
                                <>
                                  <CheckCircle2 className="size-3.5 text-[#009b3a]" />
                                  Completo
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="size-3.5 text-[#c58917]" />
                                  Pendente
                                </>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                <div>
                  <p className="text-sm font-semibold text-[#050505]">Workspace da negociacao</p>
                  <p className="text-sm text-[#6B7280]">Centro limpo para revisar o documento e direita reservada para pendencias, comentarios e COS.</p>
                </div>

                <div className="rounded-[1rem] border border-black/[0.05] bg-[#fbfbf8] p-4 text-sm leading-6 text-[#5F6B7A]">
                  O preview nunca mostra placeholders tecnicos nem “Nao informado”. Quando faltar dado estrutural, a pendencia aparece aqui e a correcao acontece na entidade de origem.
                </div>
                <div className="grid gap-2">
                  {negotiationChecks.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-[1rem] border px-3 py-2 ${
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
                <div className="rounded-[1rem] border border-dashed border-black/[0.08] bg-[#fcfcfa] p-4 text-sm leading-6 text-[#6B7280]">
                  Futuro painel do COS: comentarios contextuais, validacoes juridicas e abertura orientada das entidades que ainda precisarem de complemento.
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

function scoreSection<T extends { done: boolean }>(items: T[]) {
  if (items.length === 0) return 100
  const completed = items.filter((item) => item.done).length
  return Math.round((completed / items.length) * 100)
}
