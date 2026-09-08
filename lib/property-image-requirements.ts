import { PROPERTY_PUBLICATION_STANDARDS } from "@/lib/property-publication-standards"

const standards = PROPERTY_PUBLICATION_STANDARDS.marketplace

export const MARKETPLACE_COVER_REQUIREMENT = `Para a capa, use uma foto horizontal ou quadrada com no mínimo ${standards.minimumImageLongEdge}×${standards.minimumImageShortEdge} px.`

export function describePropertyImage(width: number, height: number) {
  const orientation = width > height ? "horizontal" : width < height ? "vertical" : "quadrada"
  const hasMinimumResolution = Math.max(width, height) >= standards.minimumImageLongEdge &&
    Math.min(width, height) >= standards.minimumImageShortEdge
  const coverEligible = width >= standards.minimumImageLongEdge &&
    height >= standards.minimumImageShortEdge && width >= height
  const dimensions = `${width} × ${height} px · ${orientation}`
  const status = !hasMinimumResolution
    ? `Resolução insuficiente: envie o original com lado maior de pelo menos ${standards.minimumImageLongEdge} px e lado menor de ${standards.minimumImageShortEdge} px.`
    : coverEligible
      ? "Apta para capa do Marketplace."
      : "Resolução suficiente para a galeria; foto vertical não pode ser capa."

  return { orientation, hasMinimumResolution, coverEligible, dimensions, status }
}
