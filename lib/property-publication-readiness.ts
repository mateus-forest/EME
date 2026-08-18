import type { CreciValidationStatus, PropertyType } from "@/lib/prisma-enums"
import { isPlaceholderPropertyImage } from "@/lib/property-media"
import { PROPERTY_PUBLICATION_STANDARDS } from "@/lib/property-publication-standards"

export { PROPERTY_PUBLICATION_STANDARDS } from "@/lib/property-publication-standards"

export type PropertyPublicationChannel = "catalog" | "marketplace"

export type PropertyPublicationIssueCode =
  | "TITLE_REQUIRED"
  | "PRICE_REQUIRED"
  | "CITY_REQUIRED"
  | "NEIGHBORHOOD_REQUIRED"
  | "AREA_REQUIRED"
  | "PURPOSE_REQUIRED"
  | "TYPE_REQUIRED"
  | "BEDROOMS_REQUIRED"
  | "BATHROOMS_REQUIRED"
  | "PARKING_REQUIRED"
  | "DESCRIPTION_TOO_SHORT"
  | "MINIMUM_PHOTOS_REQUIRED"
  | "PRIMARY_PHOTO_INVALID"
  | "PHOTO_INVALID"
  | "PHOTO_FORMAT_UNSUPPORTED"
  | "PHOTO_RESOLUTION_TOO_LOW"
  | "HORIZONTAL_COVER_REQUIRED"
  | "CRECI_NOT_VERIFIED"

export type PropertyPublicationIssue = {
  code: PropertyPublicationIssueCode
  message: string
  field: string
  scope: "property" | "broker"
}

export type PropertyChannelReadiness = {
  ready: boolean
  issues: PropertyPublicationIssue[]
}

export type PropertyPublicationReadiness = {
  schemaVersion: 1
  catalogReady: boolean
  marketplaceReady: boolean
  catalog: PropertyChannelReadiness
  marketplace: PropertyChannelReadiness
}

export type PropertyPublicationBlockedPayload = {
  error: "Este imóvel ainda não atende ao padrão de publicação do EME."
  code: "PROPERTY_NOT_READY"
  channel: PropertyPublicationChannel
  channelReadiness: PropertyChannelReadiness
  publicationReadiness?: PropertyPublicationReadiness
}

export type PropertyPublicationInput = {
  title: string
  description: string | null
  price: number
  city: string
  neighborhood: string | null
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  type: PropertyType
  purpose: string
  imageUrls: unknown
  legalData: unknown
  broker: {
    creciValidationStatus: CreciValidationStatus
  }
}

export type PropertyImageInspection = {
  valid: boolean
  format?: string
  width?: number
  height?: number
  reason?: "invalid_url" | "unreachable" | "unsupported_format" | "too_large" | "invalid_image"
}

type ImageInspector = (url: string) => Promise<PropertyImageInspection>
type CatalogPublicationInput = Pick<PropertyPublicationInput, "title" | "price" | "city" | "broker">

const RESIDENTIAL_TYPES = new Set<PropertyType>(["APARTMENT", "HOUSE", "PENTHOUSE"])
const BUILT_TYPES = new Set<PropertyType>(["APARTMENT", "HOUSE", "PENTHOUSE", "COMMERCIAL", "OFFICE", "STORE"])
const SUPPORTED_PROPERTY_TYPES = new Set<PropertyType>([
  "APARTMENT",
  "HOUSE",
  "COMMERCIAL",
  "LAND",
  "OFFICE",
  "STORE",
  "PENTHOUSE",
])

