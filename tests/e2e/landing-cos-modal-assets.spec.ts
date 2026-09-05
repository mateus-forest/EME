import { expect, test } from "@playwright/test"

test.describe("Landing — assets do modal do COS", () => {
  test("usa a arte aprovada integral no desktop e fecha pelo hotspot transparente", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir modulo COS" }).click({ force: true })

    const dialog = page.locator('[data-module-dialog="cos"]')
    const artwork = dialog.locator('img[src="/modals/cos-desktop-approved.png"]')
    const close = dialog.locator("[data-landing-modal-close]")

    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute("data-landing-modal-image-only", "desktop")
    await expect(artwork).toBeVisible()
    await expect(artwork).toHaveJSProperty("naturalWidth", 1672)
    await expect(artwork).toHaveJSProperty("naturalHeight", 941)
    await expect(dialog.locator("[data-cos-layered-artwork]")).toHaveCount(0)
    await expect(dialog.locator('img[src="/modals/cos-screen-desktop.png"]')).toHaveCount(0)
    await expect(dialog.locator('img[src="/modals/cos-screen-mobile.jpeg"]')).toHaveCount(0)

    await expect(close).toHaveCount(1)
    await expect(close.locator("svg")).toHaveCount(0)
    await expect(close).toHaveCSS("width", "44px")
    await expect(close).toHaveCSS("height", "44px")
    await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(close).toHaveCSS("box-shadow", "none")

    const imageBox = await artwork.boundingBox()
    const closeBox = await close.boundingBox()
    expect(imageBox).not.toBeNull()
    expect(closeBox).not.toBeNull()
    expect(imageBox!.width / imageBox!.height).toBeCloseTo(1672 / 941, 3)
    expect((closeBox!.x + closeBox!.width / 2 - imageBox!.x) / imageBox!.width).toBeCloseTo(1548 / 1672, 2)
    expect((closeBox!.y + closeBox!.height / 2 - imageBox!.y) / imageBox!.height).toBeCloseTo(104 / 941, 2)

    await close.click()
    await expect(dialog).toHaveCount(0)
  })

  test("usa a arte mobile aprovada integral e sem composição duplicada", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir modulo COS" }).click({ force: true })

    const dialog = page.locator('[data-module-dialog="cos"]')
    const artwork = dialog.locator('img[src="/modals/cos-mobile-approved.png"]')
    const close = dialog.locator("[data-landing-modal-close]")

    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute("data-landing-modal-image-only", "mobile")
    await expect(artwork).toBeVisible()
    await expect(artwork).toHaveJSProperty("naturalWidth", 941)
    await expect(artwork).toHaveJSProperty("naturalHeight", 1672)
    await expect(dialog.locator('img[src="/modals/cos-desktop-approved.png"]')).toHaveCount(0)
    await expect(dialog.locator("[data-cos-layered-artwork]")).toHaveCount(0)
    await expect(dialog.locator("[data-mobile-module-layout]")).toHaveCount(0)
    await expect(dialog.locator("[data-mobile-module-title]")).toHaveCount(0)
    await expect(dialog.locator("[data-mobile-module-description]")).toHaveCount(0)
    await expect(dialog.locator("[data-mobile-module-benefits]")).toHaveCount(0)

    await expect(close).toHaveCount(1)
    await expect(close.locator("svg")).toHaveCount(0)
    await expect(close).toHaveCSS("width", "44px")
    await expect(close).toHaveCSS("height", "44px")
    await expect(close).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(close).toHaveCSS("box-shadow", "none")
    await expect.poll(async () => (await dialog.boundingBox())?.width).toBeCloseTo(366, 0)

    const dialogBox = await dialog.boundingBox()
    const imageBox = await artwork.boundingBox()
    const closeBox = await close.boundingBox()
    expect(dialogBox).not.toBeNull()
    expect(imageBox).not.toBeNull()
    expect(closeBox).not.toBeNull()
    expect(dialogBox!.width).toBeCloseTo(366, 0)
    expect(dialogBox!.x).toBeCloseTo(12, 0)
    expect(dialogBox!.height).toBeLessThanOrEqual(820)
    expect(imageBox!.width / imageBox!.height).toBeCloseTo(941 / 1672, 3)
    expect((closeBox!.x + closeBox!.width / 2 - imageBox!.x) / imageBox!.width).toBeCloseTo(848 / 941, 2)
    expect((closeBox!.y + closeBox!.height / 2 - imageBox!.y) / imageBox!.height).toBeCloseTo(99 / 1672, 2)

    await close.click()
    await expect(dialog).toHaveCount(0)
  })

  test("mantém a imagem acessível por scroll interno em viewport baixo", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 })
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir modulo COS" }).click({ force: true })

    const dialog = page.locator('[data-module-dialog="cos"]')
    const content = dialog.locator(".eme-landing-modal-content")
    const artwork = dialog.locator('img[src="/modals/cos-mobile-approved.png"]')

    await expect(dialog).toBeVisible()
    await expect(content).toHaveCSS("overflow-y", "auto")
    expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)

    await content.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    const imageBox = await artwork.boundingBox()
    const dialogBox = await dialog.boundingBox()
    expect(imageBox).not.toBeNull()
    expect(dialogBox).not.toBeNull()
    expect(imageBox!.y + imageBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height + 1)
  })
})
