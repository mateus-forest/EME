"use client"

import type { ContractStatus, ContractType } from "@/lib/contract-template"

export type ContractFilterStatus = "all" | ContractStatus

export type ContractRecord = {
  id: string
  title: string
  status: ContractStatus
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

export type ContractDraft = {
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
  status?: ContractStatus
}

type ContractResponse = {
  contract?: ContractRecord
  contracts?: ContractRecord[]
  error?: string
}

type GenerateContractResponse = {
  credits?: number
  creditsUsed?: number
  error?: string
}

export const contractStatusOptions: Array<{ label: string; value: ContractFilterStatus }> = [
  { label: "Todos", value: "all" },
  { label: "Rascunhos", value: "draft" },
  { label: "Aguardando assinatura", value: "awaiting_signature" },
  { label: "Assinados", value: "signed" },
  { label: "Cancelados", value: "cancelled" },
  { label: "Finalizados", value: "completed" },
]

async function parseContractResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as ContractResponse | null
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar os contratos.")
  }
  return data ?? {}
}

async function parseGenerateResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as GenerateContractResponse | null
  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel preparar o contrato.")
  }
  return data ?? {}
}

export function getContractStatusLabel(status: ContractStatus) {
  if (status === "awaiting_signature") return "Aguardando assinatura"
  if (status === "signed") return "Assinado"
  if (status === "cancelled") return "Cancelado"
  if (status === "completed") return "Finalizado"
  return "Rascunho"
}

export function getContractStatusTone(status: ContractStatus) {
  if (status === "awaiting_signature") return "bg-[#fff8e8] text-[#8a6a13] border-[#ead5a0]"
  if (status === "signed") return "bg-[#eef9f1] text-[#009b3a] border-[#b9e5c7]"
  if (status === "cancelled") return "bg-[#f5f5f5] text-[#7b8491] border-[#d9dde3]"
  if (status === "completed") return "bg-[#edf3ff] text-[#375b9a] border-[#cdd9f1]"
  return "bg-[#f7f6f1] text-[#5f6b7a] border-black/[0.08]"
}

export const contracts = {
  async list(params?: { query?: string; status?: ContractFilterStatus; kind?: "all" | ContractType }) {
    const searchParams = new URLSearchParams()
    if (params?.query) searchParams.set("q", params.query)
    if (params?.status) searchParams.set("status", params.status)
    if (params?.kind) searchParams.set("kind", params.kind)

    const query = searchParams.toString()
    const response = await fetch(`/api/brokers/contracts${query ? `?${query}` : ""}`, {
      credentials: "include",
      cache: "no-store",
    })
    const data = await parseContractResponse(response)
    return data.contracts ?? []
  },

  async create(payload: ContractDraft) {
    const response = await fetch("/api/brokers/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    const data = await parseContractResponse(response)
    if (!data.contract) {
      throw new Error("Nao foi possivel criar o contrato.")
    }
    return data.contract
  },

  async update(id: string, payload: Partial<ContractDraft> & { status?: ContractStatus }) {
    const response = await fetch(`/api/brokers/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    const data = await parseContractResponse(response)
    if (!data.contract) {
      throw new Error("Nao foi possivel atualizar o contrato.")
    }
    return data.contract
  },

  async delete(id: string) {
    const response = await fetch(`/api/brokers/contracts/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
    await parseContractResponse(response)
  },

  async duplicate(id: string) {
    const response = await fetch(`/api/brokers/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "duplicate" }),
    })
    const data = await parseContractResponse(response)
    if (!data.contract) {
      throw new Error("Nao foi possivel duplicar o contrato.")
    }
    return data.contract
  },

  async generate(id: string) {
    const response = await fetch(`/api/brokers/contracts/${id}/pdf-credit`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
    return parseGenerateResponse(response)
  },

  async send(id: string) {
    return contracts.update(id, { status: "awaiting_signature" })
  },

  async sign(id: string) {
    return contracts.update(id, { status: "signed" })
  },

  async cancel(id: string) {
    return contracts.update(id, { status: "cancelled" })
  },
}
