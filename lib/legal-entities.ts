export type EntityDocumentRecord = {
  id: string
  label: string
  name: string
  url: string
  mimeType: string
  uploadedAt: string
}

export type LeadIdentification = {
  cpfCnpj: string
  rg: string
  issuingAuthority: string
  issueDate: string
  nationality: string
  birthPlace: string
  maritalStatus: string
  propertyRegime: string
  profession: string
}

export type LeadAddress = {
  cep: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

export type LeadLegalData = {
  legalRepresentative: string
  powerOfAttorney: string
  legalNotes: string
}

export type PropertyLegalData = {
  code: string
  registryNumber: string
  registryOffice: string
  registryBook: string
  registryPage: string
  municipalRegistration: string
  taxRegistration: string
  cep: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  privateArea: string
  totalArea: string
  idealFraction: string
  condominiumName: string
  condominiumFee: string
  iptuValue: string
  additionalFees: string
  legalNotes: string
}

export type CompletionSummary = {
  score: number
  pending: string[]
}

export const defaultLeadIdentification: LeadIdentification = {
  cpfCnpj: "",
  rg: "",
  issuingAuthority: "",
  issueDate: "",
  nationality: "",
  birthPlace: "",
  maritalStatus: "",
  propertyRegime: "",
  profession: "",
}

export const defaultLeadAddress: LeadAddress = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
}

export const defaultLeadLegalData: LeadLegalData = {
  legalRepresentative: "",
  powerOfAttorney: "",
  legalNotes: "",
}

export const defaultPropertyLegalData: PropertyLegalData = {
  code: "",
  registryNumber: "",
  registryOffice: "",
  registryBook: "",
  registryPage: "",
  municipalRegistration: "",
  taxRegistration: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  privateArea: "",
  totalArea: "",
  idealFraction: "",
  condominiumName: "",
  condominiumFee: "",
  iptuValue: "",
  additionalFees: "",
  legalNotes: "",
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {}
}

function asString(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function parseLeadIdentification(value: unknown): LeadIdentification {
  const source = asObject(value)
  return {
    cpfCnpj: asString(source.cpfCnpj),
    rg: asString(source.rg),
    issuingAuthority: asString(source.issuingAuthority),
    issueDate: asString(source.issueDate),
    nationality: asString(source.nationality),
    birthPlace: asString(source.birthPlace),
    maritalStatus: asString(source.maritalStatus),
    propertyRegime: asString(source.propertyRegime),
    profession: asString(source.profession),
  }
}

export function parseLeadAddress(value: unknown): LeadAddress {
  const source = asObject(value)
  return {
    cep: asString(source.cep),
    street: asString(source.street),
    number: asString(source.number),
    complement: asString(source.complement),
    district: asString(source.district),
    city: asString(source.city),
    state: asString(source.state),
  }
}

export function parseLeadLegalData(value: unknown): LeadLegalData {
  const source = asObject(value)
  return {
    legalRepresentative: asString(source.legalRepresentative),
    powerOfAttorney: asString(source.powerOfAttorney),
    legalNotes: asString(source.legalNotes),
  }
}

export function parsePropertyLegalData(value: unknown): PropertyLegalData {
  const source = asObject(value)
  return {
    code: asString(source.code),
    registryNumber: asString(source.registryNumber),
    registryOffice: asString(source.registryOffice),
    registryBook: asString(source.registryBook),
    registryPage: asString(source.registryPage),
    municipalRegistration: asString(source.municipalRegistration),
    taxRegistration: asString(source.taxRegistration),
    cep: asString(source.cep),
    street: asString(source.street),
    number: asString(source.number),
    complement: asString(source.complement),
    district: asString(source.district),
    city: asString(source.city),
    state: asString(source.state),
    privateArea: asString(source.privateArea),
    totalArea: asString(source.totalArea),
    idealFraction: asString(source.idealFraction),
    condominiumName: asString(source.condominiumName),
    condominiumFee: asString(source.condominiumFee),
    iptuValue: asString(source.iptuValue),
    additionalFees: asString(source.additionalFees),
    legalNotes: asString(source.legalNotes),
  }
}

export function parseEntityDocuments(value: unknown): EntityDocumentRecord[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const source = asObject(item)
      const url = asString(source.url)
      if (!url) return null

      return {
        id: asString(source.id) || crypto.randomUUID(),
        label: asString(source.label),
        name: asString(source.name) || asString(source.label) || "Documento",
        url,
        mimeType: asString(source.mimeType),
        uploadedAt: asString(source.uploadedAt) || new Date().toISOString(),
      } satisfies EntityDocumentRecord
    })
    .filter((item): item is EntityDocumentRecord => Boolean(item))
}

function buildCompletion(requiredFields: Array<{ label: string; value: string }>): CompletionSummary {
  const completed = requiredFields.filter((field) => field.value.trim()).length
  const score = requiredFields.length ? Math.round((completed / requiredFields.length) * 100) : 100
  return {
    score,
    pending: requiredFields.filter((field) => !field.value.trim()).map((field) => field.label),
  }
}

export function computeLeadCompletion(input: {
  name: string
  email: string
  phone: string
  identification: LeadIdentification
  address: LeadAddress
}) {
  return buildCompletion([
    { label: "Nome completo", value: input.name },
    { label: "CPF/CNPJ", value: input.identification.cpfCnpj },
    { label: "RG", value: input.identification.rg },
    { label: "Estado civil", value: input.identification.maritalStatus },
    { label: "Regime de bens", value: input.identification.propertyRegime },
    { label: "Nacionalidade", value: input.identification.nationality },
    { label: "Profissao", value: input.identification.profession },
    { label: "Telefone", value: input.phone },
    { label: "Email", value: input.email },
    { label: "CEP", value: input.address.cep },
    { label: "Rua", value: input.address.street },
    { label: "Cidade", value: input.address.city },
    { label: "Estado", value: input.address.state },
  ])
}

export function computePropertyCompletion(input: {
  title: string
  ownerName: string
  price: string
  legal: PropertyLegalData
}) {
  return buildCompletion([
    { label: "Titulo", value: input.title },
    { label: "Proprietario", value: input.ownerName },
    { label: "Valor", value: input.price },
    { label: "Matricula", value: input.legal.registryNumber },
    { label: "Cartorio", value: input.legal.registryOffice },
    { label: "Area privativa", value: input.legal.privateArea },
    { label: "Inscricao imobiliaria", value: input.legal.taxRegistration },
    { label: "CEP", value: input.legal.cep },
    { label: "Rua", value: input.legal.street },
    { label: "Cidade", value: input.legal.city },
    { label: "Estado", value: input.legal.state },
  ])
}
