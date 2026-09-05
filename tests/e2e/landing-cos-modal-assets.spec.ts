import { expect, test } from "@playwright/test"

const viewports = [
  { name: "desktop", width: 1440, height: 900, compact: false },
  { name: "mobile", width: 390, height: 844, compact: true },
] as const

test.describe("Landing — assets do modal do COS", () => {
  for (const viewport of viewports) {
    test(`usa as telas e o logo oficiais em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/")
      await page.getByRole("button", { name: "Abrir modulo COS" }).click({ force: true })

      const dialog = page.locator('[data-module-dialog="cos"]')
      const desktopScreen = dialog.locator('img[src="/modals/cos-screen-desktop.png"]')
      const mobileScreen = dialog.locator('img[src="/modals/cos-screen-mobile.jpeg"]')
      const officialLogo = dialog.locator('img[src="/modals/cos-logo-header.png"]')

      await expect(dialog).toBeVisible()
      await expect(desktopScreen).toBeVisible()
      await expect(mobileScreen).toBeVisible()
      await expect(officialLogo).toBeVisible()

      await expect(desktopScreen).toHaveJSProperty("naturalWidth", 1910)
      await expect(mobileScreen).toHaveJSProperty("naturalWidth", 738)
      await expect(officialLogo).toHaveJSProperty("naturalWidth", 3919)

      if (viewport.compact) {
        const label = dialog.locator("[data-mobile-module-label]")
        await expect(label.locator("svg")).toHaveCount(0)
        await expect(label).not.toContainText("COS")
        await expect(dialog.locator("[data-mobile-module-title]")).toBeVisible()
        await expect(dialog.locator("[data-mobile-module-description]")).toBeVisible()
        await expect(dialog.locator("[data-mobile-module-benefits]")).toBeVisible()
      } else {
        await expect(dialog.locator("[data-desktop-module-artwork]")).toBeVisible()
      }
    })
  }
})