function issue(
  code: PropertyPublicationIssueCode,
  message: string,
  field: string,
  scope: PropertyPublicationIssue["scope"] = "property",
): PropertyPublicationIssue {
  return { code, message, field, scope }
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readLegalData(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function parsePositiveDecimal(value: unknown) {
  const text = readText(value).replace(/[^\d,.-]/g, "")
  if (!text) return 0

  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function propertyImages(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, PROPERTY_PUBLICATION_STANDARDS.marketplace.maximumPhotos)
}

export function assessCatalogReadiness(input: CatalogPublicationInput): PropertyChannelReadiness {
  const issues: PropertyPublicationIssue[] = []

  if (!readText(input.title)) {
    issues.push(issue("TITLE_REQUIRED", "Informe o título do imóvel.", "title"))
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    issues.push(issue("PRICE_REQUIRED", "Informe o preço do imóvel.", "price"))
  }
  if (!readText(input.city)) {
    issues.push(issue("CITY_REQUIRED", "Informe a cidade do imóvel.", "city"))
  }
  if (input.broker.creciValidationStatus !== "VERIFIED") {
    issues.push(
      issue(
        "CRECI_NOT_VERIFIED",
        "Seu CRECI precisa estar verificado.",
        "creciValidationStatus",
        "broker",
      ),
    )
  }

  return { ready: issues.length === 0, issues }
}

function assessMarketplaceFields(input: PropertyPublicationInput) {
  const issues = [...assessCatalogReadiness(input).issues]
  const legal = readLegalData(input.legalData)
  const neighborhood = readText(input.neighborhood) || readText(legal.district)
  const area = parsePositiveDecimal(legal.privateArea) || parsePositiveDecimal(legal.totalArea)

  if (!neighborhood) {
    issues.push(issue("NEIGHBORHOOD_REQUIRED", "Informe o bairro ou a localização do imóvel.", "neighborhood"))
  }
  if (!area) {
    issues.push(issue("AREA_REQUIRED", "Informe a área do imóvel.", "area"))
  }
  if (input.purpose !== "SALE" && input.purpose !== "RENT") {
    issues.push(issue("PURPOSE_REQUIRED", "Informe a finalidade do imóvel.", "purpose"))
  }
  if (!SUPPORTED_PROPERTY_TYPES.has(input.type)) {
    issues.push(issue("TYPE_REQUIRED", "Informe o tipo do imóvel.", "type"))
  }
  if (RESIDENTIAL_TYPES.has(input.type) && input.bedrooms < 1) {
    issues.push(issue("BEDROOMS_REQUIRED", "Informe a quantidade de quartos.", "bedrooms"))
  }
  if (BUILT_TYPES.has(input.type) && input.bathrooms < 1) {
    issues.push(issue("BATHROOMS_REQUIRED", "Informe a quantidade de banheiros.", "bathrooms"))
  }
  if (RESIDENTIAL_TYPES.has(input.type) && input.parkingSpots < 1) {
    issues.push(issue("PARKING_REQUIRED", "Informe a quantidade de vagas.", "parkingSpots"))
  }
  if (readText(input.description).length < PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumDescriptionCharacters) {
    issues.push(
      issue(
        "DESCRIPTION_TOO_SHORT",
        `Complete a descrição com pelo menos ${PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumDescriptionCharacters} caracteres.`,
        "description",
      ),
    )
  }
  return issues
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [first, second] = parts
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase()
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) {
    return true
  }
  if (normalized.startsWith("::ffff:")) return isPrivateIpv4(normalized.slice(7))
  return isPrivateIpv4(normalized)
}

async function isSafePublicImageUrl(value: string, trustedOrigins: ReadonlySet<string>) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }

  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return false
  if (trustedOrigins.has(parsed.origin)) return true
  const hostname = parsed.hostname.toLowerCase()
  if (hostname === "localhost" || hostname.endsWith(".local")) return false

  const [{ isIP }, { lookup }] = await Promise.all([import("node:net"), import("node:dns/promises")])
  if (isIP(hostname)) return !isPrivateIp(hostname)

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true })
    return addresses.length > 0 && addresses.every((item) => !isPrivateIp(item.address))
  } catch {
    return false
  }
}

async function readLimitedResponse(response: Response) {
  const maximumBytes = PROPERTY_PUBLICATION_STANDARDS.marketplace.maximumImageBytes
  const contentLength = Number(response.headers.get("content-length") ?? 0)
  if (contentLength > maximumBytes) throw new Error("too_large")
  if (!response.body) throw new Error("invalid_image")

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maximumBytes) {
      await reader.cancel()
      throw new Error("too_large")
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

async function fetchPublicImage(url: string, trustedOrigins: ReadonlySet<string>) {
  let currentUrl = url

  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!(await isSafePublicImageUrl(currentUrl, trustedOrigins))) throw new Error("invalid_url")

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(PROPERTY_PUBLICATION_STANDARDS.marketplace.imageTimeoutMs),
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) throw new Error("unreachable")
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    if (!response.ok) throw new Error("unreachable")
    return readLimitedResponse(response)
  }

  throw new Error("unreachable")
}

export async function inspectPropertyPublicationImage(
  url: string,
  options: { baseUrl?: string } = {},
): Promise<PropertyImageInspection> {
  if (!url || isPlaceholderPropertyImage(url)) return { valid: false, reason: "invalid_url" }

  try {
    const resolvedUrl = options.baseUrl ? new URL(url, options.baseUrl).toString() : url
    const trustedOrigins = new Set(
      options.baseUrl && process.env.NODE_ENV !== "production" ? [new URL(options.baseUrl).origin] : [],
    )
    const buffer = await fetchPublicImage(resolvedUrl, trustedOrigins)
    const sharp = (await import("sharp")).default
    const metadata = await sharp(buffer, { failOn: "error" }).metadata()
    const format = metadata.format?.toLowerCase()
    let width = metadata.width ?? 0
    let height = metadata.height ?? 0

    if ([5, 6, 7, 8].includes(metadata.orientation ?? 0)) {
      const orientedWidth = height
      height = width
      width = orientedWidth
    }

    if (!format || !PROPERTY_PUBLICATION_STANDARDS.marketplace.supportedFormats.includes(format as "jpeg" | "png" | "webp")) {
      return { valid: false, format, width, height, reason: "unsupported_format" }
    }
    if (!width || !height) return { valid: false, format, width, height, reason: "invalid_image" }

    return { valid: true, format, width, height }
  } catch (caughtError) {
    const reason = caughtError instanceof Error ? caughtError.message : "unreachable"
    if (reason === "invalid_url" || reason === "too_large" || reason === "invalid_image") {
      return { valid: false, reason }
    }
    return { valid: false, reason: "unreachable" }
  }
}

