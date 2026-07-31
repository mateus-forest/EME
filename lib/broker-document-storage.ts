import "server-only"

import { randomUUID } from "node:crypto"

import { getSupabaseStorageEnv } from "@/lib/env.server"

function getStorageConfig() {
  const env = getSupabaseStorageEnv()
  const supabaseUrl = (env.publicSupabaseUrl || env.supabaseUrl || "").replace(/\/+$/, "")
  const anonKey = env.anonKey
  const serviceRoleKey = env.serviceRoleKey
  const bucket = env.bucket || "properties"

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !bucket) {
    throw new Error("Upload de contratos indisponivel: configure o Supabase Storage.")
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    bucket,
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
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.anonKey,
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
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.anonKey,
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
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.anonKey,
    },
  }).catch(() => null)

  if (response && !response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("[storage][contracts] delete failed", { status: response.status, detail })
  }
}
