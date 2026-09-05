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
    await expect(dialog).toHaveAttribute("data-landing-modal-image-only", "true")
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

  test("mantém a composição mobile existente", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir modulo COS" }).click({ force: true })

    const dialog = page.locator('[data-module-dialog="cos"]')
    const desktopScreen = dialog.locator('img[src="/modals/cos-screen-desktop.png"]')
    const mobileScreen = dialog.locator('img[src="/modals/cos-screen-mobile.jpeg"]')
    const officialLogo = dialog.locator('img[src="/modals/cos-logo-header.png"]')

    await expect(dialog).toBeVisible()
    await expect(dialog).not.toHaveAttribute("data-landing-modal-image-only", "true")
    await expect(dialog.locator('img[src="/modals/cos-desktop-approved.png"]')).toHaveCount(0)
    await expect(desktopScreen).toBeVisible()
    await expect(mobileScreen).toBeVisible()
    await expect(officialLogo).toBeVisible()
    await expect(desktopScreen).toHaveJSProperty("naturalWidth", 1910)
    await expect(mobileScreen).toHaveJSProperty("naturalWidth", 738)
    await expect(officialLogo).toHaveJSProperty("naturalWidth", 3919)

    const label = dialog.locator("[data-mobile-module-label]")
    await expect(label.locator("svg")).toHaveCount(0)
    await expect(label).not.toContainText("COS")
    await expect(dialog.locator("[data-mobile-module-title]")).toBeVisible()
    await expect(dialog.locator("[data-mobile-module-description]")).toBeVisible()
    await expect(dialog.locator("[data-mobile-module-benefits]")).toBeVisible()
    await expect(dialog.locator("[data-landing-modal-close] svg")).toHaveCount(1)
  })
})
