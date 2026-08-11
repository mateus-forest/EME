import { randomUUID } from "node:crypto"

import { expect, test, type APIResponse } from "@playwright/test"
import sharp from "sharp"

import { loginAsBroker } from "./helpers/auth"

type PreparationResponse = {
  campaign?: {
    id: string
    metadata: Record<string, unknown>
    assets: Array<{ id: string; fileUrl: string | null; label: string | null; metadata: Record<string, unknown> }>
  }
  jobId?: string
}

async function createFixture(width = 800, height = 500) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 220, g: 218, b: 210 } },
  }).png().toBuffer()
}

async function createMask(width: number, height: number, color: "black" | "white" | "red" = "black") {
  const background = color === "black"
    ? { r: 0, g: 0, b: 0 }
    : color === "white"
      ? { r: 255, g: 255, b: 255 }
      : { r: 255, g: 0, b: 0 }
  return sharp({ create: { width, height, channels: 3, background } }).png().toBuffer()
}

test.describe("Studio IA — Remover objeto", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("desenha uma máscara alinhada, permite desfazer e funciona no mobile/touch", async ({ page }) => {
    const image = await createFixture()
    await page.goto("/corretor/studio-ia/preparar-imovel")
    await page.getByRole("button", { name: /Enviar imagem/ }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: "sala.png", mimeType: "image/png", buffer: image })
    await page.getByRole("button", { name: /Remover objeto/ }).first().click()

    const editor = page.getByTestId("object-mask-editor")
    const canvas = page.getByTestId("object-mask-canvas")
    const generate = page.getByRole("button", { name: "Remover objeto", exact: true }).last()
    await expect(editor).toBeVisible()
    await expect(canvas).toHaveAttribute("data-image-width", "800")
    await expect(canvas).toHaveAttribute("data-image-height", "500")
    await expect(generate).toBeDisabled()

    await page.getByLabel("Tamanho do pincel").fill("60")
    await canvas.scrollIntoViewIfNeeded()
    const bounds = await canvas.boundingBox()
    expect(bounds).not.toBeNull()
    const center = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 }
    await page.mouse.move(center.x - 25, center.y)
    await page.mouse.down()
    await page.mouse.move(center.x + 25, center.y, { steps: 5 })
    await page.mouse.up()

    await expect(page.getByText("Área marcada", { exact: true })).toBeVisible()
    await expect(generate).toBeEnabled()
    const centerAlpha = await canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement
      return target.getContext("2d")!.getImageData(400, 250, 1, 1).data[3]
    })
    expect(centerAlpha).toBeGreaterThan(0)

    await page.getByRole("button", { name: "Desfazer", exact: true }).click()
    await expect(page.getByText("Sem seleção", { exact: true })).toBeVisible()
    await expect(generate).toBeDisabled()

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileBounds = await canvas.boundingBox()
    expect(mobileBounds).not.toBeNull()
    const touchX = mobileBounds!.x + mobileBounds!.width * 0.3
    const touchY = mobileBounds!.y + mobileBounds!.height * 0.4
    await canvas.dispatchEvent("pointerdown", { pointerId: 41, pointerType: "touch", isPrimary: true, buttons: 1, clientX: touchX, clientY: touchY })
    await canvas.dispatchEvent("pointerup", { pointerId: 41, pointerType: "touch", isPrimary: true, buttons: 0, clientX: touchX, clientY: touchY })
    await expect(page.getByText("Área marcada", { exact: true })).toBeVisible()
    await expect(generate).toBeEnabled()
    await expect(canvas).toHaveCSS("touch-action", "none")

    await page.getByRole("button", { name: "Apagar marcação", exact: true }).click()
    await expect(page.getByRole("button", { name: "Apagar marcação", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Limpar seleção", exact: true }).click()
    await expect(generate).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBeFalsy()
  })

  test("rejeita máscara ausente, vazia, desalinhada e com pixels inválidos antes da Pedra", async ({ page }) => {
    const image = await createFixture(320, 200)
    const common = {
      sourceType: "upload",
      operation: "remove_object",
      image: { name: "sala.png", mimeType: "image/png", buffer: image },
    }

    const missing = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: { ...common, idempotencyKey: randomUUID() },
    })
    expect(missing.status()).toBe(400)
    await expect(missing.json()).resolves.toMatchObject({ code: "MASK_REQUIRED" })

    const empty = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        ...common,
        idempotencyKey: randomUUID(),
        mask: { name: "mask.png", mimeType: "image/png", buffer: await createMask(320, 200) },
      },
    })
    expect(empty.status()).toBe(400)
    await expect(empty.json()).resolves.toMatchObject({ code: "EMPTY_MASK" })

    const mismatched = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        ...common,
        idempotencyKey: randomUUID(),
        mask: { name: "mask.png", mimeType: "image/png", buffer: await createMask(160, 100, "white") },
      },
    })
    expect(mismatched.status()).toBe(400)
    await expect(mismatched.json()).resolves.toMatchObject({ code: "MASK_DIMENSIONS_MISMATCH" })

    const invalidPixels = await page.request.post("/api/studio-ia/prepare-property", {
      multipart: {
        ...common,
        idempotencyKey: randomUUID(),
        mask: { name: "mask.png", mimeType: "image/png", buffer: await createMask(320, 200, "red") },
      },
    })
    expect(invalidPixels.status()).toBe(400)
    await expect(invalidPixels.json()).resolves.toMatchObject({ code: "INVALID_MASK_PIXELS" })
  })

  test("remove um objeto uma vez e reutiliza o lock em requests concorrentes", async ({ page }) => {
    test.skip(process.env.RUN_PEDRA_REMOVE_OBJECT_REAL_TEST !== "1", "Executado manualmente para controlar créditos externos.")
    test.setTimeout(120_000)

    const campaignsResponse = await page.request.get("/api/studio-ia/campaigns?kind=PROPERTY_PREPARATION&limit=20")
    expect(campaignsResponse.ok()).toBeTruthy()
    const campaignsPayload = await campaignsResponse.json() as { campaigns: Array<{ metadata: unknown }> }
    const sourceImageUrl = campaignsPayload.campaigns
      .map((campaign) => campaign.metadata)
      .map((metadata) => metadata && typeof metadata === "object" && "sourceImageUrl" in metadata ? String(metadata.sourceImageUrl ?? "") : "")
      .find((url) => url.startsWith("https://"))
    expect(sourceImageUrl, "É necessária uma imagem pública de uma validação anterior.").toBeTruthy()

    const sourceResponse = await page.request.get(sourceImageUrl!)
    expect(sourceResponse.ok()).toBeTruthy()
    const normalized = await sharp(await sourceResponse.body()).rotate().png().toBuffer({ resolveWithObject: true })
    const width = normalized.info.width
    const height = normalized.info.height
    const selectionWidth = Math.max(16, Math.round(width * 0.25))
    const selectionHeight = Math.max(16, Math.round(height * 0.09))
    const mask = await sharp({ create: { width, height, channels: 3, background: "black" } })
      .composite([{
        input: await createMask(selectionWidth, selectionHeight, "white"),
        left: Math.round(width * 0.41),
        top: Math.round(height * 0.565),
      }])
      .png()
      .toBuffer()

    const requestPayload = (idempotencyKey: string) => ({
      multipart: {
        sourceType: "upload",
        operation: "remove_object",
        idempotencyKey,
        image: { name: "ambiente.png", mimeType: "image/png", buffer: normalized.data },
        mask: { name: "object-mask.png", mimeType: "image/png", buffer: mask },
      },
    })
    const responses: APIResponse[] = await Promise.all([
      page.request.post("/api/studio-ia/prepare-property", requestPayload(randomUUID())),
      page.request.post("/api/studio-ia/prepare-property", requestPayload(randomUUID())),
    ])
    expect(responses.map((response) => response.status()).sort()).toEqual([201, 202])
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<PreparationResponse>))
    const completed = payloads.find((payload) => payload.campaign)?.campaign
    const reusedJobId = payloads.find((payload) => payload.jobId)?.jobId
    expect(completed).toBeTruthy()
    expect(reusedJobId).toBe(completed!.id)
    expect(completed!.metadata).toMatchObject({
      transformation: "remove_object",
      providerInternal: "pedra",
      externalCredits: 1,
      creditsConsumed: null,
      emeCreditsCharged: false,
      mask: { width, height, retainedInStorage: false },
    })

    const resultAsset = completed!.assets.find((asset) => asset.label === "Objeto removido")
    expect(resultAsset?.fileUrl).toMatch(/^https:\/\//)
    expect(resultAsset?.metadata).toMatchObject({ maskWidth: width, maskHeight: height, maskRetainedInStorage: false })
    const approval = await page.request.patch(`/api/studio-ia/campaigns/assets/${resultAsset!.id}`, { data: { status: "APPROVED" } })
    expect(approval.ok()).toBeTruthy()

    await page.goto(`/corretor/studio-ia/biblioteca/${completed!.id}`)
    await expect(page.getByText("Objeto removido", { exact: true })).toBeVisible()
    await expect(page.getByText(/mask|máscara/i)).toHaveCount(0)
  })

  test("valida o resultado real existente na Biblioteca sem nova geração", async ({ page }) => {
    test.skip(process.env.RUN_PEDRA_REMOVE_OBJECT_REAL_TEST !== "1", "Executado após a única geração real.")

    const response = await page.request.get("/api/studio-ia/campaigns?kind=PROPERTY_PREPARATION&limit=20")
    expect(response.ok()).toBeTruthy()
    const payload = await response.json() as { campaigns: Array<{ id: string; metadata: Record<string, unknown> }> }
    const campaign = payload.campaigns.find((item) => item.metadata.transformation === "remove_object")
    expect(campaign).toBeTruthy()

    await page.goto(`/corretor/studio-ia/biblioteca/${campaign!.id}`)
    const resultImage = page.getByRole("img", { name: "Objeto removido" }).first()
    await expect(resultImage).toBeVisible()
    await expect.poll(() => resultImage.evaluate((element) => {
      const image = element as HTMLImageElement
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    }), { timeout: 30_000 }).toBe(true)
    await expect(page.getByText(/mask|máscara/i)).toHaveCount(0)
  })
})
