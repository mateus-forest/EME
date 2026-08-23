import { expect, test, type Page } from "@playwright/test"

import { buildProposalHtml, sanitizeProposalDocumentContent, sanitizeProposalDisplayText } from "@/lib/proposal-template"

async function mockBrokerSession(page: Page) {
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { id: "user-1", name: "Corretor Teste", email: "corretor@example.com", role: "BROKER", brokerId: "broker-1", agencyId: null } } }))
  await page.route("**/api/brokers/me**", (route) => route.fulfill({ json: { profile: { id: "user-1", brokerId: "broker-1", agencyId: null, agencyName: "", accountType: "BROKER_INDEPENDENT", name: "Corretor Teste", email: "corretor@example.com", phone: "11999999999", photoUrl: "", creci: "12345", description: "" } } }))
  await page.route("**/api/brokers/subscription**", (route) => route.fulfill({ json: { subscription: { planName: "Plano EME", isUpgraded: true, propertyLimit: 10, status: "Ativo" } } }))
}

test.describe("Propostas — apresentação legítima e workspace limitado", () => {
  test("remove contexto interno de anexos sem truncar o conteúdo legítimo", () => {
    const internalContext = "IMPORTANTE: os anexos sao a fonte principal de informacao. O texto do usuario descreve apenas a intencao operacional. Nao use o prompt como titulo, descricao ou conteudo do imovel/documento quando o anexo trouxer dados mais confiaveis. Arquivos anexados: proposta.pdf"
    const html = `<main><h1>Proposta ${internalContext}</h1><p>Entrada de R$ 100.000. ${internalContext}</p><p>Validade de 30 dias.</p></main>`
    const sanitized = sanitizeProposalDocumentContent(html)

    expect(sanitizeProposalDisplayText(`Proposta ${internalContext}`)).toBe("Proposta")
    expect(sanitized).toContain("Entrada de R$ 100.000.")
    expect(sanitized).toContain("Validade de 30 dias.")
    expect(sanitized).not.toContain("IMPORTANTE")
    expect(sanitized).not.toContain("intencao operacional")
    expect(sanitized).not.toContain("Arquivos anexados")
  })

  test("mantém imóvel, valor e condições no documento gerado", () => {
    const html = buildProposalHtml({
      lead: { name: "Marina Lopes", phone: "11999999999", email: "marina@example.com" },
      property: {
        id: "property-1",
        publicCode: 42,
        title: "Apartamento Central",
        neighborhood: "Centro",
        city: "São Paulo",
        type: "APARTMENT",
        purpose: "SALE",
        price: 825_000_00,
        area: "82 m²",
        bedrooms: 3,
        parkingSpots: 2,
      },
      broker: { name: "Corretor Teste", phone: "11988887777", email: "corretor@example.com", creci: "12345" },
      conditions: {
        entry: "R$ 165.000,00",
        installments: "24 parcelas",
        paymentMethod: "Financiamento bancário",
        notes: "Entrega das chaves após a quitação da entrada.",
        validity: "10 dias",
      },
    })

    const readableHtml = html.replace(/\u00a0/g, " ")
    expect(readableHtml).toContain("Apartamento Central")
    expect(readableHtml).toContain("R$ 825.000,00")
    expect(html).toContain("R$ 165.000,00")
    expect(html).toContain("24 parcelas")
    expect(html).toContain("Financiamento bancário")
    expect(html).toContain("Entrega das chaves após a quitação da entrada.")
    expect(html).toContain("10 dias")
  })

  test("expõe imóvel e condições, envia o payload completo e reabre a proposta", async ({ page }) => {
    await mockBrokerSession(page)
    let createdDocument: Record<string, unknown> | null = null
    let submittedPayload: Record<string, unknown> | null = null

    await page.route("**/api/brokers/documents*", async (route) => {
      if (route.request().method() === "POST") {
        submittedPayload = route.request().postDataJSON() as Record<string, unknown>
        const content = buildProposalHtml({
          lead: { name: String(submittedPayload.clientName), phone: String(submittedPayload.clientPhone), email: String(submittedPayload.clientEmail) },
          property: {
            id: String(submittedPayload.propertyCode),
            title: String(submittedPayload.propertyTitle),
            neighborhood: String(submittedPayload.propertyNeighborhood),
            city: String(submittedPayload.propertyCity),
            type: String(submittedPayload.propertyType),
            purpose: "SALE",
            price: 810_000_00,
            area: String(submittedPayload.propertyArea),
            bedrooms: Number(submittedPayload.propertyBedrooms),
            parkingSpots: Number(submittedPayload.propertyParkingSpots),
          },
          broker: { name: "Corretor Teste", phone: "11999999999", email: "corretor@example.com", creci: "12345" },
          conditions: {
            entry: String(submittedPayload.entry),
            installments: `${String(submittedPayload.installmentCount)} parcelas de ${String(submittedPayload.installmentValue)}`,
            paymentMethod: String(submittedPayload.paymentMethod),
            notes: String(submittedPayload.conditions),
            validity: String(submittedPayload.validity),
          },
        })
        createdDocument = {
          id: "proposal-created",
          type: "proposal",
          title: "Proposta Marina + Apartamento Central",
          content,
          status: "generated",
          leadId: "lead-1",
          propertyId: "property-1",
          leadName: "Marina Lopes",
          propertyTitle: "Apartamento Central",
          createdAt: new Date().toISOString(),
        }
        await route.fulfill({ status: 201, json: { document: createdDocument } })
        return
      }

      await route.fulfill({ json: { documents: createdDocument ? [createdDocument] : [] } })
    })
    await page.route("**/api/brokers/leads", (route) => route.fulfill({ json: { leads: [{ id: "lead-1", name: "Marina Lopes", phone: "11999999999", email: "marina@example.com" }] } }))
    await page.route("**/api/properties/me", (route) => route.fulfill({ json: { properties: [{ id: "property-1", publicCode: 42, title: "Apartamento Central", formattedPrice: "R$ 810.000,00", city: "São Paulo", neighborhood: "Centro", bedrooms: 3, parkingSpots: 2, type: "Apartamento", purpose: "Venda", legal: { privateArea: "82", totalArea: "95" } }] } }))

    await page.goto("/corretor/documentos")
    await page.getByTestId("proposal-workspace").getByRole("button", { name: "Nova", exact: true }).click()

    await expect(page.getByLabel("Selecionar cliente")).toBeVisible()
    await expect(page.getByLabel("Selecionar imóvel")).toBeVisible()
    await expect(page.getByLabel("Valor da proposta")).toBeVisible()
    await expect(page.getByLabel("Entrada")).toBeVisible()
    await expect(page.getByLabel("Valor financiado calculado")).toBeVisible()
    await expect(page.getByLabel("Quantidade de parcelas")).toBeVisible()
    await expect(page.getByLabel("Juros mensais")).toBeVisible()
    await expect(page.getByLabel("Valor estimado da parcela calculado")).toBeVisible()
    await expect(page.getByLabel("Forma de pagamento")).toBeVisible()
    await expect(page.getByLabel("Observações")).toBeVisible()

    await page.getByLabel("Selecionar cliente").selectOption("lead-1")
    await page.getByLabel("Selecionar imóvel").selectOption("property-1")
    await expect(page.getByLabel("Valor da proposta")).toHaveValue(/R\$\s810\.000,00/)
    await page.getByLabel("Entrada").fill("160000")
    await expect(page.getByLabel("Entrada")).toHaveValue(/R\$\s160\.000,00/)
    await expect(page.getByLabel("Valor financiado calculado")).toHaveValue(/R\$\s650\.000,00/)
    const entryValue = await page.getByLabel("Entrada").inputValue()
    const financingValue = await page.getByLabel("Valor financiado calculado").inputValue()
    await page.getByLabel("Quantidade de parcelas").fill("24")
    await expect(page.getByLabel("Quantidade de parcelas")).toHaveValue("24")
    await page.getByLabel("Juros mensais").fill("0,89")
    await expect(page.getByLabel("Juros mensais")).toHaveValue(/0,89%/)
    const calculatedInstallment = await page.getByLabel("Valor estimado da parcela calculado").inputValue()
    expect(calculatedInstallment).toMatch(/R\$\s*[\d.]+,\d{2}/)
    expect(calculatedInstallment).not.toMatch(/R\$\s*0,00/)
    await page.getByLabel("Forma de pagamento").fill("Financiamento bancário")
    await page.getByLabel("Validade").fill("10 dias")
    await page.getByLabel("Observações").fill("Entrega das chaves após a entrada.")
    await page.getByRole("button", { name: "Gerar e salvar proposta" }).click()

    await expect.poll(() => submittedPayload).not.toBeNull()
    expect(submittedPayload).toMatchObject({
      leadId: "lead-1",
      propertyId: "property-1",
      propertyTitle: "Apartamento Central",
      propertyCode: "42",
      propertyNeighborhood: "Centro",
      propertyCity: "São Paulo",
      propertyType: "Apartamento",
      propertyPurpose: "venda",
      propertyPrice: "R$ 810.000,00",
      propertyArea: "82",
      propertyBedrooms: "3",
      propertyParkingSpots: "2",
      entry: entryValue,
      financing: financingValue,
      installmentCount: 24,
      monthlyInterestRate: 0.89,
      installmentValue: calculatedInstallment,
      paymentMethod: "Financiamento bancário",
      validity: "10 dias",
      conditions: "Entrega das chaves após a entrada.",
    })

    await expect(page.getByText("Proposta Marina + Apartamento Central").first()).toBeVisible()
    await page.reload()
    const proposalCard = page.getByRole("button", { name: /Proposta Marina \+ Apartamento Central/ })
    await expect(proposalCard).toHaveAttribute("aria-pressed", "true")
    await expect(proposalCard).toContainText("Gerado")
    await expect(proposalCard).toContainText("Marina Lopes")
    await expect(proposalCard).toContainText("Apartamento Central")
    const proposalCardBox = await proposalCard.boundingBox()
    expect(proposalCardBox?.height).toBeLessThanOrEqual(56)
    const proposalFrame = page.frameLocator('iframe[title="Proposta Marina + Apartamento Central"]')
    await expect(proposalFrame.getByText("Apartamento Central").first()).toBeVisible()
    await expect(proposalFrame.getByText("R$ 160.000,00").first()).toBeVisible()
    await expect(proposalFrame.getByText(/24 parcelas de/).first()).toBeVisible()
    await expect(proposalFrame.getByText(calculatedInstallment).first()).toBeVisible()
    await expect(proposalFrame.getByText("Financiamento bancário").first()).toBeVisible()
    await expect(proposalFrame.getByText("Entrega das chaves após a entrada.").first()).toBeVisible()

    let pdfCreditRequested = false
    await page.route("**/api/brokers/documents/proposal-created/pdf-credit", (route) => {
      pdfCreditRequested = true
      return route.fulfill({ json: { ok: true } })
    })
    const popupPromise = page.waitForEvent("popup")
    await page.getByRole("button", { name: "Baixar PDF" }).click()
    const popup = await popupPromise
    await expect.poll(() => pdfCreditRequested).toBe(true)
    await popup.close()
  })

  test("mantém proposta longa dentro do workspace no desktop e no mobile", async ({ page }) => {
    await mockBrokerSession(page)
    const longContent = Array.from({ length: 90 }, (_, index) => `Cláusula ${index + 1}: ${"condicao-legitima-".repeat(18)}`).join("\n")
    const proposalDocument = {
      id: "proposal-long",
      type: "proposal",
      title: "Proposta comercial extensa com condições legítimas",
      content: longContent,
      status: "generated",
      leadName: "Cliente Real",
      propertyTitle: "Apartamento Central",
      createdAt: new Date().toISOString(),
    }

    await page.route("**/api/brokers/documents?**", (route) => route.fulfill({ json: { documents: [proposalDocument] } }))
    await page.route("**/api/brokers/leads", (route) => route.fulfill({ json: { leads: [] } }))
    await page.route("**/api/properties/me", (route) => route.fulfill({ json: { properties: [] } }))

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.goto("/corretor/documentos")
      await expect(page.getByText(proposalDocument.title).first()).toBeVisible()
      const preview = page.getByTestId("proposal-preview")
      await expect(preview).toBeVisible()
      const openAction = page.getByRole("button", { name: "Abrir", exact: true })
      await openAction.scrollIntoViewIfNeeded()
      await expect(openAction).toBeVisible()
      await expect(page.getByRole("button", { name: "Baixar PDF" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Copiar texto" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Marcar assinado" })).toBeVisible()
      const layout = await page.evaluate(() => {
        const preview = document.querySelector<HTMLElement>('[data-testid="proposal-preview"]')
        const workspace = document.querySelector<HTMLElement>('[data-testid="proposal-workspace"]')
        if (!preview || !workspace) return null
        return {
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          previewWidth: preview.scrollWidth,
          previewClientWidth: preview.clientWidth,
          previewRect: preview.getBoundingClientRect().toJSON(),
          workspaceRect: workspace.getBoundingClientRect().toJSON(),
          workspaceWidth: workspace.getBoundingClientRect().width,
        }
      })
      expect(layout).not.toBeNull()
      expect(layout!.pageWidth).toBeLessThanOrEqual(layout!.viewportWidth + 1)
      expect(layout!.previewClientWidth).toBeLessThanOrEqual(layout!.workspaceWidth)
      expect(layout!.previewRect.width).toBeLessThanOrEqual(layout!.workspaceRect.width + 1)
      expect(layout!.previewWidth).toBeGreaterThanOrEqual(layout!.previewClientWidth)
    }
  })
})
