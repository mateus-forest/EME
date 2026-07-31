import { mapPropertyType, type PropertyApiItem } from "@/lib/property-contract"
import type { PropertyType } from "@/lib/prisma-enums"

export const XML_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const XML_IMPORT_MAX_PROPERTIES = 50

export type XmlImportStatus = "ready" | "needs_review" | "invalid"

export type ParsedXmlProperty = {
  title: string
  description: string
  price: string
  type: PropertyApiItem["type"]
  city: string
  neighborhood: string
  address: string
  bedrooms: number
  bathrooms: number
  parking: number
  area: string
  images: string[]
  externalRef: string
  status: XmlImportStatus
  issues: string[]
}

type AliasMap = Record<string, string[]>

const fieldAliases: AliasMap = {
  title: ["title", "titulo", "título", "nome", "headline", "referencia", "referência"],
  description: ["description", "descricao", "descrição", "detalhes", "observacao", "observação"],
  price: ["price", "valor", "valorvenda", "saleprice", "preco", "preço"],
  type: ["type", "tipo", "tipoimovel", "tipoImovel", "propertytype"],
  city: ["city", "cidade"],
  neighborhood: ["neighborhood", "bairro", "district"],
  address: ["address", "endereco", "endereço", "logradouro"],
  bedrooms: ["bedrooms", "quartos", "dormitorios", "dormitórios", "suites", "suítes"],
  bathrooms: ["bathrooms", "banheiros", "wc"],
  parking: ["parking", "vagas", "garagens", "garage"],
  area: ["area", "areautil", "áreautil", "areaUtil", "area_total", "areatotal"],
  externalRef: ["externalid", "externalId", "codigo", "código", "referencia", "referência", "ref", "idexterno"],
}

const imageAliases = ["images", "image", "fotos", "foto", "url", "imageurl", "imageUrl", "imagem"]

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function cleanText(value: string) {
  return decodeXmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000)
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function findTagValue(xml: string, aliases: string[]) {
  for (const alias of aliases) {
    const tagPattern = new RegExp(
      `<(?:[a-zA-Z0-9_.-]+:)?${escapeRegex(alias)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_.-]+:)?${escapeRegex(alias)}>`,
      "i",
    )
    const match = tagPattern.exec(xml)
    const value = match ? cleanText(match[1] ?? "") : ""

    if (value) return value
  }

  return ""
}

function findImages(xml: string) {
  const urls = new Set<string>()

  for (const alias of imageAliases) {
    const tagPattern = new RegExp(
      `<(?:[a-zA-Z0-9_.-]+:)?${escapeRegex(alias)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_.-]+:)?${escapeRegex(alias)}>`,
      "gi",
    )
    let match: RegExpExecArray | null

    while ((match = tagPattern.exec(xml))) {
      const value = cleanText(match[1] ?? "")
      if (/^https?:\/\//i.test(value)) {
        urls.add(value)
      }
    }
  }

  const attributePattern = /\b(?:url|src|href)=["'](https?:\/\/[^"']+)["']/gi
  let attributeMatch: RegExpExecArray | null
  while ((attributeMatch = attributePattern.exec(xml))) {
    urls.add(decodeXmlEntities(attributeMatch[1] ?? "").trim())
  }

  return Array.from(urls).slice(0, 6)
}

function parseInteger(value: string) {
  const number = Number.parseInt(value.replace(/[^\d]/g, ""), 10)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function normalizePrice(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim()
  if (!cleaned) return ""

  const digits = cleaned.replace(/[^\d]/g, "")
  if (!digits) return ""

  if (cleaned.includes(",") || cleaned.includes(".")) {
    const numeric = Number(cleaned.replace(/\./g, "").replace(",", "."))
    if (Number.isFinite(numeric) && numeric > 0) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric)
    }
  }

  const numeric = Number(digits)
  return Number.isFinite(numeric) && numeric > 0
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric)
    : ""
}

function normalizeType(value: string): ParsedXmlProperty["type"] {
  const normalized = normalizeKey(value)

  if (normalized.includes("casa") || normalized.includes("house")) return "Casa"
  if (normalized.includes("terreno") || normalized.includes("lote") || normalized.includes("land")) return "Terreno"
  if (normalized.includes("cobertura") || normalized.includes("penthouse")) return "Cobertura"
  if (normalized.includes("loja") || normalized.includes("store")) return "Loja"
  if (normalized.includes("salacomercial") || normalized.includes("office") || normalized.includes("escritorio")) return "Sala comercial"
  if (normalized.includes("comercial")) return "Comercial"

  return "Apartamento"
}

function getCandidateNodes(xml: string) {
  const candidates: string[] = []
  const itemNames = ["imovel", "Imovel", "property", "Property", "listing", "Listing", "anuncio", "Anuncio", "realEstate", "RealEstate"]

  for (const itemName of itemNames) {
    const itemPattern = new RegExp(
      `<(?:[a-zA-Z0-9_.-]+:)?${escapeRegex(itemName)}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[a-zA-Z0-9_.-]+:)?${escapeRegex(itemName)}>`,
      "g",
    )
    let match: RegExpExecArray | null

    while ((match = itemPattern.exec(xml))) {
      candidates.push(match[0] ?? "")
    }
  }

  return candidates.length > 0 ? candidates.slice(0, XML_IMPORT_MAX_PROPERTIES) : [xml]
}

function parseNode(nodeXml: string): ParsedXmlProperty {
  const title = findTagValue(nodeXml, fieldAliases.title)
  const description = findTagValue(nodeXml, fieldAliases.description)
  const price = normalizePrice(findTagValue(nodeXml, fieldAliases.price))
  const city = findTagValue(nodeXml, fieldAliases.city)
  const neighborhood = findTagValue(nodeXml, fieldAliases.neighborhood)
  const issues: string[] = []

  if (!title) issues.push("titulo")
  if (!city) issues.push("cidade")
  if (!neighborhood) issues.push("bairro")
  if (!price) issues.push("preco")

  return {
    title,
    description,
    price,
    type: normalizeType(findTagValue(nodeXml, fieldAliases.type)),
    city,
    neighborhood,
    address: findTagValue(nodeXml, fieldAliases.address),
    bedrooms: parseInteger(findTagValue(nodeXml, fieldAliases.bedrooms)),
    bathrooms: parseInteger(findTagValue(nodeXml, fieldAliases.bathrooms)),
    parking: parseInteger(findTagValue(nodeXml, fieldAliases.parking)),
    area: findTagValue(nodeXml, fieldAliases.area),
    images: findImages(nodeXml),
    externalRef: findTagValue(nodeXml, fieldAliases.externalRef),
    status: issues.length === 0 ? "ready" : "needs_review",
    issues,
  }
}

export function parsePropertiesXml(xml: string) {
  const normalizedXml = xml.replace(/^\uFEFF/, "").trim()
  if (!normalizedXml || !normalizedXml.includes("<") || !normalizedXml.includes(">")) {
    throw new Error("Arquivo XML vazio ou invalido.")
  }

  return getCandidateNodes(normalizedXml)
    .map(parseNode)
    .filter((property) => property.title || property.city || property.neighborhood || property.price || property.images.length > 0)
}

export function mapXmlPropertyType(value: ParsedXmlProperty["type"]): PropertyType {
  return mapPropertyType(value) ?? "APARTMENT"
}
