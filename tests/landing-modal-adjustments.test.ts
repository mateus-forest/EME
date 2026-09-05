import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { emeModules } from "../lib/eme-modules.ts"

const panelSource = readFileSync(
  new URL("../components/eme/expanded-module-panel.tsx", import.meta.url),
  "utf8",
)
const acceleratorSource = readFileSync(
  new URL("../components/eme/landing-accelerator.tsx", import.meta.url),
  "utf8",
)
const acceleratorStyles = readFileSync(
  new URL("../components/eme/landing-accelerator.module.css", import.meta.url),
  "utf8",
)

test("Compromissos usa conteúdo e mockup próprios dentro de um único shell", () => {
  const agendaArtwork = panelSource.slice(
    panelSource.indexOf("function AgendaModuleArtwork"),
    panelSource.indexOf("function MobileModuleArtwork"),
  )

  assert.match(agendaArtwork, /data-agenda-modal-layout/)
  assert.match(agendaArtwork, /MOBILE_MODULE_ARTWORK_CROPS\.agenda/)
  assert.match(agendaArtwork, /module\.tagline/)
  assert.match(agendaArtwork, /module\.longDescription/)
  assert.match(agendaArtwork, /AGENDA_DESKTOP_BENEFITS\.map/)
  assert.match(panelSource, /Lembretes automáticos para você e o cliente/)
  assert.match(panelSource, /Acompanhamento claro do que precisa ser feito/)
  assert.match(panelSource, /const modalAspectRatio = isAgenda[\s\S]*?approvedArtwork\.width \/ approvedArtwork\.height/)
  assert.match(panelSource, /aspectRatio=\{modalAspectRatio\}/)
})

test("Catálogo oferece o catálogo real em uma nova aba", () => {
  const catalog = emeModules.find((module) => module.id === "catalogo")

  assert.ok(catalog)
  assert.equal(catalog.demoLabel, "Ver catálogo real")
  assert.equal(catalog.demoHref, "https://www.meueme.com/catalogo/fabricio-foscarini")
  assert.match(panelSource, /target="_blank"/)
  assert.match(panelSource, /rel="noopener noreferrer"/)
  assert.match(panelSource, /<CatalogDemoLink module=\{module\} compact \/>/)
})

test("Acelerador desktop fica compacto, sem sino, badge duplicado ou setas sem ação", () => {
  assert.doesNotMatch(acceleratorSource, /\bBell\b/)
  assert.match(acceleratorSource, /Novo produto · Em desenvolvimento/)
  assert.match(acceleratorSource, /\{compact \? <DevelopmentBadge \/> : null\}/)
  assert.match(acceleratorSource, /\{compact \? \([\s\S]*?eme-accelerator-card__arrow/)
  assert.match(acceleratorStyles, /@media \(min-width: 1024px\)/)
  assert.match(acceleratorStyles, /eme-accelerator-impact__metric strong/)
  assert.match(acceleratorStyles, /font-size:\s*clamp\(20px, 1\.7vw, 28px\)/)
  assert.match(acceleratorStyles, /height:\s*clamp\(136px, 18vh, 180px\)/)
})
