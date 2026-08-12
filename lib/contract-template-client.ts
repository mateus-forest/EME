"use client"

import type { ContractTemplateStructure } from "@/lib/contract-template-engine"

export type ContractTemplateRecord = {
  id: string
  name: string
  status: "ANALYZING" | "REVIEW_REQUIRED" | "READY" | "FAILED" | string
  currentVersion: number
  createdAt: string
  updatedAt: string
  version: {
    id: string
    number: number
    status: string
    sourceFileName: string
    sourceMimeType: string
    sourceFileSize: number | null
    structure: ContractTemplateStructure | null
    analysisMetadata: Record<string, unknown> | null
    reviewedAt: string | null
    createdAt: string
  } | null
}

export type ContractTemplateInstanceRecord = {
  id: string
  brokerDocumentId: string | null
  title: string
  status: string
  template: { id: string; name: string; version: number }
  leadId: string | null
  propertyId: string | null
  values: Record<string, string>
  additionalParties: Record<string, { leadId?: string; values?: Record<string, string> }>
  readiness: { score: number; missing: ContractTemplateStructure["fields"]; completed: number; required: number }
  html: string
  structure: ContractTemplateStructure
  signedAt: string | null
  signatureNote: string | null
  createdAt: string
  updatedAt: string
}

async function parseResponse<T>(response: Response) {
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(data?.error || "Não foi possível concluir esta ação.")
  if (!data) throw new Error("O servidor retornou uma resposta vazia.")
  return data
}

export const contractTemplates = {
  async list() {
    const response = await fetch("/api/brokers/contract-templates", { credentials: "include", cache: "no-store" })
    return parseResponse<{ templates: ContractTemplateRecord[] }>(response)
  },
  async import(file: File, name?: string) {
    const formData = new FormData()
    formData.append("file", file)
    if (name) formData.append("name", name)
    const response = await fetch("/api/brokers/contract-templates", {
      method: "POST",
      credentials: "include",
      body: formData,
    })
    return parseResponse<{ template: ContractTemplateRecord; reused: boolean }>(response)
  },
  async get(id: string) {
    const response = await fetch(`/api/brokers/contract-templates/${encodeURIComponent(id)}`, {
      credentials: "include",
      cache: "no-store",
    })
    return parseResponse<{ template: ContractTemplateRecord }>(response)
  },
  async saveReview(id: string, payload: { name: string; structure: ContractTemplateStructure }) {
    const response = await fetch(`/api/brokers/contract-templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    return parseResponse<{ template: ContractTemplateRecord; legalTextModified: boolean }>(response)
  },
  async reanalyze(id: string) {
    const response = await fetch(`/api/brokers/contract-templates/${encodeURIComponent(id)}/reanalyze`, {
      method: "POST",
      credentials: "include",
    })
    return parseResponse<{ template: ContractTemplateRecord; reused: boolean }>(response)
  },
}

export const templateContracts = {
  async create(payload: { templateId: string; leadId?: string; propertyId?: string }) {
    const response = await fetch("/api/brokers/contract-instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    return parseResponse<{ instance: { id: string; brokerDocumentId: string | null } }>(response)
  },
  async get(id: string) {
    const response = await fetch(`/api/brokers/contract-instances/${encodeURIComponent(id)}`, {
      credentials: "include",
      cache: "no-store",
    })
    return parseResponse<{ instance: ContractTemplateInstanceRecord }>(response)
  },
  async update(id: string, payload: Partial<Pick<ContractTemplateInstanceRecord, "title" | "leadId" | "propertyId" | "values" | "additionalParties">>) {
    const response = await fetch(`/api/brokers/contract-instances/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    return parseResponse<{ instance: ContractTemplateInstanceRecord }>(response)
  },
  async duplicate(id: string) {
    const response = await fetch(`/api/brokers/contract-instances/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "duplicate" }),
    })
    return parseResponse<{ instance: { id: string; brokerDocumentId: string | null } }>(response)
  },
  async sign(id: string, payload: { signedAt: string; note?: string }) {
    const response = await fetch(`/api/brokers/contract-instances/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "sign", ...payload }),
    })
    return parseResponse<{ instance: ContractTemplateInstanceRecord }>(response)
  },
}
