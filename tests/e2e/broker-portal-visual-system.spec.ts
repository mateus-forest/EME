import { expect, test, type Page } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const desktopRoutes = [
  "/corretor",
  "/corretor/historico",
  "/corretor/corretor-m",
  "/corretor/corretor-eme",
  "/corretor/suporte",
  "/corretor/clientes",
  "/corretor/imoveis",
  "/corretor/novo-imovel",
  "/corretor/leads",
  "/corretor/marketplace",
  "/corretor/catalogo",
  "/corretor/studio-ia",
  "/corretor/studio-ia/biblioteca",
  "/corretor/studio-ia/preparar-imovel",
  "/corretor/studio-ia/criar-campanha-instagram",
  "/corretor/studio-ia/criar-video-do-imovel",
  "/corretor/studio-ia/visualizar-projeto",
  "/corretor/studio-ia/atrair-compradores",
  "/corretor/studio-ia/captar-proprietarios",
  "/corretor/studio-ia/vender-este-imovel",
  "/corretor/studio-ia/transformar-obra-em-imovel-pronto",
  "/corretor/documentos",
  "/corretor/documentos/contratos",
  "/corretor/agenda",
  "/corretor/analytics",
  "/corretor/financeiro",
  "/corretor/plano",
  "/corretor/conta",
] as const

const mobileRoutes = [
  "/corretor",
  "/corretor/clientes",
  "/corretor/imoveis",
  "/corretor/novo-imovel",
  "/corretor/marketplace",
  "/corretor/catalogo",
  "/corretor/documentos",
  "/corretor/documentos/contratos",
  "/corretor/agenda",
  "/corretor/analytics",
  "/corretor/financeiro",
  "/corretor/studio-ia",
  "/corretor/studio-ia/biblioteca",
  "/corretor/plano",
  "/corretor/conta",
  "/corretor/historico",
] as const

async function expectBrokerPortalFrame(page: Page) {
  const portal = page.locator(".broker-portal-scope").first()
  await expect(portal).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(150)

  const fontFamily = await portal.evaluate((element) => getComputedStyle(element).fontFamily)
  expect(fontFamily).toContain("EME Broker Geist")

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
}

test.describe("Sistema visual do Portal do Corretor", () => {
  test.describe.configure({ timeout: 360_000 })

  test("mantém o shell compartilhado e sem overflow nas rotas principais", async ({ page }) => {
    await loginAsBroker(page)

    for (const route of desktopRoutes) {
      await test.step(route, async () => {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        await expectBrokerPortalFrame(page)
      })
    }
  })

  test("preserva a experiência compacta no viewport mobile/PWA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginAsBroker(page)

    for (const route of mobileRoutes) {
      await test.step(route, async () => {
        await page.goto(route, { waitUntil: "domcontentloaded" })
        await expectBrokerPortalFrame(page)
      })
    }
  })

  test("mantém o tema do corretor isolado do Marketplace público", async ({ page }) => {
    await page.goto("/imoveis", { waitUntil: "domcontentloaded" })

    await expect(page.locator(".broker-portal-scope")).toHaveCount(0)
  })
})
