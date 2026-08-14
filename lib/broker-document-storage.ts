import "server-only"

import { randomUUID } from "node:crypto"

import { getSupabaseStorageEnv } from "@/lib/env.server"

function getStorageConfig() {
  const env = getSupabaseStorageEnv()
  const configuredUrl = env.publicSupabaseUrl || env.supabaseUrl || ""
  let supabaseUrl = ""
  try {
    // SUPABASE_URL is sometimes configured with /rest/v1. Storage endpoints always
    // live at the project origin, so keeping that path produces /rest/v1/storage/...
    // and every upload/read fails with PGRST125.
    supabaseUrl = new URL(configuredUrl).origin
  } catch {
    // The validation below keeps the public error stable for missing/invalid config.
  }
  const serviceRoleKey = env.serviceRoleKey
  const bucket = env.bucket || "properties"

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error("Upload de contratos indisponivel: configure o Supabase Storage.")
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    bucket,
  }
}

function getStorageAuthHeaders(serviceRoleKey: string) {
  return {
    // New Supabase sb_secret_* keys are opaque API keys, not JWTs. Sending one as
    // Bearer makes Storage reject it with PGRST301 before authorizing the request.
    apikey: serviceRoleKey,
    ...(serviceRoleKey.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${serviceRoleKey}` }),
  }
}

function sanitizeFileName(fileName: string) {
  const trimmed = fileName.trim() || "documento"
  return trimmed.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-")
}

function getPublicPrefix(config: ReturnType<typeof getStorageConfig>) {
  return `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/`
}

export async function saveBrokerContractFile(input: {
  brokerId: string
  file: File
}) {
  const config = getStorageConfig()
  const safeName = sanitizeFileName(input.file.name)
  const objectPath = `brokers/${input.brokerId}/contracts/${randomUUID()}-${safeName}`
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
      "Content-Type": input.file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: Buffer.from(await input.file.arrayBuffer()),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][contracts] upload failed", { status: response.status, detail })
    throw new Error("Nao foi possivel enviar o contrato anexado para o storage.")
  }

  return {
    fileName: input.file.name || safeName,
    fileUrl: `${getPublicPrefix(config)}${objectPath}`,
    mimeType: input.file.type || "application/octet-stream",
    fileSize: input.file.size || null,
  }
}

export async function saveBrokerContractTemplateFile(input: {
  brokerId: string
  file: File
}) {
  const config = getStorageConfig()
  const safeName = sanitizeFileName(input.file.name)
  const objectPath = `brokers/${input.brokerId}/contract-templates/${randomUUID()}-${safeName}`
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
      "Content-Type": input.file.type || "application/octet-stream",
      "x-upsert": "false",
    },
    body: Buffer.from(await input.file.arrayBuffer()),
  })

  if (!response.ok) {
    console.error("[storage][contract-templates] upload failed", { status: response.status })
    throw new Error("Não foi possível preservar o arquivo original do modelo.")
  }

  return {
    fileName: input.file.name || safeName,
    storagePath: objectPath,
    mimeType: input.file.type || "application/octet-stream",
    fileSize: input.file.size || null,
  }
}

export async function readBrokerContractTemplateFile(storagePath: string) {
  const config = getStorageConfig()
  if (!storagePath.startsWith("brokers/") || storagePath.includes("..")) {
    throw new Error("Arquivo de modelo inválido.")
  }
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${storagePath}`, {
    method: "GET",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
    },
    cache: "no-store",
  })
  if (!response.ok) {
    console.error("[storage][contract-templates] read failed", { status: response.status })
    throw new Error("Não foi possível carregar o arquivo original do modelo.")
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("Content-Type") || "application/octet-stream",
  }
}

export async function deleteBrokerContractTemplateFile(storagePath: string | null | undefined) {
  if (!storagePath || !storagePath.startsWith("brokers/") || storagePath.includes("..")) return
  let config: ReturnType<typeof getStorageConfig>
  try {
    config = getStorageConfig()
  } catch {
    return
  }
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${storagePath}`, {
    method: "DELETE",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
    },
  }).catch(() => null)
  if (response && !response.ok) {
    console.error("[storage][contract-templates] delete failed", { status: response.status })
  }
}

function getObjectPath(fileUrl: string, config: ReturnType<typeof getStorageConfig>) {
  const prefix = getPublicPrefix(config)
  if (!fileUrl.startsWith(prefix)) {
    throw new Error("Arquivo de contrato fora do bucket configurado.")
  }

  return fileUrl.slice(prefix.length)
}

export async function readBrokerContractFile(fileUrl: string) {
  const config = getStorageConfig()
  const objectPath = getObjectPath(fileUrl, config)
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "GET",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][contracts] read failed", { status: response.status, detail })
    throw new Error("Nao foi possivel carregar o arquivo do contrato anexado.")
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("Content-Type") || "application/octet-stream",
    contentLength: response.headers.get("Content-Length"),
  }
}

export async function deleteBrokerContractFile(fileUrl: string) {
  let config: ReturnType<typeof getStorageConfig>
  try {
    config = getStorageConfig()
  } catch {
    return
  }

  let objectPath: string
  try {
    objectPath = getObjectPath(fileUrl, config)
  } catch {
    return
  }

  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "DELETE",
    headers: {
      ...getStorageAuthHeaders(config.serviceRoleKey),
    },
  }).catch(() => null)

  if (response && !response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][contracts] delete failed", { status: response.status, detail })
  }
}
