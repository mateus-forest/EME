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

function getImageExtension(file: File) {
  if (file.type === "image/png") return ".png"
  if (file.type === "image/webp") return ".webp"
  return ".jpg"
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

export function isPropertyStorageUrl(url: string) {
  try {
    const config = getStorageConfig()
    return url.startsWith(`${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/`)
  } catch {
    return false
  }
}

export async function savePropertyImage(propertyId: string, file: File) {
  return uploadPropertyFile({
    propertyId,
    file,
    folder: "images",
    extension: getImageExtension(file),
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

export async function deletePropertyStorageFile(fileUrl: string) {
  const config = getStorageConfig()
  const publicPrefix = `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/`
  if (!fileUrl.startsWith(publicPrefix)) return

  const objectPath = fileUrl.slice(publicPrefix.length)
  await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.anonKey,
    },
  }).catch(() => null)
}
