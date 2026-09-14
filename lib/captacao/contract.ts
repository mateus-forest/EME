import { z } from "zod"

export const sources = ["chavesnamao", "olx", "vivareal", "zap"] as const
export type Source = (typeof sources)[number]
export const sourceNames: Record<Source, string> = {
  chavesnamao: "Chaves na Mão",
  olx: "OLX",
  vivareal: "VivaReal",
  zap: "ZAP Imóveis",
}
export const domains: Record<Source, string> = {
  chavesnamao: "chavesnamao.com.br",
  olx: "olx.com.br",
  vivareal: "vivareal.com.br",
  zap: "zapimoveis.com.br",
}
export const stages = [
  "SAVED",
  "CONTACTED",
  "CONVERSATION",
  "VISIT",
  "CONFIRMED",
  "DISCARDED",
] as const
export type Stage = (typeof stages)[number]
export const stageNames: Record<Stage, string> = {
  SAVED: "Salvo",
  CONTACTED: "Contato realizado",
  CONVERSATION: "Em conversa",
  VISIT: "Visita agendada",
  CONFIRMED: "Captação confirmada",
  DISCARDED: "Descartado",
}
export const propertyTypes = {
  apartment: "Apartamento",
  house: "Casa",
  land: "Terreno",
  penthouse: "Cobertura",
  commercial_room: "Sala comercial",
} as const
export type PropertyType = keyof typeof propertyTypes
export type AdvertiserKind = "unknown" | "broker" | "agency" | "owner"
export const advertiserNames: Record<AdvertiserKind, string> = {
  unknown: "Anunciante não identificado",
  broker: "Corretor",
  agency: "Imobiliária",
  owner: "Proprietário confirmado pelo corretor",
}
export const objectives = {
  availability: "Confirmar disponibilidade",
  service: "Apresentar serviço de intermediação",
  partnership: "Propor parceria",
  visit: "Agendar conversa ou visita",
  followup: "Retomar conversa registrada",
} as const
export type Objective = keyof typeof objectives
export type Listing = {
  key: string
  source: Source
  sourceId: string
  url: string
  title: string
  description: string
  price: number | null
  city: string
  state: string
  neighborhood: string
  street: string
  propertyType: PropertyType | null
  businessType: "sale" | "rent" | null
  area: number | null
  bedrooms: number | null
  parking: number | null
  image: string | null
  publishedAt: string | null
  checkedAt: string
  removed: boolean
  advertiser: {
    name: string
    kind: AdvertiserKind
    evidence: string
    phone: string | null
    phoneSource: string | null
    contactUnavailable: string
  }
  matches: string[]
  possibleDuplicates?: string[]
  receipt?: string
}
export type Capture = {
  id: string
  listing: Listing
  stage: Stage
  notes: string
  nextAction: string
  dueAt: string | null
  agendaEventId: string | null
  doNotContact: boolean
  advertiserKind: AdvertiserKind | null
  identityEvidence: string
  leadId: string | null
  propertyId: string | null
  createdAt: string
  updatedAt: string
  activities: { id: string; action: string; note: string; createdAt: string }[]
}
const text = z.string().trim().max(120)
const number = z.number().int().min(0).max(2_000_000_000).optional()
export const filterSchema = z
  .object({
    state: z
      .string()
      .regex(
        /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
      ),
    city: text.min(2),
    neighborhoods: z.array(text.min(1)).max(5).default([]),
    businessType: z.enum(["sale", "rent"]),
    propertyType: z
      .enum(["apartment", "house", "land", "penthouse", "commercial_room"])
      .optional(),
    priceMin: number,
    priceMax: number,
    bedrooms: z.number().int().min(0).max(20).optional(),
    parking: z.number().int().min(0).max(20).optional(),
    areaMin: number,
    areaMax: number,
    advertiser: z.enum(["any", "private", "professional"]).default("any"),
  })
  .strict()
  .refine(
    (v) =>
      v.priceMax === undefined ||
      v.priceMin === undefined ||
      v.priceMax >= v.priceMin,
    "Faixa de preço inválida.",
  )
  .refine(
    (v) =>
      v.areaMax === undefined ||
      v.areaMin === undefined ||
      v.areaMax >= v.areaMin,
    "Faixa de área inválida.",
  )
export type Filters = z.infer<typeof filterSchema>
export const searchSchema = z
  .object({
    filters: filterSchema,
    sources: z.array(z.enum(sources)).min(1).max(4),
    page: z.number().int().min(1).max(50).default(1),
  })
  .strict()
