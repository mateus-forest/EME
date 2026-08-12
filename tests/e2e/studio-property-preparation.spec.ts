import { randomUUID } from "node:crypto"

import { expect, test, type APIResponse } from "@playwright/test"

import { getStudioCapabilityProviders } from "../../lib/studio-provider-catalog"
import { buildPropertyPreparationEditPrompt } from "../../lib/studio-property-preparation"
import { loginAsBroker } from "./helpers/auth"

type PreparationResponse = {
  campaign?: { id: string; assets: Array<{ id: string; fileUrl: string | null }> }
  jobId?: string
}

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nQAAAABJRU5ErkJggg==", "base64")

function preparedCampaign(provider = "openai", status = "PENDING_REVIEW") {
  const now = new Date().toISOString()
  return {
    id: `campaign-${provider}`,
    workspaceType: "BROKER",
    brokerId: "broker-1",
    agencyId: null,
    propertyId: null,
    kind: "PROPERTY_PREPARATION",
    status,
    goal: "Mobiliar ambiente",
    title: "Ambiente mobiliado",
    visualIdentity: "Modern",
    version: 1,
    provider,
    model: provider === "openai" ? "gpt-image-2" : "furnish",
    prompt: "Mobiliar",
    promptRevised: null,
    sourceRoute: "/api/studio-ia/prepare-property",
    metadata: { sourceImageUrl: "https://images.example.com/source.jpg", providerInternal: provider },
    property: null,
    primaryAsset: null,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    assets: [{
      id: `asset-${provider}`,
      assetKey: "prepared_furnish",
      label: "Ambiente mobiliado",
      type: "IMAGE",
      prompt: null,
      promptRevised: null,
      provider,
      model: provider === "openai" ? "gpt-image-2" : "furnish",
      fileUrl: "https://images.example.com/result.jpg",
      thumbnailUrl: "https://images.example.com/result.jpg",
      status: status === "APPROVED" ? "APPROVED" : "PENDING_REVIEW",
      approvedAt: status === "APPROVED" ? now : null,
      content: { sourceImageUrl: "https://images.example.com/source.jpg" },
      metadata: { providerInternal: provider },
      createdAt: now,
      updatedAt: now,
    }],
  }
}

