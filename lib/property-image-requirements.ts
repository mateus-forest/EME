import { PROPERTY_PUBLICATION_STANDARDS } from "@/lib/property-publication-standards"

const standards = PROPERTY_PUBLICATION_STANDARDS.marketplace

export const MARKETPLACE_COVER_REQUIREMENT = "A capa pode ser horizontal, quadrada ou vertical. O enquadramento no Marketplace é apenas visual e preserva o arquivo original."
export const MARKETPLACE_MEDIA_RECOMMENDATION = "Para uma apresentação melhor no Marketplace, recomendamos fotos em alta resolução e mais opções de ambientes. Você pode publicar mesmo assim."

export function describePropertyImage(width: number, height: number) {
  const orientation = width > height ? "horizontal" : width < height ? "vertical" : "quadrada"
  const hasRecommendedResolution = Math.max(width, height) >= standards.recommendedImageLongEdge &&
    Math.min(width, height) >= standards.recommendedImageShortEdge
  const coverEligible = width > 0 && height > 0
  const dimensions = `${width} × ${height} px · ${orientation}`
  const status = !coverEligible
    ? "Não foi possível confirmar as dimensões da imagem."
    : hasRecommendedResolution
      ? "Apta para capa do Marketplace."
      : `Apta para capa do Marketplace. ${MARKETPLACE_MEDIA_RECOMMENDATION}`

  return { orientation, hasRecommendedResolution, coverEligible, dimensions, status }
}
