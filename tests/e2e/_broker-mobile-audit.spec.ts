import { expect, test, type Page } from "@playwright/test"

const routes = [
  "/corretor",
  "/corretor/clientes",
  "/corretor/imoveis",
  "/corretor/catalogo",
  "/corretor/documentos",
  "/corretor/documentos/contratos",
  "/corretor/agenda",
  "/corretor/financeiro",
  "/corretor/studio-ia",
  "/corretor/conta",
] as const

async function measureOverflow(page: Page, selector = ".broker-portal-scope") {
  return page.evaluate((scopeSelector) => {
    const viewportWidth = document.documentElement.clientWidth
    const scope = document.querySelector(scopeSelector)
    const visibleOverflow = Array.from(scope?.querySelectorAll<HTMLElement>("*") ?? [])
      .filter((element) => {
        const style = getComputedStyle(element)
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false
        const rect = element.getBoundingClientRect()
        if (rect.width <= 1 || rect.height <= 1) return false
        return rect.left < -1 || rect.right > viewportWidth + 1
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return `${element.tagName.toLowerCase()}.${element.className.toString().split(/\s+/).slice(0, 3).join(".")} [${Math.round(rect.left)},${Math.round(rect.right)}]`
      })

    return {
      documentOverflow: document.documentElement.scrollWidth - viewportWidth,
      visibleOverflow,
    }
  }, selector)
}

async function mockBrokerSession(page: Page) {
  const receipt = {
    id: "receipt-1",
    source: "ENTRY",
    description: "Comissão da Sala Comercial com descrição extensa",
    category: "COMMISSION",
    client: { id: "client-1", name: "Cliente de demonstração" },
    property: { id: "property-1", title: "Sala Comercial no Centro" },
    account: { id: "account-1", bank: "Nubank", name: "Conta principal" },
    amount: 7_200_00,
    dueDate: "2026-09-10",
    occurredAt: null,
    status: "EXPECTED",
    notes: null,
    editable: true,
  }
  await page.route("**/api/brokers/financial", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      config: { commissionPercent: 6 },
      summary: { portfolioValue: 799_900_000, receivedThisMonth: 48_500_00, expensesThisMonth: 12_300_00, monthResult: 36_200_00, receivable: 72_000_00, overdue: 7_200_00 },
      portfolio: {
        totalValue: 799_900_000,
        totalProperties: 4,
        activeProperties: 4,
        unpricedProperties: 1,
        forSale: { count: 1, value: 545_000_000, unpricedCount: 0 },
        forRent: { count: 2, value: 247_700_000, unpricedCount: 1 },
        activeRentals: { count: 1, value: 7_200_00, unpricedCount: 0 },
      },
      accounts: {
        items: [{ id: "account-1", bank: "Nubank", name: "Conta principal", type: "DIGITAL", initialBalance: 10_000_00, balance: 46_200_00, notes: null }],
        totalBalance: 46_200_00,
      },
      receipts: [receipt],
      expenses: [{ id: "expense-1", description: "Tráfego e anúncios do imóvel", category: "ADS", client: receipt.client, property: receipt.property, account: receipt.account, amount: 12_300_00, date: "2026-09-05", occurredAt: null, status: "PENDING", notes: null }],
      commissions: [{ id: "commission-1", client: receipt.client, property: receipt.property, operationAmount: 500_000_00, commissionPercent: 6, commissionAmount: 30_000_00, dueDate: "2026-09-10", receivedAt: null, status: "EXPECTED", notes: null }],
      upcoming: { next7Days: [receipt], next30Days: [receipt], overdue: [{ ...receipt, id: "receipt-2", status: "OVERDUE" }] },
      references: { clients: [receipt.client], properties: [{ id: "property-1", title: receipt.property.title, purpose: "RENT", price: 799_900_000 }], documents: [], rentals: [], accounts: [receipt.account] },
    }),
  }))
  await page.route("**/api/brokers/catalog", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      settings: {
        slug: "fabricio",
        displayName: "Fabrício",
        photoUrl: "",
        description: "",
        bannerUrl: "/marketplace/images/hero-residence.png",
        headline: "",
        bio: "",
        experienceYears: 1,
        soldProperties: 24,
        serviceArea: "Vacaria",
        cities: ["Vacaria"],
        priceRange: "R$ 120 mil a R$ 350 mil",
        specialties: [],
        differentials: [],
        videoUrl: "",
        creci: "87193",
        creciUf: "RS",
        creciValidationStatus: "VERIFIED",
        creciVerified: true,
        email: "mobile-audit@eme.test",
        whatsApp: "",
      },
    }),
  }))
  await page.route("**/api/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      user: {
        id: "mobile-audit-user",
        name: "Fabrício",
        email: "mobile-audit@eme.test",
        role: "BROKER",
        accountType: "BROKER_INDEPENDENT",
        plan: "BROKER",
        subscriptionStatus: "ACTIVE",
        brokerId: "mobile-audit-broker",
        agencyId: null,
      },
    }),
  }))
}

