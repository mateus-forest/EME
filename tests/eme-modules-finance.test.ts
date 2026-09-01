import assert from "node:assert/strict"
import test from "node:test"

import { emeModules } from "../lib/eme-modules.ts"

test("Financeiro participa da órbita com conteúdo aprovado e sem CTA de demonstração", () => {
  const finance = emeModules.find((module) => module.id === "financeiro")

  assert.ok(finance)
  assert.equal(finance.name, "Financeiro")
  assert.equal(finance.description, "Carteira, recebimentos, despesas e comissões.")
  assert.equal(finance.mockup, "/modals/financeiro-approved-reference.png")
  assert.equal(finance.priorityMobile, true)
  assert.equal(finance.demoHref, undefined)
  assert.equal(finance.demoLabel, undefined)
})

test("nove cards mantêm distribuição orbital uniforme", () => {
  const sortedAngles = emeModules.map((module) => module.angle).sort((left, right) => left - right)
  const gaps = sortedAngles.map((angle, index) => {
    const next = sortedAngles[(index + 1) % sortedAngles.length]
    return (next - angle + 360) % 360
  })

  assert.equal(emeModules.length, 9)
  assert.equal(new Set(emeModules.map((module) => module.id)).size, 9)
  assert.deepEqual(gaps, Array.from({ length: 9 }, () => 40))
})
