import { randomUUID } from "node:crypto"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { getSupabaseStorageEnv } from "@/lib/env.server"

function getImageExtension(file: File) {
  if (file.type === "image/png") return ".png"
  if (file.type === "image/webp") return ".webp"
  return ".jpg"
}

function getStorageBaseUrl() {
  const env = getSupabaseStorageEnv()
  return env.publicSupabaseUrl || env.supabaseUrl
}

export async function savePropertyImage(propertyId: string, file: File) {
  const env = getSupabaseStorageEnv()
  const extension = getImageExtension(file)
  const fileName = `${randomUUID()}${extension}`

  if (env.enabled) {
    const supabaseUrl = getStorageBaseUrl()

    if (!supabaseUrl || !env.serviceRoleKey || !env.bucket) {
      throw new Error("Supabase Storage habilitado, mas sem URL, bucket ou service role configurados.")
    }

    const objectPath = `properties/${propertyId}/${fileName}`
    const baseUrl = supabaseUrl.replace(/\/+$/, "")
    const response = await fetch(`${baseUrl}/storage/v1/object/${env.bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.serviceRoleKey}`,
        apikey: env.serviceRoleKey,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: Buffer.from(await file.arrayBuffer()),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(detail || "Não foi possível enviar a imagem para o Supabase Storage.")
    }

    return `${baseUrl}/storage/v1/object/public/${env.bucket}/${objectPath}`
  }

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("Upload de imagens indisponível: configure Supabase Storage para salvar imagens em produção.")
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const directory = path.join(process.cwd(), "public", "uploads", "properties", propertyId)
  const absoluteFilePath = path.join(directory, fileName)

  await mkdir(directory, { recursive: true })
  await writeFile(absoluteFilePath, buffer)

  return `/uploads/properties/${propertyId}/${fileName}`
}

export async function deletePropertyImageFile(imageUrl: string) {
  const env = getSupabaseStorageEnv()

  if (env.enabled) {
    const supabaseUrl = getStorageBaseUrl()
    if (!supabaseUrl || !env.serviceRoleKey || !env.bucket) return

    const baseUrl = supabaseUrl.replace(/\/+$/, "")
    const publicPrefix = `${baseUrl}/storage/v1/object/public/${env.bucket}/`
    if (!imageUrl.startsWith(publicPrefix)) return

    const objectPath = imageUrl.slice(publicPrefix.length)
    await fetch(`${baseUrl}/storage/v1/object/${env.bucket}/${objectPath}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${env.serviceRoleKey}`,
        apikey: env.serviceRoleKey,
      },
    }).catch(() => null)
    return
  }

  if (!imageUrl.startsWith("/uploads/properties/")) return
  const relativePath = imageUrl.replace(/^\/+/, "")
  await unlink(path.join(process.cwd(), "public", ...relativePath.split("/"))).catch(() => null)
}
