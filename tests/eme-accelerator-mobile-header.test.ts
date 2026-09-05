import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(
  new URL("../components/eme/landing-accelerator.tsx", import.meta.url),
  "utf8",
)

test("header do Acelerador remove o sino e unifica o estado no desktop", () => {
  const topbar = source.slice(
    source.indexOf("function AcceleratorTopbar"),
    source.indexOf("function AcceleratorIntro"),
  )

  assert.doesNotMatch(source, /\bBell\b/)
  assert.doesNotMatch(topbar, /eme-accelerator__notify/)
  assert.match(topbar, /Entrar/)
  assert.match(topbar, /Começar agora/)
  assert.match(topbar, /ProductBadge compact=\{compact\}/)
  assert.match(source, /Novo produto · Em desenvolvimento/)
  assert.match(source, /\{compact \? <DevelopmentBadge \/> : null\}/)
})
