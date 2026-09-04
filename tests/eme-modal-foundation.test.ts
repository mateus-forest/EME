import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const foundationSource = readFileSync(
  new URL("../components/ui/eme-modal-foundation.tsx", import.meta.url),
  "utf8",
)
const landingShellSource = readFileSync(
  new URL("../components/eme/landing-modal-shell.tsx", import.meta.url),
  "utf8",
)
const styles = readFileSync(
  new URL("../components/ui/eme-modal-foundation.module.css", import.meta.url),
  "utf8",
)

test("define a geometria responsiva do shell sem altura universal fixa", () => {
  assert.match(styles, /width:\s*min\(1120px,\s*calc\(100vw - 64px\)\)/)
  assert.match(styles, /max-height:\s*calc\(100dvh - 48px\)/)
  assert.match(styles, /border-radius:\s*26px/)
  assert.match(styles, /--eme-modal-padding:\s*32px/)
  assert.match(styles, /padding:\s*var\(--eme-modal-padding\)/)
  assert.match(styles, /height:\s*auto/)

  assert.match(styles, /width:\s*calc\(100vw - 40px\)/)
  assert.match(styles, /max-height:\s*calc\(100dvh - 40px\)/)

  assert.match(styles, /width:\s*min\(calc\(100vw - 24px\), 100%\)/)
  assert.match(styles, /max-height:\s*min\(calc\(100dvh - 24px\), 100%\)/)
  assert.match(styles, /border-radius:\s*22px/)
  assert.match(styles, /--eme-modal-padding:\s*18px/)
})

test("desativa a proporcao preferencial dos modais nos breakpoints compactos", () => {
  const tabletStart = styles.indexOf("@media (min-width: 641px) and (max-width: 1023px)")
  const mobileStart = styles.indexOf("@media (max-width: 640px)")
  const supportStart = styles.indexOf("@supports not", mobileStart)
  const tabletStyles = styles.slice(tabletStart, mobileStart)
  const mobileStyles = styles.slice(mobileStart, supportStart)
  const preferredAspectSelector = /\.surface\.surface\[data-eme-modal-preferred-aspect='true'\]/

  assert.match(tabletStyles, preferredAspectSelector)
  assert.match(tabletStyles, /width:\s*calc\(100vw - 40px\)/)
  assert.match(tabletStyles, /aspect-ratio:\s*auto/)

  assert.match(mobileStyles, preferredAspectSelector)
  assert.match(mobileStyles, /width:\s*min\(calc\(100vw - 24px\), 100%\)/)
  assert.match(mobileStyles, /max-height:\s*min\(calc\(100dvh - 24px\), 100%\)/)
  assert.match(mobileStyles, /aspect-ratio:\s*auto/)
})

test("respeita safe areas, scroll interno e alvo de fechar de 44 pixels", () => {
  assert.match(styles, /env\(safe-area-inset-top\)/)
  assert.match(styles, /env\(safe-area-inset-right\)/)
  assert.match(styles, /env\(safe-area-inset-bottom\)/)
  assert.match(styles, /env\(safe-area-inset-left\)/)
  assert.match(styles, /overflow-y:\s*auto/)
  assert.match(styles, /overscroll-behavior:\s*contain/)
  assert.match(styles, /width:\s*44px/)
  assert.match(styles, /height:\s*44px/)
  assert.match(styles, /color:\s*#16231b/)
  assert.match(styles, /\[data-eme-modal-close-icon\]/)
  assert.match(styles, /visibility:\s*visible/)
})

test("expõe header, body, footer e split opcional 58 por 42", () => {
  for (const exportedPart of [
    "EmeModalHeader",
    "EmeModalBody",
    "EmeModalFooter",
    "EmeModalActions",
    "EmeModalSplit",
    "EmeModalVisual",
    "EmeModalDetails",
  ]) {
    assert.match(foundationSource, new RegExp(`export function ${exportedPart}`))
  }

  assert.match(styles, /grid-template-columns:\s*minmax\(0, 58fr\) minmax\(0, 42fr\)/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.split \{[\s\S]*?display:\s*block/)
})

test("landing reutiliza a fundação sem perder seus contratos de interação", () => {
  for (const primitive of [
    "EmeModalViewport",
    "EmeModalBackdrop",
    "EmeModalSurface",
    "EmeModalContent",
    "EmeModalCloseTarget",
  ]) {
    assert.match(landingShellSource, new RegExp(`<${primitive}`))
  }

  assert.match(landingShellSource, /data-landing-modal-shell/)
  assert.match(landingShellSource, /data-landing-modal-close/)
  assert.match(landingShellSource, /<motion\.div[\s\S]*?aria-hidden="true"[\s\S]*?eme-landing-modal-backdrop/)
  assert.equal((landingShellSource.match(/data-eme-modal-close-icon/g) ?? []).length, 1)
  assert.match(landingShellSource, /event\.key === "Escape"/)
  assert.match(landingShellSource, /body\.style\.overflow = "hidden"/)
})
