import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

test.describe("COS Launch — smoke real", () => {
  test.skip(process.env.COS_LAUNCH_REAL_SMOKE !== "true", "Executa mutações reais somente quando solicitado explicitamente.")

  test("consulta, cria entidades, anexa PDF e mantém fallback honesto", async ({ page }) => {
    test.setTimeout(180_000)
    const consoleErrors: string[] = []
    const failedLaunchRequests: Array<{ status: number; url: string }> = []
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text())
    })
    page.on("response", (response) => {
      if (response.url().includes("/api/cos-launch") && response.status() >= 400) {
        failedLaunchRequests.push({ status: response.status(), url: response.url() })
      }
    })

    await loginAsBroker(page)
    await expect(page.getByText("Olá. Consulte seus dados ou escolha uma ação para começar.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Meus imóveis", exact: true })).toBeVisible()

    const send = async (message: string) => {
      const responsePromise = page.waitForResponse((response) => response.url().includes("/api/cos-launch") && response.request().method() === "POST")
      const composer = page.getByPlaceholder("Fale com o COS...")
      await composer.fill(message)
      await page.getByRole("button", { name: "Enviar mensagem ao COS" }).click()
      const response = await responsePromise
      expect(response.status()).toBe(200)
      return response
    }

    await send("meus imóveis")
    await expect(page.getByText(/Encontrei .* imóve|Nenhum imóvel/).last()).toBeVisible()
    await send("meus clientes")
    await expect(page.getByText(/Encontrei .* cliente|Nenhum cliente/).last()).toBeVisible()
    await send("contratos")
    await expect(page.getByText(/contratos mais recentes|Nenhum contrato/).last()).toBeVisible()
    await send("agenda de hoje")
    await expect(page.getByText(/compromissos de hoje|não possui compromissos/).last()).toBeVisible()

    const unique = Date.now().toString().slice(-8)
    await send("Cadastrar cliente")
    const clientForm = page.locator("form").filter({ hasText: "Cadastrar cliente" }).last()
    await clientForm.getByLabel("Nome", { exact: true }).fill(`Cliente Launch ${unique}`)
    await clientForm.getByLabel("WhatsApp", { exact: true }).fill(`549${unique}`)
    await clientForm.getByLabel("E-mail", { exact: true }).fill(`launch.${unique}@example.com`)
    const clientResponse = page.waitForResponse((response) => response.url().includes("/api/cos-launch") && response.request().method() === "POST")
    await clientForm.getByRole("button", { name: "Cadastrar cliente", exact: true }).click()
    expect((await clientResponse).status()).toBe(200)
    await expect(page.getByText(`Cliente Launch ${unique}`).last()).toBeVisible()
    await expect(page.getByRole("link", { name: "Ver cliente" }).last()).toBeVisible()

    await send("Quero cadastrar um imóvel")
    const propertyForm = page.locator("form").filter({ hasText: "Cadastrar imóvel" }).last()
    await propertyForm.getByLabel("Título", { exact: true }).fill(`Imóvel Launch ${unique}`)
    await propertyForm.getByLabel("Preço", { exact: true }).fill("450000")
    await propertyForm.getByLabel("Cidade", { exact: true }).fill("Vacaria")
    await propertyForm.getByLabel("Bairro", { exact: true }).fill("Centro")
    await propertyForm.getByLabel("Quartos", { exact: true }).fill("2")
    await propertyForm.getByLabel("Metragem", { exact: true }).fill("72")
    await propertyForm.locator('input[type="file"]').setInputFiles({
      name: "imovel-launch.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    })
    const propertyResponse = page.waitForResponse((response) => response.url().includes("/api/cos-launch") && response.request().method() === "POST")
    await propertyForm.getByRole("button", { name: "Cadastrar imóvel", exact: true }).click()
    expect((await propertyResponse).status()).toBe(200)
    await expect(page.getByText(`Imóvel Launch ${unique}`).last()).toBeVisible()
    await expect(page.getByRole("link", { name: "Ver imóvel" }).last()).toBeVisible()

    await send("Criar proposta")
    await page.getByRole("combobox").nth(0).selectOption({ label: `Cliente Launch ${unique}` })
    await page.getByRole("combobox").nth(1).selectOption({ label: `Imóvel Launch ${unique}` })
    await page.getByRole("textbox", { name: "Valor da proposta" }).fill("430000")
    const proposalResponse = page.waitForResponse((response) => response.url().includes("/api/cos-launch") && response.request().method() === "POST")
    await page.getByRole("button", { name: "Criar proposta", exact: true }).last().click()
    expect((await proposalResponse).status()).toBe(200)
    await expect(page.getByRole("link", { name: "Abrir proposta" }).last()).toBeVisible()

    await send("Criar contrato")
    await page.getByRole("textbox", { name: "Tipo de contrato" }).fill("Locação residencial")
    await page.getByRole("combobox").nth(0).selectOption({ label: `Cliente Launch ${unique}` })
    await page.getByRole("combobox").nth(1).selectOption({ label: `Imóvel Launch ${unique}` })
    const contractResponse = page.waitForResponse((response) => response.url().includes("/api/cos-launch") && response.request().method() === "POST")
    await page.getByRole("button", { name: "Criar contrato", exact: true }).last().click()
    expect((await contractResponse).status()).toBe(200)
    await expect(page.getByRole("link", { name: "Abrir contrato" }).last()).toBeVisible()

    await send("Anexar documento")
    await page.getByRole("combobox").nth(0).selectOption({ label: `Cliente Launch ${unique}` })
    await page.getByRole("textbox", { name: "Nome do documento" }).fill(`Documento Launch ${unique}`)
    await page.getByRole("textbox", { name: "Tipo", exact: true }).fill("Identificação")
    await page.getByLabel("Selecionar PDF").setInputFiles({ name: "documento-launch.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") })
    const documentResponse = page.waitForResponse((response) => response.url().includes("/api/cos-launch") && response.request().method() === "POST")
    await page.getByRole("button", { name: "Anexar documento", exact: true }).last().click()
    expect((await documentResponse).status()).toBe(200)

    await send("Faça uma transferência bancária por mim")
    await expect(page.getByText("Ainda não consigo fazer isso diretamente por aqui.").last()).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    expect(failedLaunchRequests).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
