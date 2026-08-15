"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  CopyPlus,
  Download,
  ExternalLink,
  FilePenLine,
  FileSignature,
  FileUp,
  PencilLine,
  Paperclip,
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
import { StructuredInput } from "@/components/ui/structured-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { parseCurrencyInputToCents } from "@/lib/currency"
import { formatDateBR, formatPercentInput, parseBrazilianDate, parsePercentInput } from "@/lib/structured-fields"
import { subscribeEntitySync } from "@/lib/entity-sync"
import {
  createContractContent,
  type ContractStatus,
  contractTypeOptions,
  creatableContractTypeOptions,
  type ContractType,
} from "@/lib/contract-template"
import {
  contractStatusOptions,
  contracts,
  getContractStatusLabel,
  getContractStatusTone,
  type ContractAttachmentUpdateDraft,
  type ContractAttachmentDraft,
  type ContractDraft,
  type ContractFilterStatus,
  type ContractRecord,
} from "@/lib/contracts-client"
import type { LeadRecord } from "@/lib/lead-contract"
import type { PropertyApiItem } from "@/lib/property-contract"
import { templateContracts } from "@/lib/contract-template-client"

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

type ContractAttachmentForm = {
  leadId: string
  propertyId: string
  kind: ContractType
  title: string
  notes: string
  status: ContractStatus
}

