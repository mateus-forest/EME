import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

test.describe("Studio IA — Criar vídeo", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("mantém uma única imagem ativa entre imóvel e upload", async ({ page }) => {
    const propertiesResponse = await page.request.get("/api/properties/me")
    expect(propertiesResponse.ok()).toBeTruthy()
    const propertiesPayload = await propertiesResponse.json() as {
      properties: Array<{ title: string; images: string[] }>
    }
    const propertyIndex = propertiesPayload.properties.findIndex((property) => property.images.length > 0)
    const propertyWithImage = propertiesPayload.properties[propertyIndex]
    expect(propertyWithImage, "O ambiente E2E precisa ter ao menos um imóvel com fotografia.").toBeTruthy()

    await page.goto("/corretor/studio-ia/criar-video-do-imovel")
    await expect(page.getByRole("heading", { name: "Criar vídeo", exact: true })).toBeVisible()

    const propertySelect = page.getByRole("combobox").first()
    await propertySelect.click()
    await page.getByRole("option").nth(propertyIndex).click()

    const firstPropertyImage = page.getByRole("button", { name: /Imagem 1/ })
    await expect(firstPropertyImage).toBeVisible()
    const activeSource = page.getByTestId("active-video-source")
    await expect(activeSource).toContainText("Fotografia do imóvel")
    await expect(activeSource).toContainText("única imagem")

    await page.locator('input[type="file"]').setInputFiles({
      name: "imagem-principal.png",
      mimeType: "image/png",
      buffer: tinyPng,
    })
    await expect(activeSource).toContainText("Imagem enviada")
    await expect(activeSource).toContainText("imagem-principal.png")

    await firstPropertyImage.click()
    await expect(activeSource).toContainText("Fotografia do imóvel")
    await expect(activeSource).not.toContainText("imagem-principal.png")
  })

  test("expõe somente controles que influenciam a geração atual", async ({ page }) => {
    await page.goto(
      "/corretor/studio-ia/criar-video-do-imovel?preparedAssetId=asset-e2e&preparedImageUrl=https%3A%2F%2Fimages.example.com%2Fprepared.jpg",
    )
    await expect(page.getByTestId("active-video-source")).toContainText("Resultado aprovado de Preparar imóvel")
    await page.getByRole("button", { name: "Continuar", exact: true }).click()

    await expect(page.getByText("B. Formato", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Vertical 9:16", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Horizontal 16:9", exact: true })).toBeVisible()
    await expect(page.getByText("C. Objetivo", { exact: true })).toBeVisible()
    await expect(page.getByText("D. Estilo e ritmo", { exact: true })).toBeVisible()
    await expect(page.getByText("E. Movimento sugerido", { exact: true })).toBeVisible()
    await expect(page.getByText("F. Orientações adicionais", { exact: true })).toBeVisible()
    await expect(page.getByText("Duração atual: 9 segundos.", { exact: false })).toBeVisible()

    for (const hiddenControl of [
      "Música",
      "Narração",
      "Legendas",
      "Logo",
      "Foto do corretor",
      "Cor da marca",
      "Título final",
      "Encerramento",
      "Tipo de transformação",
    ]) {
      await expect(page.getByText(hiddenControl, { exact: true })).toHaveCount(0)
    }
  })

  test("rejeita briefing sem imagem antes de consultar créditos ou provider", async ({ page }) => {
    const response = await page.request.post("/api/studio-ia/video", {
      multipart: {
        payload: JSON.stringify({
          referenceImageUrls: [],
          uploadedImages: [],
          format: "Reel vertical 9:16",
          duration: "9s",
          objective: "Atrair interessados",
          style: "Cinematografico",
          transformation: "Nenhuma",
          rhythm: "Equilibrado",
          cameraMovement: "Gimbal",
          additionalInstructions: "",
          version: 1,
        }),
      },
    })

    expect(response.status()).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "Selecione uma fotografia do imovel ou envie uma imagem.",
    })
  })

  test("não cria overflow horizontal no viewport PWA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(
      "/corretor/studio-ia/criar-video-do-imovel?preparedAssetId=asset-e2e&preparedImageUrl=https%3A%2F%2Fimages.example.com%2Fprepared.jpg",
    )
    await expect(page.getByRole("heading", { name: "Criar vídeo", exact: true })).toBeVisible()
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBeFalsy()
  })
})
