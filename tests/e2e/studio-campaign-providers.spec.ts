import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

test.describe("Studio IA — providers de Criar campanha", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("envia o provider escolhido sem alterar o renderer da campanha", async ({ page }) => {
    let requestedProvider: string | null = null

    await page.route("**/api/studio-ia/instagram", async (route) => {
      const request = route.request()
      if (request.method() !== "POST") {
        await route.continue()
        return
      }

      requestedProvider = (request.postDataJSON() as { provider?: string }).provider ?? null
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Resposta controlada do teste." }),
      })
    })

    await page.goto("/corretor/studio-ia/criar-campanha-instagram")
    await expect(page.getByRole("heading", { name: "Criar campanha", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Reiniciar fluxo", exact: true }).click()
    await page.getByRole("button", { name: "Avançar para configuração", exact: true }).click()

    const openai = page.getByTestId("campaign-provider-openai")
    const grok = page.getByTestId("campaign-provider-xai")
    await expect(openai).toHaveAttribute("aria-pressed", "true")
    await expect(grok).toHaveAttribute("aria-pressed", "false")

    await grok.click()
    await expect(grok).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: "Gerar campanha", exact: true }).click()

    await expect.poll(() => requestedProvider).toBe("xai")
    await expect(page.getByText("Resposta controlada do teste.", { exact: true })).toBeVisible()
    await expect(page.locator("[data-testid='campaign-provider-options']")).toBeVisible()
  })
})
