import { expect, test } from "@playwright/test"

import {
  buildLandingActivityMetrics,
  type LandingActivityCounts,
  type LandingActivityMetric,
} from "@/lib/landing-activity"

function emptyCounts(): LandingActivityCounts {
  return {
    properties: { today: 0, sevenDays: 0, thirtyDays: 0, total: 0 },
    proposals: { today: 0, sevenDays: 0, thirtyDays: 0, total: 0 },
    studioMaterials: { today: 0, sevenDays: 0, thirtyDays: 0, total: 0 },
    cities: { today: 0, sevenDays: 0, thirtyDays: 0, total: 0 },
  }
}

function testMetrics(): LandingActivityMetric[] {
  return [
    {
      id: "properties",
      value: 12,
      period: "today",
      title: "12 imóveis publicados hoje",
      subtitle: "Direto da carteira dos corretores.",
    },
    {
      id: "proposals",
      value: 8,
      period: "sevenDays",
      title: "8 propostas criadas nos últimos 7 dias",
      subtitle: "Negociações ganhando forma no EME.",
    },
  ]
}

test.describe("atividade real da landing", () => {
  test.describe.configure({ timeout: 90_000 })

  test("seleciona hoje, 7 dias, 30 dias e total sem misturar períodos", () => {
    const counts = emptyCounts()
    counts.properties = { today: 12, sevenDays: 25, thirtyDays: 40, total: 80 }
    counts.proposals = { today: 0, sevenDays: 8, thirtyDays: 18, total: 50 }
    counts.studioMaterials = { today: 0, sevenDays: 0, thirtyDays: 21, total: 70 }
    counts.cities = { today: 0, sevenDays: 0, thirtyDays: 0, total: 35 }

    const metrics = buildLandingActivityMetrics(counts)

    expect(metrics.map(({ id, period, value }) => ({ id, period, value }))).toEqual([
      { id: "properties", period: "today", value: 12 },
      { id: "proposals", period: "sevenDays", value: 8 },
      { id: "studioMaterials", period: "thirtyDays", value: 21 },
      { id: "cities", period: "total", value: 35 },
    ])
    expect(metrics.map((metric) => metric.title)).toEqual([
      "12 imóveis publicados hoje",
      "8 propostas criadas nos últimos 7 dias",
      "21 materiais criados nos últimos 30 dias",
      "35 cidades com imóveis disponíveis agora",
    ])
  })

  test("omite indicadores sem qualquer dado real", () => {
    const counts = emptyCounts()
    counts.proposals.total = 1

    expect(buildLandingActivityMetrics(counts)).toEqual([
      expect.objectContaining({
        id: "proposals",
        period: "total",
        value: 1,
        title: "1 proposta criada no EME",
      }),
    ])
    expect(buildLandingActivityMetrics(emptyCounts())).toEqual([])
  })

  test("faz rotação e permite escolher um indicador", async ({ page }) => {
    await page.route("**/api/landing/activity", (route) =>
      route.fulfill({ json: { metrics: testMetrics(), generatedAt: new Date().toISOString() } }),
    )

    await page.goto("/")
    const activity = page.getByTestId("landing-activity")
    await expect(activity).toBeVisible({ timeout: 20_000 })
    await expect(activity.getByText("12 imóveis publicados hoje")).toBeVisible({ timeout: 20_000 })

    await expect(activity).toHaveAttribute("data-active-metric", "proposals", { timeout: 8_000 })
    await activity.getByRole("button", { name: "Mostrar indicador 1 de 2" }).click()
    await expect(activity).toHaveAttribute("data-active-metric", "properties")
  })

  test("mantém o indicador estável com reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.route("**/api/landing/activity", (route) =>
      route.fulfill({ json: { metrics: testMetrics(), generatedAt: new Date().toISOString() } }),
    )

    await page.goto("/")
    const activity = page.getByTestId("landing-activity")
    await expect(activity.getByText("12 imóveis publicados hoje")).toBeVisible()
    await page.waitForTimeout(5_800)
    await expect(activity.getByText("12 imóveis publicados hoje")).toBeVisible()
  })

  test("usa a composição compacta sem overflow no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route("**/api/landing/activity", (route) =>
      route.fulfill({ json: { metrics: testMetrics(), generatedAt: new Date().toISOString() } }),
    )

    await page.goto("/")
    await expect(page.getByTestId("landing-activity")).toBeVisible()
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(hasHorizontalOverflow).toBe(false)
  })
})
