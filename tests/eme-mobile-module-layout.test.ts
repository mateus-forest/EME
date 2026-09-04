import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const panelSource = readFileSync(
  new URL("../components/eme/expanded-module-panel.tsx", import.meta.url),
  "utf8",
)
const styles = readFileSync(
  new URL("../components/eme/mobile-module-artwork.module.css", import.meta.url),
  "utf8",
)

test("todos os módulos compactos usam uma composição mobile própria", () => {
  assert.doesNotMatch(panelSource, /MOBILE_MODULE_BANNERS/)
  assert.match(panelSource, /function MobileModuleArtwork/)
  assert.match(panelSource, /\{compact \? \([\s\S]*?<MobileModuleArtwork module=\{module\} \/>/)

  for (const id of [
    "marketplace",
    "cos",
    "clientes",
    "imoveis",
    "catalogo",
    "studio-ia",
    "propostas",
    "contratos",
    "agenda",
    "financeiro",
  ]) {
    assert.match(panelSource, new RegExp(`(?:"${id}"|${id}):\\s*(?:FINANCE_MOCKUP_CROP|\\{)`))
  }
})

test("fluxo mobile segue label, título, descrição, mockup, benefícios e complemento", () => {
  const mobileArtworkSource = panelSource.slice(
    panelSource.indexOf("function MobileModuleArtwork"),
    panelSource.indexOf("export function ExpandedModulePanel"),
  )
  const flowTokens = [
    "data-mobile-module-label",
    "data-mobile-module-title",
    "data-mobile-module-description",
    "mobileMockup",
    "data-mobile-module-benefits",
    "data-mobile-module-complement",
  ]
  const positions = flowTokens.map((token) => mobileArtworkSource.indexOf(token))
  assert.ok(positions.every((position) => position >= 0))
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right))
})

test("container mobile usa dimensões fluidas, scroll interno e mídia contida", () => {
  assert.match(styles, /display:\s*flex/)
  assert.match(styles, /flex-direction:\s*column/)
  assert.match(styles, /width:\s*100%/)
  assert.match(styles, /max-height:\s*inherit/)
  assert.match(styles, /overflow-y:\s*auto/)
  assert.match(styles, /object-fit:\s*contain/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?padding:\s*18px/)
  assert.doesNotMatch(styles, /position:\s*absolute/)
})

test("mockups usam apenas recortes declarados das imagens aprovadas", () => {
  assert.match(panelSource, /src=\{module\.mockup \|\| "\/placeholder\.svg"\}/)
  assert.match(panelSource, /crop=\{artworkCrop\}/)
  assert.match(panelSource, /mobileMockup[\s\S]*?fit="contain"/)
})
