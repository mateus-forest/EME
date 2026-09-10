import { expect, test } from "@playwright/test"
import type { AdminJourneyOverview } from "../../lib/admin-journey-contract"

// The first navigation may compile the admin bundle in Next dev.
test.setTimeout(90_000)

function fixture(key = "7d"): AdminJourneyOverview {
  return {
    generatedAt: "2026-09-10T18:00:00Z", period: { key: key as "7d", from: "2026-09-04", to: "2026-09-10", start: "2026-09-04T03:00:00Z", end: "2026-09-10T18:00:00Z", timeZone: "America/Sao_Paulo" },
    registrations: { count: 8, state: { status: "available", note: "Contas criadas no banco" } }, subscribers: { count: 3, pending: 1, trial: 1, asOf: "2026-09-10T18:00:00Z", state: { status: "partial", note: "Estimativa local; 1 pendente" } },
    journey: { state: { status: "partial", note: "Coleta iniciada durante o período." }, data: {
      totals: { visitors: 120, sessions: 180, pageViews: 450, signupStarted: 20, signupCompleted: 8, landingViews: 200, marketplaceViews: 90, catalogViews: 32, leads: 12, errors: 6 },
      sources: [{ label: "google", count: 110 }, { label: "example.test", count: 70 }], devices: [{ label: "desktop", count: 100 }, { label: "mobile", count: 80 }],
      funnel: [{ event: "landing_view", count: 100, total: 200 }, { event: "signup_started", count: 20, total: 25 }, { event: "signup_completed", count: 8, total: 8 }, { event: "checkout_started", count: 4, total: 6 }, { event: "checkout_completed", count: 2, total: 2 }],
      modules: [{ label: "cos", count: 70, users: 9 }, { label: "studio", count: 40, users: 4 }], actions: [{ label: "cos_message_sent", count: 35 }],
      commerce: [{ label: "marketplace_view", count: 90 }, { label: "marketplace_search", count: 50 }, { label: "marketplace_result_opened", count: 20 }, { label: "catalog_view", count: 32 }, { label: "catalog_property_opened", count: 15 }, { label: "lead_created", count: 12 }],
      errors: { users: 2, sessions: 4, latest: "2026-09-10T17:23:00Z", codes: [{ label: "HTTP_500", count: 6 }], routes: [{ label: "/api/studio-ia/prepare-property", count: 6 }] },
      routes: [{ label: "/", count: 200, visitors: 100, sessions: 140 }, { label: "/catalogo/:id", count: 100, visitors: 50, sessions: 60 }],
      series: Array.from({ length: 7 }, (_, i) => ({ bucket: `2026-09-${String(i + 4).padStart(2, "0")}T03:00:00Z`, views: i * 20, visitors: i * 7, sessions: i * 10 })),
      quality: { firstReceivedAt: "2026-09-05T12:00:00Z", lastReceivedAt: "2026-09-10T18:00:00Z", missingPageIdentity: 0, unlinkedConversions: 0 },
    } },
  }
}

for (const width of [1440, 390]) test(`overview has separate totals, honest coverage and responsive sections (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  let unavailable = false
  const requested: string[] = []
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user: { id: "admin_fixture", name: "Admin", role: "ADMIN" } } })
    if (url.pathname === "/api/admin/me") return route.fulfill({ json: { profile: { id: "admin_fixture", name: "Admin", email: "", phone: "" } } })
    if (url.pathname === "/api/admin/journey-overview") {
      requested.push(url.searchParams.get("period")!)
      const data = fixture(url.searchParams.get("period")!)
      if (unavailable) { data.journey = { state: { status: "unavailable", note: "Fonte indisponível" }, data: null }; data.subscribers.count = null; data.subscribers.state.status = "unavailable" }
      return route.fulfill({ json: { overview: data } })
    }
    return route.fulfill({ status: 202, json: {} })
  })
  await page.goto("/admin")
  const value = (id: string) => page.getByTestId(`metric-${id}`).getByTestId("metric-value")
  await expect(value("visitors")).toHaveText("120")
  await expect(value("sessions")).toHaveText("180")
  await expect(value("pageViews")).toHaveText("450")
  await expect(value("conversion")).toHaveText("8%")
  await expect(page.getByText("Dados parciais.", { exact: true })).toBeVisible()
  for (const name of ["Aquisição", "Conversão", "Uso do produto", "Marketplace / Catálogo", "Erros e operação", "Rotas mais acessadas"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible()
  await expect(page.getByTestId("funnel-signup_started").getByTestId("funnel-count")).toHaveText("20")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.getByRole("button", { name: "30 dias", exact: true }).click()
  await expect.poll(() => requested.at(-1)).toBe("30d")
  await expect(value("visitors")).toHaveText("120")
  await page.getByRole("button", { name: "Hoje", exact: true }).click()
  await expect.poll(() => requested.at(-1)).toBe("today")
  await expect(value("visitors")).toHaveText("120")
  await page.getByRole("button", { name: "Personalizado", exact: true }).click()
  await page.getByLabel("Data inicial").fill("2026-09-01")
  await page.getByLabel("Data final").fill("2026-09-02")
  await page.getByRole("button", { name: "Aplicar intervalo" }).click()
  await expect.poll(() => requested.at(-1)).toBe("custom")
  await expect(value("visitors")).toHaveText("120")
  unavailable = true
  await page.getByRole("button", { name: "Atualizar visão geral" }).click()
  await expect(value("visitors")).toHaveText("—")
  await expect(value("errors")).toHaveText("—")
  await expect(value("subscribers")).toHaveText("—")
  await expect(value("registrations")).toHaveText("8")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test("late response from previous period cannot replace the selected period", async ({ page }) => {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user: { id: "admin_fixture", role: "ADMIN" } } })
    if (url.pathname === "/api/admin/journey-overview") {
      const period = url.searchParams.get("period")!, data = fixture(period)
      if (period === "7d") await new Promise(resolve => setTimeout(resolve, 1500))
      data.journey.data!.totals.visitors = period === "7d" ? 7 : 30
      return route.fulfill({ json: { overview: data } }).catch(() => {})
    }
    return route.fulfill({ status: 200, json: {} })
  })
  await page.goto("/admin")
  await page.getByRole("button", { name: "30 dias", exact: true }).click()
  await expect(page.getByTestId("metric-visitors").getByTestId("metric-value")).toHaveText("30")
  await page.waitForTimeout(1700)
  await expect(page.getByTestId("metric-visitors").getByTestId("metric-value")).toHaveText("30")
})
