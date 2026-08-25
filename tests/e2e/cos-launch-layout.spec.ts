import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

test.describe("COS Launch — layout", () => {
  test.skip(process.env.COS_LAUNCH_LAYOUT_SMOKE !== "true", "Executa a validação visual somente quando solicitado.")

  test("mantém chat, saúde e composer proporcionais no desktop e mobile", async ({ page }) => {
    test.setTimeout(90_000)
    const consoleErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await loginAsBroker(page)

    await expect(page.getByText("Olá. Consulte seus dados ou escolha uma ação para começar.")).toBeVisible()
    await expect(page.getByText("Saúde da operação")).toBeVisible()
    await expect(page.getByRole("button", { name: "Meus imóveis", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Cadastrar cliente", exact: true })).toBeVisible()

    const healthBox = await page.getByText("Saúde da operação").locator("../..").boundingBox()
    expect(healthBox?.width ?? 999).toBeLessThanOrEqual(250)

    await page.getByRole("button", { name: "Abrir menu de ações do COS" }).click()
    await expect(page.getByText("Nova conversa", { exact: true }).last()).toBeVisible()
    await expect(page.getByText("Criar", { exact: true }).last()).toBeVisible()
    await expect(page.getByText("Consultar", { exact: true }).last()).toBeVisible()
    await expect(page.getByText("Ajuda", { exact: true }).last()).toBeVisible()
    await expect(page.getByText("Anexar", { exact: true }).last()).toBeVisible()
    await expect(page.getByText("Múltiplos arquivos", { exact: true })).toHaveCount(0)
    await expect(page.getByText("Vídeo", { exact: true })).toHaveCount(0)
    await page.screenshot({ path: "test-results/cos-launch-layout-desktop.png", fullPage: true })

    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText("Saúde da operação")).toBeVisible()
    await expect(page.getByPlaceholder("Fale com o COS...")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.screenshot({ path: "test-results/cos-launch-layout-mobile.png", fullPage: true })
    expect(consoleErrors).toEqual([])
  })
})
