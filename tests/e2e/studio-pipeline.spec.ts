import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const now = new Date().toISOString()
const approvedMaterial = {
  id: "prepared-campaign", workspaceType: "BROKER", brokerId: "broker", agencyId: null, propertyId: null,
  kind: "PROPERTY_PREPARATION", status: "PENDING_REVIEW", goal: "Mobiliar", title: "Sala preparada", visualIdentity: null,
  version: 1, provider: "pedra", model: "furnish", prompt: null, promptRevised: null, sourceRoute: "/api/studio-ia/prepare-property",
  metadata: { sourceImageUrl: "https://images.example.com/original.jpg" }, property: null, primaryAsset: null,
  createdByUserId: "user", createdAt: now, updatedAt: now,
  assets: [{ id: "prepared-asset", assetKey: "prepared_furnish", label: "Sala mobiliada", type: "IMAGE", prompt: null, promptRevised: null, provider: "pedra", model: "furnish", fileUrl: "https://images.example.com/result.jpg", thumbnailUrl: "https://images.example.com/result.jpg", status: "APPROVED", approvedAt: now, content: { sourceImageUrl: "https://images.example.com/original.jpg" }, metadata: {}, createdAt: now, updatedAt: now }],
}

const adCampaign = {
  ...approvedMaterial, id: "ad-campaign", kind: "BUYERS", status: "PENDING_REVIEW", title: "Anúncio",
  provider: "openai", model: "gpt-5-mini", assets: [
    { ...approvedMaterial.assets[0], id: "ad-title", assetKey: "title", label: "Título", type: "COPY", fileUrl: null, thumbnailUrl: null, status: "PENDING_REVIEW", content: "Seu próximo imóvel" },
  ],
}

test.describe("Studio IA — continuidade Biblioteca → anúncio", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
    await page.route("**/api/studio-ia/campaigns?limit=100", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ campaigns: [approvedMaterial] }) }))
  })

  test("pré-seleciona o asset, não mostra métricas simuladas e gera conteúdo utilizável", async ({ page }) => {
    let payload: unknown = null
    await page.route("**/api/studio-ia/buyers", async (route) => {
      payload = route.request().postDataJSON()
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ title: "Seu próximo imóvel", primaryText: "Conheça este ambiente preparado.", cta: "Agende uma visita", audience: "Famílias que buscam conforto", approach: "Valorize a experiência do espaço.", campaign: adCampaign }) })
    })
    await page.goto("/corretor/studio-ia/atrair-compradores?sourceAssetId=prepared-asset")
    await expect(page.getByTestId("ad-library-material")).toContainText("Sala preparada")
    await expect(page.getByText(/estimativa de alcance/i)).toHaveCount(0)
    await expect(page.getByText(/estimativa de leads/i)).toHaveCount(0)
    await page.getByRole("button", { name: "Gerar anúncio", exact: true }).click()
    await expect.poll(() => payload).toMatchObject({ sourceAssetId: "prepared-asset", channel: "Instagram / Meta", objective: "Vender" })
    await expect(page.getByText("Seu próximo imóvel", { exact: true })).toBeVisible()
    await expect(page.getByText("Agende uma visita", { exact: true })).toBeVisible()
  })

  test("mantém anúncio sem overflow no PWA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/corretor/studio-ia/atrair-compradores?sourceAssetId=prepared-asset")
    await expect(page.getByRole("heading", { name: "Criar anúncio", exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy()
  })

  test("Biblioteca apresenta histórico operacional sem expor rota ou modelo interno", async ({ page }) => {
    await page.route("**/api/studio-ia/campaigns/prepared-campaign", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ campaign: approvedMaterial }),
    }))
    await page.goto("/corretor/studio-ia/biblioteca/prepared-campaign")
    await expect(page.getByRole("heading", { name: "Sala preparada", exact: true }).first()).toBeVisible()
    await expect(page.getByText("IA", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Pedra", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("/api/studio-ia/prepare-property", { exact: true })).toHaveCount(0)
    await expect(page.getByText("furnish", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Assets da campanha", { exact: true })).toHaveCount(0)
  })

  test("Captar imóveis rejeita entrada inválida com mensagem humana", async ({ page }) => {
    const response = await page.request.post("/api/studio-ia/owners", {
      data: {
        goal: "Captar imovel para venda",
        city: "S".repeat(81),
        neighborhood: "Centro",
        operationRadius: "10 km",
        ownerProfile: "Proprietario particular",
        version: 1,
      },
    })
    expect(response.status()).toBe(400)
    const body = await response.json() as { error: string; issues?: unknown }
    expect(body.error).toBe("Revise as informações necessárias para criar a estratégia.")
    expect(body).not.toHaveProperty("issues")
  })
})
