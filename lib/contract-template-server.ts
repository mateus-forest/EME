import "server-only"

import { formatCurrencyBRLFromCents } from "@/lib/currency"
import {
  calculateContractReadiness,
  contractTemplateStructureSchema,
  renderContractTemplateHtml,
  splitContractTextIntoBlocks,
  type ContractFieldBinding,
  type ContractTemplateStructure,
} from "@/lib/contract-template-engine"
import { parseLeadAddress, parseLeadIdentification, parsePropertyLegalData } from "@/lib/legal-entities"

type EntityContext = {
  lead: {
    name: string | null
    email: string | null
    phone: string | null
    whatsapp: string | null
    legalData: unknown
    addressData: unknown
  } | null
  property: {
    title: string
    price: number
    city: string
    neighborhood: string | null
    ownerName: string | null
    legalData: unknown
  } | null
  broker: {
    user: { name: string; email: string; phone: string | null }
    phone: string
    creci: string | null
    agency: { name: string } | null
  }
}

function addressLine(parts: {
  street?: string
  number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
}) {
  const street = [parts.street, parts.number].filter(Boolean).join(", ")
  return [street, parts.complement, parts.district, [parts.city, parts.state].filter(Boolean).join(" - ")]
    .filter(Boolean)
    .join(", ")
}

export function resolveContractBinding(binding: ContractFieldBinding, context: EntityContext) {
  const leadIdentification = parseLeadIdentification(context.lead?.legalData)
  const leadAddress = parseLeadAddress(context.lead?.addressData)
  const propertyLegal = parsePropertyLegalData(context.property?.legalData)
  const values: Partial<Record<ContractFieldBinding, string>> = {
    "client.name": context.lead?.name ?? "",
    "client.email": context.lead?.email ?? "",
    "client.phone": context.lead?.whatsapp ?? context.lead?.phone ?? "",
    "client.cpfCnpj": leadIdentification.cpfCnpj,
    "client.rg": leadIdentification.rg,
    "client.nationality": leadIdentification.nationality,
    "client.profession": leadIdentification.profession,
    "client.maritalStatus": leadIdentification.maritalStatus,
    "client.address": addressLine(leadAddress),
    "property.title": context.property?.title ?? "",
    "property.address": addressLine({
      street: propertyLegal.street,
      number: propertyLegal.number,
      complement: propertyLegal.complement,
      district: propertyLegal.district || context.property?.neighborhood || "",
      city: propertyLegal.city || context.property?.city || "",
      state: propertyLegal.state,
    }),
    "property.registryNumber": propertyLegal.registryNumber,
    "property.registryOffice": propertyLegal.registryOffice,
    "property.ownerName": context.property?.ownerName ?? "",
    "property.price": context.property ? formatCurrencyBRLFromCents(context.property.price) : "",
    "property.city": propertyLegal.city || context.property?.city || "",
    "property.neighborhood": propertyLegal.district || context.property?.neighborhood || "",
    "broker.name": context.broker.user.name,
    "broker.email": context.broker.user.email,
    "broker.phone": context.broker.phone || context.broker.user.phone || "",
    "broker.creci": context.broker.creci ?? "",
    "broker.agencyName": context.broker.agency?.name ?? "",
  }
  return values[binding] ?? ""
}

export function mergeKnownContractValues(input: {
  structure: ContractTemplateStructure
  currentValues?: Record<string, string>
  context: EntityContext
  refreshSources?: Array<"CLIENT" | "PROPERTY" | "BROKER">
}) {
  const values = { ...(input.currentValues ?? {}) }
  for (const field of input.structure.fields) {
    if (["CLIENT", "PROPERTY", "BROKER"].includes(field.source)) {
      const resolved = resolveContractBinding(field.binding, input.context)
      if (!input.currentValues || input.refreshSources?.includes(field.source as "CLIENT" | "PROPERTY" | "BROKER")) {
        values[field.id] = resolved
      } else if (!(field.id in values)) values[field.id] = resolved
    } else if (!(field.id in values)) {
      values[field.id] = ""
    }
  }
  return values
}

export function createTemplateContractContent(input: {
  instanceId: string
  title: string
  status: string
  html: string
  author: EntityContext["broker"]
  lead: EntityContext["lead"] & { id?: string } | null
  property: EntityContext["property"] & { id?: string; publicCode?: number | null } | null
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
  const parsed = contractTemplateStructureSchema.parse(value)
  if (parsed.blocks.length > 0) return parsed

  const blocks = splitContractTextIntoBlocks(originalText)
  if (blocks.length === 0) {
    throw new Error("A versão deste modelo não possui conteúdo textual preservado.")
  }

  return contractTemplateStructureSchema.parse({
    ...parsed,
    title: parsed.title || blocks[0]?.text || "Contrato",
    blocks,
    sections: [],
    fields: [],
    warnings: [...parsed.warnings, "Estrutura textual restaurada a partir do arquivo original preservado."],
    partiallyRecognized: true,
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
  return {
    id: template.id,
    name: template.name,
    status: template.status,
    currentVersion: template.currentVersion,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    version: version ? {
      id: version.id,
      number: version.version,
      status: version.status,
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
