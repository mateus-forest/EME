import { expect, test, type Page } from "@playwright/test"

import { sanitizeProposalDocumentContent, sanitizeProposalDisplayText } from "@/lib/proposal-template"

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
      const layout = await page.evaluate(() => {
        const preview = document.querySelector<HTMLElement>('[data-testid="proposal-preview"]')
        const workspace = document.querySelector<HTMLElement>('[data-testid="proposal-workspace"]')
        if (!preview || !workspace) return null
        return {
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          previewWidth: preview.scrollWidth,
          previewClientWidth: preview.clientWidth,
          previewHeight: preview.getBoundingClientRect().height,
          workspaceWidth: workspace.getBoundingClientRect().width,
        }
      })
      expect(layout).not.toBeNull()
      expect(layout!.pageWidth).toBeLessThanOrEqual(layout!.viewportWidth + 1)
      expect(layout!.previewClientWidth).toBeLessThanOrEqual(layout!.workspaceWidth)
      expect(layout!.previewHeight).toBeLessThanOrEqual(viewport.height * 0.55)
      expect(layout!.previewWidth).toBeGreaterThanOrEqual(layout!.previewClientWidth)
    }
  })
})
