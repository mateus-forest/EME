import { randomUUID } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MARKETPLACE_REGION_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_MARKETPLACE_REGION_IMAGE_BYTES = 4 * 1024 * 1024

export class InvalidMarketplaceRegionImageError extends Error {
  readonly reason: string

  constructor(reason = "invalid_image") {
    super("O link informado não é uma imagem válida.")
    this.name = "InvalidMarketplaceRegionImageError"
    this.reason = reason
  }
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error("Upload indisponível: configure as variáveis do Supabase Storage.")
  return value
}

function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) throw new Error("Upload indisponível: configure as variáveis do Supabase Storage.")

  let supabaseOrigin: string
  try {
    supabaseOrigin = new URL(supabaseUrl).origin
  } catch {
    throw new Error("Upload indisponível: a URL do Supabase Storage é inválida.")
  }

  return {
    supabaseUrl: supabaseOrigin,
    serviceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: "properties",
  }
}

function getStorageAuthHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    ...(serviceRoleKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceRoleKey}` }),
  }
}

function getImageExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return ".png"
  if (mimeType === "image/webp") return ".webp"
  return ".jpg"
}

function getImageExtension(file: File) {
  return getImageExtensionFromMimeType(file.type)
}

function assertMarketplaceRegionSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Região inválida para upload.")
}

function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b, c] = parts
  if (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 18) ||
    (a === 198 && b === 19) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) return false
  return true
}

function isPublicIp(address: string) {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version !== 6) return false
  const normalized = address.toLowerCase()
  if (normalized.startsWith("::ffff:")) return isPublicIpv4(normalized.slice(7))
  return !(
    normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  )
}

async function assertPublicMarketplaceRegionImageUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new InvalidMarketplaceRegionImageError("invalid_url")
  }
  if (
    parsed.protocol !== "https:" || parsed.username || parsed.password ||
    (parsed.port && parsed.port !== "443") ||
    parsed.hostname === "localhost" || parsed.hostname.endsWith(".local") || parsed.hostname.endsWith(".internal")
  ) throw new InvalidMarketplaceRegionImageError("unsafe_url")
  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true }).catch(() => [])
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new InvalidMarketplaceRegionImageError("non_public_host")
  }
  return parsed
}

async function readImageResponse(response: Response) {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || ""
  const contentLength = Number(response.headers.get("content-length") || 0)
  if (!MARKETPLACE_REGION_IMAGE_TYPES.has(contentType) || contentLength > MAX_MARKETPLACE_REGION_IMAGE_BYTES || !response.body) {
    throw new InvalidMarketplaceRegionImageError("invalid_content_type_or_size")
  }
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_MARKETPLACE_REGION_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new InvalidMarketplaceRegionImageError("image_too_large")
    }
    chunks.push(Buffer.from(value))
  }
  if (!total) throw new InvalidMarketplaceRegionImageError("empty_image")
  return Buffer.concat(chunks)
}

async function downloadMarketplaceRegionImage(value: string) {
  let target = await assertPublicMarketplaceRegionImageUrl(value)
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(target, {
      headers: { Accept: "image/webp,image/png,image/jpeg", "User-Agent": "EME-Region-Media/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null)
    if (!response) throw new InvalidMarketplaceRegionImageError("download_failed")
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location || redirect === 3) throw new InvalidMarketplaceRegionImageError("invalid_redirect")
      target = await assertPublicMarketplaceRegionImageUrl(new URL(location, target).toString())
      continue
    }
    if (!response.ok) throw new InvalidMarketplaceRegionImageError("download_status")
    return readImageResponse(response)
  }
  throw new InvalidMarketplaceRegionImageError("too_many_redirects")
}

// Fotos de imovel chegam direto da camera do celular, que grava a orientacao real como metadado
// EXIF em vez de girar os pixels. Navegadores modernos respeitam esse EXIF ao exibir a imagem
// original, mas qualquer reprocessamento posterior (ex: otimizador de imagem do Next.js) pode
// nao preservar/respeitar essa orientacao, fazendo a foto aparecer virada. Corrigindo aqui, na
// gravacao, os pixels ja saem fisicamente na orientacao correta e o problema deixa de existir em
// qualquer consumidor posterior.
async function normalizeImageOrientation(buffer: Buffer) {
  try {
    const sharp = (await import("sharp")).default
    return await sharp(buffer).rotate().toBuffer()
  } catch (error) {
    console.error("[storage][properties] EXIF auto-rotate failed, uploading original bytes", error)
    return buffer
  }
}

function getAudioExtension(file: File) {
  if (file.type === "audio/wav" || file.type === "audio/x-wav") return ".wav"
  if (file.type === "audio/ogg") return ".ogg"
  if (file.type === "audio/webm") return ".webm"
  if (file.type === "audio/mp4" || file.type === "audio/x-m4a") return ".m4a"
  return ".mp3"
}

async function uploadPropertyFile({
  propertyId,
  file,
  folder,
  extension,
}: {
  propertyId: string
  file: File
  folder: string
  extension: string
}) {
  const config = getStorageConfig()
  const objectPath = `${propertyId}/${folder}/${randomUUID()}${extension}`
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: Buffer.from(await file.arrayBuffer()),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][properties] upload failed", { status: response.status, detail })
    throw new Error("Não foi possível enviar o arquivo para o Supabase Storage.")
  }

  return `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/${objectPath}`
}

async function uploadPropertyBuffer({
  propertyId,
  buffer,
  folder,
  extension,
  contentType,
}: {
  propertyId: string
  buffer: Buffer
  folder: string
  extension: string
  contentType: string
}) {
  const config = getStorageConfig()
  const objectPath = `${propertyId}/${folder}/${randomUUID()}${extension}`
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: buffer,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][properties] upload failed", { status: response.status, detail })
    throw new Error("Não foi possível enviar o arquivo para o Supabase Storage.")
  }

  return `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/${objectPath}`
}

export function isPropertyStorageUrl(url: string) {
  try {
    const config = getStorageConfig()
    return url.startsWith(`${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/`)
  } catch {
    return false
  }
}

export async function savePropertyImage(propertyId: string, file: File) {
  const buffer = await normalizeImageOrientation(Buffer.from(await file.arrayBuffer()))

  return uploadPropertyBuffer({
    propertyId,
    buffer,
    folder: "images",
    extension: getImageExtension(file),
    contentType: file.type || "application/octet-stream",
  })
}

export async function savePropertyImageFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?,([\s\S]+)$/)
  if (!match) throw new Error("Formato de imagem inválido para upload.")

  const mimeType = match[1] || "image/jpeg"
  const buffer = await normalizeImageOrientation(Buffer.from(match[2], "base64"))

  return uploadPropertyBuffer({
    propertyId: randomUUID(),
    buffer,
    folder: "images",
    extension: getImageExtensionFromMimeType(mimeType),
    contentType: mimeType,
  })
}

export async function savePropertyAudio(propertyId: string, file: File) {
  return uploadPropertyFile({
    propertyId,
    file,
    folder: "audio",
    extension: getAudioExtension(file),
  })
}

export async function savePropertyGeneratedImage(propertyId: string, imageBuffer: Buffer, mimeType = "image/png") {
  const extension = mimeType === "image/webp" ? ".webp" : mimeType === "image/jpeg" ? ".jpg" : ".png"
  return uploadPropertyBuffer({
    propertyId,
    buffer: imageBuffer,
    folder: "studio-ia",
    extension,
    contentType: mimeType,
  })
}

export async function saveStudioVideoReferenceImage(referenceId: string, file: File) {
  const mimeType = file.type || "image/jpeg"
  const extension = mimeType === "image/webp" ? ".webp" : mimeType === "image/png" ? ".png" : ".jpg"

  return uploadPropertyBuffer({
    propertyId: referenceId,
    buffer: Buffer.from(await file.arrayBuffer()),
    folder: "studio-ia/references",
    extension,
    contentType: mimeType,
  })
}

export async function saveStudioPropertyPreparationReferenceImage(referenceId: string, file: File) {
  const mimeType = file.type || "image/jpeg"
  const extension = getImageExtensionFromMimeType(mimeType)
  const buffer = await normalizeImageOrientation(Buffer.from(await file.arrayBuffer()))

  return uploadPropertyBuffer({
    propertyId: referenceId,
    buffer,
    folder: "studio-ia/references",
    extension,
    contentType: mimeType,
  })
}

export async function saveStudioPropertyPreparationMask(referenceId: string, maskBuffer: Buffer) {
  return uploadPropertyBuffer({
    propertyId: referenceId,
    buffer: maskBuffer,
    folder: "studio-ia/masks",
    extension: ".png",
    contentType: "image/png",
  })
}

export async function savePropertyGeneratedVideo(propertyId: string, videoBuffer: Buffer, mimeType = "video/mp4") {
  const extension = mimeType === "video/webm" ? ".webm" : ".mp4"
  return uploadPropertyBuffer({
    propertyId,
    buffer: videoBuffer,
    folder: "studio-ia/videos",
    extension,
    contentType: mimeType,
  })
}

export async function saveBrokerCatalogBanner(brokerId: string, file: File) {
  const source = Buffer.from(await file.arrayBuffer())
  let buffer: Buffer<ArrayBufferLike> = source
  let extension = getImageExtension(file)
  let contentType = file.type || "application/octet-stream"
  try {
    const sharp = (await import("sharp")).default
    buffer = await sharp(source)
      .rotate()
      .resize({ width: 2400, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer()
    extension = ".webp"
    contentType = "image/webp"
  } catch (error) {
    console.error("[storage][catalog] banner optimization failed, uploading original bytes", error)
  }
  return uploadPropertyBuffer({
    propertyId: `broker-${brokerId}`,
    buffer,
    folder: "catalog/banner",
    extension,
    contentType,
  })
}

export async function saveBrokerCatalogVideo(brokerId: string, file: File) {
  const extension = file.type === "video/webm" ? ".webm" : file.type === "video/quicktime" ? ".mov" : ".mp4"
  return uploadPropertyFile({
    propertyId: `broker-${brokerId}`,
    file,
    folder: "catalog/video",
    extension,
  })
}

async function saveMarketplaceRegionImageBuffer(slug: string, source: Buffer) {
  assertMarketplaceRegionSlug(slug)
  let buffer: Buffer<ArrayBufferLike>
  try {
    const sharp = (await import("sharp")).default
    buffer = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2400, height: 1400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer()
  } catch {
    throw new InvalidMarketplaceRegionImageError("invalid_image_bytes")
  }
  return uploadPropertyBuffer({
    propertyId: "marketplace-regions",
    buffer,
    folder: `${slug}/manual`,
    extension: ".webp",
    contentType: "image/webp",
  })
}

export async function saveMarketplaceRegionImage(slug: string, file: File) {
  if (!MARKETPLACE_REGION_IMAGE_TYPES.has(file.type) || file.size === 0 || file.size > MAX_MARKETPLACE_REGION_IMAGE_BYTES) {
    throw new Error("Use uma imagem JPG, PNG ou WebP de até 4 MB.")
  }
  return saveMarketplaceRegionImageBuffer(slug, Buffer.from(await file.arrayBuffer()))
}

export async function saveMarketplaceRegionImageFromUrl(slug: string, imageUrl: string) {
  const downloaded = await downloadMarketplaceRegionImage(imageUrl)
  return saveMarketplaceRegionImageBuffer(slug, downloaded)
}

function marketplaceRegionStorageObjectPath(slug: string, fileUrl: string) {
  assertMarketplaceRegionSlug(slug)
  let config: ReturnType<typeof getStorageConfig>
  try {
    config = getStorageConfig()
  } catch {
    return null
  }
  const publicPathPrefix = `/storage/v1/object/public/${config.bucket}/`
  try {
    const parsedUrl = new URL(fileUrl)
    if (
      parsedUrl.origin !== config.supabaseUrl || parsedUrl.search || parsedUrl.hash ||
      !parsedUrl.pathname.startsWith(publicPathPrefix)
    ) return null
    const objectPath = decodeURIComponent(parsedUrl.pathname.slice(publicPathPrefix.length))
    const segments = objectPath.split("/")
    const [root, regionSlug, kind, fileName] = segments
    if (
      segments.length !== 4 || root !== "marketplace-regions" || regionSlug !== slug || kind !== "manual" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(fileName)
    ) return null
    return { config, objectPath: segments.map(encodeURIComponent).join("/") }
  } catch {
    return null
  }
}

export function isMarketplaceRegionStorageUrl(slug: string, fileUrl: string | null | undefined) {
  return Boolean(fileUrl && marketplaceRegionStorageObjectPath(slug, fileUrl))
}

export async function deleteMarketplaceRegionStorageFile(slug: string, fileUrl: string) {
  const owned = marketplaceRegionStorageObjectPath(slug, fileUrl)
  if (!owned) return
  const response = await fetch(`${owned.config.supabaseUrl}/storage/v1/object/${owned.config.bucket}/${owned.objectPath}`, {
    method: "DELETE",
    headers: getStorageAuthHeaders(owned.config.serviceRoleKey),
  }).catch(() => null)
  if (response && !response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][marketplace-regions] delete failed", { status: response.status, detail })
  }
}

export async function deletePropertyStorageFile(fileUrl: string) {
  let config: ReturnType<typeof getStorageConfig>
  try {
    config = getStorageConfig()
  } catch {
    return
  }

  const publicPrefix = `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/`
  if (!fileUrl.startsWith(publicPrefix)) return

  const objectPath = fileUrl.slice(publicPrefix.length)
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "DELETE",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
    },
  }).catch(() => null)

  if (response && !response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][properties] delete failed", { status: response.status, detail })
  }
}

/**
 * Removes catalog media only when the object belongs to the authenticated
 * broker's dedicated catalog directory. Catalog URLs can also be supplied by
 * the broker, so the generic bucket deleter must never be used for this flow.
 */
export async function deleteBrokerCatalogStorageFile(brokerId: string, fileUrl: string) {
  let config: ReturnType<typeof getStorageConfig>
  try {
    config = getStorageConfig()
  } catch {
    return
  }

  const publicPathPrefix = `/storage/v1/object/public/${config.bucket}/`
  let parsedUrl: URL
  let objectPath: string
  try {
    parsedUrl = new URL(fileUrl)
    if (
      parsedUrl.origin !== config.supabaseUrl
      || parsedUrl.search
      || parsedUrl.hash
      || !parsedUrl.pathname.startsWith(publicPathPrefix)
    ) return
    objectPath = decodeURIComponent(parsedUrl.pathname.slice(publicPathPrefix.length))
  } catch {
    return
  }

  const segments = objectPath.split("/")
  const [ownerDirectory, catalogDirectory, kindDirectory, fileName] = segments
  if (
    segments.length !== 4
    || ownerDirectory !== `broker-${brokerId}`
    || catalogDirectory !== "catalog"
    || (kindDirectory !== "banner" && kindDirectory !== "video")
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp|mp4|webm|mov)$/i.test(fileName)
  ) return

  const canonicalPath = segments.map(encodeURIComponent).join("/")
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${canonicalPath}`, {
    method: "DELETE",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
    },
  }).catch(() => null)

  if (response && !response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][catalog] delete failed", { status: response.status, detail })
  }
}