function imageIssue(index: number, inspection: PropertyImageInspection): PropertyPublicationIssue {
  const photo = `A foto ${index + 1}`
  if (inspection.reason === "unsupported_format") {
    return issue(
      "PHOTO_FORMAT_UNSUPPORTED",
      `${photo} deve estar em JPG, PNG ou WebP.`,
      `images.${index}`,
    )
  }
  if (inspection.reason === "too_large") {
    return issue("PHOTO_INVALID", `${photo} excede o limite aceito pelo EME.`, `images.${index}`)
  }
  return issue("PHOTO_INVALID", `${photo} está quebrada, é um placeholder ou possui uma URL inválida.`, `images.${index}`)
}

export async function assessPropertyPublicationReadiness(
  input: PropertyPublicationInput,
  options: { inspectImage?: ImageInspector; baseUrl?: string } = {},
): Promise<PropertyPublicationReadiness> {
  const catalog = assessCatalogReadiness(input)
  const marketplaceIssues = assessMarketplaceFields(input)
  const images = propertyImages(input.imageUrls)
  const inspectImage = options.inspectImage ?? ((url: string) => inspectPropertyPublicationImage(url, { baseUrl: options.baseUrl }))

  if (images.length < PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumPhotos) {
    marketplaceIssues.push(
      issue(
        "MINIMUM_PHOTOS_REQUIRED",
        `Adicione pelo menos ${PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumPhotos} fotos.`,
        "images",
      ),
    )
  }

  const inspections = await Promise.all(images.map((url) => inspectImage(url)))
  let hasHorizontalCover = false
  let validImageCount = 0

  inspections.forEach((inspection, index) => {
    if (!inspection.valid) {
      marketplaceIssues.push(
        index === 0
          ? issue(
              "PRIMARY_PHOTO_INVALID",
              "A foto principal está quebrada, é um placeholder ou possui uma URL inválida.",
              "images.0",
            )
          : imageIssue(index, inspection),
      )
      return
    }

    validImageCount += 1
    const width = inspection.width ?? 0
    const height = inspection.height ?? 0
    const longEdge = Math.max(width, height)
    const shortEdge = Math.min(width, height)
    const hasMinimumResolution =
      longEdge >= PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumImageLongEdge &&
      shortEdge >= PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumImageShortEdge

    if (!hasMinimumResolution) {
      marketplaceIssues.push(
        issue(
          "PHOTO_RESOLUTION_TOO_LOW",
          `A foto ${index + 1} precisa ter pelo menos ${PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumImageLongEdge} × ${PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumImageShortEdge} px em orientação equivalente.`,
          `images.${index}`,
        ),
      )
      return
    }

    if (width > height) hasHorizontalCover = true
  })

  if (images.length >= PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumPhotos && validImageCount < PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumPhotos) {
    marketplaceIssues.push(
      issue(
        "MINIMUM_PHOTOS_REQUIRED",
        `Mantenha pelo menos ${PROPERTY_PUBLICATION_STANDARDS.marketplace.minimumPhotos} fotos válidas.`,
        "images",
      ),
    )
  }
  if (images.length > 0 && !hasHorizontalCover) {
    marketplaceIssues.push(
      issue(
        "HORIZONTAL_COVER_REQUIRED",
        "Adicione pelo menos uma foto horizontal com resolução adequada para a capa.",
        "images",
      ),
    )
  }

  const marketplace = { ready: marketplaceIssues.length === 0, issues: marketplaceIssues }
  return {
    schemaVersion: 1,
    catalogReady: catalog.ready,
    marketplaceReady: marketplace.ready,
    catalog,
    marketplace,
  }
}

export function propertyPublicationBlockedResponse(
  readiness: PropertyPublicationReadiness | PropertyChannelReadiness,
  channel: PropertyPublicationChannel,
): PropertyPublicationBlockedPayload {
  if ("schemaVersion" in readiness) {
    return {
      error: "Este imóvel ainda não atende ao padrão de publicação do EME.",
      code: "PROPERTY_NOT_READY",
      channel,
      channelReadiness: readiness[channel],
      publicationReadiness: readiness,
    }
  }

  return {
    error: "Este imóvel ainda não atende ao padrão de publicação do EME.",
    code: "PROPERTY_NOT_READY",
    channel,
    channelReadiness: readiness,
  }
}
