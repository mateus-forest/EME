import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const panelSource = readFileSync(
  new URL("../components/eme/expanded-module-panel.tsx", import.meta.url),
  "utf8",
)
const styles = readFileSync(
  new URL("../components/eme/finance-module-artwork.module.css", import.meta.url),
  "utf8",
)
const financeArtworkSource = panelSource.slice(
  panelSource.indexOf("function FinanceModuleArtwork"),
  panelSource.indexOf("function MobileModuleArtwork"),
)

test("Financeiro usa composição própria sem máscara ou CTA vazio", () => {
  assert.match(financeArtworkSource, /function FinanceModuleArtwork/)
  assert.match(financeArtworkSource, /data-finance-modal-layout/)
  assert.match(financeArtworkSource, /data-mobile-module-scroll=\{compact/)
  assert.match(financeArtworkSource, /data-desktop-module-artwork=\{compact/)
  assert.doesNotMatch(panelSource, /data-finance-demo-mask/)
  assert.doesNotMatch(financeArtworkSource, /Abrir demonstração/)
  assert.match(financeArtworkSource, /FINANCE_MOCKUP_CROP/)
})

test("composição desktop mantém mockup e conteúdo em 58 por 42", () => {
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 58fr\) minmax\(0, 42fr\)/)
  assert.match(styles, /"mockup eyebrow"/)
  assert.match(styles, /"control benefits"/)
  assert.match(styles, /padding:\s*32px/)
})

test("composição compacta empilha todo o conteúdo sem corte horizontal", () => {
  assert.match(styles, /@media \(max-width: 1023px\)/)
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\)/)
  assert.match(styles, /"mockup"[\s\S]*?"benefits"[\s\S]*?"control"/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?padding:\s*18px/)
  assert.doesNotMatch(styles, /overflow:\s*hidden/)
})

test("texto e benefícios continuam vindo do conteúdo aprovado do módulo", () => {
  assert.match(panelSource, /module\.tagline/)
  assert.match(panelSource, /module\.longDescription/)
  assert.match(panelSource, /module\.benefits\.map/)
  assert.match(panelSource, /Controle e previsibilidade/)
  assert.match(
    panelSource,
    /Recebimentos, despesas e comissões organizados para uma operação mais clara e segura\./,
  )
})
