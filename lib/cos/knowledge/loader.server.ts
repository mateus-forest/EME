import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

import type { CosConversationDomain, CosKnowledgeChunk, CosKnowledgeType } from "@/lib/cos/types"

export type CosKnowledgeDocument = {
  id: string
  title: string
  domains: CosConversationDomain[]
  aliases: string[]
  version: string
  updatedAt: string
  knowledgeTypes: CosKnowledgeType[]
  fileName: string
  chunks: CosKnowledgeChunk[]
}

export type CosKnowledgeIndex = {
  documents: CosKnowledgeDocument[]
  chunks: CosKnowledgeChunk[]
  documentsById: Map<string, CosKnowledgeDocument>
  documentIdsByAlias: Map<string, string>
  documentIdsByDomain: Map<CosConversationDomain, string[]>
  documentIdsByType: Map<CosKnowledgeType, string[]>
  sourceVersion: string
}

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge", "eme")
export const COS_KNOWLEDGE_SOURCE_CHUNK_CHARS = 1_600
const FRONTMATTER_FIELDS = ["id", "title", "domains", "aliases", "version", "updated_at", "knowledge_type"] as const
const KNOWN_DOMAINS = new Set(["lead", "property", "proposal", "contract", "agenda", "catalog", "marketplace", "finance", "analytics", "studio", "help", "general"])
const KNOWN_TYPES = new Set(["module", "rule", "glossary", "procedure", "capability"])
let indexPromise: Promise<CosKnowledgeIndex> | null = null

function parseList(value: string, fileName: string) {
  if (!value.startsWith("[") || !value.endsWith("]")) throw new Error(`COS_KNOWLEDGE_INVALID_LIST:${fileName}`)
  return value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean)
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "introducao"
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function splitSection(section: string) {
  const lines = section.split(/\r?\n/)
  const parts: string[] = []
  let current = ""
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line
    if (candidate.length > COS_KNOWLEDGE_SOURCE_CHUNK_CHARS && current) {
      parts.push(current.trim())
      current = line
    } else {
      current = candidate
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts.flatMap((part) => {
    if (part.length <= COS_KNOWLEDGE_SOURCE_CHUNK_CHARS) return [part]
    const slices: string[] = []
    for (let start = 0; start < part.length; start += COS_KNOWLEDGE_SOURCE_CHUNK_CHARS) slices.push(part.slice(start, start + COS_KNOWLEDGE_SOURCE_CHUNK_CHARS))
    return slices
  })
}

function chunkBody(input: {
  id: string
  title: string
  domains: CosConversationDomain[]
  knowledgeTypes: CosKnowledgeType[]
  version: string
  body: string
}) {
  const headingPattern = /^##\s+(.+)$/gm
  const matches = [...input.body.matchAll(headingPattern)]
  const sections: Array<{ heading: string; section: string }> = []
  const firstHeadingStart = matches[0]?.index ?? input.body.length
  const introduction = input.body.slice(0, firstHeadingStart).replace(/^#\s+.+$/m, "").trim()
  if (introduction) sections.push({ heading: "Visão geral", section: introduction })

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const heading = match[1].trim()
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? input.body.length
    const section = input.body.slice(start, end).trim()
    if (section) sections.push({ heading, section })
  }
  let order = 0
  return sections.flatMap(({ heading, section }) => {
    const parts = splitSection(section)
    return parts.map((text, partIndex) => ({
      id: `${input.id}#${slugify(heading)}${parts.length > 1 ? `-parte-${partIndex + 1}` : ""}`,
      sourceId: input.id,
      documentTitle: input.title,
      heading: parts.length > 1 ? `${heading} — parte ${partIndex + 1}` : heading,
      domains: input.domains,
      knowledgeTypes: input.knowledgeTypes,
      version: input.version,
      order: order++,
      text,
      score: 0,
      reason: [],
    }))
  })
}

export function parseCosKnowledgeDocument(fileName: string, source: string): CosKnowledgeDocument {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error(`COS_KNOWLEDGE_INVALID_FRONTMATTER:${fileName}`)
  const metadata = new Map<string, string>()
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator < 1) throw new Error(`COS_KNOWLEDGE_INVALID_METADATA:${fileName}`)
    metadata.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }
  for (const field of FRONTMATTER_FIELDS) if (!metadata.get(field)) throw new Error(`COS_KNOWLEDGE_MISSING_FIELD:${fileName}:${field}`)

  const id = metadata.get("id")!
  const title = metadata.get("title")!
  const domains = parseList(metadata.get("domains")!, fileName) as CosConversationDomain[]
  const aliases = parseList(metadata.get("aliases")!, fileName)
  const version = metadata.get("version")!
  const knowledgeTypes = parseList(metadata.get("knowledge_type")!, fileName) as CosKnowledgeType[]
  for (const domain of domains) if (!KNOWN_DOMAINS.has(domain)) throw new Error(`COS_KNOWLEDGE_UNKNOWN_DOMAIN:${fileName}:${domain}`)
  for (const type of knowledgeTypes) if (!KNOWN_TYPES.has(type)) throw new Error(`COS_KNOWLEDGE_UNKNOWN_TYPE:${fileName}:${type}`)
  return {
    id,
    title,
    domains,
    aliases,
    version,
    updatedAt: metadata.get("updated_at")!,
    fileName,
    chunks: chunkBody({ id, title, domains, knowledgeTypes, version, body: match[2] }),
    knowledgeTypes,
  }
}

async function buildKnowledgeIndex(): Promise<CosKnowledgeIndex> {
  const files = (await readdir(KNOWLEDGE_DIR)).filter((file) => file.endsWith(".md")).sort()
  const documents = await Promise.all(files.map(async (file) => parseCosKnowledgeDocument(file, await readFile(path.join(KNOWLEDGE_DIR, file), "utf8"))))
  const chunks = documents.flatMap((document) => document.chunks)
  const documentsById = new Map<string, CosKnowledgeDocument>()
  const documentIdsByAlias = new Map<string, string>()
  const documentIdsByDomain = new Map<CosConversationDomain, string[]>()
  const documentIdsByType = new Map<CosKnowledgeType, string[]>()

  for (const document of documents) {
    if (documentsById.has(document.id)) throw new Error(`COS_KNOWLEDGE_DUPLICATE_ID:${document.id}`)
    documentsById.set(document.id, document)

    for (const alias of document.aliases) {
      const normalizedAlias = normalizeLookup(alias)
      const existing = documentIdsByAlias.get(normalizedAlias)
      if (existing && existing !== document.id) throw new Error(`COS_KNOWLEDGE_DUPLICATE_ALIAS:${alias}:${existing}:${document.id}`)
      documentIdsByAlias.set(normalizedAlias, document.id)
    }

    for (const domain of document.domains) {
      documentIdsByDomain.set(domain, [...(documentIdsByDomain.get(domain) ?? []), document.id])
    }
    for (const type of document.knowledgeTypes) {
      documentIdsByType.set(type, [...(documentIdsByType.get(type) ?? []), document.id])
    }
  }

  return {
    documents,
    chunks,
    documentsById,
    documentIdsByAlias,
    documentIdsByDomain,
    documentIdsByType,
    sourceVersion: `eme-book:${documents.map((document) => `${document.id}@${document.version}`).join("|")}`,
  }
}

export function loadCosKnowledgeIndex() {
  indexPromise ??= buildKnowledgeIndex()
  return indexPromise
}

export function clearCosKnowledgeIndexCacheForTests() {
  indexPromise = null
}
