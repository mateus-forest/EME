import { expect, test, type Locator, type Page } from "@playwright/test"

const mobileViewports = [
  { name: "390", width: 390, height: 844 },
  { name: "393", width: 393, height: 852 },
  { name: "430", width: 430, height: 932 },
] as const

async function waitForMobileComposition(page: Page) {
  const stage = page.locator("[data-mobile-orbit-stage]")
  await expect(stage).toBeVisible()
  await expect.poll(() => stage.locator("..").evaluate((element) => getComputedStyle(element).opacity)).toBe("1")
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible()
  return stage
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox()
  expect(bounds).not.toBeNull()
  return bounds!
}

test.describe("Landing — composição mobile refinada", () => {
  for (const viewport of mobileViewports) {
    test(`preserva hierarquia e separação em ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/")
      await waitForMobileComposition(page)

      const activity = page.getByTestId("landing-activity")
      const chips = activity.locator(".eme-landing-glass-chip")
      const teaser = page.locator(".eme-accelerator-teaser.is-compact")
      const teaserButton = teaser.getByRole("button", { name: "Conheça o Acelerador EME" })
      const pagination = page.locator("[data-mobile-orbit-pagination]")
      const cards = page.locator('[data-module-card="mobile"]')

      await expect(activity).toBeVisible()
      await expect(chips).toHaveCount(2)
      await expect(teaserButton).toBeVisible()
      await expect(pagination).toBeVisible()
      await expect(cards).toHaveCount(10)

      const chipHeights = await chips.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().height),
      )
      expect(chipHeights.every((height) => height <= 24)).toBe(true)

      const cardScales = await cards.evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).scale),
      )
      expect(cardScales.every((scale) => scale === "0.9")).toBe(true)

      const teaserBox = await box(teaserButton)
      const paginationBox = await box(pagination)
      expect(teaserBox.width).toBeCloseTo(156, 0)
      expect(teaserBox.height).toBeCloseTo(44, 0)
      expect(paginationBox.y - (teaserBox.y + teaserBox.height)).toBeGreaterThanOrEqual(20)

      const headerButtons = page.locator("header button")
      const headerBottom = Math.max(...await headerButtons.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().bottom),
      ))
      const activityBox = await box(activity)
      expect(activityBox.y - headerBottom).toBeGreaterThanOrEqual(4)

      const overlapsTeaser = await cards.evaluateAll((elements, teaserBounds) =>
        elements.some((element) => {
          const cardBounds = element.getBoundingClientRect()
          return !(
            cardBounds.right <= teaserBounds.x ||
            cardBounds.left >= teaserBounds.x + teaserBounds.width ||
            cardBounds.bottom <= teaserBounds.y ||
            cardBounds.top >= teaserBounds.y + teaserBounds.height
          )
        }),
        teaserBox,
      )
      expect(overlapsTeaser).toBe(false)

      await teaserButton.click()
      await expect(page.locator('section[aria-label="Acelerador EME"]')).toBeVisible()
    })
  }

  test("mantém a escala dos cards no desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")

    const desktopCard = page.locator('[data-module-card="desktop"]').first()
    await expect(desktopCard).toBeVisible()
    await expect(desktopCard).toHaveCSS("width", "184px")
    await expect(desktopCard).toHaveCSS("height", "252px")
    await expect(desktopCard).toHaveCSS("transform", "none")
  })
})
