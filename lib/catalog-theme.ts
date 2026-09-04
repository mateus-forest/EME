export const CATALOG_THEME_COOKIE = "eme_catalog_theme"
export const CATALOG_THEME_STORAGE_KEY = "eme:catalog-theme"
export const CATALOG_THEME_MAX_AGE = 60 * 60 * 24 * 365

export type CatalogTheme = "light" | "dark"

export function parseCatalogTheme(value: unknown): CatalogTheme {
  return value === "dark" ? "dark" : "light"
}

export function getNextCatalogTheme(theme: CatalogTheme): CatalogTheme {
  return theme === "dark" ? "light" : "dark"
}

export function buildCatalogThemeCookie(theme: CatalogTheme) {
  return `${CATALOG_THEME_COOKIE}=${theme}; path=/catalogo; max-age=${CATALOG_THEME_MAX_AGE}; samesite=lax`
}
