import "server-only"

import type { Prisma } from "@prisma/client"

import {
  contractHtmlToText,
  isExternalContractContent,
  normalizeContractStatus,
  parseContractContent,
  stringifyContractContent,
} from "@/lib/contract-template"
import { getCosStatusLabel } from "@/lib/cos/localization"
import { createCosSuccessResult } from "@/lib/cos/action-result"
import { resolveContractEntity } from "@/lib/cos/entity-resolver"
import { prisma } from "@/lib/prisma"

import { cleanText, getEntityIdFromPayload, getPayloadRecord, requiredSelectionResponse } from "@/lib/cos/capabilities/shared"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function contractWhere(brokerId: string, documentId: string) {
  return {
    id: documentId,
    brokerId,
    type: "contract",
  } as const
}

async function resolveContract(brokerId: string, payload: Record<string, unknown>) {
  const contractId = getEntityIdFromPayload(payload, "contract") || getEntityIdFromPayload(payload, "document")
  if (!contractId) return null
  const resolution = await resolveContractEntity({
    brokerId,
    payload,
    message: typeof payload.message === "string" ? payload.message : "",
  })
  return resolution.record
}

function serializeContractSummary(document: {
  id: string
  title: string
  status: string
  updatedAt: Date
  leadId: string | null
  propertyId: string | null
  content: string
}) {
  const content = parseContractContent(document.content)
  const preview = contractHtmlToText(content.html).replace(/\s+/g, " ").trim().slice(0, 220)
  return {
    id: document.id,
    title: document.title,
    status: normalizeContractStatus(document.status) ?? "draft",
    updatedAt: document.updatedAt.toISOString(),
    leadId: document.leadId,
    propertyId: document.propertyId,
    preview,
    content,
  }
}

export const previewContractCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload })
  const contract = await resolveContract(brokerId, payloadRecord)
  if (!contract) return requiredSelectionResponse("contrato", "contractId", undefined, {
    action: "UPDATE_CONTRACT",
    entity: "contract",
    capabilityId: "contract.update",
  })

  const summary = serializeContractSummary(contract)
  return createCosSuccessResult({
    response: `Prévia do contrato:\n\n${summary.title}\nStatus: ${getCosStatusLabel("contract", summary.status)}\n\n${summary.preview || "Prévia ainda não disponível."}`,
    metadata: {
      documentId: contract.id,
      contractId: contract.id,
      leadId: contract.leadId,
      propertyId: contract.propertyId,
      contractStatus: summary.status,
    },
  })
}

export const updateContractCapability: CosCapabilityHandler = async ({ brokerId, message, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message, action: "general", payload })
  const contract = await resolveContract(brokerId, payloadRecord)
  if (!contract) return requiredSelectionResponse("contrato", "contractId")

  const parsed = parseContractContent(contract.content)
  const normalizedMessage = message.toLowerCase()
  const nextStatus =
    normalizeContractStatus(payloadRecord.status) ??
    (normalizedMessage.includes("assinado")
      ? "signed"
      : normalizedMessage.includes("cancel")
        ? "cancelled"
        : normalizedMessage.includes("final")
          ? "completed"
          : null) ??
    normalizeContractStatus(contract.status) ??
    "draft"
  const nextTitle = cleanText(payloadRecord.title, 160) || contract.title
  const nextContent = {
    ...parsed,
    title: nextTitle,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  }

  const updated = await prisma.brokerDocument.update({
    where: { id: contract.id },
    data: {
      title: nextTitle,
      status: nextStatus,
      content: stringifyContractContent(nextContent),
    },
  })

  return {
    response: `Contrato atualizado com sucesso.\n\n${updated.title}\nStatus: ${getCosStatusLabel("contract", nextStatus)}`,
    metadata: {
      documentId: updated.id,
      contractId: updated.id,
      contractStatus: nextStatus,
      leadId: updated.leadId,
      propertyId: updated.propertyId,
    },
  }
}

