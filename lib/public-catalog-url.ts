const PUBLIC_WEB_ORIGIN = "https://www.meueme.com"

function trimSlashes(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "")
}

export function getPublicWebOrigin() {
  return PUBLIC_WEB_ORIGIN
}

export function buildBrokerCatalogPath(slug: string) {
  return `/catalogo/${trimSlashes(slug)}`
}

export function buildAgencyCatalogPath(slug: string) {
  return `/catalogo/imobiliaria/${trimSlashes(slug)}`
}

export function buildBrokerCatalogListingPath(slug: string) {
  return `${buildBrokerCatalogPath(slug)}/imoveis`
}

export function buildAgencyCatalogListingPath(slug: string) {
  return `${buildAgencyCatalogPath(slug)}/imoveis`
}

export function toPublicWebUrl(pathname: string) {
  return new URL(pathname, PUBLIC_WEB_ORIGIN).toString()
}

export function buildBrokerCatalogUrl(slug: string) {
  return toPublicWebUrl(buildBrokerCatalogPath(slug))
}

export function buildAgencyCatalogUrl(slug: string) {
  return toPublicWebUrl(buildAgencyCatalogPath(slug))
}

export function buildBrokerCatalogListingUrl(slug: string) {
  return toPublicWebUrl(buildBrokerCatalogListingPath(slug))
}

export function buildAgencyCatalogListingUrl(slug: string) {
  return toPublicWebUrl(buildAgencyCatalogListingPath(slug))
}
