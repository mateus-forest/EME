import { expect, test } from "@playwright/test"

test.describe("Landing — módulo Financeiro", () => {
  test("abre o modal aprovado sem CTA de demonstração no desktop e mobile", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 393, height: 852 },
      { width: 430, height: 932 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto("/")

      const trigger = page.getByRole("button", { name: "Abrir modulo Financeiro" })
      await expect(trigger).toBeAttached()
      await trigger.click({ force: true })

      const dialog = page.locator('[data-module-dialog="financeiro"]')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole("link", { name: /demonstração/i })).toHaveCount(0)
      await expect(page.getByText("Abrir demonstração", { exact: true })).toHaveCount(0)

      const dialogBox = await dialog.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width)
      expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height)

      const compact = viewport.width < 1024
      const layout = dialog.locator(compact ? "[data-mobile-module-layout]" : "[data-finance-modal-layout]")
      await expect(layout).toBeVisible()
      await expect(dialog.locator("[data-finance-demo-mask]")).toHaveCount(0)
      await expect(dialog.getByText("Sua operação financeira, organizada em um só lugar.")).toBeVisible()
      await expect(dialog.getByText("Controle recebimentos, despesas e comissões")).toBeVisible()
      await expect(dialog.getByRole("img", { name: "Prévia visual do módulo Financeiro" })).toBeVisible()

      if (compact) {
        await expect(dialog.getByText("Financeiro EME", { exact: true })).toBeVisible()
        const flowIsOrdered = await layout.evaluate((element) => {
          const selectors = [
            "[data-mobile-module-label]",
            "[data-mobile-module-title]",
            "[data-mobile-module-description]",
            "[data-mobile-module-mockup]",
            "[data-mobile-module-benefits]",
            "[data-mobile-module-complement]",
          ]
          const boxes = selectors.map((selector) => element.querySelector(selector)?.getBoundingClientRect())
          return boxes.every((box) => box != null)
            && boxes.every((box, index) => index === 0 || box!.top >= boxes[index - 1]!.bottom - 1)
        })
        expect(flowIsOrdered).toBe(true)
      } else {
        const gridColumnCount = await layout.evaluate((element) => {
          const columns = getComputedStyle(element).gridTemplateColumns
          return columns.split(" ").filter(Boolean).length
        })
        expect(gridColumnCount).toBe(2)
      }

      const closeButton = dialog.getByRole("button", { name: "Fechar", exact: true })
      await expect(closeButton.locator("[data-eme-modal-close-icon]")).toBeVisible()
      await expect(dialog.locator("[data-eme-modal-close-icon]")).toHaveCount(1)
      await closeButton.click()
      await expect(dialog).toHaveCount(0)
    }
  })
})
