import { formatCurrencyBRLFromCents } from "@/lib/currency"
import type { ContractFieldBinding, ContractTemplateStructure } from "@/lib/contract-template-engine"
import { parseLeadAddress, parseLeadIdentification, parsePropertyLegalData } from "@/lib/legal-entities"

export type ContractEntityContext = {
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

export function resolveContractBinding(binding: ContractFieldBinding, context: ContractEntityContext) {
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

export function contractBindingEntitySource(binding: ContractFieldBinding) {
  if (binding.startsWith("client.")) return "CLIENT" as const
  if (binding.startsWith("property.")) return "PROPERTY" as const
  if (binding.startsWith("broker.")) return "BROKER" as const
  return null
}

export type AdditionalPartyEntity = {
  name: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  legalData: unknown
  addressData: unknown
}

export function resolveAdditionalPartyContractBinding(binding: ContractFieldBinding, person: AdditionalPartyEntity) {
  const identification = parseLeadIdentification(person.legalData)
  const address = parseLeadAddress(person.addressData)
  const values: Partial<Record<ContractFieldBinding, string>> = {
    "additionalParty.name": person.name ?? "",
    "additionalParty.email": person.email ?? "",
    "additionalParty.phone": person.whatsapp ?? person.phone ?? "",
    "additionalParty.cpfCnpj": identification.cpfCnpj,
    "additionalParty.rg": identification.rg,
    "additionalParty.nationality": identification.nationality,
    "additionalParty.profession": identification.profession,
    "additionalParty.maritalStatus": identification.maritalStatus,
    "additionalParty.address": addressLine(address),
  }
  return values[binding] ?? ""
}

export function mergeKnownContractValues(input: {
  structure: ContractTemplateStructure
  currentValues?: Record<string, string>
  context: ContractEntityContext
  refreshSources?: Array<"CLIENT" | "PROPERTY" | "BROKER">
}) {
  const values = { ...(input.currentValues ?? {}) }
  for (const field of input.structure.fields) {
    const entitySource = contractBindingEntitySource(field.binding)
    if (entitySource) {
      const resolved = resolveContractBinding(field.binding, input.context)
      if (!input.currentValues || input.refreshSources?.includes(entitySource)) {
        values[field.id] = resolved
      } else if (!values[field.id]?.trim() && resolved.trim()) {
        values[field.id] = resolved
      } else if (!(field.id in values)) {
        values[field.id] = resolved
      }
    } else if (!(field.id in values)) {
      values[field.id] = ""
    }
  }
  return values
}

export type AdditionalPartyContractState = Record<string, { leadId?: string; values?: Record<string, string> }>

export function reconcileAdditionalPartyContractValues(input: {
  structure: ContractTemplateStructure
  storedValues: Record<string, string>
  incomingValues: Record<string, string>
  storedParties: AdditionalPartyContractState
  incomingParties: AdditionalPartyContractState
  hasIncomingValues: boolean
}) {
  const additionalParties = structuredClone(input.incomingParties)
  const values = { ...input.incomingValues }

  for (const party of input.structure.parties) {
    const fields = input.structure.fields.filter(
      (field) => field.partyId === party.id && field.binding.startsWith("additionalParty."),
    )
    if (fields.length === 0) continue

    const stored = input.storedParties[party.id] ?? {}
    const incoming = additionalParties[party.id] ?? {}
    const entityChanged = (stored.leadId ?? "") !== (incoming.leadId ?? "")

    if (entityChanged) {
      additionalParties[party.id] = { leadId: incoming.leadId, values: {} }
      for (const field of fields) values[field.id] = ""
      continue
    }

    if (!input.hasIncomingValues) continue
    const explicitValues = { ...(incoming.values ?? {}) }
    for (const field of fields) {
      if ((values[field.id] ?? "") !== (input.storedValues[field.id] ?? "")) {
        explicitValues[field.id] = values[field.id] ?? ""
      }
    }
    additionalParties[party.id] = { leadId: incoming.leadId, values: explicitValues }
  }

  return { additionalParties, values }
}
