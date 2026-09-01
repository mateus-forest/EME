import { expect, test } from "@playwright/test"

test.describe("Landing — módulo Financeiro", () => {
  test("abre o modal aprovado sem CTA de demonstração no desktop e mobile", async ({ page }) => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
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

      if (viewport.width >= 768) {
        await expect(dialog.locator("[data-finance-demo-mask]")).toBeVisible()
      } else {
        await expect(dialog.getByText("Sua operação financeira, organizada em um só lugar.")).toBeVisible()
        await expect(dialog.getByText("Controle recebimentos, despesas e comissões")).toBeVisible()
      }

      await dialog.getByRole("button", { name: "Fechar" }).click()
      await expect(dialog).toHaveCount(0)
    }
  })
})