// eslint-disable-next-line no-control-regex -- Remove control characters from untrusted external text.
export function plain(value: unknown, limit = 160): string {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\p{Cc}/gu, " ")
        .trim()
        .slice(0, limit)
    : ""
}
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}
export function safeUrl(value: unknown, source: Source): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\\\s]/.test(value))
    return null
  try {
    const u = new URL(value)
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !(
        u.hostname === domains[source] ||
        u.hostname.endsWith(`.${domains[source]}`)
      )
    )
      return null
    u.hash = ""
    return u.href
  } catch {
    return null
  }
}
export function usablePhone(value: unknown): string | null {
  if (typeof value !== "string" || !/^[+\d ()-]{10,22}$/.test(value))
    return null
  const n = value.replace(/\D/g, "")
  const local = n.startsWith("55") && n.length > 11 ? n.slice(2) : n
  return /^[1-9]\d[2-9]\d{7,8}$/.test(local) ? `55${local}` : null
}
export function matchFacts(l: Listing, f: Filters): string[] {
  const facts: string[] = []
  if (normalize(l.city) === normalize(f.city)) facts.push(`Cidade: ${l.city}`)
  if (f.neighborhoods.some((n) => normalize(n) === normalize(l.neighborhood)))
    facts.push(`Bairro: ${l.neighborhood}`)
  if (f.propertyType && l.propertyType === f.propertyType)
    facts.push(`Tipo: ${propertyTypes[f.propertyType]}`)
  if (
    l.price !== null &&
    (f.priceMin !== undefined || f.priceMax !== undefined) &&
    l.price >= (f.priceMin ?? 0) &&
    l.price <= (f.priceMax ?? Infinity)
  )
    facts.push("Preço dentro da faixa selecionada")
  return facts
}
export function possibleDuplicates(items: Listing[]): Listing[] {
  return items.map((l) => ({
    ...l,
    possibleDuplicates: items
      .filter(
        (x) =>
          x.key !== l.key &&
          x.source !== l.source &&
          l.street &&
          normalize(l.street) === normalize(x.street) &&
          l.city &&
          normalize(l.city) === normalize(x.city) &&
          l.neighborhood &&
          normalize(l.neighborhood) === normalize(x.neighborhood) &&
          l.price !== null &&
          l.price === x.price &&
          l.area !== null &&
          l.area === x.area,
      )
      .map((x) => x.key),
  }))
}
export function buildApproach(
  listing: Listing,
  kind: AdvertiserKind,
  objective: Objective,
  brokerName: string,
  brokerCity: string,
  hasConversation: boolean,
) {
  const type = listing.propertyType
    ? propertyTypes[listing.propertyType].toLowerCase()
    : "imóvel"
  const where = listing.neighborhood
    ? ` em ${listing.neighborhood}`
    : listing.city
      ? ` em ${listing.city}`
      : ""
  const intro = `Olá! Sou ${plain(brokerName) || "[seu nome]"}, corretor de imóveis${brokerCity ? ` em ${plain(brokerCity)}` : ""}. Vi o anúncio do ${type}${where}.`
  const identify =
    kind === "unknown"
      ? " Ele continua disponível? Você é o proprietário ou está responsável pela intermediação?"
      : " Ele continua disponível?"
  let extra = ""
  if (objective === "partnership" && (kind === "broker" || kind === "agency"))
    extra =
      " Há abertura para conversarmos sobre uma parceria de intermediação?"
  else if (objective === "service" && kind === "owner")
    extra =
      " Posso apresentar meu serviço de intermediação em uma breve conversa?"
  else if (objective === "visit")
    extra =
      " Se estiver disponível, podemos combinar uma conversa e verificar a possibilidade de visita?"
  else if (objective === "followup" && hasConversation)
    extra = " Gostaria de retomar nossa conversa e confirmar o próximo passo."
  const strategy =
    kind === "owner"
      ? "Apresente seu serviço e peça abertura para uma conversa, sem prometer resultados."
      : kind === "broker" || kind === "agency"
        ? "Confirme a disponibilidade e proponha uma parceria, alinhando responsabilidades."
        : "Primeiro identifique quem anuncia. A indicação de particular no portal não comprova propriedade."
  return {
    summary: `${listing.title}. ${listing.matches.join(". ") || "Revise os dados disponíveis antes de avaliar a oportunidade."}`,
    confirm: [
      "Disponibilidade atual",
      "Identidade e relação do anunciante com o imóvel",
      "Abertura para intermediação ou parceria",
      "Possibilidade e condições de visita",
    ],
    strategy,
    message: `${intro}${identify}${extra}`,
  }
}
