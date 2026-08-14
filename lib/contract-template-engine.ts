import { z } from "zod"

export const contractFieldTypeSchema = z.enum([
  "TEXT",
  "LONG_TEXT",
  "DATE",
  "CURRENCY",
  "NUMBER",
  "CPF_CNPJ",
  "PHONE",
  "EMAIL",
])

export const contractFieldSourceSchema = z.enum([
  "CLIENT",
  "PROPERTY",
  "BROKER",
  "CONTRACT",
  "ADDITIONAL_PARTY",
  "NONE",
])

export const contractFieldBindingSchema = z.enum([
  "client.name",
  "client.email",
  "client.phone",
  "client.cpfCnpj",
  "client.rg",
  "client.nationality",
  "client.profession",
  "client.maritalStatus",
  "client.address",
  "property.title",
  "property.address",
  "property.registryNumber",
  "property.registryOffice",
  "property.ownerName",
  "property.price",
  "property.city",
  "property.neighborhood",
  "broker.name",
  "broker.email",
  "broker.phone",
  "broker.creci",
  "broker.agencyName",
  "contract.value",
  "contract.startDate",
  "contract.endDate",
  "contract.dueDate",
  "contract.duration",
  "contract.paymentMethod",
  "contract.guarantee",
  "contract.keyDeliveryDate",
  "contract.custom",
  "additionalParty.name",
  "additionalParty.email",
  "additionalParty.phone",
  "additionalParty.cpfCnpj",
  "additionalParty.rg",
  "additionalParty.nationality",
  "additionalParty.profession",
  "additionalParty.maritalStatus",
  "additionalParty.address",
  "none",
])

export type ContractFieldType = z.infer<typeof contractFieldTypeSchema>
export type ContractFieldSource = z.infer<typeof contractFieldSourceSchema>
export type ContractFieldBinding = z.infer<typeof contractFieldBindingSchema>

export const contractAnalysisSchema = z.object({
  title: z.string().min(1).max(180),
  sections: z.array(z.object({
    title: z.string().min(1).max(160),
    startBlockIndex: z.number().int().min(0),
    endBlockIndex: z.number().int().min(0),
  })).max(80),
  parties: z.array(z.object({
    key: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    required: z.boolean(),
    description: z.string().max(240),
  })).max(30),
  fields: z.array(z.object({
    label: z.string().min(1).max(160),
    type: contractFieldTypeSchema,
    required: z.boolean(),
    blockIndex: z.number().int().min(0),
    exactText: z.string().min(1).max(500),
    occurrenceIndex: z.number().int().min(0),
    source: contractFieldSourceSchema,
    binding: contractFieldBindingSchema,
    partyKey: z.string().max(80),
    confidence: z.number().min(0).max(1),
    needsReview: z.boolean(),
    rationale: z.string().max(240),
  })).max(250),
  warnings: z.array(z.string().max(300)).max(40),
  partiallyRecognized: z.boolean(),
})

export type ContractAnalysis = z.infer<typeof contractAnalysisSchema>

export const contractTemplateBlockSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  type: z.enum(["TITLE", "HEADING", "CLAUSE", "PARAGRAPH", "SIGNATURE"]),
  text: z.string(),
})

export const contractTemplateFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: contractFieldTypeSchema,
  required: z.boolean(),
  blockId: z.string(),
  exactText: z.string(),
  occurrenceIndex: z.number().int().min(0),
  source: contractFieldSourceSchema,
  binding: contractFieldBindingSchema,
  partyId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reviewStatus: z.enum(["SUGGESTED", "REVIEW_REQUIRED", "CONFIRMED"]),
  defaultValue: z.string().nullable(),
})

export const contractTemplateStructureSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string(),
  blocks: z.array(contractTemplateBlockSchema),
  sections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    startBlockId: z.string(),
    endBlockId: z.string(),
  })),
  parties: z.array(z.object({
    id: z.string(),
    label: z.string(),
    required: z.boolean(),
    description: z.string(),
  })),
  fields: z.array(contractTemplateFieldSchema),
  warnings: z.array(z.string()),
  partiallyRecognized: z.boolean(),
})

