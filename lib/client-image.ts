"use client"

type CompressImageOptions = {
  maxBytes?: number
  maxDimension?: number
}

const DEFAULT_MAX_BYTES = 450_000
const DEFAULT_MAX_DIMENSION = 720

export async function compressImageToDataUrl(file: File, options: CompressImageOptions = {}) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione uma imagem valida.")
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Nao foi possivel preparar a imagem selecionada.")
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
    const dataUrl = canvas.toDataURL("image/webp", quality)
    if (dataUrl.length <= maxBytes) return dataUrl
  }

  throw new Error("A imagem continua muito grande. Tente uma foto menor ou com menos resolucao.")
}
