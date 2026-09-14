import {
  domains,
  normalize,
  plain,
  safeUrl,
  usablePhone,
  matchFacts,
  type Filters,
  type Listing,
  type Source,
  type PropertyType,
} from "./contract"

type Obj = Record<string, unknown>
function obj(v: unknown): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {}
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function at(v: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((a, k) => (Array.isArray(a) ? a[Number(k)] : obj(a)[k]), v)
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && /^\d+(\.\d+)?$/.test(v)
        ? Number(v)
        : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}
function date(v: unknown): string | null {
  const s = plain(v)
  const d = new Date(s)
  return s && !Number.isNaN(d.getTime()) ? d.toISOString() : null
}
function type(v: unknown): PropertyType | null {
  const t = normalize(plain(v))
  const map: Record<string, PropertyType> = {
    apartment: "apartment",
    apartamento: "apartment",
    house: "house",
    casa: "house",
    land: "land",
    terreno: "land",
    penthouse: "penthouse",
    cobertura: "penthouse",
    commercial_room: "commercial_room",
    "sala comercial": "commercial_room",
  }
  return map[t] ?? null
}
function photo(v: unknown): string | null {
  if (typeof v !== "string" || /[{}\\]/.test(v)) return null
  try {
    const u = new URL(v)
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      [
        "chavesnamao.com.br",
        "olx.com.br",
        "vivareal.com",
        "vivareal.com.br",
        "zapimoveis.com.br",
      ].some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
      ? u.href
      : null
  } catch {
    return null
  }
}
export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 503,
  ) {
    super(message)
  }
}
export function requestFor(source: Source, f: Filters, page: number) {
  const body: Obj = {
    target: domains[source],
    type: "plp",
    state: f.state,
    city: f.city,
    page,
    ...(f.priceMin !== undefined ? { priceMin: f.priceMin } : {}),
    ...(f.priceMax !== undefined ? { priceMax: f.priceMax } : {}),
  }
  const local: string[] = []
  if (source === "olx") {
    body.categoryPath = "imoveis"
    body.keyword = `${f.propertyType ? { apartment: "apartamento", house: "casa", land: "terreno", penthouse: "cobertura", commercial_room: "sala comercial" }[f.propertyType] : "imóvel"} ${f.businessType === "sale" ? "venda" : "aluguel"}`
    local.push(
      "finalidade e tipo (quando identificáveis no anúncio)",
      "bairro",
      "quartos",
      "área",
      "vagas",
      "perfil do anunciante",
    )
  } else {
    body.businessType = f.businessType
    for (const name of ["areaMin", "areaMax"] as const)
      if (f[name] !== undefined) body[name] = f[name]
    if (f.bedrooms !== undefined) body.bedrooms = [f.bedrooms]
    if (f.parking !== undefined) body.parkingSpots = [f.parking]
    if (source !== "zap") {
      if (f.propertyType) body.propertyTypes = [f.propertyType]
      if (f.neighborhoods.length === 1) body.neighborhood = f.neighborhoods[0]
      else if (f.neighborhoods.length > 1)
        local.push("bairros (sobre as páginas carregadas)")
      if (f.advertiser === "private") body.directOwner = true
      if (f.advertiser === "professional") local.push("perfil profissional")
    } else {
      local.push("tipo", "bairros", "perfil do anunciante")
    }
  }
  return { body, local }
}
export function normalizeListing(
  source: Source,
  value: unknown,
  checkedAt: string,
): Listing | null {
  const r = obj(value)
  const sourceId = plain(String(r.id ?? r.listingId ?? ""), 120)
  const url = safeUrl(r.url, source)
  if (!sourceId || !url) return null
  const a = obj(r.advertiser)
  const adr = obj(source === "olx" ? r.location : r.address)
  const license = plain(a.creci ?? a.license)
  const cnm = source === "chavesnamao",
    vr = source === "vivareal"
  // Private/directOwner/OWNER labels are deliberately insufficient to assert ownership.
  const kind = license
    ? /\bJ[-\s\d]|[-\s]J\b/i.test(license)
      ? "agency"
      : "broker"
    : r.contractType === "BROKER"
      ? "broker"
      : "unknown"
  let phone: string | null = null,
    phoneSource: string | null = null
  if (source !== "olx") {
    const candidates = cnm
      ? at(a, "phones.public") === true
        ? [
            at(a, "phones.cellphone"),
            at(a, "phones.landline"),
            at(a, "phones.commercial"),
          ]
        : []
      : [
          a.whatsappNumber,
          a.whatsAppNumber,
          a.mainPhone,
          ...arr(a.phoneNumbers),
        ]
    phone = candidates.map(usablePhone).find(Boolean) ?? null
    if (phone) phoneSource = url
  }
  const attrs = arr(r.attributes ?? r.properties).map(obj)
  const attr = (label: RegExp) =>
    attrs.find((x) => label.test(normalize(plain(x.label) || plain(x.name))))
      ?.value
  const businessRaw = plain(
    r.businessType ?? r.business ?? r.transaction,
  ).toLowerCase()
  const explicitTitle = normalize(plain(r.title))
  const businessType = ["sale", "sell"].includes(businessRaw)
    ? "sale"
    : ["rent", "rental"].includes(businessRaw)
      ? "rent"
      : source === "olx"
        ? /\b(venda|vende-se)\b/.test(explicitTitle)
          ? "sale"
          : /\b(aluguel|alugar|aluga-se|locacao)\b/.test(explicitTitle)
            ? "rent"
            : null
        : null
  const propertyType = cnm
    ? type(at(r, "realtyType.name"))
    : vr
      ? type(arr(r.unitTypes)[0])
      : source === "olx"
        ? (type(attr(/tipo.*imovel/)) ??
          (Object.entries({
            apartment: "apartamento",
            house: "casa",
            land: "terreno",
            penthouse: "cobertura",
            commercial_room: "sala comercial",
          }).find(([, v]) =>
            explicitTitle.includes(v),
          )?.[0] as PropertyType | null))
        : null
  const price = cnm
    ? num(at(r, "prices.rawPrice"))
    : vr
      ? num(
          obj(
            arr(r.prices).find(
              (p) => plain(obj(p).businessType).toLowerCase() === businessType,
            ) || arr(r.prices)[0],
          ).value,
        )
      : source === "zap"
        ? num(at(r, "prices.price") ?? at(r, "prices.mainValue"))
        : num(r.price)
  const title =
    plain(r.title, 240) ||
    `${propertyType ? { apartment: "Apartamento", house: "Casa", land: "Terreno", penthouse: "Cobertura", commercial_room: "Sala comercial" }[propertyType] : "Imóvel anunciado"}${plain(adr.neighborhood) ? ` em ${plain(adr.neighborhood)}` : ""}`
  return {
    key: `${source}:${sourceId}`,
    source,
    sourceId,
    url,
    title,
    description: plain(r.description, 4000),
    price,
    city: plain(adr.city),
    state: plain(adr.stateAcronym ?? adr.state),
    neighborhood: plain(adr.neighborhood),
    street: plain(adr.street),
    propertyType: propertyType ?? null,
    businessType,
    area: cnm
      ? num(at(r, "area.useful"))
      : vr
        ? num(at(r, "attributes.usableAreas.0"))
        : source === "olx"
          ? num(attr(/area/))
          : null,
    bedrooms: cnm
      ? num(at(r, "counts.bedrooms.count"))
      : vr
        ? num(at(r, "attributes.bedrooms.0"))
        : source === "olx"
          ? num(attr(/quartos/))
          : null,
    parking: cnm
      ? num(at(r, "counts.garages.count"))
      : vr
        ? num(at(r, "attributes.parkingSpaces.0"))
        : source === "olx"
          ? num(attr(/vagas/))
          : null,
    image: photo(
      r.featuredImage ??
        at(r, "media.0.url") ??
        at(r, "images.0.url") ??
        arr(r.images)[0],
    ),
    publishedAt: date(source === "olx" ? r.listedAt : r.createdAt),
    checkedAt,
    removed:
      r.active === false ||
      ["INACTIVE", "DELETED", "REMOVED"].includes(String(r.status)),
    advertiser: {
      name: source === "olx" ? "" : plain(a.name),
      kind,
      evidence: license
        ? `Registro informado na origem: ${license}`
        : r.contractType === "BROKER"
          ? "Origem informa contractType BROKER"
          : source === "olx" &&
              (r.professionalAd === true ||
                at(r, "seller.isProfessional") === true)
            ? "Origem indica anúncio profissional; tipo de profissional não confirmado"
            : r.contractType === "OWNER" || a.type === "PF"
              ? "Origem indica anunciante particular; propriedade não confirmada"
              : "Identidade ainda não confirmada",
      phone,
      phoneSource,
      contactUnavailable: phone
        ? ""
        : source === "olx"
          ? "A OLX anonimiza dados de contato. Use o anúncio original."
          : "Contato utilizável não disponível na consulta.",
    },
    matches: [],
  }
}
export function filterLoaded(l: Listing, f: Filters, source: Source) {
  if (normalize(l.city) !== normalize(f.city)) return false
  if (
    l.price !== null &&
    (l.price < (f.priceMin ?? 0) || l.price > (f.priceMax ?? Infinity))
  )
    return false
  if (
    f.neighborhoods.length &&
    !f.neighborhoods.some((n) => normalize(n) === normalize(l.neighborhood))
  )
    return false
  if (
    (source === "olx" || source === "zap") &&
    f.propertyType &&
    l.propertyType !== f.propertyType
  )
    return false
  if (source === "olx" && l.businessType !== f.businessType) return false
  if (source === "olx") {
    if (f.bedrooms !== undefined && l.bedrooms !== f.bedrooms) return false
    if (f.parking !== undefined && l.parking !== f.parking) return false
    if (
      (f.areaMin !== undefined || f.areaMax !== undefined) &&
      (l.area === null ||
        l.area < (f.areaMin ?? 0) ||
        l.area > (f.areaMax ?? Infinity))
    )
      return false
  }
  if (
    f.advertiser === "professional" &&
    !["broker", "agency"].includes(l.advertiser.kind) &&
    !l.advertiser.evidence.includes("profissional")
  )
    return false
  if (
    f.advertiser === "private" &&
    ["olx", "zap"].includes(source) &&
    !l.advertiser.evidence.includes("particular")
  )
    return false
  return true
}
export function normalizeResponse(
  source: Source,
  payload: unknown,
  checkedAt: string,
  f?: Filters,
  page = 1,
) {
  const root = obj(payload),
    envelope = obj(root.data)
  const data = envelope.source ? envelope : root
  if (root.notFound === true)
    throw new ProviderError(
      "LISTING_REMOVED",
      "Anúncio removido ou não encontrado na origem.",
      410,
    )
  if (data.source !== domains[source])
    throw new ProviderError(
      "INVALID_RESPONSE",
      "A fonte retornou um formato não reconhecido.",
    )
  if (f) {
    if (!Array.isArray(data.items))
      throw new ProviderError(
        "INVALID_RESPONSE",
        "Resposta de busca sem lista de anúncios.",
      )
    const normalized = data.items
      .slice(0, 100)
      .map((x) => normalizeListing(source, x, checkedAt))
      .filter((x): x is Listing => !!x)
    const items = normalized
      .filter((x) => filterLoaded(x, f, source))
      .map((x) => ({ ...x, matches: matchFacts(x, f) }))
    return {
      items,
      excluded: data.items.length - items.length,
      nextPage:
        typeof data.nextPage === "number" &&
        data.nextPage > page &&
        data.nextPage <= 50
          ? data.nextPage
          : null,
      localFilters: requestFor(source, f, page).local,
      checkedAt,
    }
  }
  const listing = normalizeListing(
    source,
    source === "vivareal" ? data.listing : (data.data ?? data),
    checkedAt,
  )
  if (!listing)
    throw new ProviderError(
      "INVALID_RESPONSE",
      "Detalhes sem identificação válida.",
    )
  if (listing.removed)
    throw new ProviderError(
      "LISTING_REMOVED",
      "Anúncio indisponível na origem.",
      410,
    )
  return {
    items: [listing],
    excluded: 0,
    nextPage: null,
    localFilters: [],
    checkedAt,
  }
}
export async function extract(
  body: Record<string, unknown>,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  let response: Response
  try {
    response = await fetcher("https://api.geckoapi.com.br/v1/extract", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35_000),
      cache: "no-store",
      redirect: "error",
    })
  } catch {
    throw new ProviderError(
      "SOURCE_UNAVAILABLE",
      "A fonte não respondeu. Nenhuma tentativa automática foi feita.",
    )
  }
  if (response.status === 402 || response.status === 429)
    throw new ProviderError(
      "USAGE_LIMIT",
      "Limite de uso ou créditos do fornecedor atingido.",
      429,
    )
  if (response.status === 401 || response.status === 403)
    throw new ProviderError(
      "SOURCE_UNAVAILABLE",
      "Acesso à fonte indisponível. Verifique a configuração do fornecedor.",
    )
  if (!response.ok)
    throw new ProviderError(
      "SOURCE_UNAVAILABLE",
      "A fonte está indisponível no momento.",
    )
  const raw = await response.text()
  if (raw.length > 4_000_000)
    throw new ProviderError(
      "INVALID_RESPONSE",
      "Resposta da fonte acima do limite de segurança.",
    )
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "Resposta da fonte não reconhecida.",
    )
  }
}