export type ContractTemplateStructure = z.infer<typeof contractTemplateStructureSchema>
export type ContractTemplateField = z.infer<typeof contractTemplateFieldSchema>

function stableKey(value: string, fallback: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
  return normalized || fallback
}

function inferBlockType(text: string, index: number): ContractTemplateStructure["blocks"][number]["type"] {
  const trimmed = text.trim()
  if (index === 0 || (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s\d–—-]{8,}$/.test(trimmed) && trimmed.length <= 180)) return "TITLE"
  if (/^(CL[ÁA]USULA|CAP[ÍI]TULO|SE[CÇ][ÃA]O|PAR[ÁA]GRAFO)\b/i.test(trimmed)) return "CLAUSE"
  if (/^(ASSINATURAS?|TESTEMUNHAS?)\b/i.test(trimmed)) return "SIGNATURE"
  if (trimmed.length <= 120 && !/[.!?;:]$/.test(trimmed)) return "HEADING"
  return "PARAGRAPH"
}

const MAX_CONTRACT_BLOCK_CHARS = 1_800

function splitOversizedContractParagraph(paragraph: string) {
  const compact = paragraph.replace(/\n+/g, " ").trim()
  if (compact.length <= MAX_CONTRACT_BLOCK_CHARS) return [compact]

  // PDF extractors commonly return a whole page (or several pages) as one
  // paragraph. Smaller semantic blocks keep the preview readable and give the
  // field classifier enough local context without changing the legal text.
  const sentences = compact.match(/[^.!?;:]+[.!?;:]*(?:\s+|$)/g)?.map((item) => item.trim()).filter(Boolean) ?? [compact]
  const chunks: string[] = []
  let current = ""

  function flush() {
    if (!current) return
    chunks.push(current)
    current = ""
  }

  for (const sentence of sentences) {
    if (sentence.length <= MAX_CONTRACT_BLOCK_CHARS) {
      const candidate = current ? `${current} ${sentence}` : sentence
      if (candidate.length <= MAX_CONTRACT_BLOCK_CHARS) {
        current = candidate
      } else {
        flush()
        current = sentence
      }
      continue
    }

    flush()
    let remaining = sentence
    while (remaining.length > MAX_CONTRACT_BLOCK_CHARS) {
      const boundary = remaining.lastIndexOf(" ", MAX_CONTRACT_BLOCK_CHARS)
      const splitAt = boundary >= Math.floor(MAX_CONTRACT_BLOCK_CHARS * 0.6)
        ? boundary
        : MAX_CONTRACT_BLOCK_CHARS
      chunks.push(remaining.slice(0, splitAt).trim())
      remaining = remaining.slice(splitAt).trim()
    }
    current = remaining
  }
  flush()
  return chunks.filter(Boolean)
}

export function splitContractTextIntoBlocks(text: string) {
  const normalized = text
    .split("\u0000").join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim()

  const paragraphs = normalized
    .split(/\n\s*\n|(?=\n(?:CL[ÁA]USULA|CAP[ÍI]TULO|SE[CÇ][ÃA]O)\b)/i)
    .flatMap(splitOversizedContractParagraph)
    .filter(Boolean)

  return paragraphs.map((paragraph, index) => ({
    id: `block-${index + 1}`,
    order: index,
    type: inferBlockType(paragraph, index),
    text: paragraph,
  }))
}

