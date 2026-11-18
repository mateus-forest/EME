export type CatalogSearchProperty = { id: string; publicCode?: number | null; title: string; type: string; purpose: string; location: string; neighborhood: string; city: string; description: string; price: string; priceValue: number; bedrooms: number; parking: number; views: number }
export type CatalogAdvancedFilters = { type: string; purpose: string; city: string; neighborhood: string; bedrooms: string; parking: string; maxPrice: string; feature: string }
export const EMPTY_CATALOG_FILTERS: CatalogAdvancedFilters = { type: "", purpose: "", city: "", neighborhood: "", bedrooms: "", parking: "", maxPrice: "", feature: "" }

type SearchFieldName =
  | "title"
  | "type"
  | "purpose"
  | "location"
  | "neighborhood"
  | "city"
  | "description"
  | "code"

type SearchAnalysis = {
  query: string
  tokens: string[]
  expandedTokens: string[]
  maxPrice: number | null
  bedrooms: number | null
  parking: number | null
  type: string
  purpose: string
  features: string[]
  intent: string
}

type PropertySearchIndex = {
  title: string
  type: string
  purpose: string
  location: string
  neighborhood: string
  city: string
  description: string
  code: string
  haystack: string
  tokens: string[]
}

const SEARCH_FIELD_WEIGHTS: Record<SearchFieldName, number> = {
  title: 12,
  type: 11,
  purpose: 8,
  location: 6,
  neighborhood: 9,
  city: 8,
  description: 5,
  code: 7,
}

const FEATURE_KEYWORDS = [
  "frente mar",
  "alto padrao",
  "investimento",
  "suite",
  "sacada",
  "piscina",
  "churrasqueira",
  "academia",
  "gourmet",
  "condominio",
  "jardim",
  "jardins",
] as const

const TOKEN_SYNONYMS: Record<string, string[]> = {
  sala: ["salas", "comercial", "escritorio", "escritorios", "office", "corporativa"],
  comercial: ["sala", "salas", "escritorio", "escritorios", "loja", "corporativa"],
  escritorio: ["escritorios", "sala", "comercial", "office"],
  apartamento: ["apto", "apartamentos"],
  apto: ["apartamento", "apartamentos"],
  cobertura: ["coberturas", "penthouse"],
  casa: ["casas", "residencia", "residencial"],
  terreno: ["terreno", "lote"],
  jardim: ["jardins"],
  jardins: ["jardim"],
  locacao: ["aluguel", "alugar", "residencial", "comercial"],
  venda: ["comprar", "compra"],
  investimento: ["investidor", "renda"],
}

function buildPropertySearchIndex(property: CatalogSearchProperty): PropertySearchIndex {
  const index = {
    title: normalizeText(property.title),
    type: normalizeText(property.type),
    purpose: normalizeText(property.purpose),
    location: normalizeText(property.location),
    neighborhood: normalizeText(property.neighborhood),
    city: normalizeText(property.city),
    description: normalizeText(property.description),
    code: normalizeText(property.publicCode ? String(property.publicCode) : ""),
  }

  const haystack = normalizeText(
    [
      property.title,
      property.type,
      property.purpose,
      property.location,
      property.neighborhood,
      property.city,
      property.description,
      property.publicCode ? `imovel ${property.publicCode}` : "",
      property.bedrooms ? `${property.bedrooms} quartos` : "",
      property.parking ? `${property.parking} vagas` : "",
      property.price,
    ].join(" "),
  )

  return {
    ...index,
    haystack,
    tokens: buildSearchTerms(haystack),
  }
}

export function analyzeSearch(rawSearch: string): SearchAnalysis {
  const query = normalizeText(rawSearch)
  const tokens = buildSearchTerms(query)
  const expandedTokens = Array.from(new Set(tokens.flatMap((token) => [token, ...expandToken(token)])))
  const maxPrice = extractPriceValue(rawSearch)
  const bedrooms = extractNumericIntent(query, ["quarto", "quartos", "dormitorio", "dormitorios"])
  const parking = extractNumericIntent(query, ["vaga", "vagas", "garagem", "garagens"])
  const type = inferSearchType(query, tokens)
  const purpose = inferSearchPurpose(query)
  const features = FEATURE_KEYWORDS.filter((feature) => query.includes(feature))

  return {
    query,
    tokens,
    expandedTokens,
    maxPrice,
    bedrooms,
    parking,
    type,
    purpose,
    features,
    intent:
      [
        type,
        purpose,
        maxPrice ? `ate ${maxPrice}` : "",
        bedrooms ? `${bedrooms} quartos` : "",
        parking ? `${parking} vagas` : "",
        ...features,
      ]
        .filter(Boolean)
        .join(", ") || rawSearch.trim(),
  }
}

