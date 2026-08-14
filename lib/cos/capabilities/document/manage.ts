import { createCosAwaitingInputResult, createCosErrorResult, createCosSuccessResult } from "@/lib/cos/action-result"
import { createPendingInput } from "@/lib/cos/pending-input"
import { prisma } from "@/lib/prisma"
import type { CosCapabilityHandler } from "@/lib/cos/types"

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function resolveRequestedDocumentId(input: Parameters<CosCapabilityHandler>[0]) {
  const payload = asRecord(input.payload)
  const contextId = input.context?.selectedEntityIds.document
  const pendingData = asRecord(input.pendingInput?.parsedData)
  return [payload.documentId, pendingData.documentId, contextId]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
}

export const listDocumentsCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const documents = await prisma.brokerDocument.findMany({
    where: { brokerId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, title: true, type: true, status: true, updatedAt: true },
  })

  return createCosSuccessResult({
    response: documents.length
      ? `Encontrei ${documents.length} documento${documents.length === 1 ? "" : "s"}:\n\n${documents
          .map((document, index) => `${index + 1}. ${document.title} — ${document.status}`)
          .join("\n")}`
      : "Você ainda não possui documentos cadastrados.",
    metadata: {
      documentIds: documents.map((document) => document.id),
      documents: documents.map((document) => ({
        id: document.id,
        label: document.title,
        type: document.type,
        status: document.status,
        updatedAt: document.updatedAt.toISOString(),
      })),
      resultCount: documents.length,
    },
  })
}

export const getDocumentCapability: CosCapabilityHandler = async (input) => {
  const documentId = resolveRequestedDocumentId(input)
  const documents = await prisma.brokerDocument.findMany({
    where: {
      brokerId: input.brokerId,
      ...(documentId ? { id: documentId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: documentId ? 1 : 10,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      content: true,
      leadId: true,
      propertyId: true,
      updatedAt: true,
    },
  })

  if (documentId && documents.length === 0) {
    return createCosErrorResult({
      errorCode: "COS_DOCUMENT_NOT_FOUND",
      response: "Não encontrei esse documento na sua conta.",
      metadata: { documentId },
    })
  }

  if (!documentId) {
    if (documents.length === 0) {
      return createCosErrorResult({
        errorCode: "COS_DOCUMENT_NOT_FOUND",
        response: "Você ainda não possui documentos cadastrados.",
        metadata: {},
      })
    }

    const pendingInput = createPendingInput({
      field: "document",
      label: "Documento",
      type: "selection",
      action: "GET_DOCUMENT",
      entity: "operation",
      capabilityId: "document.get",
      reason: "document_target_required",
      parsedData: {},
      options: documents.map((document) => ({
        id: document.id,
        label: document.title,
        description: `${document.type} — ${document.status}`,
      })),
    })
    return createCosAwaitingInputResult({
      response: "Qual documento você deseja consultar?",
      pendingInput,
      metadata: { noCharge: true },
    })
  }

  const document = documents[0]
  const textPreview = document.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 700)
  return createCosSuccessResult({
    response: `${document.title}\nStatus: ${document.status}${textPreview ? `\n\n${textPreview}` : ""}`,
    metadata: {
      documentId: document.id,
      documentType: document.type,
      documentStatus: document.status,
      leadId: document.leadId,
      propertyId: document.propertyId,
      updatedAt: document.updatedAt.toISOString(),
    },
    leadId: document.leadId ?? undefined,
    propertyId: document.propertyId ?? undefined,
  })
}