export function buildTextOnlyContractTemplateStructure(input: {
  text: string
  title?: string
  warning?: string
}): ContractTemplateStructure {
  const blocks = splitContractTextIntoBlocks(input.text)
  if (blocks.length === 0) throw new Error("O documento não possui conteúdo textual preservado.")
  const inferredTitle = blocks.find((block) => block.type === "TITLE")?.text || blocks[0].text
  return contractTemplateStructureSchema.parse({
    schemaVersion: 1,
    title: input.title?.trim() || inferredTitle.slice(0, 180) || "Contrato",
    blocks,
    sections: [],
    parties: [],
    fields: [],
    warnings: input.warning ? [input.warning] : [],
    partiallyRecognized: true,
  })
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0
  let count = 0
  let cursor = 0
  while (cursor <= haystack.length) {
    const index = haystack.indexOf(needle, cursor)
    if (index < 0) break
    count += 1
    cursor = index + needle.length
  }
  return count
}

export function validateContractTemplateOccurrences(structure: ContractTemplateStructure) {
  const blockById = new Map(structure.blocks.map((block) => [block.id, block]))
  return structure.fields.filter((field) => {
    const block = blockById.get(field.blockId)
    return !block || countOccurrences(block.text, field.exactText) <= field.occurrenceIndex
  })
}

