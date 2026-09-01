import { expect, test, type Page } from "@playwright/test"

const modules = [
  { id: "marketplace", name: "Marketplace" },
  { id: "cos", name: "COS" },
  { id: "clientes", name: "Clientes" },
  { id: "imoveis", name: "Imóveis" },
  { id: "catalogo", name: "Catálogo" },
  { id: "studio-ia", name: "Studio IA" },
  { id: "propostas", name: "Propostas" },
  { id: "contratos", name: "Contratos" },
  { id: "agenda", name: "Compromissos" },
  { id: "financeiro", name: "Financeiro" },
] as const

const viewports = [
  { label: "desktop", width: 1440, height: 900, compact: false },
  { label: "tablet", width: 820, height: 1180, compact: true },
  { label: "mobile", width: 390, height: 844, compact: true },
] as const

async function assertModalFitsViewport(page: Page, width: number, height: number) {
  const dialog = page.locator("[data-landing-modal-shell]")
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5)
  expect(box!.y + box!.height).toBeLessThanOrEqual(height + 0.5)

  const hasHorizontalOverflow = await dialog.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)
}

test.describe("Landing — sistema único dos modais de módulos", () => {
  test.describe.configure({ timeout: 120_000 })

  for (const viewport of viewports) {
    test(`padroniza todos os módulos em ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto("/")

      for (const [index, module] of modules.entries()) {
        const trigger = page.getByRole("button", { name: `Abrir modulo ${module.name}` })
        await expect(trigger).toBeAttached()
        await trigger.click({ force: true })

        const dialog = page.locator(`[data-module-dialog="${module.id}"]`)
        await expect(dialog).toBeVisible()
        await expect(page.locator("[data-landing-modal-layer]")).toHaveCount(1)
        await expect(dialog.locator("[data-landing-modal-close]")).toHaveCount(1)
        await expect(dialog.locator("[data-landing-modal-close]")).toBeFocused()
        await expect(page.locator("html")).toHaveCSS("overflow", "hidden")
        await expect(page.locator("body")).toHaveCSS("overflow", "hidden")
        await assertModalFitsViewport(page, viewport.width, viewport.height)

        if (viewport.compact) {
          await expect(dialog.locator("[data-mobile-module-scroll]")).toBeVisible()
          await expect(dialog.locator("[data-desktop-module-artwork]")).toHaveCount(0)
        } else {
          await expect(dialog.locator("[data-desktop-module-artwork]")).toBeVisible()
          await expect(dialog.locator("[data-mobile-module-scroll]")).toHaveCount(0)
        }

        if (index % 3 === 0) {
          await page.keyboard.press("Escape")
        } else if (index % 3 === 1) {
          await dialog.locator("[data-landing-modal-close]").click()
        } else {
          await page.locator(".eme-landing-modal-backdrop").click({ force: true })
        }

        await expect(dialog).toHaveCount(0)
        await expect(trigger).toBeFocused()
      }
    })
  }

  test("mantém abertura e fechamento estáveis em ciclos repetidos", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    const trigger = page.getByRole("button", { name: "Abrir modulo Financeiro" })

    for (let cycle = 0; cycle < 4; cycle += 1) {
      await trigger.click({ force: true })
      const dialog = page.locator('[data-module-dialog="financeiro"]')
      await expect(dialog).toBeVisible()
      await dialog.locator("[data-landing-modal-close]").click()
      await expect(dialog).toHaveCount(0)
    }

    await expect(page.locator("[data-landing-modal-layer]")).toHaveCount(0)
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden")
  })
})
