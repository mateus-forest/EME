import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")

function projectCampaign(status = "PENDING_REVIEW") {
  const now = new Date().toISOString()
  return { id: "project-campaign", workspaceType: "BROKER", brokerId: "broker", agencyId: null, propertyId: null, kind: "CONSTRUCTION", status: "PENDING_REVIEW", goal: "Construção no terreno", title: "Visualização", visualIdentity: null, version: 1, provider: "openai", model: "gpt-image-2", prompt: "Crie uma farmácia", promptRevised: null, sourceRoute: "/api/studio-ia/visualize-project", metadata: { category: "project_visualization", illustrative: true, sourceImageUrl: "https://images.example.com/original.jpg" }, property: null, primaryAsset: null, createdByUserId: "user", createdAt: now, updatedAt: now, assets: [{ id: "project-asset", assetKey: "project_option_1", label: "Opção 1", type: "IMAGE", prompt: "Crie uma farmácia", promptRevised: null, provider: "openai", model: "gpt-image-2", fileUrl: "https://images.example.com/project.jpg", thumbnailUrl: "https://images.example.com/project.jpg", status, approvedAt: status === "APPROVED" ? now : null, content: { sourceImageUrl: "https://images.example.com/original.jpg", illustrative: true }, metadata: { illustrative: true }, createdAt: now, updatedAt: now }] }
}

test.describe("Studio IA — Visualizar projeto", () => {
  test.beforeEach(async ({ page }) => loginAsBroker(page))

  test("gera via provider escolhido, aprova e oferece continuidade contextual", async ({ page }) => {
    let requestedProvider = ""
    await page.route("**/api/studio-ia/visualize-project", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      requestedProvider = (await route.request().postDataBuffer())?.toString("utf8").includes("xai") ? "xai" : "openai"
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ campaign: projectCampaign() }) })
    })
    await page.route("**/api/studio-ia/campaigns/assets/project-asset", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ campaign: projectCampaign("APPROVED") }) }))
    await page.goto("/corretor/studio-ia/visualizar-projeto")
    await page.locator('input[type="file"]').setInputFiles({ name: "terreno.png", mimeType: "image/png", buffer: tinyPng })
    await page.getByPlaceholder(/crie uma farmácia/i).fill("Crie uma farmácia contemporânea neste terreno.")
    await page.getByTestId("project-provider-xai").click()
    await page.getByRole("button", { name: "Gerar visualização", exact: true }).click()
    await expect.poll(() => requestedProvider).toBe("xai")
    await expect(page.getByText("Representação ilustrativa gerada por IA", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Aprovar", exact: true }).click()
    await expect(page.getByRole("link", { name: "Criar vídeo", exact: true })).toHaveAttribute("href", /sourceAssetId=project-asset/)
    await expect(page.getByRole("link", { name: "Criar anúncio", exact: true })).toHaveAttribute("href", /sourceAssetId=project-asset/)
  })

  test("mantém a página sem overflow no viewport PWA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/corretor/studio-ia/visualizar-projeto")
    await expect(page.getByRole("heading", { name: "Visualizar projeto", exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy()
  })

  test("real OpenAI persiste uma representação ilustrativa", async ({ page }) => {
    test.skip(process.env.RUN_OPENAI_PROJECT_REAL_TEST !== "1", "Executado manualmente para controlar custo externo.")
    test.setTimeout(120_000)

    const campaigns = await page.request.get("/api/studio-ia/campaigns?kind=PROPERTY_PREPARATION&limit=20")
    expect(campaigns.ok()).toBeTruthy()
    const body = await campaigns.json() as { campaigns: Array<{ metadata: Record<string, unknown> }> }
    const sourceUrl = body.campaigns.map((item) => item.metadata.sourceImageUrl).find((value): value is string => typeof value === "string" && value.startsWith("https://"))
    expect(sourceUrl, "É necessária uma imagem pública já existente no Studio.").toBeTruthy()
    const imageResponse = await page.request.get(sourceUrl!)
    expect(imageResponse.ok()).toBeTruthy()

    await page.goto("/corretor/studio-ia/visualizar-projeto")
    await page.locator('input[type="file"]').setInputFiles({ name: "projeto-real.jpg", mimeType: imageResponse.headers()["content-type"] || "image/jpeg", buffer: await imageResponse.body() })
    await page.getByRole("button", { name: /Projeto mais realista/ }).click()
    await page.getByPlaceholder(/crie uma farmácia/i).fill("Crie uma representação mais realista deste projeto, preservando perspectiva e entorno.")
    await page.getByRole("button", { name: "Gerar visualização", exact: true }).click()
    await expect(page.getByText("Representação ilustrativa gerada por IA", { exact: true })).toBeVisible({ timeout: 110_000 })
    await expect(page.getByText("Original", { exact: true })).toBeVisible()
    await expect(page.getByText("Opção 1", { exact: true })).toBeVisible()
  })
})
