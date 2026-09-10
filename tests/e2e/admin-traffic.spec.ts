import { expect, test } from "@playwright/test"
import type { AdminTraffic, TrafficSurface } from "../../lib/admin-traffic-contract"

test.setTimeout(90_000)
function fixture(): AdminTraffic {
  return {
    generatedAt: "2026-09-10T18:00:00Z", filters: { period: { key: "7d", from: "2026-09-04", to: "2026-09-10", start: "2026-09-04T03:00:00Z", end: "2026-09-10T18:00:00Z", timeZone: "America/Sao_Paulo" }, surface: "all", route: null },
    state: { status: "partial", note: "O período começou antes da coleta." }, ownersState: { status: "available", note: "Proprietário atual; não é o visitante." },
    data: {
      totals: { views: 450, visitors: 120, sessions: 180, pagesPerSession: 2.5, newVisitors: 70, returningVisitors: 50, entries: 170 },
      series: Array.from({ length: 7 }, (_, i) => ({ bucket: `2026-09-${String(i + 4).padStart(2, "0")}T03:00:00Z`, views: i * 20, visitors: i * 7, sessions: i * 10 })),
      surfaces: [{ label: "landing", views: 200, visitors: 70, sessions: 90, entries: 85, exits: 20 }, { label: "marketplace", views: 100, visitors: 50, sessions: 70, entries: 40, exits: 20 }, { label: "catalog", views: 80, visitors: 30, sessions: 40, entries: 25, exits: 15 }, { label: "portal", views: 50, visitors: 10, sessions: 20, entries: 10, exits: 5 }, { label: "other", views: 20, visitors: 10, sessions: 20, entries: 10, exits: 5 }],
      routes: [{ label: "/", views: 200, visitors: 70, sessions: 90, entries: 85, exits: 20 }, { label: "/imoveis", views: 100, visitors: 80, sessions: 85, entries: 60, exits: 40 }],
      devices: [{ label: "desktop", count: 100 }, { label: "mobile", count: 80 }], acquisition: [{ label: "google/cpc/google.com", source: "google", medium: "cpc", referrer: "google.com", sessions: 110 }, { label: "direct/other/none", source: "direct", medium: "other", referrer: "Não informado", sessions: 70 }],
      marketplace: { views: 90, searches: 50, opened: 45, leads: 8, linkedSearches: 40, convertedSearches: 16, searchRate: 40, unlinkedOpens: 8 },
      catalogs: [{ label: "jardins-prime", views: 30, visitors: 20, sessions: 25, opened: 15, leads: 4, owner: "Corretor Jardins", ownerType: "BROKER" }, { label: "eme-residencial", views: 20, visitors: 10, sessions: 15, opened: 9, leads: 2, owner: "EME Residencial", ownerType: "AGENCY" }],
      catalogTotals: { views: 50, opened: 24, leads: 6 }, quality: { firstReceivedAt: "2026-09-05T12:00:00Z", lastReceivedAt: "2026-09-10T18:00:00Z", missingPageIdentity: 0, missingCatalogId: 0, missingSearchIdentity: 10, routes: 2, catalogs: 2, acquisition: 2 },
    },
  }
}