export function rankProperties<T extends CatalogSearchProperty>(
  properties: T[],
  analysis: SearchAnalysis,
  filters: CatalogAdvancedFilters,
) {
  return properties
    .map((property) => {
      const index = buildPropertySearchIndex(property)
      const compatible =
        matchesNaturalLanguage(property, analysis, index) &&
        matchesAdvancedFilters(property, filters, index)
      const score = calculatePropertyScore(property, analysis, index, compatible)

      return {
        property,
        compatible,
        score,
        matchLabel: score >= 28 ? "Destaque" : score >= 16 ? "Selecionado" : "Boa opção",
      }
    })
    .filter((item) => item.compatible)
    .sort((first, second) => second.score - first.score || second.property.views - first.property.views)
}

function calculatePropertyScore(
  property: CatalogSearchProperty,
  analysis: SearchAnalysis,
  index: PropertySearchIndex,
  compatible: boolean,
) {
  let score = compatible ? 1 : 0

  if (!analysis.query) score += 2
  if (analysis.type && normalizeText(property.type) === normalizeText(analysis.type)) score += 18
  if (analysis.purpose && normalizeText(property.purpose) === normalizeText(analysis.purpose)) score += 8
  if (analysis.maxPrice && property.priceValue <= analysis.maxPrice) score += 6
  if (analysis.bedrooms && property.bedrooms >= analysis.bedrooms) score += 5
  if (analysis.parking && property.parking >= analysis.parking) score += 4

  for (const feature of analysis.features) {
    if (index.haystack.includes(feature)) score += 7
  }

  for (const token of analysis.expandedTokens) {
    score += scoreTokenAcrossFields(token, index)
  }

  if (analysis.query && index.title.includes(analysis.query)) score += 14
  if (analysis.query && index.type.includes(analysis.query)) score += 11
  if (analysis.query && index.description.includes(analysis.query)) score += 5

  return score
}

function scoreTokenAcrossFields(token: string, index: PropertySearchIndex) {
  let score = 0

  for (const [field, weight] of Object.entries(SEARCH_FIELD_WEIGHTS) as Array<[SearchFieldName, number]>) {
    const value = index[field]
    if (!value) continue
    if (value === token) {
      score += weight + 3
      continue
    }
    if (value.includes(` ${token} `) || value.startsWith(`${token} `) || value.endsWith(` ${token}`)) {
      score += weight + 1
      continue
    }
    if (value.includes(token)) score += Math.max(2, Math.floor(weight / 2))
  }

  return score
}

function matchesNaturalLanguage(property: CatalogSearchProperty, analysis: SearchAnalysis, index: PropertySearchIndex) {
  if (!analysis.query.trim()) return true
  if (analysis.maxPrice && (property.priceValue <= 0 || property.priceValue > analysis.maxPrice)) return false
  if (analysis.bedrooms && property.bedrooms < analysis.bedrooms) return false
  if (analysis.parking && property.parking < analysis.parking) return false
  if (analysis.type && !matchesPropertyType(property.type, analysis.type)) return false
  if (analysis.purpose && normalizeText(property.purpose) !== normalizeText(analysis.purpose)) return false
  if (analysis.features.some((feature) => !index.haystack.includes(feature))) return false

  if (analysis.expandedTokens.length === 0) return true

  return analysis.tokens.every((token) =>
    [token, ...expandToken(token)].some((candidate) =>
      index.haystack.includes(candidate) || (candidate.length >= 5 && hasFuzzyTokenMatch(candidate, index.tokens)),
    ),
  )
}

function matchesAdvancedFilters(property: CatalogSearchProperty, filters: CatalogAdvancedFilters, index: PropertySearchIndex) {
  if (filters.type && normalizeText(property.type) !== normalizeText(filters.type)) return false
  if (filters.purpose && normalizeText(property.purpose) !== normalizeText(filters.purpose)) return false
  if (filters.city && index.city !== normalizeText(filters.city)) return false
  if (filters.neighborhood && index.neighborhood !== normalizeText(filters.neighborhood)) return false

  const bedrooms = Number(filters.bedrooms)
  if (Number.isFinite(bedrooms) && bedrooms > 0 && property.bedrooms < bedrooms) return false

  const parking = Number(filters.parking)
  if (Number.isFinite(parking) && parking > 0 && property.parking < parking) return false

  const maxPrice = extractPriceValue(filters.maxPrice, true)
  if (maxPrice && (property.priceValue <= 0 || property.priceValue > maxPrice)) return false

  const featureTerms = buildSearchTerms(normalizeText(filters.feature))
  if (featureTerms.some((feature) => !index.haystack.includes(feature))) return false

  return true
}

export function hasActiveAdvancedFilters(filters: CatalogAdvancedFilters) {
  return Object.values(filters).some((value) => value.trim().length > 0)
}

