export function isPlaceholderPropertyImage(image?: string | null) {
  if (!image) return true

  return image.includes("/placeholder") || image.includes("placeholder.jpg")
}

function normalizeSeed(seed: string | number) {
  if (typeof seed === "number") return Math.abs(seed)

  return seed.split("").reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0)
}

export function getPropertyImage(image?: string | null, _seed: string | number = 0): string {
  return isPlaceholderPropertyImage(image) ? "" : image ?? ""
}

export function getPropertyImages(images: Array<string | null | undefined>, seed: string | number = 0) {
  const baseSeed = normalizeSeed(seed)
  const normalizedImages = images
    .map((image, index) => getPropertyImage(image, baseSeed + index))
    .filter((image): image is string => Boolean(image))

  if (normalizedImages.length > 0) return normalizedImages

  return []
}