test("mantém as rotas operacionais dentro do viewport mobile", async ({ page }) => {
  test.setTimeout(360_000)
  await mockBrokerSession(page)

  const failures: string[] = []
  for (const width of [375, 390, 393, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await expect(page.locator(".broker-portal-scope").first()).toBeVisible({ timeout: 20_000 })
      await page.waitForTimeout(250)

      const result = await measureOverflow(page)

      if (result.documentOverflow > 1 || result.visibleOverflow.length > 0) {
        failures.push(`${width}px ${route}: doc=${result.documentOverflow}; ${result.visibleOverflow.join(" | ")}`)
      }

      if (route === "/corretor/financeiro") {
        for (const tab of ["Recebimentos", "Despesas", "Comissões", "Contas"]) {
          await page.getByRole("tab", { name: tab, exact: true }).click()
          await page.waitForTimeout(50)
          const tabResult = await measureOverflow(page)
          if (tabResult.documentOverflow > 1 || tabResult.visibleOverflow.length > 0) {
            failures.push(`${width}px ${route} [${tab}]: doc=${tabResult.documentOverflow}; ${tabResult.visibleOverflow.join(" | ")}`)
          }
        }

        await page.getByRole("button", { name: "Novo lançamento", exact: true }).click()
        const dialog = page.locator('[data-slot="dialog-content"]')
        await expect(dialog).toBeVisible()
        const dialogFits = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return rect.left >= 11 && rect.right <= document.documentElement.clientWidth - 11 && element.scrollWidth <= element.clientWidth + 1
        })
        if (!dialogFits) failures.push(`${width}px ${route} [modal]: fora da área útil`)
        await page.keyboard.press("Escape")
      }

      if (route === "/corretor/catalogo") {
        for (const name of ["Trocar banner", "Remover"]) {
          const button = page.getByRole("button", { name, exact: true }).first()
          await expect(button).toBeVisible()
          const fits = await button.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            return rect.left >= 0 && rect.right <= document.documentElement.clientWidth
          })
          if (!fits) failures.push(`${width}px ${route} [${name}]: fora da área útil`)
        }
      }

      if (route === "/corretor/conta") {
        for (const tab of ["Segurança", "Faturamento"]) {
          await page.getByRole("tab", { name: tab, exact: true }).click()
          await page.waitForTimeout(50)
          const tabResult = await measureOverflow(page)
          if (tabResult.documentOverflow > 1 || tabResult.visibleOverflow.length > 0) {
            failures.push(`${width}px ${route} [${tab}]: doc=${tabResult.documentOverflow}; ${tabResult.visibleOverflow.join(" | ")}`)
          }
        }
      }

      if (route === "/corretor/clientes") {
        await page.getByRole("button", { name: "Novo cliente", exact: true }).click()
        const dialog = page.locator('[data-slot="dialog-content"]')
        await expect(dialog).toBeVisible()
        const dialogFits = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return rect.left >= 11 && rect.right <= document.documentElement.clientWidth - 11 && element.scrollWidth <= element.clientWidth + 1
        })
        if (!dialogFits) failures.push(`${width}px ${route} [modal]: fora da área útil`)
        await page.keyboard.press("Escape")
      }
    }
  }

  expect(failures, failures.join("\n")).toEqual([])
})

test("preserva a geometria das rotas operacionais no desktop", async ({ page }) => {
  test.setTimeout(240_000)
  await mockBrokerSession(page)
  await page.setViewportSize({ width: 1440, height: 960 })

  const failures: string[] = []
  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" })
    await expect(page.locator(".broker-portal-scope").first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(150)
    const result = await measureOverflow(page)
    if (result.documentOverflow > 1 || result.visibleOverflow.length > 0) {
      failures.push(`${route}: doc=${result.documentOverflow}; ${result.visibleOverflow.join(" | ")}`)
    }
  }

  expect(failures, failures.join("\n")).toEqual([])
})
