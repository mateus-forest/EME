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
  test.describe.configure({ timeout: 90_000 })

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

  test("desktop isola o scroll da conversa e mantém os controles estáticos", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openCosHome(page)
    await sendCosMessage(page, "Oi")

    const composer = page.getByTestId("cos-composer-dock")
    const operationHealth = page.getByTestId("cos-operation-health")
    const operationHealthToggle = operationHealth.getByRole("button", { name: /Saúde da operação/i })
    await expect(composer).toBeVisible()
    await expect(operationHealth).toBeVisible()
    await expect(page.locator("#operation-health-panel")).toBeVisible()
    await operationHealthToggle.click()
    await expect(page.locator("#operation-health-panel")).toHaveCount(0)
    await operationHealthToggle.click()
    await expect(page.locator("#operation-health-panel")).toBeVisible()

    const layout = await page.evaluate(() => {
      const conversation = document.querySelector<HTMLElement>('[data-testid="cos-conversation-scroll"]')
      const composerDock = document.querySelector<HTMLElement>('[data-testid="cos-composer-dock"]')
      const health = document.querySelector<HTMLElement>('[data-testid="cos-operation-health"]')
      const healthPanel = document.querySelector<HTMLElement>("#operation-health-panel")
      const surface = document.querySelector<HTMLElement>('[data-testid="cos-conversation-surface"]')
      const sidebar = document.querySelector<HTMLElement>('aside:not([data-testid="cos-operation-health"])')
      if (!composerDock || !health || !healthPanel || !surface || !sidebar) return null

      const before = {
        composerTop: composerDock.getBoundingClientRect().top,
        healthTop: health.getBoundingClientRect().top,
        sidebarTop: sidebar.getBoundingClientRect().top,
      }
      window.scrollTo(0, 500)
      if (conversation) conversation.scrollTop = conversation.scrollHeight

      return {
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        pageScroll: window.scrollY,
        conversationOverflowY: conversation ? getComputedStyle(conversation).overflowY : null,
        conversationScrollbarWidth: conversation ? getComputedStyle(conversation).scrollbarWidth : null,
        healthPanelOverflowY: getComputedStyle(healthPanel).overflowY,
        conversationSurfaceBackground: getComputedStyle(surface).backgroundColor,
        conversationSurfaceBorderWidth: getComputedStyle(surface).borderTopWidth,
        healthPanelTop: healthPanel.getBoundingClientRect().top,
        healthTop: health.getBoundingClientRect().top,
        composerDelta: composerDock.getBoundingClientRect().top - before.composerTop,
        healthDelta: health.getBoundingClientRect().top - before.healthTop,
        sidebarDelta: sidebar.getBoundingClientRect().top - before.sidebarTop,
      }
    })

    expect(layout).not.toBeNull()
    expect(layout!.pageHeight).toBeLessThanOrEqual(layout!.viewportHeight + 1)
    expect(layout!.pageScroll).toBe(0)
    expect(layout!.conversationOverflowY).toBe("auto")
    expect(layout!.conversationScrollbarWidth).toBe("none")
    expect(layout!.healthPanelOverflowY).toBe("auto")
    expect(layout!.conversationSurfaceBackground).toBe("rgba(0, 0, 0, 0)")
    expect(layout!.conversationSurfaceBorderWidth).toBe("0px")
    expect(layout!.healthPanelTop).toBeGreaterThanOrEqual(layout!.healthTop)
    expect(Math.abs(layout!.composerDelta)).toBeLessThan(1)
    expect(Math.abs(layout!.healthDelta)).toBeLessThan(1)
    expect(Math.abs(layout!.sidebarDelta)).toBeLessThan(1)
  })

  test("mobile mantém compositor e saúde próximos ao rodapé sem exceder a viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openCosHome(page)

    const dock = page.getByTestId("cos-composer-dock")
    await expect(dock).toBeVisible()
    const position = await dock.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { top: rect.top, bottomGap: window.innerHeight - rect.bottom, viewportHeight: window.innerHeight }
    })
    expect(position.top).toBeGreaterThan(position.viewportHeight * 0.6)
    expect(position.bottomGap).toBeGreaterThanOrEqual(0)
    expect(position.bottomGap).toBeLessThanOrEqual(32)
  })

  test("conversa simples responde sem mensagens técnicas", async ({ page }) => {
    await openCosHome(page)
    await sendCosMessage(page, "Oi")

    const text = await collectBodyText(page)
    expect(text).toContain("Oi")
    expect(text).toMatch(/ajudar|executar|resolver|Tudo bem|Tudo certo/i)
    await expectNoTechnicalMessages(page)
  })

  test("variações sociais respondem sem workflow ou pending input", async ({ page }) => {
    await openCosHome(page)

    for (const message of ["olá", "bom dia", "tudo bem?", "oi, tudo certo?", "o que você consegue fazer?", "obrigado"]) {
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes("/api/assistant/eme") && response.request().method() === "POST",
      )
      await sendCosMessage(page, message)
      const response = await responsePromise
      const payload = await response.json() as {
        response?: string
        action?: string
        actionStatus?: string
        confirmRequired?: boolean
        metadata?: { workflow?: { pendingInput?: unknown } }
      }

      expect.soft(response.ok()).toBeTruthy()
      expect.soft(payload.response?.trim().length ?? 0).toBeGreaterThan(0)
      expect.soft(payload.action).toBe("general")
      expect.soft(payload.actionStatus).toBe("success")
      expect.soft(payload.confirmRequired).toBeFalsy()
      expect.soft(payload.metadata?.workflow?.pendingInput ?? null).toBeNull()
      await expectNoTechnicalMessages(page)
    }
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
    await sendCosMessage(page, "abrir")

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

  test("PWA mantém conversa e escolhas sem overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openCosHome(page)
    await sendCosMessage(page, "abrir")

    await expect(page.getByRole("button", { name: "Clientes", exact: true }).last()).toBeVisible()
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(hasOverflow).toBe(false)
    const viewportLayout = await page.evaluate(() => ({
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      pageScroll: window.scrollY,
      composerBottom: document.querySelector<HTMLElement>('[data-testid="cos-composer-dock"]')?.getBoundingClientRect().bottom,
    }))
    expect(viewportLayout.pageHeight).toBeLessThanOrEqual(viewportLayout.viewportHeight + 1)
    expect(viewportLayout.pageScroll).toBe(0)
    expect(viewportLayout.composerBottom).toBeLessThanOrEqual(viewportLayout.viewportHeight)
    await expectNoTechnicalMessages(page)
  })
})
