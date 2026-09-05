import { expect, test } from "@playwright/test"

test.describe("Landing — módulo Financeiro", () => {
  test("usa as artes aprovadas recortadas no desktop e mobile", async ({ page }) => {
    for (const scenario of [
      {
        viewport: { width: 1440, height: 900 },
        variant: "desktop",
        src: "/modals/finance-desktop-approved.png",
        width: 1538,
        height: 851,
        closeX: 1492,
        closeY: 47.5,
      },
      {
        viewport: { width: 390, height: 844 },
        variant: "mobile",
        src: "/modals/finance-mobile-approved.png",
        width: 828,
        height: 1580,
        closeX: 765.5,
        closeY: 62,
      },
      {
        viewport: { width: 430, height: 932 },
        variant: "mobile",
        src: "/modals/finance-mobile-approved.png",
        width: 828,
        height: 1580,
        closeX: 765.5,
        closeY: 62,
      },
    ] as const) {
      await page.setViewportSize(scenario.viewport)
      await page.goto("/")
      await page.getByRole("button", { name: "Abrir modulo Financeiro" }).evaluate((button) => {
        (button as HTMLButtonElement).click()
      })

      const dialog = page.locator('[data-module-dialog="financeiro"]')
      const artwork = dialog.locator(`img[src="${scenario.src}"]`)
      const close = dialog.locator("[data-landing-modal-close]")

      await expect(dialog).toBeVisible()
      await expect(dialog).toHaveAttribute("data-landing-modal-image-only", scenario.variant)
      await expect(artwork).toBeVisible()
      await expect(artwork).toHaveJSProperty("naturalWidth", scenario.width)
      await expect(artwork).toHaveJSProperty("naturalHeight", scenario.height)
      await expect(dialog.locator("[data-finance-modal-layout]")).toHaveCount(0)
      await expect(dialog.locator("[data-mobile-module-layout]")).toHaveCount(0)
      await expect(dialog.getByRole("link", { name: /demonstração/i })).toHaveCount(0)

      await expect(close).toHaveCount(1)
      await expect(close.locator("svg")).toHaveCount(0)
      await expect(close).toHaveCSS("width", "44px")
      await expect(close).toHaveCSS("height", "44px")
      await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")

      const dialogBox = await dialog.boundingBox()
      const imageBox = await artwork.boundingBox()
      const closeBox = await close.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(imageBox).not.toBeNull()
      expect(closeBox).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(scenario.viewport.width)
      expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(scenario.viewport.height)
      expect(imageBox!.width / imageBox!.height).toBeCloseTo(scenario.width / scenario.height, 3)
      expect((closeBox!.x + closeBox!.width / 2 - imageBox!.x) / imageBox!.width).toBeCloseTo(scenario.closeX / scenario.width, 2)
      expect((closeBox!.y + closeBox!.height / 2 - imageBox!.y) / imageBox!.height).toBeCloseTo(scenario.closeY / scenario.height, 2)

      await close.click()
      await expect(dialog).toHaveCount(0)
    }
  })

  test("mantém a arte mobile completa acessível por scroll interno em viewport baixo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 })
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir modulo Financeiro" }).evaluate((button) => {
      (button as HTMLButtonElement).click()
    })

    const dialog = page.locator('[data-module-dialog="financeiro"]')
    const content = dialog.locator(".eme-landing-modal-content")
    const artwork = dialog.locator('img[src="/modals/finance-mobile-approved.png"]')

    await expect(dialog).toBeVisible()
    await expect(content).toHaveCSS("overflow-y", "auto")
    expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)

    await content.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    const imageBox = await artwork.boundingBox()
    const dialogBox = await dialog.boundingBox()
    expect(imageBox).not.toBeNull()
    expect(dialogBox).not.toBeNull()
    expect(imageBox!.y + imageBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 2)
  })
})
