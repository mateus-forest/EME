import type { ContractAttachment, ContractType } from "@/lib/contract-template"
import type { EntityDocumentRecord } from "@/lib/legal-entities"

export function getLinkedContractDocumentId(contractId: string) {
  return `contract:${contractId}`
}

export function buildLinkedContractDocument(input: {
  contractId: string
  title: string
  kind: ContractType
  attachment: ContractAttachment
  updatedAt: string
}): EntityDocumentRecord {
  return {
    id: getLinkedContractDocumentId(input.contractId),
    label: "Contrato",
    name: input.title || input.attachment.fileName || `Contrato ${input.kind}`,
    url: `/api/brokers/contracts/${encodeURIComponent(input.contractId)}/file`,
    mimeType: input.attachment.mimeType || "application/octet-stream",
    uploadedAt: input.updatedAt,
  }
}

export function upsertLinkedContractDocument(
  documents: EntityDocumentRecord[],
  linkedDocument: EntityDocumentRecord,
) {
  const filtered = documents.filter((document) => document.id !== linkedDocument.id)
  return [...filtered, linkedDocument]
}

export function removeLinkedContractDocument(documents: EntityDocumentRecord[], contractId: string) {
  const linkedDocumentId = getLinkedContractDocumentId(contractId)
  return documents.filter((document) => document.id !== linkedDocumentId)
}
