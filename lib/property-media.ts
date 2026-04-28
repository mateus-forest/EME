export const DEFAULT_PROPERTY_IMAGES = [
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&h=675&fit=crop",
] as const

export function isPlaceholderPropertyImage(image?: string | null) {
  if (!image) return true

  return image.includes("/placeholder") || image.includes("placeholder.jpg")
}

function normalizeSeed(seed: string | number) {
  if (typeof seed === "number") return Math.abs(seed)

  return seed.split("").reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0)
}

export function getFallbackPropertyImage(seed: string | number = 0) {
  return DEFAULT_PROPERTY_IMAGES[normalizeSeed(seed) % DEFAULT_PROPERTY_IMAGES.length]
}

export function getPropertyImage(image?: string | null, seed: string | number = 0): string {
  return isPlaceholderPropertyImage(image) ? getFallbackPropertyImage(seed) : image ?? getFallbackPropertyImage(seed)
}

export function getPropertyImages(images: Array<string | null | undefined>, seed: string | number = 0) {
  const baseSeed = normalizeSeed(seed)
  const normalizedImages = images
    .map((image, index) => getPropertyImage(image, baseSeed + index))
    .filter((image): image is string => Boolean(image))

  if (normalizedImages.length > 0) return normalizedImages

  return [getFallbackPropertyImage(baseSeed)]
}
