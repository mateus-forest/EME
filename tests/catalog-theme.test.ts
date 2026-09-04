import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCatalogThemeCookie,
  CATALOG_THEME_COOKIE,
  CATALOG_THEME_STORAGE_KEY,
  getNextCatalogTheme,
  parseCatalogTheme,
} from "../lib/catalog-theme.ts"

test("normaliza o tema persistido sem aceitar valores desconhecidos", () => {
  assert.equal(parseCatalogTheme("dark"), "dark")
  assert.equal(parseCatalogTheme("light"), "light")
  assert.equal(parseCatalogTheme("system"), "light")
  assert.equal(parseCatalogTheme(undefined), "light")
})

test("alterna entre light e dark", () => {
  assert.equal(getNextCatalogTheme("light"), "dark")
  assert.equal(getNextCatalogTheme("dark"), "light")
})

test("persiste a preferência no escopo do catálogo", () => {
  assert.equal(CATALOG_THEME_COOKIE, "eme_catalog_theme")
  assert.equal(CATALOG_THEME_STORAGE_KEY, "eme:catalog-theme")
  assert.match(buildCatalogThemeCookie("dark"), /^eme_catalog_theme=dark;/)
  assert.match(buildCatalogThemeCookie("dark"), /path=\/catalogo/)
  assert.match(buildCatalogThemeCookie("dark"), /samesite=lax$/)
})