for (const width of [1440, 390]) test(`traffic supports periods, surface/route drilldown, sorting and honest unavailable states (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  let unavailable = false
  const requested: URL[] = []
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user: { id: "admin_fixture", role: "ADMIN", name: "Admin" } } })
    if (url.pathname === "/api/admin/me") return route.fulfill({ json: { profile: { id: "admin_fixture", name: "Admin", email: "", phone: "" } } })
    if (url.pathname === "/api/admin/journey-traffic") {
      requested.push(url)
      const data = fixture()
      data.filters.surface = url.searchParams.get("surface") as TrafficSurface
      data.filters.route = url.searchParams.get("route")
      if (unavailable) { data.data = null; data.state = { status: "unavailable", note: "Journey indisponível." } }
      return route.fulfill({ json: { traffic: data } })
    }
    return route.fulfill({ status: 202, json: {} }) // No tracking or other database writes in UI fixtures.
  })
  await page.goto("/admin/trafego")
  const value = (id: string) => page.getByTestId(`metric-${id}`).getByTestId("metric-value")
  await expect(value("visitors")).toHaveText("120")
  await expect(value("sessions")).toHaveText("180")
  await expect(value("pageViews")).toHaveText("450")
  await expect(value("pagesPerSession")).toHaveText("2,5")
  await expect(value("newVisitors")).toHaveText("70")
  await expect(value("returningVisitors")).toHaveText("50")
  await expect(page.getByTestId("search-rate")).toHaveText("40%")
  for (const name of ["Evolução do tráfego", "Superfícies", "Rotas mais acessadas", "Marketplace", "Catálogos", "Aquisição", "Dispositivos"]) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible()
  await expect(page.getByText("Indisponível · não capturado", { exact: true })).toBeVisible()
  await expect(page.getByText("Indisponível · não capturada", { exact: true })).toBeVisible()
  const routes = page.getByRole("table", { name: "Rotas", exact: true })
  await expect(routes.locator("tbody tr").first()).toContainText("200")
  await page.getByRole("button", { name: "Ordenar Rotas por Visitantes", exact: true }).click()
  await expect(routes.locator("tbody tr").first()).toContainText("/imoveis")
  await routes.getByRole("button", { name: "/imoveis", exact: true }).click()
  await expect.poll(() => requested.at(-1)?.searchParams.get("route")).toBe("/imoveis")
  await page.getByRole("button", { name: "Remover filtro de rota" }).click()
  for (const surface of ["landing", "marketplace", "catalog", "portal", "all"]) {
    await page.getByLabel("Superfície", { exact: true }).selectOption(surface)
    await expect.poll(() => requested.at(-1)?.searchParams.get("surface")).toBe(surface)
    await expect(value("visitors")).toHaveText("120")
  }
  for (const [key, label] of [["today", "Hoje"], ["30d", "30 dias"], ["7d", "7 dias"]]) {
    await page.getByRole("button", { name: label, exact: true }).click()
    await expect.poll(() => requested.at(-1)?.searchParams.get("period")).toBe(key)
    await expect(value("visitors")).toHaveText("120")
  }
  await page.getByRole("button", { name: "Personalizado", exact: true }).click()
  await page.getByLabel("Data inicial").fill("2026-09-01")
  await page.getByLabel("Data final").fill("2026-09-02")
  await page.getByRole("button", { name: "Aplicar intervalo" }).click()
  await expect.poll(() => requested.at(-1)?.searchParams.get("from")).toBe("2026-09-01")
  await expect(value("visitors")).toHaveText("120")
  await page.getByRole("button", { name: "jardins-prime", exact: true }).click()
  await expect(page.getByRole("region", { name: "Detalhe do catálogo", exact: true })).toContainText("Corretor Jardins")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.screenshot({ path: `.qa-audit-tmp/admin-traffic-fixture-${width}.png`, fullPage: true })
  unavailable = true
  await page.getByRole("button", { name: "Atualizar tráfego" }).click()
  await expect(value("visitors")).toHaveText("—")
  await expect(value("pageViews")).toHaveText("—")
  await expect(value("pagesPerSession")).toHaveText("—")
  await expect(page.getByTestId("search-rate")).toHaveText("—")
  await expect(page.getByText("Fonte indisponível.", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test("a previous period response cannot overwrite the selected traffic filter", async ({ page }) => {
  let release: (() => void) | undefined
  let held = false
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { user: { id: "admin_fixture", role: "ADMIN" } } })
    if (url.pathname === "/api/admin/me") return route.fulfill({ json: { profile: { name: "Admin" } } })
    if (url.pathname === "/api/admin/journey-traffic") {
      const data = fixture()
      if (url.searchParams.get("period") === "7d") { held = true; await new Promise<void>(resolve => { release = resolve }); data.data!.totals.views = 999 }
      return route.fulfill({ json: { traffic: data } }).catch(() => {})
    }
    return route.fulfill({ status: 202, json: {} })
  })
  await page.goto("/admin/trafego")
  await expect.poll(() => held).toBe(true)
  await page.getByRole("button", { name: "Hoje", exact: true }).click()
  await expect(page.getByTestId("metric-pageViews").getByTestId("metric-value")).toHaveText("450")
  release?.()
  await page.getByRole("button", { name: "Únicos", exact: true }).click()
  await expect(page.getByTestId("metric-pageViews").getByTestId("metric-value")).toHaveText("450")
})
