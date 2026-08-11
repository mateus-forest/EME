import { randomUUID } from "node:crypto"

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error("Upload indisponível: configure as variáveis do Supabase Storage.")
  return value
}

function getStorageConfig() {
  return {
    supabaseUrl: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, ""),
    anonKey: readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: "properties",
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
  folder: "images" | "audio"
  extension: string
}) {
  const config = getStorageConfig()
  const objectPath = `${propertyId}/${folder}/${randomUUID()}${extension}`
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.anonKey,
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
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.anonKey,
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
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.anonKey,
    },
  }).catch(() => null)

  if (response && !response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][properties] delete failed", { status: response.status, detail })
  }
}
