import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(
  new URL("../components/eme/landing-accelerator.tsx", import.meta.url),
  "utf8",
)

test("sino do Acelerador permanece somente no header desktop", () => {
  const topbar = source.slice(
    source.indexOf("function AcceleratorTopbar"),
    source.indexOf("function AcceleratorIntro"),
  )

  assert.match(topbar, /\{!compact \? \([\s\S]*?eme-accelerator__notify/)
  assert.match(topbar, /Entrar/)
  assert.match(topbar, /Começar agora/)
  assert.match(topbar, /ProductBadge compact=\{compact\}/)
})
