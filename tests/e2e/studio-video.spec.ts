import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const approvedPair = {
  id: "campaign-prepared", workspaceType: "BROKER", brokerId: "broker", agencyId: null, propertyId: null,
  kind: "PROPERTY_PREPARATION", status: "PENDING_REVIEW", goal: "Mobiliar", title: "Sala preparada",
  visualIdentity: null, version: 1, provider: "pedra", model: "furnish", prompt: null, promptRevised: null,
  sourceRoute: "/api/studio-ia/prepare-property", metadata: { sourceImageUrl: "https://images.example.com/original.jpg" },
  property: null, primaryAsset: null, createdByUserId: "user", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  assets: [{ id: "asset-prepared", assetKey: "prepared_furnish", label: "Sala mobiliada", type: "IMAGE", prompt: null, promptRevised: null, provider: "pedra", model: "furnish", fileUrl: "https://images.example.com/result.jpg", thumbnailUrl: "https://images.example.com/result.jpg", status: "APPROVED", approvedAt: new Date().toISOString(), content: { sourceImageUrl: "https://images.example.com/original.jpg" }, metadata: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
}

test.describe("Studio IA — Criar vídeo", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
    await page.route("**/api/studio-ia/campaigns?limit=100", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ campaigns: [approvedPair] }) }))
  })

  test("usa projeto aprovado, envia frame original e final e expõe somente providers compatíveis", async ({ page }) => {
    let payload: Record<string, unknown> | null = null
    await page.route("**/api/studio-ia/video", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      const body = await route.request().postDataBuffer()
      const text = body?.toString("utf8") ?? ""
      const match = text.match(/\r\n\r\n(\{[\s\S]*?\})\r\n--/)
      payload = match ? JSON.parse(match[1]) : null
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ requestId: "video-job", provider: "lumaai", estimatedCredits: 22, stageEstimatedCredits: 22, totalCreditsConsumed: 22, generationStatus: "processing", requestKind: "direct_video", jobStage: "video_processing", activeStage: "video", requiresPreviewApproval: false, previewApproved: false, canCreateVideo: false, canRegeneratePreview: false, storyboard: ["Cena 1", "Cena 2", "Cena 3"], script: "Roteiro", shotPlan: ["Plano 1", "Plano 2", "Plano 3"], duration: "9s", promptPreview: "Prompt", fileSaved: false, progress: 10 }) })
    })
    await page.route("**/api/studio-ia/video?requestId=video-job", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requestId: "video-job", provider: "lumaai", estimatedCredits: 22, stageEstimatedCredits: 22, totalCreditsConsumed: 22, generationStatus: "completed", requestKind: "direct_video", jobStage: "completed", activeStage: "video", requiresPreviewApproval: false, previewApproved: false, canCreateVideo: false, canRegeneratePreview: false, storyboard: ["Cena 1", "Cena 2", "Cena 3"], script: "Roteiro", shotPlan: ["Plano 1", "Plano 2", "Plano 3"], duration: "9s", promptPreview: "Prompt", videoUrl: "https://videos.example.com/final.mp4", fileSaved: true, progress: 100 }) }))

    await page.goto("/corretor/studio-ia/criar-video-do-imovel?sourceAssetId=asset-prepared")
    await expect(page.getByRole("heading", { name: "Criar vídeo", exact: true })).toBeVisible()
    await expect(page.getByText("Original", { exact: true })).toBeVisible()
    await expect(page.getByText("Resultado", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /Luma/ })).toBeEnabled()
    await expect(page.getByRole("button", { name: /Pedra/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Grok/ })).toHaveCount(0)
    await expect(page.getByText(/executor durável/i)).toHaveCount(0)
    await expect(page.getByText(/contrato atual não garante/i)).toHaveCount(0)
    await expect(page.getByText("Música", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Narração", { exact: true })).toHaveCount(0)

    await page.getByRole("button", { name: "Criar vídeo", exact: true }).click()
    await expect.poll(() => payload).not.toBeNull()
    expect(payload).toMatchObject({ provider: "lumaai", sourceAssetId: "asset-prepared", referenceImageUrls: ["https://images.example.com/result.jpg"], duration: "9s", transformation: "Nenhuma" })
  })

  test("não cria overflow horizontal no viewport PWA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/corretor/studio-ia/criar-video-do-imovel?sourceAssetId=asset-prepared")
    await expect(page.getByRole("heading", { name: "Criar vídeo", exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy()
  })
})