async function updateContractStatus(input: {
  brokerId: string
  payload: Record<string, unknown>
  status: string
  responseLabel: string
  metadataExtra?: Prisma.InputJsonObject
  action: "SEND_CONTRACT" | "SIGN_CONTRACT" | "CANCEL_CONTRACT"
  capabilityId: "contract.send" | "contract.sign" | "contract.cancel"
}) {
  const contract = await resolveContract(input.brokerId, input.payload)
  if (!contract) return requiredSelectionResponse("contrato", "contractId", undefined, {
    action: input.action,
    entity: "contract",
    capabilityId: input.capabilityId,
  })

  const parsed = parseContractContent(contract.content)
  const nextContent = {
    ...parsed,
    status: normalizeContractStatus(input.status) ?? parsed.status,
    updatedAt: new Date().toISOString(),
  }

  const updated = await prisma.brokerDocument.update({
    where: { id: contract.id },
    data: {
      status: input.status,
      content: stringifyContractContent(nextContent),
    },
  })

  return createCosSuccessResult({
    response: `${input.responseLabel}\n\n${updated.title}`,
    metadata: {
      documentId: updated.id,
      contractId: updated.id,
      contractStatus: input.status,
      leadId: updated.leadId,
      propertyId: updated.propertyId,
      ...(input.metadataExtra ?? {}),
    },
  })
}

export const sendContractCapability: CosCapabilityHandler = async ({ brokerId, payload }) =>
  updateContractStatus({
    brokerId,
    payload: getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload }),
    status: "awaiting_signature",
    responseLabel: "Contrato enviado para assinatura.",
    action: "SEND_CONTRACT",
    capabilityId: "contract.send",
  })

export const signContractCapability: CosCapabilityHandler = async ({ brokerId, payload }) =>
  updateContractStatus({
    brokerId,
    payload: getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload }),
    status: "signed",
    responseLabel: "Contrato marcado como assinado.",
    action: "SIGN_CONTRACT",
    capabilityId: "contract.sign",
  })

export const cancelContractCapability: CosCapabilityHandler = async ({ brokerId, payload }) =>
  updateContractStatus({
    brokerId,
    payload: getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload }),
    status: "cancelled",
    responseLabel: "Contrato cancelado com histórico preservado.",
    action: "CANCEL_CONTRACT",
    capabilityId: "contract.cancel",
  })

export const downloadContractCapability: CosCapabilityHandler = async ({ brokerId, payload }) => {
  const payloadRecord = getPayloadRecord({ brokerId, userId: "", message: "", action: "general", payload })
  const contract = await resolveContract(brokerId, payloadRecord)
  if (!contract) return requiredSelectionResponse("contrato", "contractId")

  const parsed = parseContractContent(contract.content)
  const downloadPath = isExternalContractContent(parsed)
    ? `/api/brokers/contracts/${contract.id}/file`
    : `/corretor/contratos/${contract.id}`

  return {
    response: `Contrato pronto para abertura em nova aba.\n\n${downloadPath}`,
    metadata: {
      documentId: contract.id,
      contractId: contract.id,
      downloadPath,
      leadId: contract.leadId,
      propertyId: contract.propertyId,
    },
  }
}

export const contractHistoryCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const contracts = await prisma.brokerDocument.findMany({
    where: { brokerId, type: "contract" },
    orderBy: { updatedAt: "desc" },
    take: 8,
  })

  const byStatus = contracts.reduce<Record<string, number>>((acc, item) => {
    const key = normalizeContractStatus(item.status) ?? "draft"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return {
    response: contracts.length
      ? `Histórico recente de contratos:\n\n${contracts
          .map((item) => `- ${item.title} (${getCosStatusLabel("contract", normalizeContractStatus(item.status) ?? "draft")})`)
          .join("\n")}`
      : "Ainda não há contratos registrados.",
    metadata: {
      totalContracts: contracts.length,
      contractsByStatus: byStatus,
      documentIds: contracts.map((item) => item.id),
    },
  }
}