/** Prices are in cents; counts and property codes are never inferred as money. */
export function extractPriceValue(input: string, priceField = false): number | null {
  const text = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const number = "(\\d+(?:[.,]\\d+)*)"
  const unit = "(milhoes|milhao|mil|mi)"
  const match = text.match(new RegExp("(?:r\\$\\s*|ate\\s+(?:r\\$\\s*)?|preco\\s+(?:de\\s+)?)(" + number + "\\s*(?:" + unit + "\\b)?)(?![\\d.,])"))
  const withUnit = text.match(new RegExp(number + "\\s*" + unit + "\\b"))
  const candidate = match?.[1] ?? withUnit?.[0] ?? ((priceField || /^\s*\d[\d.,]*\s*$/.test(text)) ? text.trim() : "")
  if (!candidate) return null
  // “até 2 quartos” is a count, not a budget.
  if (match && /^\s*(quartos?|dormitorios?|vagas?|m2|m²)\b/.test(text.slice((match.index ?? 0) + match[0].length))) return null
  const parts = candidate.match(/^(\d+(?:[.,]\d+)*)\s*(milhoes|milhao|mil|mi)?/)
  if (!parts) return null
  let numeric = parts[1]
  if (numeric.includes(",")) numeric = numeric.replaceAll(".", "").replace(",", ".")
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(numeric)) numeric = numeric.replaceAll(".", "")
  const amount = Number(numeric)
  const multiplier = parts[2] === "mil" ? 1_000 : parts[2] ? 1_000_000 : 1
  const cents = Math.round(amount * multiplier * 100)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

function extractNumericIntent(query: string, keywords: string[]) {
  const pattern = new RegExp(`(\\d+)\\s*(?:${keywords.join("|")})`)
  const match = query.match(pattern)
  if (!match) return null

  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/.,;:()]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function buildSearchTerms(query: string) {
  const stopWords = new Set([
    "a",
    "as",
    "ate",
    "com",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "mil",
    "milhao",
    "milhoes",
    "mi",
    "no",
    "nos",
    "na",
    "nas",
    "para",
    "por",
    "quarto",
    "quartos",
    "vaga",
    "vagas",
    "imovel",
    "imoveis",
    "um",
    "uma", "busco", "quero", "encontre", "encontrar", "mostre", "buscar", "dormitorio", "dormitorios", "garagem", "garagens", "reais", "preco", "maximo", "menos", "mais",
  ])

  return query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((term) => normalizeToken(term.trim()))
    .filter((term) => term.length > 2)
    .filter((term) => !stopWords.has(term))
    .filter((term) => !/^\d+$/.test(term))
}

function normalizeToken(term: string) {
  const cleaned = normalizeText(term)
  if (cleaned.endsWith("oes")) return `${cleaned.slice(0, -3)}ao`
  if (cleaned.endsWith("ais")) return `${cleaned.slice(0, -3)}al`
  if (cleaned.endsWith("eis")) return `${cleaned.slice(0, -3)}el`
  if (cleaned.endsWith("res")) return cleaned.slice(0, -1)
  if (cleaned.endsWith("s") && cleaned.length > 4) return cleaned.slice(0, -1)
  return cleaned
}

function expandToken(token: string) {
  const normalized = normalizeToken(token)
  return (TOKEN_SYNONYMS[normalized] ?? []).map(normalizeToken)
}

function inferSearchType(query: string, tokens: string[]) {
  if (query.includes("cobertura") || tokens.includes("cobertura")) return "Cobertura"
  if (tokens.includes("casa")) return "Casa"
  if ((tokens.includes("terreno") || tokens.includes("lote"))) return "Terreno"
  if (tokens.includes("loja")) return "Loja"
  if (/\b(sala|escritorio)/.test(query)) return "Sala Comercial"
  if (/\bcomercia/.test(query)) return "Comercial"
  if (tokens.includes("apartamento") || tokens.includes("apto")) return "Apartamento"
  return ""
}

function inferSearchPurpose(query: string) {
  if (query.includes("locacao") || query.includes("aluguel") || query.includes("alugar")) return "Locacao"
  if (query.includes("venda") || query.includes("comprar") || query.includes("compra")) return "Venda"
  return ""
}

function hasFuzzyTokenMatch(token: string, candidates: string[]) {
  return candidates.some((candidate) => {
    if (candidate === token) return true
    if (candidate.includes(token) || token.includes(candidate)) return true
    return levenshteinDistance(token, candidate) <= 2
  })
}

function levenshteinDistance(source: string, target: string) {
  if (source === target) return 0
  if (!source.length) return target.length
  if (!target.length) return source.length

  const matrix = Array.from({ length: source.length + 1 }, (_, row) =>
    Array.from({ length: target.length + 1 }, (_, column) => {
      if (row === 0) return column
      if (column === 0) return row
      return 0
    }),
  )

  for (let row = 1; row <= source.length; row += 1) {
    for (let column = 1; column <= target.length; column += 1) {
      const cost = source[row - 1] === target[column - 1] ? 0 : 1
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      )
    }
  }

  return matrix[source.length][target.length]
}


function matchesPropertyType(actual: string, requested: string) {
  const type = normalizeText(actual)
  return requested === "Comercial" ? ["comercial", "sala comercial", "loja"].includes(type) : type === normalizeText(requested)
}
