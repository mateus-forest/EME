import "server-only"

import {
  calculateContractReadiness,
  buildTextOnlyContractTemplateStructure,
  contractTemplateStructureSchema,
  inspectContractTemplateStructure,
  renderContractTemplateHtml,
  splitContractTextIntoBlocks,
  type ContractTemplateStructure,
} from "@/lib/contract-template-engine"
import type { ContractEntityContext } from "@/lib/contract-template-bindings"

export {
  contractBindingEntitySource,
  mergeKnownContractValues,
  reconcileAdditionalPartyContractValues,
  resolveAdditionalPartyContractBinding,
  resolveContractBinding,
  type AdditionalPartyContractState,
} from "@/lib/contract-template-bindings"

export function createTemplateContractContent(input: {
  instanceId: string
  title: string
  status: string
  html: string
  author: ContractEntityContext["broker"]
  lead: ContractEntityContext["lead"] & { id?: string } | null
  property: ContractEntityContext["property"] & { id?: string; publicCode?: number | null } | null
  createdAt?: Date
}) {
  const now = (input.createdAt ?? new Date()).toISOString()
  return JSON.stringify({
    version: 3,
    kind: "Modelo próprio",
    status: input.status,
    source: "template",
    templateInstanceId: input.instanceId,
    title: input.title,
    authorName: input.author.user.name,
    authorEmail: input.author.user.email,
    authorPhone: input.author.phone || input.author.user.phone,
    authorCreci: input.author.creci,
    authorAgencyName: input.author.agency?.name ?? null,
    createdAt: now,
    updatedAt: now,
    lead: input.lead ? {
      id: input.lead.id ?? null,
      name: input.lead.name,
      email: input.lead.email,
      phone: input.lead.whatsapp ?? input.lead.phone,
    } : null,
    property: input.property ? {
      id: input.property.id ?? null,
      publicCode: input.property.publicCode ?? null,
      title: input.property.title,
      city: input.property.city,
      neighborhood: input.property.neighborhood,
      ownerName: input.property.ownerName,
      priceCents: input.property.price,
    } : null,
    financial: {},
    clauses: [],
    reviewNotes: [],
    attachment: null,
    html: input.html,
  })
}

export function parseTemplateStructure(value: unknown) {
  return contractTemplateStructureSchema.parse(value)
}

export function parseStoredTemplateStructure(value: unknown, originalText: string) {
  const parsed = contractTemplateStructureSchema.safeParse(value)
  if (parsed.success && parsed.data.blocks.length > 0) return parsed.data

  if (splitContractTextIntoBlocks(originalText).length === 0) {
    throw new Error("A versão deste modelo não possui conteúdo textual preservado.")
  }

  return buildTextOnlyContractTemplateStructure({
    text: originalText,
    title: parsed.success ? parsed.data.title : undefined,
    warning: "Estrutura textual restaurada a partir do arquivo original preservado.",
  })
}

export function buildInstanceSnapshot(input: {
  structure: ContractTemplateStructure
  values: Record<string, string>
  title: string
  draft?: boolean
}) {
  const readiness = calculateContractReadiness(input.structure, input.values)
  return {
    readiness,
    html: renderContractTemplateHtml({
      structure: input.structure,
      values: input.values,
      draft: input.draft ?? readiness.score < 100,
      title: input.title,
    }),
  }
}

export function serializeContractTemplate(template: {
  id: string
  name: string
  status: string
  currentVersion: number
  createdAt: Date
  updatedAt: Date
  versions: Array<{
    id: string
    version: number
    status: string
    sourceFileName: string
    sourceMimeType: string
    sourceFileSize: number | null
    originalText: string
    structure: unknown
    analysisMetadata: unknown
    reviewedAt: Date | null
    createdAt: Date
  }>
}) {
  const version = template.versions.find((item) => item.version === template.currentVersion) ?? template.versions[0]
  let structure: ContractTemplateStructure | null = null
  if (version) {
    try {
      structure = parseStoredTemplateStructure(version.structure, version.originalText)
    } catch {
      structure = null
    }
  }
  const structurallyReady = structure
    ? inspectContractTemplateStructure(structure).canMarkReady
    : false
  const effectiveTemplateStatus = template.status === "READY" && !structurallyReady
    ? "REVIEW_REQUIRED"
    : template.status
  const effectiveVersionStatus = version?.status === "READY" && !structurallyReady
    ? "REVIEW_REQUIRED"
    : version?.status
  return {
    id: template.id,
    name: template.name,
    status: effectiveTemplateStatus,
    currentVersion: template.currentVersion,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    version: version ? {
      id: version.id,
      number: version.version,
      status: effectiveVersionStatus,
      sourceFileName: version.sourceFileName,
      sourceMimeType: version.sourceMimeType,
      sourceFileSize: version.sourceFileSize,
      structure,
      analysisMetadata: version.analysisMetadata,
      reviewedAt: version.reviewedAt?.toISOString() ?? null,
      createdAt: version.createdAt.toISOString(),
    } : null,
  }
}
