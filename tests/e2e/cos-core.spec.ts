import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"
import {
  clickSidebarLink,
  collectBodyText,
  expectAnyVisibleText,
  expectNoTechnicalMessages,
  findVisibleButtonsByLabels,
  openCosHome,
  sendCosMessage,
  waitForCosReady,
} from "./helpers/cos"

const fastActions = [
  { command: "Clientes", expectedUrl: /\/corretor\/clientes$/ },
  { command: "Imóveis", expectedUrl: /\/corretor\/imoveis$/ },
  { command: "Contratos", expectedUrl: /\/corretor\/documentos\/contratos$/ },
  { command: "Propostas", expectedUrl: /\/corretor\/documentos$/ },
  { command: "Agenda", expectedUrl: /\/corretor\/agenda$/ },
  { command: "Financeiro", expectedUrl: /\/corretor\/financeiro$/ },
  { command: "Studio IA", expectedUrl: /\/corretor\/studio-ia$/ },
  { command: "Histórico", expectedUrl: /\/corretor\/historico$/ },
  { command: "Conta", expectedUrl: /\/corretor\/conta$/ },
]

test.describe("COS Core E2E", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("login, portal e abertura do COS", async ({ page }) => {
    await openCosHome(page)

    await expect(page).toHaveURL(/\/corretor$/)
    await expect(page.getByText(/Olá,/i)).toBeVisible()
    await expect(page.getByText(/COS ativo/i)).toBeVisible()
    await expect(page.getByPlaceholder("Fale com o COS...")).toBeVisible()
    await expectNoTechnicalMessages(page)
  })

  test("conversa simples responde sem mensagens técnicas", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Oi")

    const text = await collectBodyText(page)
    expect(text).toContain("Oi")
    expect(text).toMatch(/Escolha por onde deseja começar|RESULTADO|Como usar o COS|Clientes/i)
    await expectNoTechnicalMessages(page)
  })

  test("mudança de contexto entre cliente, imóvel, agenda e retorno", async ({ page }) => {
    await openCosHome(page)

    await sendCosMessage(page, "Criar cliente")
    await expectNoTechnicalMessages(page)

    await sendCosMessage(page, "Agora quero criar um imóvel")
    await expectNoTechnicalMessages(page)

    await sendCosMessage(page, "Agenda")
    await expect(page).toHaveURL(/\/corretor\/agenda$/)

    await clickSidebarLink(page, "/corretor")
    await waitForCosReady(page)
    await sendCosMessage(page, "Clientes")
    await expect(page).toHaveURL(/\/corretor\/clientes$/)
  })

  test("fast action Clientes abre o módulo correto sem reaproveitar workflow antigo", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Criar contrato")
    await clickSidebarLink(page, "/corretor")
    await sendCosMessage(page, "Clientes")

    await expect(page).toHaveURL(/\/corretor\/clientes$/)
    const text = await collectBodyText(page)
    expect(text).toContain("Clientes")
    expect(text).not.toMatch(/Confirmar|Cancelar ação|Confirmar ação/i)
  })

  for (const action of fastActions) {
    test(`fast action navega para ${action.command}`, async ({ page }) => {
      await openCosHome(page)
      await sendCosMessage(page, action.command)
      await expect(page).toHaveURL(action.expectedUrl)
    })
  }

  test("ver detalhes da operação não mostra mensagem técnica", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Ver detalhes da operação")

    await expect(page).toHaveURL(/\/corretor$/)
    await expectAnyVisibleText(page, [/operação/i, /pendências/i, /saúde da operação/i, /resumo/i])
    await expectNoTechnicalMessages(page)
  })

  test("escolhas estruturadas renderizam CTAs clicáveis e continuam o fluxo", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Oi")

    const buttons = await findVisibleButtonsByLabels(page, [
      "Clientes",
      "Buscar imóveis",
      "Criar proposta",
      "Novo contrato",
      "Agenda",
      "Como usar o COS",
    ])

    expect(buttons.length).toBeGreaterThan(0)

    await buttons[0].click()
    await page.waitForLoadState("networkidle").catch(() => null)
    await page.waitForTimeout(1000)

    const text = await collectBodyText(page)
    expect(text.length).toBeGreaterThan(0)
  })

  test("cancelamento encerra o fluxo e permite navegar sem confirmação antiga", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Criar contrato")
    await sendCosMessage(page, "Cancelar")
    await sendCosMessage(page, "Clientes")

    await expect(page).toHaveURL(/\/corretor\/clientes$/)
    const text = await collectBodyText(page)
    expect(text).not.toMatch(/Confirmar ação|Cancelar ação/i)
  })

  test("continuar retoma o fluxo de proposta sem perder contexto imediatamente", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Criar proposta")
    await sendCosMessage(page, "Continuar")

    const text = await collectBodyText(page)
    expect(text).toMatch(/proposta|cliente|imóvel|imovel|continuar|próximo passo|resultado/i)
    await expectNoTechnicalMessages(page)
  })

  test("comandos ambíguos pedem esclarecimento ou permanecem contextuais", async ({ page }) => {
    await openCosHome(page)

    for (const command of ["abrir", "editar", "mostrar", "confirmar", "continuar"]) {
      await sendCosMessage(page, command)
      const text = await collectBodyText(page)
      expect.soft(text).toMatch(/escolha|qual|confirmar|continuar|resultado|próximo passo|selec/i)
      await expectNoTechnicalMessages(page)
      await clickSidebarLink(page, "/corretor")
      await waitForCosReady(page)
    }
  })

  test("ux conversacional evita linguagem técnica e mantém respostas utilizáveis", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Como usar o COS?")

    const text = await collectBodyText(page)
    expect(text).not.toMatch(/fallback|legacy|stack|exception|runtime/i)
    expect(text).toMatch(/COS|Clientes|imóveis|imoveis|proposta|contrato|agenda/i)
  })
})
