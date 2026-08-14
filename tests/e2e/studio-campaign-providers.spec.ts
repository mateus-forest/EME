import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

test.describe("Studio IA — providers de Criar campanha", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("envia o provider escolhido sem alterar o renderer da campanha", async ({ page }) => {
    let requestedProvider: string | null = null
    let requestedIdentity = false

    await page.route("**/api/properties/me", async (route) => {
      if (route.request().method() !== "GET") return route.continue()
      const response = await route.fetch()
      const payload = await response.json() as { properties?: Array<{ images?: string[] }> }
      if (payload.properties?.[0]) {
        payload.properties[0].images = ["https://images.example.com/property.jpg"]
      }
      await route.fulfill({ response, json: payload })
    })

    await page.route("**/api/studio-ia/instagram", async (route) => {
      const request = route.request()
      if (request.method() !== "POST") {
        await route.continue()
        return
      }

      const payload = request.postDataJSON() as { provider?: string; identity?: unknown }
      requestedProvider = payload.provider ?? null
      requestedIdentity = Object.hasOwn(payload, "identity")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Resposta controlada do teste." }),
      })
    })

    await page.goto("/corretor/studio-ia/criar-campanha-instagram")
    await expect(page.getByRole("heading", { name: "Criar campanha", exact: true })).toBeVisible()
    await expect(page.getByText("Geração simulada", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Sem alterar banco", { exact: true })).toHaveCount(0)
    await page.getByRole("button", { name: "Reiniciar fluxo", exact: true }).click()
    await page.getByRole("button", { name: "Avançar para configuração", exact: true }).click()
    await expect(page.getByText("Escolha a identidade visual", { exact: true })).toHaveCount(0)

    const openai = page.getByTestId("campaign-provider-openai")
    const grok = page.getByTestId("campaign-provider-xai")
    await expect(openai).toHaveAttribute("aria-pressed", "true")
    await expect(grok).toHaveAttribute("aria-pressed", "false")

    await grok.click()
    await expect(grok).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: "Gerar campanha", exact: true }).click()

    await expect.poll(() => requestedProvider).toBe("xai")
    expect(requestedIdentity).toBeFalsy()
    await expect(page.getByText("Resposta controlada do teste.", { exact: true })).toBeVisible()
    await expect(page.locator("[data-testid='campaign-provider-options']")).toBeVisible()
  })

  test("real Grok preserva schema, renderer e Biblioteca", async ({ page }) => {
    test.skip(process.env.RUN_XAI_REAL_TEST !== "1", "Executado manualmente para controlar custo externo e Créditos EME.")
    test.setTimeout(120_000)

    await page.goto("/corretor/studio-ia/criar-campanha-instagram")
    await page.getByRole("button", { name: "Reiniciar fluxo", exact: true }).click()
    await page.getByRole("button", { name: "Avançar para configuração", exact: true }).click()
    await page.getByTestId("campaign-provider-xai").click()
    await page.getByRole("button", { name: "Gerar campanha", exact: true }).click()

    await expect(page.getByText("Feed", { exact: true }).first()).toBeVisible({ timeout: 100_000 })
    await expect(page.getByText("Story", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Carrossel", { exact: true }).first()).toBeVisible()
    const response = await page.request.get("/api/studio-ia/campaigns?kind=INSTAGRAM&limit=1")
    expect(response.ok()).toBeTruthy()
    const body = await response.json() as { campaigns: Array<{ provider: string; assets: Array<{ assetKey: string }> }> }
    expect(body.campaigns[0]?.provider).toBe("xai")
    expect(body.campaigns[0]?.assets.map((asset) => asset.assetKey)).toEqual(expect.arrayContaining(["post_feed", "story", "carousel"]))
  })
})