const emptyAttachmentDraft: ContractAttachmentForm = {
  leadId: "",
  propertyId: "",
  kind: contractTypeOptions[0],
  title: "",
  notes: "",
  status: "draft",
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

function getContractHealthTone(score: number) {
  if (score >= 70) return "bg-[#edf7ef] text-[#009b3a]"
  if (score >= 40) return "bg-[#fff4dc] text-[#c58917]"
  return "bg-[#fdecec] text-[#d14343]"
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

function isExternalContract(contract: ContractRecord | null | undefined) {
  return contract?.content.source === "external" && Boolean(contract.content.attachment?.fileUrl)
}

function buildAttachedContractRoute(contractId: string, download = false) {
  return `/api/brokers/contracts/${contractId}/file${download ? "?download=1" : ""}`
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
  const commission = draft.commissionPercent ? `${formatPercentInput(draft.commissionPercent, { suffix: false })}%` : ""
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
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary: property?.ownerName || "Vincule um imóvel com locador definido para iniciar a minuta.",
        items: [
          { label: "Nome", value: property?.ownerName || "" },
          { label: "Imóvel vinculado", value: property?.title || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
        ],
      },
      {
        key: "client",
        title: "Locatário",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary: lead?.name || "Selecione um locatário para compor o contrato.",
        items: [
          { label: "Nome", value: lead?.name || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Estado civil", value: lead?.identification.maritalStatus || "" },
          { label: "Profissão", value: lead?.identification.profession || "" },
          { label: "Endereço", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: isCommercialLease(kind) ? "Imóvel comercial" : "Imóvel",
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary:
          property?.title ||
          (isCommercialLease(kind)
            ? "Selecione um imóvel comercial para alimentar a locação."
            : "Selecione um imóvel para alimentar a locação residencial."),
        items: [
          { label: "Título", value: property?.title || "" },
          { label: "Endereço", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "CEP", value: property?.legal.cep || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
          { label: "Cartório", value: property?.legal.registryOffice || "" },
          { label: "Valor anunciado", value: property?.formattedPrice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliária",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediação pode ser vinculada a uma imobiliária quando disponível.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsável", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda não carregados.",
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
        title: "Proprietário",
        route: lead ? `/corretor/clientes/${lead.id}` : "/corretor/clientes",
        actionLabel: "Editar cliente",
        summary:
          lead?.name ||
          property?.ownerName ||
          (isExclusivity(kind)
            ? "Selecione o proprietário para compor o contrato de exclusividade."
            : "Selecione o proprietário para compor a autorização."),
        items: [
          { label: "Nome", value: lead?.name || property?.ownerName || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Estado civil", value: lead?.identification.maritalStatus || "" },
          { label: "Profissão", value: lead?.identification.profession || "" },
          { label: "Endereço", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imóvel",
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary:
          property?.title ||
          (isExclusivity(kind)
            ? "Selecione um imóvel para alimentar o contrato de exclusividade."
            : "Selecione um imóvel para alimentar a autorização de venda."),
        items: [
          { label: "Título", value: property?.title || "" },
          { label: "Endereço", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
          { label: "Cartório", value: property?.legal.registryOffice || "" },
          { label: "Valor anunciado", value: property?.formattedPrice || "" },
          { label: "Proprietário no imóvel", value: property?.ownerName || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliária",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediação pode ser vinculada a uma imobiliária quando disponível.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsável", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda não carregados.",
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
        summary: lead?.name || "Selecione o interessado para compor a reserva do imóvel.",
        items: [
          { label: "Nome", value: lead?.name || "" },
          { label: "Telefone", value: lead?.whatsApp || lead?.phone || "" },
          { label: "E-mail", value: lead?.email || "" },
          { label: "CPF", value: lead?.identification.cpfCnpj || "" },
          { label: "RG", value: lead?.identification.rg || "" },
          { label: "Estado civil", value: lead?.identification.maritalStatus || "" },
          { label: "Profissão", value: lead?.identification.profession || "" },
          { label: "Endereço", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "owner",
        title: "Proprietário",
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary: property?.ownerName || "Vincule um imóvel com proprietário identificado para formalizar a reserva.",
        items: [
          { label: "Nome", value: property?.ownerName || "" },
          { label: "Imóvel vinculado", value: property?.title || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
        ],
      },
      {
        key: "property",
        title: "Imóvel",
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary: property?.title || "Selecione um imóvel para alimentar a reserva.",
        items: [
          { label: "Título", value: property?.title || "" },
          { label: "Endereço", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "CEP", value: property?.legal.cep || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
          { label: "Cartório", value: property?.legal.registryOffice || "" },
          { label: "Valor anunciado", value: property?.formattedPrice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliária",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediação pode ser vinculada a uma imobiliária quando disponível.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsável", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda não carregados.",
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
          { label: "Endereço", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imóvel do contrato original",
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary: property?.title || "Selecione o imóvel vinculado ao contrato que será aditado.",
        items: [
          { label: "Título", value: property?.title || "" },
          { label: "Endereço", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
          { label: "Cartório", value: property?.legal.registryOffice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliária",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediação pode ser vinculada a uma imobiliária quando disponível.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsável", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda não carregados.",
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
          { label: "Endereço", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imóvel do contrato original",
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary: property?.title || "Selecione o imóvel vinculado ao contrato que será encerrado.",
        items: [
          { label: "Título", value: property?.title || "" },
          { label: "Endereço", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
          { label: "Cartório", value: property?.legal.registryOffice || "" },
        ],
      },
      {
        key: "agency",
        title: "Imobiliária",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.agencyName || "A intermediação pode ser vinculada a uma imobiliária quando disponível.",
        items: [
          { label: "Nome", value: broker?.agencyName || "" },
          { label: "Corretor responsável", value: broker?.name || "" },
          { label: "CRECI", value: broker?.creci || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda não carregados.",
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
          { label: "Endereço", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
        ],
      },
      {
        key: "property",
        title: "Imóvel visitado",
        route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
        actionLabel: "Editar imóvel",
        summary: property?.title || "Selecione o imóvel para registrar a visita.",
        items: [
          { label: "Título", value: property?.title || "" },
          { label: "Endereço", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
          { label: "Bairro", value: property?.neighborhood || "" },
          { label: "Cidade", value: property?.legal.city || property?.city || "" },
          { label: "CEP", value: property?.legal.cep || "" },
          { label: "Matrícula", value: property?.legal.registryNumber || "" },
        ],
      },
      {
        key: "broker",
        title: "Corretor",
        route: "/corretor/conta",
        actionLabel: "Editar corretor",
        summary: broker?.name || "Dados do corretor ainda não carregados.",
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
        { label: "Profissão", value: lead?.identification.profession || "" },
        { label: "Endereço", value: [lead?.address.street, lead?.address.number, lead?.address.city].filter(Boolean).join(", ") },
      ],
    },
    {
      key: "property",
      title: "Imóvel",
      route: property ? `/corretor/imóveis/${property.id}` : "/corretor/imóveis",
      actionLabel: "Editar imóvel",
      summary: property?.title || "Selecione um imóvel para alimentar o documento.",
      items: [
        { label: "Título", value: property?.title || "" },
        { label: "Cidade", value: property?.legal.city || property?.city || "" },
        { label: "Bairro", value: property?.neighborhood || "" },
        { label: "Valor anunciado", value: property?.formattedPrice || "" },
        { label: "Matrícula", value: property?.legal.registryNumber || "" },
        { label: "Área privativa", value: property?.legal.privateArea || "" },
        { label: "Cartório", value: property?.legal.registryOffice || "" },
        { label: "CEP", value: property?.legal.cep || "" },
        { label: "Endereço", value: [property?.legal.street, property?.legal.number].filter(Boolean).join(", ") },
        { label: "Proprietário / vendedor", value: property?.ownerName || "" },
      ],
    },
    {
      key: "broker",
      title: "Corretor",
      route: "/corretor/conta",
      actionLabel: "Editar corretor",
      summary: broker?.name || "Dados do corretor ainda não carregados.",
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
        hint: "Valor preenchido automaticamente pelo imóvel.",
      },
      {
        id: "commercial.commission",
        key: "commissionPercent",
        label: "Comissão da intermediação (opcional)",
        type: "percent",
        placeholder: "0",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Início",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Término",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.term",
        key: "validity",
        label: "Prazo da locação",
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
        placeholder: "Pix, boleto ou transferência",
      },
      {
        id: "commercial.guaranteeType",
        key: "guaranteeType",
        label: "Garantia",
        type: "text",
        placeholder: "Caução, fiador, seguro fiança...",
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
        label: "Encargos e observações (opcional)",
        type: "textarea",
        placeholder: "IPTU por conta do locatário. Entrega das chaves apos vistoria final.",
        examples: [
          "Condomínio e consumo por conta do locatário.",
          "Reajuste anual pelo índice contratual.",
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
        hint: "Valor preenchido automaticamente pelo imóvel.",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Início",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Término",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.term",
        key: "validity",
        label: "Prazo da locação",
        type: "text",
        placeholder: "60 meses",
      },
      {
        id: "commercial.purpose",
        key: "commercialPurpose",
        label: "Finalidade comercial",
        type: "text",
        placeholder: "Loja, clínica, escritório, operação varejista...",
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
        placeholder: "Boleto, pix, transferência...",
      },
      {
        id: "commercial.adjustmentTerm",
        key: "adjustmentTerm",
        label: "Reajuste",
        type: "text",
        placeholder: "Anual pelo índice contratual",
      },
      {
        id: "commercial.guaranteeType",
        key: "guaranteeType",
        label: "Garantia",
        type: "text",
        placeholder: "Fianca, caução, seguro fiança...",
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
        placeholder: "Obras estruturais, prazo, responsabilidade financeira e autorizações.",
        examples: [
          "Adequação elétrica sob responsabilidade do locatário.",
          "Obras estruturais somente com autorização prévia do locador.",
        ],
      },
      {
        id: "commercial.fitOut",
        key: "fitOutScope",
        label: "Adequações",
        type: "textarea",
        placeholder: "Layout, fachada, climatização, acessibilidade e demais adequações do ponto.",
        examples: [
          "Fachada aprovada previamente pelo locador e condomínio.",
          "Instalações internas conforme atividade licenciada.",
        ],
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Encargos e observações (opcional)",
        type: "textarea",
        placeholder: "IPTU, condomínio, taxas operacionais e condições especiais da locação.",
        examples: [
          "IPTU e condomínio por conta do locatário.",
          "Taxas de licenciamento operacional sob responsabilidade do locatário.",
          "Repasses extraordinarios dependem de aprovação expressa.",
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
        hint: "Valor preenchido automaticamente pelo imóvel.",
      },
      {
        id: "commercial.commission",
        key: "commissionPercent",
        label: "Comissão",
        type: "percent",
        placeholder: "0",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Início",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Término",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.validity",
        key: "validity",
        label: "Prazo da autorização",
        type: "text",
        placeholder: "90 dias",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Condições da intermediação",
        type: "textarea",
        placeholder: "Escopo da captação, formato das visitas, divulgação e regras comerciais.",
        examples: [
          "Visitas somente com agendamento previo.",
          "Divulgação autorizada nos canais digitais do corretor e da imobiliária.",
          "Negociações devem respeitar o valor autorizado e a comissão pactuada.",
        ],
      },
    ]
  }

  if (kind === "Exclusividade") {
    return [
      {
        id: "commercial.value",
        key: "amount",
        label: "Valor de referência",
        type: "currency",
        placeholder: "R$ 0,00",
        hint: "Valor preenchido automaticamente pelo imóvel.",
      },
      {
        id: "commercial.commission",
        key: "commissionPercent",
        label: "Comissão",
        type: "percent",
        placeholder: "0",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Início",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Término",
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
        label: "Direitos e obrigações",
        type: "textarea",
        placeholder: "Escopo da exclusividade, divulgação autorizada, visitas e regras comerciais.",
        examples: [
          "Captação exclusiva durante todo o prazo contratado.",
          "Visitas somente com acompanhamento do corretor responsável.",
          "Negociações devem observar a comissão e o valor de referência pactuados.",
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
        label: "Ciência da intermediação",
        type: "text",
        placeholder: "Visitante ciente da intermediação do corretor.",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Declarações",
        type: "textarea",
        placeholder: "Declarações complementares sobre a visita realizada.",
        examples: [
          "Visitante conheceu o imóvel por intermédio do corretor.",
          "Visitante ciente da intermediação para eventual proposta futura.",
        ],
      },
    ]
  }

  if (kind === "Aditivo") {
    return [
      {
        id: "commercial.originalContract",
        key: "paymentMethod",
        label: "Referência ao contrato original",
        type: "text",
        placeholder: "Contrato original vinculado ao cliente e ao imóvel.",
        hint: "Preenchido automaticamente a partir do cliente e do imóvel selecionados.",
      },
      {
        id: "commercial.changes",
        key: "additionalConditions",
        label: "Alterações",
        type: "textarea",
        placeholder: "Descreva exatamente o que esta sendo ajustado neste aditivo.",
        examples: [
          "Prorrogação do prazo originalmente pactuado.",
          "Atualização do valor e da forma de pagamento.",
          "Inclusão de nova condição comercial acordada entre as partes.",
        ],
      },
      {
        id: "commercial.modifiedClauses",
        key: "validity",
        label: "Cláusulas modificadas",
        type: "text",
        placeholder: "Ex.: Cláusulas 3, 5 e 8.",
      },
      {
        id: "commercial.startDate",
        key: "startDate",
        label: "Vigência inicial",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.endDate",
        key: "endDate",
        label: "Vigência final",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.forum",
        key: "dueDate",
        label: "Foro",
        type: "text",
        placeholder: "Comarca aplicável ao aditivo.",
      },
    ]
  }

  if (kind === "Distrato") {
    return [
      {
        id: "commercial.originalContract",
        key: "paymentMethod",
        label: "Referência ao contrato original",
        type: "text",
        placeholder: "Contrato original vinculado ao cliente e ao imóvel.",
        hint: "Preenchido automaticamente a partir do cliente e do imóvel selecionados.",
      },
      {
        id: "commercial.terminationReason",
        key: "additionalConditions",
        label: "Motivo do encerramento",
        type: "textarea",
        placeholder: "Descreva o motivo do encerramento e o contexto do distrato.",
        examples: [
          "Encerramento consensual por alteração de estrategia comercial.",
          "Rescisão amigavel por impossibilidade de continuidade da negociação.",
          "Distrato firmado apos acordo integral entre as partes.",
        ],
      },
      {
        id: "commercial.release",
        key: "validity",
        label: "Quitação",
        type: "text",
        placeholder: "Ex.: Quitação plena entre as partes.",
      },
      {
        id: "commercial.remainingObligations",
        key: "guaranteeType",
        label: "Obrigações remanescentes",
        type: "text",
        placeholder: "Ex.: Devolução de documentos, pagamentos pendentes, entrega de chaves.",
      },
      {
        id: "commercial.forum",
        key: "dueDate",
        label: "Foro",
        type: "text",
        placeholder: "Comarca aplicável ao distrato.",
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
        label: "Início da reserva",
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
        label: "Conversão ate",
        type: "date",
        placeholder: "dd/mm/aaaa",
      },
      {
        id: "commercial.notes",
        key: "additionalConditions",
        label: "Condições da reserva",
        type: "textarea",
        placeholder: "Sinal, analise documental, aprovação financeira e demais condições comerciais.",
        examples: [
          "Reserva condicionada a analise documental do imóvel.",
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
      label: "Valor do imóvel",
      type: "currency",
      placeholder: "R$ 0,00",
      hint: "Valor preenchido automaticamente pelo imóvel.",
    },
    {
      id: "commercial.commission",
      key: "commissionPercent",
      label: "Comissão",
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
      label: "Observações comerciais (opcional)",
      type: "textarea",
      placeholder: "Entrada negociada diretamente.",
      examples: [
        "Entrada negociada diretamente.",
        "Utilização de FGTS.",
        "Entrega apos quitação.",
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
    <div className="min-w-0 rounded-[1.05rem] border border-black/[0.045] bg-[#fcfcfa] px-3.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-[#8B95A1]">{label}</p>
      <p className="mt-1.5 truncate text-[0.92rem] font-medium text-[#050505]">{value || "—"}</p>
    </div>
  )
}

function CommercialDateField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const selectedDate = parseBrazilianDate(value)

  return (
    <label className="grid gap-2 text-sm text-[#5F6B7A]">
      <span>{label}</span>
      <Popover>
        <div className="flex gap-2">
          <StructuredInput
            kind="date"
            value={value}
            onValueChange={(nextValue) => onChange(nextValue)}
            placeholder={placeholder}
            autoComplete="bday"
            aria-label={label}
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
            onSelect={(date) => onChange(date ? formatDateBR(date) : "")}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </label>
  )
}

type BrokerContractsPageProps = {
  onNewTemplateContract?: () => void
  onImportTemplate?: () => void
  onOpenTemplateContract?: (instanceId: string) => void
}

export function BrokerContractsPage({
  onNewTemplateContract,
  onImportTemplate,
  onOpenTemplateContract,
}: BrokerContractsPageProps = {}) {
  const [contractsList, setContractsList] = useState<ContractRecord[]>([])
  const [availableKindFilters, setAvailableKindFilters] = useState<ContractType[]>([...creatableContractTypeOptions])
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
  const [isAttachDialogOpen, setIsAttachDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft)
  const [attachmentDraft, setAttachmentDraft] = useState<ContractAttachmentForm>(emptyAttachmentDraft)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
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
  const selectedContractIsExternal = useMemo(() => isExternalContract(selectedContract), [selectedContract])

  const loadContracts = useCallback(
    async (preferredId?: string | null) => {
      setIsLoading(true)
      setFeedback("")
      try {
        const { contracts: nextContracts, contractTypes: nextContractTypes } = await contracts.list({
          query,
          status,
          kind: kindFilter,
        })
        setContractsList(nextContracts)
        if (nextContractTypes.length > 0) setAvailableKindFilters(nextContractTypes)
        setSelectedId((current) => {
          const candidateId = preferredId ?? current
          if (candidateId && nextContracts.some((item) => item.id === candidateId)) {
            return candidateId
          }
          return nextContracts[0]?.id ?? null
        })
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Não foi possível carregar contratos.")
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
      ? "Valor preenchido automaticamente pelo imóvel."
      : "Selecione um imóvel para preencher o valor automaticamente."

  const commissionSourceLabel = commissionCustomized
    ? "Comissão personalizada."
    : financialConfig
      ? "Comissão preenchida automaticamente pela configuração do corretor."
      : "Comissão padrão do sistema."

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
    if (selectedContractIsExternal) {
      const fileScore = selectedContract?.content.attachment?.fileUrl ? 100 : 0
      const clientScore = selectedContract?.leadName ? 100 : 0
      const propertyScore = selectedContract?.propertyTitle ? 100 : 80
      const notesScore = selectedContract?.content.attachment?.notes ? 100 : 72
      const signatureScore =
        selectedContract?.status === "signed" || selectedContract?.status === "completed"
          ? 100
          : selectedContract?.status === "awaiting_signature"
            ? 80
            : 64

      return [
        { label: "Arquivo", score: fileScore },
        { label: "Cliente", score: clientScore },
        { label: "Imóvel", score: propertyScore },
        { label: "Modelo", score: selectedContract?.kind ? 100 : 0 },
        { label: "Contexto", score: notesScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

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
        label: "Laudo de vistoria",
        value: selectedContract?.content.financial.inspectionReport || "",
        done: Boolean(selectedContract?.content.financial.inspectionReport),
      },
      {
        label: "Notas de revisão",
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
        label: "Encargos e observações",
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
        label: "Conversão da reserva",
        value: selectedContract?.content.financial.dueDate || "",
        done: Boolean(selectedContract?.content.financial.dueDate),
      },
    ])
    const reservationConversionScore = scoreSection([
      {
        label: "Condições da reserva",
        value: selectedContract?.content.financial.additionalConditions || "",
        done: Boolean(selectedContract?.content.financial.additionalConditions),
      },
      {
        label: "Corretor responsável",
        value: brokerProfile?.name || "",
        done: Boolean(brokerProfile?.name),
      },
      {
        label: "Imobiliária",
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
        label: "Cláusulas modificadas",
        value: selectedContract?.content.financial.validity || "",
        done: Boolean(selectedContract?.content.financial.validity),
      },
      {
        label: "Alterações",
        value: selectedContract?.content.financial.additionalConditions || "",
        done: Boolean(selectedContract?.content.financial.additionalConditions),
      },
    ])
    const amendmentTermScore = scoreSection([
      {
        label: "Vigência inicial",
        value: selectedContract?.content.financial.startDate || "",
        done: Boolean(selectedContract?.content.financial.startDate),
      },
      {
        label: "Vigência final",
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
        label: "Quitação",
        value: selectedContract?.content.financial.validity || "",
        done: Boolean(selectedContract?.content.financial.validity),
      },
    ])
    const terminationSettlementScore = scoreSection([
      {
        label: "Obrigações remanescentes",
        value: selectedContract?.content.financial.guaranteeType || "",
        done: Boolean(selectedContract?.content.financial.guaranteeType),
      },
      {
        label: "Foro",
        value: selectedContract?.content.financial.dueDate || "",
        done: Boolean(selectedContract?.content.financial.dueDate),
      },
      {
        label: "Corretor responsável",
        value: brokerProfile?.name || "",
        done: Boolean(brokerProfile?.name),
      },
    ])

    if (selectedContract?.kind === "Locacao comercial") {
      return [
        { label: "Locador", score: landlordScore },
        { label: "Locatário", score: clientScore },
        { label: "Imóvel comercial", score: propertyScore },
        { label: "Financeiro", score: leaseFinancialScore },
        { label: "Garantias", score: guaranteeScore },
        { label: "Documentação", score: leaseDocumentationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Autorizacao de venda") {
      return [
        { label: "Proprietário", score: clientScore },
        { label: "Imóvel", score: propertyScore },
        { label: "Documentação", score: documentationScore },
        { label: "Intermediação", score: negotiationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Exclusividade") {
      return [
        { label: "Proprietário", score: clientScore },
        { label: "Imóvel", score: propertyScore },
        { label: "Documentação", score: documentationScore },
        { label: "Exclusividade", score: negotiationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Termo de visita") {
      return [
        { label: "Visitante", score: clientScore },
        { label: "Imóvel visitado", score: propertyScore },
        { label: "Documentação", score: documentationScore },
        { label: "Intermediação", score: negotiationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Reserva") {
      return [
        { label: "Interessado", score: clientScore },
        { label: "Proprietário", score: ownerScore },
        { label: "Imóvel", score: propertyScore },
        { label: "Financeiro", score: reservationFinancialScore },
        { label: "Conversão", score: reservationConversionScore },
        { label: "Documentação", score: documentationScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Aditivo") {
      return [
        { label: "Cliente", score: clientScore },
        { label: "Imóvel", score: propertyScore },
        { label: "Documentação", score: documentationScore },
        { label: "Contrato original", score: amendmentGovernanceScore },
        { label: "Vigência", score: amendmentTermScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Distrato") {
      return [
        { label: "Cliente", score: clientScore },
        { label: "Imóvel", score: propertyScore },
        { label: "Documentação", score: documentationScore },
        { label: "Contrato original", score: terminationGovernanceScore },
        { label: "Quitação", score: terminationSettlementScore },
        { label: "Assinaturas", score: signatureScore },
      ]
    }

    if (selectedContract?.kind === "Locacao residencial") {
      return [
        { label: "Locador", score: landlordScore },
        { label: "Locatário", score: clientScore },
        { label: "Imóvel", score: propertyScore },
        { label: "Financeiro", score: leaseFinancialScore },
        { label: "Garantias", score: guaranteeScore },
        { label: "Documentação", score: leaseDocumentationScore },
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
  }, [brokerProfile?.agencyName, brokerProfile?.name, selectedContract, selectedContractIsExternal, selectedContractProperty, selectedWorkspaceSections])

  const contractHealthScore = useMemo(() => {
    if (!selectedContract) return 0

    return Math.round(
      contractHealthIndicators.reduce((total, item) => total + item.score, 0) / contractHealthIndicators.length,
    )
  }, [contractHealthIndicators, selectedContract])

  const contractPendingHighlights = useMemo(() => {
    if (!selectedContract) return []
    if (selectedContractIsExternal) {
      return [
        !selectedContract.leadName ? "Cliente vinculado" : null,
        !selectedContract.content.attachment?.fileUrl ? "Arquivo do contrato" : null,
        !selectedContract.content.attachment?.mimeType ? "Tipo do documento" : null,
        !selectedContract.kind ? "Modelo do contrato" : null,
        selectedContract.status === "draft" ? "Fluxo de assinatura" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Locacao residencial") {
      return [
        !selectedContractProperty?.ownerName ? "Locador vinculado ao imóvel" : null,
        !selectedContractLead?.identification.rg ? "RG do locatário" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matrícula" : null,
        !selectedContract.content.financial.guaranteeType ? "Garantia locaticia" : null,
        !selectedContract.content.financial.inspectionReport ? "Laudo de vistoria" : null,
        selectedContract.status === "draft" ? "Fluxo de assinatura" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Locacao comercial") {
      return [
        !selectedContractProperty?.ownerName ? "Locador vinculado ao imóvel" : null,
        !selectedContract.content.financial.commercialPurpose ? "Finalidade comercial" : null,
        !selectedContract.content.financial.adjustmentTerm ? "Regra de reajuste" : null,
        !selectedContract.content.financial.guaranteeType ? "Garantia locaticia" : null,
        !selectedContract.content.financial.worksScope ? "Obras previstas" : null,
        !selectedContract.content.financial.fitOutScope ? "Adequações do ponto" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Autorizacao de venda") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do proprietário" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matrícula" : null,
        !selectedContract.amountLabel ? "Valor autorizado" : null,
        !selectedContract.content.financial.commissionPercent ? "Comissão" : null,
        !selectedContract.content.financial.additionalConditions ? "Condições da intermediação" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Exclusividade") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do proprietário" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matrícula" : null,
        !selectedContract.amountLabel ? "Valor de referência" : null,
        !selectedContract.content.financial.commissionPercent ? "Comissão" : null,
        !selectedContract.content.financial.validity ? "Prazo de exclusividade" : null,
        !selectedContract.content.financial.additionalConditions ? "Direitos e obrigações" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Termo de visita") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do visitante" : null,
        !selectedContractProperty?.title ? "Imóvel visitado" : null,
        !selectedContract.content.financial.startDate ? "Data da visita" : null,
        !selectedContract.content.financial.dueDate ? "Hora da visita" : null,
        !selectedContract.content.financial.validity ? "Ciência da intermediação" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Reserva") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do interessado" : null,
        !selectedContractProperty?.ownerName ? "Proprietário do imóvel" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matrícula" : null,
        !selectedContract.amountLabel ? "Valor da reserva" : null,
        !selectedContract.content.financial.validity ? "Prazo da reserva" : null,
        !selectedContract.content.financial.dueDate ? "Conversão da reserva" : null,
        !selectedContract.content.financial.additionalConditions ? "Condições da reserva" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Aditivo") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do cliente vinculado" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matrícula do imóvel" : null,
        !selectedContract.content.financial.paymentMethod ? "Referência do contrato original" : null,
        !selectedContract.content.financial.additionalConditions ? "Alterações do aditivo" : null,
        !selectedContract.content.financial.validity ? "Cláusulas modificadas" : null,
        !selectedContract.content.financial.startDate ? "Vigência inicial" : null,
        !selectedContract.content.financial.endDate ? "Vigência final" : null,
        !selectedContract.content.financial.dueDate ? "Foro" : null,
      ].filter((item): item is string => Boolean(item))
    }

    if (selectedContract.kind === "Distrato") {
      return [
        !selectedContractLead?.identification.cpfCnpj ? "CPF do cliente vinculado" : null,
        !selectedContractProperty?.legal.registryNumber ? "Matrícula do imóvel" : null,
        !selectedContract.content.financial.paymentMethod ? "Referência do contrato original" : null,
        !selectedContract.content.financial.additionalConditions ? "Motivo do encerramento" : null,
        !selectedContract.content.financial.validity ? "Quitação" : null,
        !selectedContract.content.financial.guaranteeType ? "Obrigações remanescentes" : null,
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
    selectedContractIsExternal,
    selectedContractLead?.identification.cpfCnpj,
    selectedContractLead?.identification.rg,
    selectedContractProperty?.legal.registryNumber,
    selectedContractProperty?.legal.registryOffice,
    selectedContractProperty?.ownerName,
    selectedContractProperty?.title,
  ])

  const contractValidationItems = useMemo(() => {
    if (!selectedContract) return []
    if (selectedContractIsExternal) {
      return [
        {
          label: "Arquivo anexado",
          detail: selectedContract.content.attachment?.fileName || "Arquivo principal ainda não enviado.",
          done: Boolean(selectedContract.content.attachment?.fileUrl),
        },
        {
          label: "Cliente vinculado",
          detail: selectedContract.leadName || "Cliente ainda não vinculado.",
          done: Boolean(selectedContract.leadName),
        },
        {
          label: "Imóvel relacionado",
          detail: selectedContract.propertyTitle || "Contrato anexado sem imóvel vinculado.",
          done: Boolean(selectedContract.propertyTitle),
        },
        {
          label: "Tipo do documento",
          detail: selectedContract.kind || "Tipo ainda não informado.",
          done: Boolean(selectedContract.kind),
        },
        {
          label: "Observações",
          detail:
            selectedContract.content.attachment?.notes ||
            "Sem observações complementares. Adicione contexto se quiser facilitar busca e uso pelo COS.",
          done: Boolean(selectedContract.content.attachment?.notes),
        },
      ]
    }

    if (selectedContract.kind === "Locacao residencial") {
      return [
        {
          label: "Locador validado",
          detail: selectedContractProperty?.ownerName || "Locador ainda não identificado no imóvel.",
          done: Boolean(selectedContractProperty?.ownerName),
        },
        {
          label: "Locatário validado",
          detail: selectedContract.leadName || "Locatário ainda não vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Garantia definida",
          detail: selectedContract.content.financial.guaranteeType || "Garantia locaticia pendente.",
          done: Boolean(selectedContract.content.financial.guaranteeType),
        },
        {
          label: "Laudo de vistoria",
          detail: selectedContract.content.financial.inspectionReport || "Laudo inicial não informado.",
          done: Boolean(selectedContract.content.financial.inspectionReport),
        },
        {
          label: "Financeiro confirmado",
          detail:
            selectedContract.amountLabel && selectedContract.content.financial.dueDate
              ? `${selectedContract.amountLabel} • ${selectedContract.content.financial.dueDate}`
              : "Aluguel e vencimento ainda exigem confirmação.",
          done: Boolean(selectedContract.amountLabel && selectedContract.content.financial.dueDate),
        },
      ]
    }

    if (selectedContract.kind === "Locacao comercial") {
      return [
        {
          label: "Locador validado",
          detail: selectedContractProperty?.ownerName || "Locador ainda não identificado no imóvel.",
          done: Boolean(selectedContractProperty?.ownerName),
        },
        {
          label: "Finalidade comercial",
          detail: selectedContract.content.financial.commercialPurpose || "Uso comercial ainda não definido.",
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
          label: "Obras e adequações",
          detail:
            selectedContract.content.financial.worksScope || selectedContract.content.financial.fitOutScope
              ? "Escopo operacional registrado."
              : "Obras e adequações ainda não detalhadas.",
          done: Boolean(
            selectedContract.content.financial.worksScope || selectedContract.content.financial.fitOutScope,
          ),
        },
      ]
    }

    if (selectedContract.kind === "Autorizacao de venda") {
      return [
        {
          label: "Proprietário validado",
          detail: selectedContract.leadName || selectedContractProperty?.ownerName || "Proprietário ainda não vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imóvel validado",
          detail: selectedContract.propertyTitle || "Imóvel ainda não vinculado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Valor autorizado",
          detail: selectedContract.amountLabel || "Valor autorizado ainda não informado.",
          done: Boolean(selectedContract.amountLabel),
        },
        {
          label: "Comissão definida",
          detail:
            selectedContract.content.financial.commissionPercent
              ? `${selectedContract.content.financial.commissionPercent}%`
              : "Comissão ainda não informada.",
          done: Boolean(selectedContract.content.financial.commissionPercent),
        },
        {
          label: "Intermediação registrada",
          detail:
            selectedContract.content.financial.additionalConditions ||
            "Condições da intermediação ainda não registradas.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Exclusividade") {
      return [
        {
          label: "Proprietário validado",
          detail: selectedContract.leadName || selectedContractProperty?.ownerName || "Proprietário ainda não vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imóvel validado",
          detail: selectedContract.propertyTitle || "Imóvel ainda não vinculado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Prazo de exclusividade",
          detail: selectedContract.content.financial.validity || "Prazo exclusivo ainda não informado.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Comissão definida",
          detail:
            selectedContract.content.financial.commissionPercent
              ? `${selectedContract.content.financial.commissionPercent}%`
              : "Comissão ainda não informada.",
          done: Boolean(selectedContract.content.financial.commissionPercent),
        },
        {
          label: "Direitos e obrigações",
          detail:
            selectedContract.content.financial.additionalConditions ||
            "Direitos e obrigações ainda não registrados.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Termo de visita") {
      return [
        {
          label: "Visitante validado",
          detail: selectedContract.leadName || "Visitante ainda não vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imóvel visitado",
          detail: selectedContract.propertyTitle || "Imóvel ainda não vinculado.",
          done: Boolean(selectedContract.propertyTitle),
        },
        {
          label: "Data e hora",
          detail:
            selectedContract.content.financial.startDate && selectedContract.content.financial.dueDate
              ? `${selectedContract.content.financial.startDate} / ${selectedContract.content.financial.dueDate}`
              : "Data ou hora da visita ainda não informadas.",
          done: Boolean(selectedContract.content.financial.startDate && selectedContract.content.financial.dueDate),
        },
        {
          label: "Ciência da intermediação",
          detail:
            selectedContract.content.financial.validity || "Ciência da intermediação ainda não registrada.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Declarações registradas",
          detail:
            selectedContract.content.financial.additionalConditions || "Declarações da visita ainda não registradas.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Reserva") {
      return [
        {
          label: "Interessado validado",
          detail: selectedContract.leadName || "Interessado ainda não vinculado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Proprietário identificado",
          detail: selectedContractProperty?.ownerName || "Proprietário ainda não identificado no imóvel.",
          done: Boolean(selectedContractProperty?.ownerName),
        },
        {
          label: "Imóvel validado",
          detail: selectedContract.propertyTitle || "Imóvel ainda não vinculado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Prazo e conversão",
          detail:
            selectedContract.content.financial.validity && selectedContract.content.financial.dueDate
              ? `${selectedContract.content.financial.validity} • ${selectedContract.content.financial.dueDate}`
              : "Prazo e conversão da reserva ainda exigem confirmação.",
          done: Boolean(selectedContract.content.financial.validity && selectedContract.content.financial.dueDate),
        },
        {
          label: "Condições registradas",
          detail:
            selectedContract.content.financial.additionalConditions || "Condições da reserva ainda não registradas.",
          done: Boolean(selectedContract.content.financial.additionalConditions),
        },
      ]
    }

    if (selectedContract.kind === "Aditivo") {
      return [
        {
          label: "Contrato original referênciado",
          detail: selectedContract.content.financial.paymentMethod || "Referência do contrato original ainda não informada.",
          done: Boolean(selectedContract.content.financial.paymentMethod),
        },
        {
          label: "Cliente validado",
          detail: selectedContract.leadName || "Cliente vinculado ainda não selecionado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imóvel validado",
          detail: selectedContract.propertyTitle || "Imóvel vinculado ainda não selecionado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Cláusulas modificadas",
          detail: selectedContract.content.financial.validity || "Cláusulas alteradas ainda não registradas.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Vigência e foro",
          detail:
            selectedContract.content.financial.startDate &&
            selectedContract.content.financial.endDate &&
            selectedContract.content.financial.dueDate
              ? `${selectedContract.content.financial.startDate} • ${selectedContract.content.financial.endDate} • ${selectedContract.content.financial.dueDate}`
              : "Vigência ou foro ainda exigem confirmação.",
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
          label: "Contrato original referênciado",
          detail: selectedContract.content.financial.paymentMethod || "Referência do contrato original ainda não informada.",
          done: Boolean(selectedContract.content.financial.paymentMethod),
        },
        {
          label: "Cliente validado",
          detail: selectedContract.leadName || "Cliente vinculado ainda não selecionado.",
          done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
        },
        {
          label: "Imóvel validado",
          detail: selectedContract.propertyTitle || "Imóvel vinculado ainda não selecionado.",
          done: Boolean(selectedContract.propertyTitle && selectedContractProperty?.legal.registryNumber),
        },
        {
          label: "Quitação definida",
          detail: selectedContract.content.financial.validity || "Quitação ainda não registrada.",
          done: Boolean(selectedContract.content.financial.validity),
        },
        {
          label: "Obrigações remanescentes",
          detail:
            selectedContract.content.financial.guaranteeType || "Obrigações remanescentes ainda não registradas.",
          done: Boolean(selectedContract.content.financial.guaranteeType),
        },
      ]
    }

    return [
      {
        label: "Cliente validado",
        detail: selectedContract.leadName || "Cliente ainda não vinculado.",
        done: Boolean(selectedContract.leadName && selectedContractLead?.identification.cpfCnpj),
      },
      {
        label: "Matrícula",
        detail: selectedContractProperty?.legal.registryNumber || "Matrícula pendente.",
        done: Boolean(selectedContractProperty?.legal.registryNumber),
      },
      {
        label: "Valor confirmado",
        detail: selectedContract.amountLabel || "Valor negociado ainda não informado.",
        done: Boolean(selectedContract.amountLabel),
      },
      {
        label: "Cartório",
        detail: selectedContractProperty?.legal.registryOffice || "Cartório não informado.",
        done: Boolean(selectedContractProperty?.legal.registryOffice),
      },
      {
        label: "Documento consistente",
        detail:
          selectedContract.content.reviewNotes[0] ||
          "Revisão estruturada pronta para acompanhamento automático.",
        done: selectedContract.content.reviewNotes.length > 0,
      },
    ]
  }, [
    selectedContract,
    selectedContractIsExternal,
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
        label: "Imóvel",
        detail: selectedProperty?.title || "Selecione um imóvel",
        done: Boolean(selectedProperty),
      },
      {
        label: "Valor negociado",
        detail: draft.amount || "Defina a condição comercial",
        done: Boolean(draft.amount.trim()),
      },
      {
        label: "Comissão",
        detail:
          parsePercentInput(draft.commissionPercent) !== null
            ? `${formatPercentInput(draft.commissionPercent, { suffix: false })}%`
            : "Defina a comissão",
        done: parsePercentInput(draft.commissionPercent) !== null,
      },
    ]
  }, [draft.amount, draft.commissionPercent, draft.kind, selectedLead, selectedProperty])

  function openCreateDialog() {
    if (onNewTemplateContract) {
      onNewTemplateContract()
      return
    }
    setEditingId(null)
    setDraft({ ...emptyDraft })
    setTitleCustomized(false)
    setAmountCustomized(false)
    setCommissionCustomized(false)
    setAmendmentReferenceCustomized(false)
    setIsDialogOpen(true)
  }

  function openAttachDialog() {
    setEditingAttachmentId(null)
    setAttachmentDraft({ ...emptyAttachmentDraft })
    setAttachmentFile(null)
    setIsAttachDialogOpen(true)
  }

  function openEditDialog(contract: ContractRecord) {
    if (contract.content.source === "template" && contract.content.templateInstanceId && onOpenTemplateContract) {
      onOpenTemplateContract(contract.content.templateInstanceId)
      return
    }
    if (isExternalContract(contract)) {
      setEditingAttachmentId(contract.id)
      setAttachmentDraft({
        leadId: contract.leadId ?? "",
        propertyId: contract.propertyId ?? "",
        kind: contract.kind,
        title: contract.title,
        notes: contract.content.attachment?.notes ?? contract.content.financial.additionalConditions ?? "",
        status: contract.status,
      })
      setAttachmentFile(null)
      setIsAttachDialogOpen(true)
      return
    }

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

  async function saveAttachedContract() {
    if (!attachmentDraft.leadId) {
      setFeedback("Selecione o cliente para anexar o contrato.")
      return
    }

    if (!editingAttachmentId && !attachmentFile) {
      setFeedback("Selecione um arquivo PDF, DOC ou DOCX.")
      return
    }

    setIsSaving(true)
    setFeedback("")
    try {
      const payloadBase: Omit<ContractAttachmentDraft, "file"> = {
        leadId: attachmentDraft.leadId,
        propertyId: attachmentDraft.propertyId,
        kind: attachmentDraft.kind,
        title: attachmentDraft.title.trim(),
        notes: attachmentDraft.notes.trim(),
        status: attachmentDraft.status,
      }

      const contract = editingAttachmentId
        ? await contracts.updateAttachment(editingAttachmentId, {
            ...(payloadBase as ContractAttachmentUpdateDraft),
            file: attachmentFile,
          })
        : await contracts.attach({
            ...payloadBase,
            file: attachmentFile as File,
          })

      setFeedback(editingAttachmentId ? "Contrato anexado atualizado com sucesso." : "Contrato anexado com sucesso.")
      setIsAttachDialogOpen(false)
      setAttachmentDraft({ ...emptyAttachmentDraft })
      setAttachmentFile(null)
      setEditingAttachmentId(null)
      await loadContracts(contract.id)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o contrato anexado.")
    } finally {
      setIsSaving(false)
    }
  }

  async function saveContract() {
    setIsSaving(true)
    setFeedback("")
    try {
      const payload: ContractDraft = {
        ...draft,
        title: draft.title.trim() || normalizeTitle(draft.kind, selectedLead, selectedProperty),
        commissionPercent: formatPercentInput(draft.commissionPercent, { suffix: false }),
      }
      const contract = editingId ? await contracts.update(editingId, payload) : await contracts.create(payload)
      setFeedback(editingId ? "Contrato atualizado com sucesso." : "Contrato criado com sucesso.")
      setIsDialogOpen(false)
      setDraft(emptyDraft)
      setEditingId(null)
      await loadContracts(contract.id)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o contrato.")
    } finally {
      setIsSaving(false)
    }
  }

  async function updateContractStatus(nextStatus: ContractStatus) {
    if (!selectedContract) return
    if (selectedContract.content.source === "template" && selectedContract.content.templateInstanceId && onOpenTemplateContract) {
      if (nextStatus === "cancelled") {
        if (!window.confirm("Cancelar este contrato?")) return
        setIsStatusSaving(true)
        setFeedback("")
        try {
          await templateContracts.cancel(selectedContract.content.templateInstanceId)
          setFeedback("Contrato cancelado.")
          await loadContracts(selectedContract.id)
        } catch (error) {
          setFeedback(error instanceof Error ? error.message : "Não foi possível cancelar o contrato.")
        } finally {
          setIsStatusSaving(false)
        }
        return
      }
      onOpenTemplateContract(selectedContract.content.templateInstanceId)
      return
    }

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
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar o status.")
    } finally {
      setIsStatusSaving(false)
    }
  }

  async function duplicateContract(contractId: string) {
    const contractToDuplicate = contractsList.find((contract) => contract.id === contractId)
    if (contractToDuplicate?.content.source === "template" && contractToDuplicate.content.templateInstanceId && onOpenTemplateContract) {
      onOpenTemplateContract(contractToDuplicate.content.templateInstanceId)
      return
    }
    try {
      const contract = await contracts.duplicate(contractId)
      setFeedback("Contrato duplicado.")
      await loadContracts(contract.id)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível duplicar o contrato.")
    }
  }

  async function deleteContract(contractId: string) {
    const contractToDelete = contractsList.find((contract) => contract.id === contractId)
    if (contractToDelete?.content.source === "template" && contractToDelete.content.templateInstanceId && onOpenTemplateContract) {
      if (!window.confirm("Excluir este contrato?")) return
      try {
        await templateContracts.delete(contractToDelete.content.templateInstanceId)
        setFeedback("Contrato excluído.")
        await loadContracts(selectedId === contractId ? null : selectedId)
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o contrato.")
      }
      return
    }
    if (!window.confirm("Excluir este contrato?")) return

    try {
      await contracts.delete(contractId)
      setFeedback("Contrato excluido.")
      await loadContracts(selectedId === contractId ? null : selectedId)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o contrato.")
    }
  }

  async function exportPdf() {
    if (!selectedContract) return
    if (selectedContract.content.source === "template" && selectedContract.content.templateInstanceId && onOpenTemplateContract) {
      onOpenTemplateContract(selectedContract.content.templateInstanceId)
      return
    }

    try {
      if (selectedContractIsExternal) {
        window.open(buildAttachedContractRoute(selectedContract.id), "_blank", "noopener,noreferrer")
        setFeedback("Arquivo anexado aberto em nova aba.")
        return
      }

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
      setFeedback(error instanceof Error ? error.message : "Não foi possível preparar o PDF.")
    }
  }

  function openAttachedContract(download = false) {
    if (!selectedContract) return
    window.open(buildAttachedContractRoute(selectedContract.id, download), "_blank", "noopener,noreferrer")
  }

  function updateDraftField(key: keyof ContractDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
        <CardHeader className="border-b border-[var(--broker-border)] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[42rem]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#9AA4B2]">Workspace de documentos</p>
              <CardTitle className="mt-1.5 flex items-center gap-2 text-[1.65rem] tracking-[-0.04em] text-[#050505]">
                <FileSignature className="size-5 text-[#009b3a]" />
                Contratos
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                Workspace para criar, anexar e armazenar contratos e documentos da sua operação.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[340px]">
              <div className="rounded-[var(--broker-radius-md)] bg-[var(--broker-surface-muted)] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Rascunhos</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[#050505]">{overview.drafts}</p>
              </div>
              <div className="rounded-[var(--broker-radius-md)] bg-[var(--broker-surface-muted)] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Em andamento</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[#050505]">{overview.awaiting}</p>
              </div>
              <div className="rounded-[var(--broker-radius-md)] bg-[var(--broker-surface-muted)] px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Assinados</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[#050505]">{overview.signed}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 p-4 sm:p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8B95A1]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por título, cliente, imóvel ou resumo"
                  className="h-11 rounded-xl border-black/[0.06] bg-[#fbfbf8] pl-10 text-[#050505]"
                />
              </div>

              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as "all" | ContractType)}
                className="h-11 rounded-xl border border-black/[0.06] bg-[#fbfbf8] px-3 text-[#050505]"
              >
                <option value="all">Todos os tipos</option>
                {availableKindFilters.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {onImportTemplate ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onImportTemplate}
                  className="h-11 rounded-xl border border-black/[0.06] bg-white px-4 text-[#111111] hover:bg-white"
                >
                  <FileUp className="size-4" />
                  Importar modelo
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={openAttachDialog}
                className="h-11 rounded-xl border border-black/[0.06] bg-white px-4 text-[#111111] hover:bg-white"
              >
                <Paperclip className="size-4" />
                Anexar contrato
              </Button>
              <Button
                type="button"
                onClick={openCreateDialog}
                className="h-11 rounded-xl bg-[#009b3a] px-4 text-white shadow-[0_10px_24px_rgba(0,155,58,0.18)] hover:bg-[#008633]"
              >
                <Plus className="size-4" />
                Novo contrato
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {contractStatusOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatus(item.value)}
                className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
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

          <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_15rem] xl:gap-4">
            <div className="min-h-0">
              {isLoading ? (
                <Card className="rounded-[1.5rem] border-black/[0.06] bg-white/90">
                  <CardContent className="p-5">
                    <EmeLoading compact message="Carregando contratos..." />
                  </CardContent>
                </Card>
              ) : contractsList.length > 0 ? (
                <div className="grid max-h-[calc(100vh-22rem)] gap-1.5 overflow-y-auto pr-1">
                  {contractsList.map((contract) => (
                    <button
                      key={contract.id}
                      type="button"
                      onClick={() => setSelectedId(contract.id)}
                      className={`relative overflow-hidden rounded-[1rem] border px-3 py-2 text-left transition ${
                        selectedContract?.id === contract.id
                          ? "border-[#009b3a]/10 bg-[#f6fbf7]"
                          : "border-black/[0.045] bg-[#fcfcfa] hover:border-black/[0.07] hover:bg-white"
                      }`}
                    >
                      {selectedContract?.id === contract.id ? (
                        <span className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-[#009b3a]" aria-hidden="true" />
                      ) : null}
                      <div className="flex items-center justify-between gap-2.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${getContractStatusTone(contract.status)}`}
                        >
                          {getContractStatusLabel(contract.status)}
                        </span>
                        <span className="text-[11px] text-[#9AA4B2]">{new Intl.DateTimeFormat("pt-BR").format(new Date(contract.updatedAt))}</span>
                      </div>

                      <p className="mt-2 line-clamp-1 text-[0.9rem] font-semibold leading-[1.35] text-[#050505]">
                        {contract.title}
                      </p>

                      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#667085]">
                        <p className="min-w-0 flex-1 truncate">{contract.leadName || "Cliente não vinculado"}</p>
                        <span className="size-1 rounded-full bg-black/[0.14]" aria-hidden="true" />
                        <p className="min-w-0 flex-1 truncate">{contract.propertyTitle || "Imóvel não vinculado"}</p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3 text-[12px]">
                        <span className="font-medium text-[#111111]">{contract.amountLabel || "Valor pendente"}</span>
                        <span className="text-[#9AA4B2]">{formatDateTime(contract.updatedAt).slice(0, 10)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                  Nenhum contrato encontrado. Crie o primeiro rascunho para iniciar o fluxo de revisão e assinatura.
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="grid gap-4">
                <div className="flex flex-col gap-3 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] px-4 py-3.5 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-[1.4rem] tracking-[-0.04em] text-[#050505]">
                      {selectedContract?.title ?? "Selecione um contrato"}
                    </CardTitle>
                    {selectedContract ? (
                      <p className="mt-1.5 text-[12px] leading-5 text-[#7B8491]">
                        Versão {selectedContract.version} por {selectedContract.authorName} · atualizado em{" "}
                        {formatDateTime(selectedContract.updatedAt)}
                      </p>
                    ) : null}
                  </div>

                  {selectedContract ? (
                    <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
                      <span
                        className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-medium ${getContractStatusTone(
                          selectedContract.status,
                        )}`}
                      >
                        {getContractStatusLabel(selectedContract.status)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openEditDialog(selectedContract)}
                        className="h-[2.125rem] rounded-xl border border-black/[0.05] bg-white px-3 text-[#111111] hover:bg-white"
                      >
                        <PencilLine className="size-4" />
                        {selectedContract.content.source === "template" ? "Preencher contrato" : "Editar contrato"}
                      </Button>
                      <Button
                        type="button"
                        onClick={exportPdf}
                        className="h-[2.125rem] rounded-xl bg-[#111111] px-3.5 text-white hover:bg-[#050505]"
                      >
                        {selectedContractIsExternal ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
                        {selectedContractIsExternal ? "Abrir arquivo" : "Gerar PDF"}
                      </Button>
                      {!selectedContractIsExternal ? (
                        <Button
                          type="button"
                          onClick={() => void updateContractStatus("signed")}
                          className="h-[2.125rem] rounded-xl bg-[#009b3a] px-3.5 text-white hover:bg-[#008633]"
                        >
                          <CheckCheck className="size-4" />
                          Assinar
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4">
                {selectedContract ? (
                  <>
                    <div className="grid gap-2 border-b border-black/[0.045] pb-4 sm:grid-cols-2 xl:grid-cols-5">
                      <PreviewInfo label="Status" value={getContractStatusLabel(selectedContract.status)} />
                      <PreviewInfo label="Cliente" value={selectedContract.leadName} />
                      <PreviewInfo label="Imóvel" value={selectedContract.propertyTitle} />
                      <PreviewInfo label="Valor" value={selectedContract.amountLabel} />
                      <PreviewInfo label="Modelo" value={selectedContract.kind} />
                    </div>

                    <div className="grid gap-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Preview do documento</p>
                          <p className="mt-1 text-[13px] leading-5 text-[#5F6B7A]">
                            A folha A4 permanece no centro enquanto a negociação e as validações acompanham o contrato.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedContractIsExternal ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => openAttachedContract(true)}
                              className="h-[2.125rem] rounded-xl border border-black/[0.05] bg-white px-3 text-[#4B5563] hover:bg-white"
                            >
                              <Download className="size-4" />
                              Baixar
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void duplicateContract(selectedContract.id)}
                            className="h-[2.125rem] rounded-xl border border-black/[0.05] bg-white px-3 text-[#4B5563] hover:bg-white"
                          >
                            <CopyPlus className="size-4" />
                            Duplicar
                          </Button>
                          {!selectedContractIsExternal ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => void updateContractStatus("awaiting_signature")}
                              className="h-[2.125rem] rounded-xl border border-black/[0.05] bg-white px-3 text-[#4B5563] hover:bg-white"
                            >
                              <Send className="size-4" />
                              Enviar
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] bg-[#f6f5f1] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] sm:px-6 sm:py-5">
                        <div className="mx-auto aspect-[210/297] w-full max-w-[25rem] overflow-hidden rounded-[1.2rem] border border-black/[0.04] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                          {selectedContractIsExternal &&
                          selectedContract.content.attachment?.mimeType === "application/pdf" ? (
                            <iframe
                              title={`Preview de ${selectedContract.title}`}
                              src={buildAttachedContractRoute(selectedContract.id)}
                              className="h-full w-full bg-white"
                            />
                          ) : (
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
                          )}
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

            <div className="min-w-0 xl:max-w-[15.5rem]">
              {selectedContract ? (
                <div className="grid gap-3">
                  <section className="rounded-[1.35rem] border border-black/[0.045] bg-[#fbfbf8] p-3.5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Painel contextual</p>
                    <h3 className="mt-2.5 text-[1.25rem] font-semibold tracking-[-0.04em] text-[#050505]">
                      Saúde deste contrato
                    </h3>
                    <div className="mt-3.5 rounded-[1.05rem] bg-white px-3 py-3">
                      <p className="text-[2rem] font-semibold tracking-[-0.06em] text-[#050505]">
                        {contractHealthScore}%
                      </p>
                      <div className="mt-3 h-2 rounded-full bg-black/[0.06]">
                        <div className="h-full rounded-full bg-[#009b3a]" style={{ width: `${contractHealthScore}%` }} />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-1.5">
                      {contractHealthIndicators.map((item) => (
                        <div key={item.label} className="flex items-center justify-between rounded-[0.9rem] bg-white px-3 py-2">
                          <span className="text-[12px] text-[#4B5563]">{item.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getContractHealthTone(item.score)}`}
                          >
                            {item.score}%
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3.5 border-t border-black/[0.06] pt-3.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Pendências</p>
                      <div className="mt-2.5 grid gap-1.5">
                        {contractPendingHighlights.length > 0 ? (
                          contractPendingHighlights.map((item) => (
                            <div key={item} className="flex items-start gap-2 text-[12px] leading-5 text-[#5F6B7A]">
                              <span className="mt-1.5 size-1.5 rounded-full bg-[#c58917]" />
                              <span>{item}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-start gap-2 text-[12px] leading-5 text-[#5F6B7A]">
                            <CheckCircle2 className="mt-0.5 size-4 text-[#009b3a]" />
                            <span>Sem pendências estruturais neste momento.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-3.5 h-[2.125rem] w-full rounded-xl border border-black/[0.05] bg-white text-[#111111] hover:bg-white"
                    >
                      <Sparkles className="size-4" />
                      Conversar com o COS
                    </Button>
                  </section>

                  <section className="rounded-[1.35rem] border border-black/[0.045] bg-white p-3.5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Validação automática</p>
                      <h3 className="mt-2.5 text-[0.95rem] font-semibold text-[#050505]">Revisão contextual</h3>
                    </div>
                    <div className="mt-3 grid gap-1.5">
                      {contractValidationItems.map((item) => (
                        <div key={item.label} className="rounded-[0.9rem] bg-[#fbfbf8] px-3 py-2">
                          <div className="flex items-start gap-3">
                            {item.done ? (
                              <CheckCircle2 className="mt-0.5 size-4 text-[#009b3a]" />
                            ) : (
                              <AlertCircle className="mt-0.5 size-4 text-[#c58917]" />
                            )}
                            <div>
                              <p className="text-[12px] font-medium text-[#050505]">{item.label}</p>
                              <p className="mt-1 text-[12px] leading-5 text-[#6B7280]">{item.detail}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.35rem] border border-black/[0.045] bg-white p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">Notas de revisão</p>
                        <h3 className="mt-2.5 text-[0.95rem] font-semibold text-[#050505]">Checklist jurídico e comercial</h3>
                      </div>
                      <span className="rounded-full bg-[#f5fbf7] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[#009b3a]">
                        {selectedContract.content.reviewNotes.length || 0} itens
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1.5">
                      {selectedContract.content.reviewNotes.length > 0 ? (
                        selectedContract.content.reviewNotes.slice(0, 5).map((item) => (
                          <div key={item} className="rounded-[0.9rem] bg-[#fbfbf8] px-3 py-2 text-[12px] leading-5 text-[#4B5563]">
                            {item}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[0.95rem] bg-[#fbfbf8] px-3 py-2.5 text-[13px] leading-5 text-[#6B7280]">
                          Este contrato ainda não possui notas de revisão registradas.
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void updateContractStatus("cancelled")}
                        className="h-9 rounded-xl border border-black/[0.05] bg-white px-3 text-[#D14343] hover:bg-white"
                      >
                        <XCircle className="size-4" />
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void deleteContract(selectedContract.id)}
                        className="h-9 rounded-xl border border-black/[0.05] bg-white px-3 text-[#D14343] hover:bg-white"
                      >
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-[#fbfbf8] p-6 text-sm leading-6 text-[#6B7280]">
                  Selecione um contrato para visualizar prontidão, validações e pendências deste workspace.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[94vh] max-w-[calc(100%-2rem)] sm:max-w-[96vw] overflow-y-auto rounded-[2rem] border-black/[0.06] bg-[#f7f7f3] p-0">
          <DialogHeader className="border-b border-black/[0.06] px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <FilePenLine className="size-5 text-[#009b3a]" />
              {editingId ? "Editor de contrato" : "Novo contrato"}
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              O EME preenche o que já conhece, organiza as pendências e mantém o documento sincronizado com o preview em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-5 py-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
            <div className="grid content-start gap-4">
              <section className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#050505]">Propriedades do contrato</p>
                    <p className="text-sm text-[#6B7280]">O contrato consome dados do cliente, do imóvel e do corretor.</p>
                  </div>
                  <span className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8B95A1]">
                    Editor
                  </span>
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm text-[#5F6B7A]">
                    <span>Título</span>
                    <Input
                      value={draft.title}
                      onChange={(event) => {
                        setTitleCustomized(Boolean(event.target.value.trim()))
                        updateDraftField("title", event.target.value)
                      }}
                      placeholder="Título da negociação"
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
                      {creatableContractTypeOptions.map((option) => (
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
                    Imóvel
                    <select
                      value={draft.propertyId}
                      onChange={(event) => {
                        setAmountCustomized(false)
                        updateDraftField("propertyId", event.target.value)
                      }}
                      className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
                    >
                      <option value="">Selecione um imóvel</option>
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
                  <p className="text-sm font-semibold text-[#050505]">Condições comerciais</p>
                  <p className="text-sm text-[#6B7280]">
                    Somente os dados especificos desta negociação ficam no contrato. O restante vem das entidades.
                  </p>
                </div>

                <div className="grid gap-4">
                  {commercialFields.map((field) => {
                    const value = draft[field.key] ?? ""

                    if (field.type === "currency") {
                      return (
                        <label key={field.id} className="grid gap-2 text-sm text-[#5F6B7A]">
                          <span>{field.label}</span>
                          <StructuredInput
                            kind="currency"
                            value={value}
                            onValueChange={(nextValue) => {
                              setAmountCustomized(true)
                              updateDraftField(field.key, nextValue)
                            }}
                            placeholder={field.placeholder}
                            aria-label={field.label}
                            className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
                          />
                          <p className="text-xs text-[#8B95A1]">{valueSourceLabel}</p>
                        </label>
                      )
                    }

                    if (field.type === "percent") {
                      return (
                        <label key={field.id} className="grid gap-2 text-sm text-[#5F6B7A]">
                          <span>{field.label}</span>
                          <StructuredInput
                            kind="percent"
                            value={value}
                            onValueChange={(nextValue) => {
                              setCommissionCustomized(true)
                              updateDraftField(field.key, nextValue)
                            }}
                            placeholder={field.placeholder}
                            aria-label={field.label}
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
                          placeholder={field.placeholder}
                          onChange={(nextValue) => updateDraftField(field.key, nextValue)}
                        />
                      )
                    }

                    if (field.type === "text") {
                      return (
                        <label key={field.id} className="grid gap-2 text-sm text-[#5F6B7A]">
                          <span>{field.label}</span>
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
                        <span>{field.label}</span>
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
                    <p className="text-sm text-[#6B7280]">Atualização automática a cada alteração.</p>
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
                  <p className="text-sm font-semibold text-[#050505]">Pendências das entidades</p>
                  <p className="text-sm text-[#6B7280]">
                    {pendingSummary.pendingCount
                      ? `Faltam ${pendingSummary.pendingCount} informações nas fontes oficiais.`
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
                  <p className="text-sm font-semibold text-[#050505]">Workspace da negociação</p>
                  <p className="text-sm text-[#6B7280]">Centro limpo para revisar o documento e direita reservada para pendências, comentarios e COS.</p>
                </div>

                <div className="rounded-[1rem] border border-black/[0.05] bg-[#fbfbf8] p-4 text-sm leading-6 text-[#5F6B7A]">
                  O preview nunca mostra placeholders tecnicos nem “Não informado”. Quando faltar dado estrutural, a pendência aparece aqui e a correção acontece na entidade de origem.
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
                  Futuro painel do COS: comentarios contextuais, validações juridicas e abertura orientada das entidades que ainda precisarem de complemento.
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="border-t border-black/[0.06] px-6 py-5 sm:justify-between">
            <p className="text-sm text-[#6B7280]">
              O contrato permanece revisável enquanto o preview acompanha todas as alterações em tempo real.
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
                {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar contrato"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAttachDialogOpen} onOpenChange={setIsAttachDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100%-2rem)] overflow-hidden rounded-[2rem] border-black/[0.06] bg-[#f7f7f3] p-0 sm:max-h-[calc(100vh-4rem)] sm:max-w-[34rem]">
          <DialogHeader className="border-b border-black/[0.06] px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl text-[#050505]">
              <Paperclip className="size-5 text-[#009b3a]" />
              {editingAttachmentId ? "Editar contrato anexado" : "Anexar contrato"}
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Armazene contratos externos na mesma biblioteca do EME, com cliente, imóvel e categoria sincronizados para busca e uso pelo COS.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[min(70vh,calc(100vh-15rem))] gap-4 overflow-y-auto px-6 py-5 sm:max-h-[min(72vh,calc(100vh-16rem))]">
            <label className="grid gap-2 text-sm text-[#5F6B7A]">
              Cliente
              <select
                value={attachmentDraft.leadId}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, leadId: event.target.value }))}
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
              Imóvel
              <select
                value={attachmentDraft.propertyId}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, propertyId: event.target.value }))}
                className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-[#050505]"
              >
                <option value="">Sem imóvel vinculado</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[#5F6B7A]">
                Tipo do documento
                <select
                  value={attachmentDraft.kind}
                  onChange={(event) =>
                    setAttachmentDraft((current) => ({ ...current, kind: event.target.value as ContractType }))
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
                  value={attachmentDraft.status}
                  onChange={(event) =>
                    setAttachmentDraft((current) => ({ ...current, status: event.target.value as ContractStatus }))
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
            </div>

            <label className="grid gap-2 text-sm text-[#5F6B7A]">
              Nome do documento
              <Input
                value={attachmentDraft.title}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Se vazio, o nome do arquivo será utilizado"
                className="h-11 rounded-xl border-black/[0.08] bg-white text-[#050505]"
              />
            </label>

            <label className="grid gap-2 text-sm text-[#5F6B7A]">
              Upload
              <Input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                className="h-auto rounded-xl border-black/[0.08] bg-white py-3 text-[#050505]"
              />
              <p className="text-xs text-[#8B95A1]">
                {attachmentFile
                  ? `Arquivo selecionado: ${attachmentFile.name}`
                  : editingAttachmentId
                    ? `Arquivo atual: ${selectedContract?.content.attachment?.fileName || "mantido"}`
                    : "Aceita PDF, DOC e DOCX."}
              </p>
            </label>

            <label className="grid gap-2 text-sm text-[#5F6B7A]">
              Observações
              <Textarea
                value={attachmentDraft.notes}
                onChange={(event) => setAttachmentDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Contexto adicional para facilitar busca, historico e uso pelo COS."
                className="min-h-28 rounded-xl border-black/[0.08] bg-white text-[#050505]"
              />
            </label>
          </div>

          <DialogFooter className="border-t border-black/[0.06] px-6 py-5 sm:justify-between">
            <p className="text-sm text-[#6B7280]">
              O contrato anexado entra na mesma biblioteca, filtros e historicos do workspace de contratos.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAttachDialogOpen(false)}
                className="h-10 rounded-xl border border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void saveAttachedContract()}
                disabled={isSaving}
                className="h-10 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]"
              >
                {isSaving ? "Salvando..." : editingAttachmentId ? "Salvar alterações" : "Anexar contrato"}
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
