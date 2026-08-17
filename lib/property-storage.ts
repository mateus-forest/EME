import { randomUUID } from "node:crypto"

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