export function buildContractTemplateStructure(
  blocks: ContractTemplateStructure["blocks"],
  analysis: ContractAnalysis,
): ContractTemplateStructure {
  const partyIds = new Map<string, string>()
  const parties = analysis.parties.map((party, index) => {
    const id = `party-${stableKey(party.key || party.label, String(index + 1))}-${index + 1}`
    partyIds.set(party.key, id)
    return { id, label: party.label, required: party.required, description: party.description }
  })

  const rejectedFields: string[] = []
  const fields = analysis.fields.flatMap((field, index) => {
    const block = blocks[field.blockIndex]
    if (!block || countOccurrences(block.text, field.exactText) <= field.occurrenceIndex) {
      rejectedFields.push(field.label)
      return []
    }
    return [{
      id: `field-${stableKey(field.label, String(index + 1))}-${index + 1}`,
      label: field.label,
      type: field.type,
      required: field.required,
      blockId: block.id,
      exactText: field.exactText,
      occurrenceIndex: field.occurrenceIndex,
      source: field.source,
      binding: field.binding,
      partyId: field.partyKey ? partyIds.get(field.partyKey) ?? null : null,
      confidence: field.confidence,
      reviewStatus: field.needsReview || field.confidence < 0.82 ? "REVIEW_REQUIRED" as const : "SUGGESTED" as const,
      defaultValue: field.exactText,
    }]
  })

  const sections = analysis.sections.flatMap((section, index) => {
    const start = blocks[section.startBlockIndex]
    const end = blocks[section.endBlockIndex]
    if (!start || !end || section.endBlockIndex < section.startBlockIndex) return []
    return [{
      id: `section-${stableKey(section.title, String(index + 1))}-${index + 1}`,
      title: section.title,
      startBlockId: start.id,
      endBlockId: end.id,
    }]
  })

  return contractTemplateStructureSchema.parse({
    schemaVersion: 1,
    title: analysis.title,
    blocks,
    sections,
    parties,
    fields,
    warnings: [
      ...analysis.warnings,
      ...(rejectedFields.length > 0
        ? [`${rejectedFields.length} campo(s) sugerido(s) não coincidiam exatamente com o documento e foram mantidos apenas como texto fixo.`]
        : []),
    ],
    partiallyRecognized: analysis.partiallyRecognized || rejectedFields.length > 0,
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function findOccurrence(text: string, needle: string, occurrenceIndex: number) {
  let cursor = 0
  for (let occurrence = 0; occurrence <= occurrenceIndex; occurrence += 1) {
    const index = text.indexOf(needle, cursor)
    if (index < 0) return -1
    if (occurrence === occurrenceIndex) return index
    cursor = index + needle.length
  }
  return -1
}

export function renderContractBlock(
  block: ContractTemplateStructure["blocks"][number],
  fields: ContractTemplateField[],
  values: Record<string, string>,
) {
  const replacements = fields
    .filter((field) => field.blockId === block.id)
    .map((field) => ({
      field,
      index: findOccurrence(block.text, field.exactText, field.occurrenceIndex),
    }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => b.index - a.index)

  let html = escapeHtml(block.text)
  // Replacement offsets refer to raw text, so compose raw fragments before escaping.
  if (replacements.length > 0) {
    let cursor = block.text.length
    const chunks: string[] = []
    for (const replacement of replacements) {
      const end = replacement.index + replacement.field.exactText.length
      if (end > cursor) continue
      chunks.unshift(escapeHtml(block.text.slice(end, cursor)))
      const value = values[replacement.field.id]?.trim()
      chunks.unshift(
        value
          ? `<span class="contract-value">${escapeHtml(value)}</span>`
          : `<span class="contract-missing">${escapeHtml(replacement.field.label)}</span>`,
      )
      cursor = replacement.index
    }
    chunks.unshift(escapeHtml(block.text.slice(0, cursor)))
    html = chunks.join("")
  }
  return html
}

export function calculateContractReadiness(structure: ContractTemplateStructure, values: Record<string, string>) {
  const required = structure.fields.filter((field) => field.required)
  const completed = required.filter((field) => Boolean(values[field.id]?.trim()))
  return {
    score: required.length === 0 ? 100 : Math.round((completed.length / required.length) * 100),
    missing: required.filter((field) => !values[field.id]?.trim()),
    completed: completed.length,
    required: required.length,
  }
}

export function renderContractTemplateHtml(input: {
  structure: ContractTemplateStructure
  values: Record<string, string>
  draft?: boolean
  title?: string
}) {
  const blockFields = input.structure.fields
  const body = input.structure.blocks.map((block) => {
    const className = block.type.toLowerCase()
    return `<div class="block ${className}">${renderContractBlock(block, blockFields, input.values)}</div>`
  }).join("\n")

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.title || input.structure.title)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm 22mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #171717; font-family: Georgia, "Times New Roman", serif; font-size: 11.5pt; line-height: 1.58; }
  main { position: relative; width: 100%; }
  .block { margin: 0 0 12pt; text-align: justify; white-space: pre-wrap; overflow-wrap: anywhere; }
  .title { margin: 0 0 22pt; text-align: center; font-weight: 700; font-size: 14pt; text-transform: uppercase; }
  .heading, .clause { margin-top: 18pt; font-weight: 700; }
  .signature { margin-top: 32pt; text-align: center; }
  .contract-value { background: transparent; }
  .contract-missing { border-bottom: 1px dotted #8a6a13; color: #8a6a13; padding: 0 2px; }
  .draft-watermark { position: fixed; inset: 42% 0 auto; z-index: -1; transform: rotate(-28deg); text-align: center; color: rgba(40,40,40,.08); font: 700 72pt Arial,sans-serif; letter-spacing: .08em; }
  @media screen {
    html, body { min-height: 100%; overflow-x: hidden; }
    body { min-height: 100vh; padding: 7.4% 9.52%; font-size: clamp(7.5px, 1.7vw, 11.5pt); }
    main { min-width: 0; }
    .block { margin-bottom: .95em; }
    .title { margin-bottom: 1.7em; font-size: 1.22em; }
    .heading, .clause { margin-top: 1.45em; }
    .signature { margin-top: 2.6em; }
    .draft-watermark { font-size: clamp(38px, 12vw, 72pt); }
  }
</style></head><body>${input.draft ? '<div class="draft-watermark">RASCUNHO</div>' : ""}<main>${body}</main></body></html>`
}

export function contractStructureToPlainText(structure: ContractTemplateStructure, values: Record<string, string>) {
  return structure.blocks.map((block) => renderContractBlockText(block, structure.fields, values)).join("\n\n")
}

export function renderContractBlockText(
  block: ContractTemplateStructure["blocks"][number],
  fields: ContractTemplateField[],
  values: Record<string, string>,
) {
    let text = block.text
    const replacements = fields
      .filter((field) => field.blockId === block.id)
      .map((field) => ({ field, index: findOccurrence(block.text, field.exactText, field.occurrenceIndex) }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => b.index - a.index)
    for (const replacement of replacements) {
      const value = values[replacement.field.id]?.trim() || `[${replacement.field.label}]`
      text = `${text.slice(0, replacement.index)}${value}${text.slice(replacement.index + replacement.field.exactText.length)}`
    }
    return text
}

export const contractBindingOptions: Array<{ value: ContractFieldBinding; label: string; source: ContractFieldSource }> = [
  { value: "client.name", label: "Cliente / Nome", source: "CLIENT" },
  { value: "client.cpfCnpj", label: "Cliente / CPF ou CNPJ", source: "CLIENT" },
  { value: "client.rg", label: "Cliente / RG", source: "CLIENT" },
  { value: "client.email", label: "Cliente / E-mail", source: "CLIENT" },
  { value: "client.phone", label: "Cliente / Telefone", source: "CLIENT" },
  { value: "client.nationality", label: "Cliente / Nacionalidade", source: "CLIENT" },
  { value: "client.profession", label: "Cliente / Profissão", source: "CLIENT" },
  { value: "client.maritalStatus", label: "Cliente / Estado civil", source: "CLIENT" },
  { value: "client.address", label: "Cliente / Endereço", source: "CLIENT" },
  { value: "property.title", label: "Imóvel / Identificação", source: "PROPERTY" },
  { value: "property.address", label: "Imóvel / Endereço", source: "PROPERTY" },
  { value: "property.registryNumber", label: "Imóvel / Matrícula", source: "PROPERTY" },
  { value: "property.registryOffice", label: "Imóvel / Cartório", source: "PROPERTY" },
  { value: "property.ownerName", label: "Imóvel / Proprietário", source: "PROPERTY" },
  { value: "property.price", label: "Imóvel / Valor", source: "PROPERTY" },
  { value: "property.city", label: "Imóvel / Cidade", source: "PROPERTY" },
  { value: "property.neighborhood", label: "Imóvel / Bairro", source: "PROPERTY" },
  { value: "broker.name", label: "Corretor / Nome", source: "BROKER" },
  { value: "broker.email", label: "Corretor / E-mail", source: "BROKER" },
  { value: "broker.phone", label: "Corretor / Telefone", source: "BROKER" },
  { value: "broker.creci", label: "Corretor / CRECI", source: "BROKER" },
  { value: "broker.agencyName", label: "Imobiliária / Nome", source: "BROKER" },
  { value: "contract.value", label: "Contrato / Valor", source: "CONTRACT" },
  { value: "contract.startDate", label: "Contrato / Data de início", source: "CONTRACT" },
  { value: "contract.endDate", label: "Contrato / Data final", source: "CONTRACT" },
  { value: "contract.dueDate", label: "Contrato / Vencimento", source: "CONTRACT" },
  { value: "contract.duration", label: "Contrato / Prazo", source: "CONTRACT" },
  { value: "contract.paymentMethod", label: "Contrato / Pagamento", source: "CONTRACT" },
  { value: "contract.guarantee", label: "Contrato / Garantia", source: "CONTRACT" },
  { value: "contract.keyDeliveryDate", label: "Contrato / Entrega das chaves", source: "CONTRACT" },
  { value: "contract.custom", label: "Informação deste contrato", source: "CONTRACT" },
  { value: "additionalParty.name", label: "Parte adicional / Nome", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.email", label: "Parte adicional / E-mail", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.phone", label: "Parte adicional / Telefone", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.cpfCnpj", label: "Parte adicional / CPF ou CNPJ", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.rg", label: "Parte adicional / RG", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.nationality", label: "Parte adicional / Nacionalidade", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.profession", label: "Parte adicional / Profissão", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.maritalStatus", label: "Parte adicional / Estado civil", source: "ADDITIONAL_PARTY" },
  { value: "additionalParty.address", label: "Parte adicional / Endereço", source: "ADDITIONAL_PARTY" },
  { value: "none", label: "Sem preenchimento automático", source: "NONE" },
]
