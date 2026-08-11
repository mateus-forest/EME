import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

test.describe("Studio IA — Visualizar projeto", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("abre pela Home sem oferecer operações incompatíveis", async ({ page }) => {
    await page.goto("/corretor/studio-ia")
    const visualizeProject = page.getByRole("link", { name: /Visualizar projeto/ })
    await expect(visualizeProject).toContainText("Área reservada para representações arquitetônicas em validação.")
    await visualizeProject.click()

    await expect(page).toHaveURL(/\/corretor\/studio-ia\/visualizar-projeto$/)
    await expect(page.getByRole("heading", { name: "Visualizar projeto", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Capacidades em validação", exact: true })).toBeVisible()
    await expect(page.getByText("Nenhuma operação de visualização arquitetônica está disponível neste momento.")).toBeVisible()
    await expect(page.getByText("Sem geração disponível", { exact: true })).toBeVisible()

    await expect(page.getByText("Obra → finalizado", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Terreno → construção", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Projeto → ambiente", { exact: true })).toHaveCount(0)
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
    await expect(page.getByRole("button", { name: /gerar/i })).toHaveCount(0)
  })

  test("mantém a página sem overflow no viewport PWA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/corretor/studio-ia/visualizar-projeto")
    await expect(page.getByRole("heading", { name: "Visualizar projeto", exact: true })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBeFalsy()
  })
})
