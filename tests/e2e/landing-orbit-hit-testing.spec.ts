import { expect, test, type Locator, type Page } from "@playwright/test"

// Real wheel/drag input and coordinate clicks: never bypass browser hit-testing.
const frontOrder = [
  ["contratos", "Contratos"], ["propostas", "Propostas"], ["studio-ia", "Studio IA"],
  ["catalogo", "Catálogo"], ["imoveis", "Imóveis"], ["clientes", "Clientes"],
  ["cos", "COS"], ["financeiro", "Financeiro"], ["agenda", "Compromissos"],
] as const

async function hitPoints(button: Locator) {
  return button.evaluate(element => {
    const box = element.getBoundingClientRect()
    return [[.5, .5], [.25, .25], [.75, .25], [.25, .75], [.75, .75]].map(([dx, dy]) => {
      const x = box.x + box.width * dx, y = box.y + box.height * dy
      const hit = document.elementFromPoint(x, y)
      return { x, y, matches: element.contains(hit), hit: hit?.tagName }
    })
  })
}

async function openAtPoint(page: Page, id: string, button: Locator, touch = false) {
  const points = await hitPoints(button)
  expect(points.every(point => point.matches), `${id}: an overlay intercepted the card`).toBe(true)
  const { x, y } = points[0]
  if (touch) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  const dialog = page.locator(`[data-module-dialog="${id}"]`)
  await expect(dialog).toHaveCSS("opacity", "1")
  if (!touch) {
    await expect(button).toHaveCSS("pointer-events", "none")
    await page.keyboard.press("Escape")
  } else {
    await dialog.locator("[data-landing-modal-close]").tap()
  }
  await expect(dialog).toHaveCount(0)
  await expect(button).toHaveCSS("pointer-events", "auto")
}

test("front cards receive real hover/click throughout a full desktop rotation", async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await expect(page.locator('[data-orbit-card="contratos"]')).toHaveCSS("opacity", "1")
  await page.waitForTimeout(900)

  for (const [id, name] of frontOrder) {
    const card = page.locator(`[data-orbit-card="${id}"]`)
    const button = page.getByRole("button", { name: `Abrir modulo ${name}`, exact: true })
    await page.mouse.move(15, 750)
    for (let step = 0; step < 100; step++) {
      if (await card.evaluate(element => Number(getComputedStyle(element).zIndex) >= 990)) break
      await page.mouse.wheel(0, 80)
      await page.waitForTimeout(90)
    }
    await expect.poll(() => card.evaluate(element => Number(getComputedStyle(element).zIndex))).toBeGreaterThanOrEqual(985)
    expect((await hitPoints(button)).every(point => point.matches)).toBe(true)
    const { x, y } = (await hitPoints(button))[0]
    await page.mouse.move(x, y)
    await expect(button).toHaveCSS("cursor", "none")
    await expect(page.locator("[data-orbit-cursor] > div")).toHaveCSS("opacity", "1")
    await expect(page.locator("[data-orbit-cursor]")).toHaveCSS("pointer-events", "none")
    await openAtPoint(page, id, button)

    // Also exercise the opposite scroll direction and a different front-facing position.
    await page.mouse.move(15, 750)
    for (let step = 0; step < 3; step++) await page.mouse.wheel(0, -80)
    await page.waitForTimeout(650)
    await openAtPoint(page, id, button)
  }
  await openAtPoint(page, "marketplace", page.getByRole("button", { name: "Abrir modulo Marketplace", exact: true }))
  expect(errors).toEqual([])
})

test("reduced motion keeps a visible native pointer on front cards", async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const button = page.getByRole("button", { name: "Abrir modulo Compromissos", exact: true })
  await expect(page.locator('[data-orbit-card="agenda"]')).toHaveCSS("opacity", "1")
  await page.waitForTimeout(400)
  await expect(button).toHaveCSS("cursor", "pointer")
  await expect(page.locator("[data-orbit-cursor]")).toBeHidden()
  await openAtPoint(page, "agenda", button)
})

test("all mobile front cards accept taps after dragging the orbit", async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" })
  const page = await context.newPage()
  try {
    await page.goto("/")
    await expect(page.locator('[data-mobile-orbit-card="contratos"]')).toHaveCSS("opacity", "1")
    await page.waitForTimeout(500)
    for (const [id, name] of frontOrder) {
      const card = page.locator(`[data-mobile-orbit-card="${id}"]`)
      for (let step = 0; step < 14; step++) {
        const delta = await card.evaluate(element => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
          const sin = (matrix.m41 + (element as HTMLElement).offsetWidth / 2) / 220
          const cos = -matrix.m43 / 92
          const angle = Math.atan2(sin, cos) * 180 / Math.PI
          return ((180 - angle + 540) % 360) - 180
        })
        if (Math.abs(delta) < 6) break
        const distance = Math.max(-240, Math.min(240, delta / .14))
        const startX = distance > 0 ? 320 : 70, endX = startX - distance
        await page.mouse.move(startX, 705)
        await page.mouse.down()
        await page.mouse.move(endX, 705, { steps: 12 })
        await page.waitForTimeout(160)
        await page.mouse.move(endX + .1, 705)
        await page.mouse.up()
        await page.waitForTimeout(900)
      }
      await expect.poll(() => card.evaluate(element => Number(getComputedStyle(element).zIndex))).toBeGreaterThan(980)
      await openAtPoint(page, id, page.getByRole("button", { name: `Abrir modulo ${name}`, exact: true }), true)
    }
    const marketplace = page.getByRole("button", { name: "Abrir modulo Marketplace", exact: true })
    await openAtPoint(page, "marketplace", marketplace, true)
  } finally { await context.close() }
})