test.describe("Studio IA — Preparar imóvel", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("exibe somente os controles da operação escolhida e se adapta ao mobile", async ({ page }) => {
    await page.goto("/corretor/studio-ia/preparar-imovel")
    await expect(page.getByRole("heading", { name: "Preparar imóvel", exact: true })).toBeVisible()
    await expect(page.getByText("Composição", { exact: true })).toBeVisible()
    await expect(page.getByRole("combobox")).toHaveCount(3)
    await expect(page.getByRole("button", { name: "Mobiliar ambiente", exact: true })).toBeVisible()
    await expect(page.getByTestId("preparation-provider-options").getByRole("button", { name: /OpenAI/ })).toBeVisible()
    await expect(page.getByTestId("preparation-provider-options").getByRole("button", { name: /Pedra/ })).toBeVisible()
    await expect(page.getByTestId("preparation-provider-options").getByRole("button", { name: /Grok/ })).toBeVisible()

    await page.getByTestId("preparation-provider-options").getByRole("button", { name: /OpenAI/ }).click()

    await page.getByRole("button", { name: /Esvaziar/ }).click()
    await expect(page.getByTestId("preparation-provider-options").getByRole("button", { name: /OpenAI/ })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByText("Nenhuma configuração adicional é necessária.")).toBeVisible()
    await expect(page.getByText("Estilo", { exact: true })).toHaveCount(0)

    await page.getByRole("button", { name: /Reformar/ }).click()
    await expect(page.getByText("Preservar janelas", { exact: true })).toBeVisible()
    await expect(page.getByText("Adicionar móveis", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: /Editar/ }).click()
    await expect(page.getByPlaceholder("Ex.: troque o piso por madeira clara e deixe as paredes brancas")).toBeVisible()

    await page.getByRole("button", { name: /Melhorar foto/ }).click()
    await expect(page.getByText("Alta fidelidade", { exact: true })).toBeVisible()
    await expect(page.getByText("Preservar enquadramento", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: /^Céu/ }).click()
    await expect(page.getByRole("combobox")).toHaveCount(2)

    await page.getByRole("button", { name: /Desfocar/ }).click()
    await expect(page.getByText("Rostos", { exact: true })).toBeVisible()
    await expect(page.getByText("Placas de veículos", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /Remover objeto/ })).toBeVisible()
    await expect(page.getByTestId("preparation-provider-options").getByRole("button")).toHaveCount(1)
    await expect(page.getByTestId("preparation-provider-options").getByRole("button", { name: /Pedra/ })).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: /Remover objeto/ }).first().click()
    await expect(page.getByTestId("preparation-provider-options").getByRole("button", { name: /OpenAI/ })).toBeVisible()
    await expect(page.getByTestId("preparation-provider-options").getByRole("button", { name: /Grok/ })).toHaveCount(0)

    await page.setViewportSize({ width: 390, height: 844 })
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(hasHorizontalOverflow).toBeFalsy()
  })

  test("catálogo e prompts implementam operações específicas sem prompt genérico", () => {
    const prompt = buildPropertyPreparationEditPrompt({
      operation: "furnish",
      roomType: "Living room",
      style: "Modern",
      creativity: "Medium",
    })
    expect(prompt).toContain("Preserve the building architecture")
    expect(prompt).toContain("Furnish only the existing Living room")
    expect(prompt).toContain("Modern")
    expect(getStudioCapabilityProviders("property_preparation.furnish").map((entry) => entry.provider)).toEqual(["pedra", "openai", "xai"])
    expect(getStudioCapabilityProviders("property_preparation.blur").map((entry) => entry.provider)).toEqual(["pedra"])
    expect(getStudioCapabilityProviders("property_preparation.remove_object").map((entry) => entry.provider)).toEqual(["pedra", "openai"])
  })

  test("envia Mobiliar para OpenAI, mantém preview/Biblioteca e não aciona fallback", async ({ page }) => {
    let providerRequests = 0
    let requestBody = ""
    const generated = preparedCampaign("openai")
    const approved = preparedCampaign("openai", "APPROVED")
    await page.route("**/api/studio-ia/prepare-property", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      providerRequests += 1
      requestBody = route.request().postData() ?? ""
      await route.fulfill({ status: 201, json: { campaign: generated, reused: false } })
    })
    await page.route("**/api/studio-ia/campaigns/assets/asset-openai", (route) => route.fulfill({ json: { campaign: approved } }))

    await page.goto("/corretor/studio-ia/preparar-imovel")
    await page.getByRole("button", { name: /Enviar imagem/ }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: "sala.png", mimeType: "image/png", buffer: tinyPng })
    await page.getByTestId("preparation-provider-options").getByRole("button", { name: /OpenAI/ }).click()
    await page.getByRole("button", { name: "Mobiliar ambiente", exact: true }).click()

    await expect(page.getByText("Imagem gerada e salva na Biblioteca para sua revisão.")).toBeVisible()
    expect(providerRequests).toBe(1)
    expect(requestBody).toContain('name="provider"')
    expect(requestBody).toContain("openai")
    expect(requestBody).not.toContain("xai")
    await expect(page.getByText("Original", { exact: true })).toBeVisible()
    await expect(page.getByText("Resultado", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Aprovar resultado" }).click()
    await expect(page.getByRole("button", { name: "Aprovado" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Abrir Biblioteca" })).toBeVisible()
  })

  test("erro de saldo Pedra é amigável e não tenta outro provider", async ({ page }) => {
    let requests = 0
    let requestBody = ""
    await page.route("**/api/studio-ia/prepare-property", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      requests += 1
      requestBody = route.request().postData() ?? ""
      await route.fulfill({
        status: 503,
        json: {
          code: "PEDRA_INSUFFICIENT_PROVIDER_CREDITS",
          error: "A IA especializada está temporariamente sem saldo. Escolha outra IA disponível ou tente novamente mais tarde.",
        },
      })
    })

    await page.goto("/corretor/studio-ia/preparar-imovel")
    await page.getByRole("button", { name: /Enviar imagem/ }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: "sala.png", mimeType: "image/png", buffer: tinyPng })
    await page.getByTestId("preparation-provider-options").getByRole("button", { name: /Pedra/ }).click()
    await page.getByRole("button", { name: "Mobiliar ambiente", exact: true }).click()

    await expect(page.getByText(/temporariamente sem saldo/)).toBeVisible()
    expect(requests).toBe(1)
    expect(requestBody).toContain("pedra")
    expect(requestBody).not.toContain("openai")
    expect(requestBody).not.toContain("xai")
  })

  test("rejeita entrada ausente, arquivo inválido e parâmetro obrigatório sem chamar geração", async ({ page }) => {
    const acceptedOpenAICombination = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        sourceType: "upload",
        operation: "furnish",
        roomType: "Living room",
        style: "Modern",
        creativity: "Medium",
        provider: "openai",
        idempotencyKey: randomUUID(),
      },
    })
    expect(acceptedOpenAICombination.status()).toBe(400)
    await expect(acceptedOpenAICombination.json()).resolves.toMatchObject({ code: "UPLOAD_REQUIRED" })

    const unsupportedGrokCombination = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        sourceType: "upload",
        operation: "remove_object",
        provider: "xai",
        idempotencyKey: randomUUID(),
      },
    })
    expect(unsupportedGrokCombination.status()).toBe(400)
    await expect(unsupportedGrokCombination.json()).resolves.toMatchObject({ code: "PROVIDER_NOT_COMPATIBLE" })

    const missingImage = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        sourceType: "upload",
        operation: "enhance",
        highFidelity: "true",
        preserveOriginalFraming: "false",
        idempotencyKey: randomUUID(),
      },
    })
    expect(missingImage.status()).toBe(400)
    await expect(missingImage.json()).resolves.toMatchObject({ code: "UPLOAD_REQUIRED" })

    const invalidFile = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        sourceType: "upload",
        operation: "enhance",
        highFidelity: "true",
        preserveOriginalFraming: "false",
        idempotencyKey: randomUUID(),
        image: { name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("not-an-image") },
      },
    })
    expect(invalidFile.status()).toBe(400)
    await expect(invalidFile.json()).resolves.toMatchObject({ code: "INVALID_IMAGE_FILE" })

    const missingPrompt = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        sourceType: "upload",
        operation: "edit_via_prompt",
        idempotencyKey: randomUUID(),
      },
    })
    expect(missingPrompt.status()).toBe(400)
    await expect(missingPrompt.json()).resolves.toMatchObject({ code: "INPUT_INVALID" })
  })

  test("melhora uma foto uma vez e reutiliza a geração concorrente", async ({ page }) => {
    test.skip(process.env.RUN_PEDRA_REAL_TEST !== "1", "Executado manualmente para controlar créditos externos.")
    test.setTimeout(120_000)

    const campaignsResponse = await page.request.get("/api/studio-ia/campaigns?kind=PROPERTY_PREPARATION&limit=20")
    expect(campaignsResponse.ok()).toBeTruthy()
    const campaignsPayload = await campaignsResponse.json() as { campaigns: Array<{ metadata: unknown }> }
    const sourceImageUrl = campaignsPayload.campaigns
      .map((campaign) => campaign.metadata)
      .map((metadata) => metadata && typeof metadata === "object" && "sourceImageUrl" in metadata
        ? String(metadata.sourceImageUrl ?? "")
        : "")
      .find((url) => url.startsWith("https://"))
    expect(sourceImageUrl, "É necessária uma imagem pública da validação anterior para o teste real.").toBeTruthy()
    const sourceImageResponse = await page.request.get(sourceImageUrl!)
    expect(sourceImageResponse.ok()).toBeTruthy()
    const sourceImageBuffer = await sourceImageResponse.body()

    const concurrentResponses: APIResponse[] = []
    await page.route("**/api/studio-ia/prepare-property", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      const [browserResponse, duplicateResponse] = await Promise.all([
        route.fetch(),
        page.request.fetch(route.request()),
      ])
      concurrentResponses.push(browserResponse, duplicateResponse)
      await route.fulfill({ response: browserResponse })
    })

    await page.goto("/corretor/studio-ia/preparar-imovel")
    await page.getByRole("button", { name: /Enviar imagem/ }).click()
    await page.locator('input[type="file"]').setInputFiles({
      name: "ambiente-validacao.jpg",
      mimeType: "image/jpeg",
      buffer: sourceImageBuffer,
    })
    await page.getByRole("button", { name: /Melhorar foto/ }).click()
    await page.getByRole("button", { name: "Melhorar fotografia", exact: true }).click()

    await expect(page.getByText("Imagem gerada e salva na Biblioteca para sua revisão.")).toBeVisible({ timeout: 100_000 })
    await expect(page.getByText("Original", { exact: true })).toBeVisible()
    await expect(page.getByText("Resultado", { exact: true })).toBeVisible()

    expect(concurrentResponses).toHaveLength(2)
    expect(concurrentResponses.map((response) => response.status()).sort()).toEqual([201, 202])
    const payloads = await Promise.all(concurrentResponses.map((response) => response.json() as Promise<PreparationResponse>))
    const campaignId = payloads.find((payload) => payload.campaign)?.campaign?.id
    const reusedJobId = payloads.find((payload) => payload.jobId)?.jobId
    expect(campaignId).toBeTruthy()
    expect(reusedJobId).toBe(campaignId)

    await page.getByRole("button", { name: "Aprovar resultado", exact: true }).click()
    await expect(page.getByRole("button", { name: "Aprovado", exact: true })).toBeVisible()
    await page.getByRole("link", { name: "Abrir Biblioteca", exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/corretor/studio-ia/biblioteca/${campaignId}$`))
    await expect(page.getByText("Fotografia melhorada", { exact: true })).toBeVisible()
  })
})
