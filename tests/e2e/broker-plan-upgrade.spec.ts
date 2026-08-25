import { expect, test, type Page, type Route } from "@playwright/test"

import { EME_PLANS, getNextEmePlanKey, resolveEmePlanUpgradeTarget } from "@/lib/eme-plans"

type PlanKey = "free" | "pro" | "scale"

const plans = [
  { key: "free", name: "Plano Free", price: "R$ 0", propertyLimit: 5, monthlyAiCredits: 30, initialAiCredits: 30, features: ["core_modules", "assessor_eme"] },
  { key: "pro", name: "Plano EME Pro", price: "R$ 129/mês", propertyLimit: 150, monthlyAiCredits: 500, initialAiCredits: 500, features: ["core_modules", "assessor_eme", "marketplace"] },
  { key: "scale", name: "Plano EME Scale", price: "R$ 389/mês", propertyLimit: 1000, monthlyAiCredits: 2000, initialAiCredits: 2000, features: ["core_modules", "assessor_eme", "marketplace"] },
]

function planSnapshot(currentPlanKey: PlanKey) {
  const currentPlan = plans.find((plan) => plan.key === currentPlanKey)!
  const now = Date.now()

  return {
    currentPlan,
    plans,
    propertyLimits: {
      baseLimit: currentPlan.propertyLimit,
      extraLimit: 0,
      purchasedExtraLimit: 0,
      suspendedExtraLimit: 0,
      isExpansionActive: currentPlanKey !== "free",
      totalLimit: currentPlan.propertyLimit,
      used: 2,
      remaining: currentPlan.propertyLimit - 2,
    },
    credits: {
      balance: currentPlan.monthlyAiCredits,
      usedThisMonth: 0,
      monthlyCredits: currentPlan.monthlyAiCredits,
      extraCredits: 0,
      history: Array.from({ length: 5 }, (_, index) => ({
        id: `credit-${index}`,
        type: "usage",
        amount: -1,
        balanceAfter: 20 - index,
        actionType: "general",
        description: `Movimento IA ${index + 1}`,
        createdAt: new Date(now - index * 60_000).toISOString(),
      })),
    },
    packages: [],
    capacityAddon: null,
    packageHistory: Array.from({ length: 5 }, (_, index) => ({
      id: `property-${index}`,
      packageKey: "property_250",
      packageType: "property",
      quantity: 50,
      price: "R$ 49,00",
      status: "completed",
      createdAt: new Date(now - index * 60_000).toISOString(),
    })),
  }
}

async function setupPlanPage(page: Page, currentPlanKey: PlanKey, checkoutBodies: Array<Record<string, unknown>>) {
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { id: "user-1", name: "Corretor Teste", email: "teste@eme.com", role: "BROKER", accountType: "BROKER_INDEPENDENT", plan: currentPlanKey === "free" ? "NONE" : "BROKER", subscriptionStatus: currentPlanKey === "free" ? "INACTIVE" : "ACTIVE", brokerId: "broker-1", agencyId: null } } }))
  await page.route("**/api/brokers/plan", (route) => route.fulfill({ json: planSnapshot(currentPlanKey) }))
  await page.route("**/api/brokers/me", (route) => route.fulfill({ json: { profile: null } }))
  await page.route("**/api/brokers/subscription", (route) => route.fulfill({ json: { subscription: { planName: `Plano ${currentPlanKey}`, billingPlan: currentPlanKey === "free" ? "NONE" : "BROKER", billingStatus: currentPlanKey === "free" ? "INACTIVE" : "ACTIVE" } } }))
  await page.route("**/api/notifications", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { notifications: [] } })
    return route.fulfill({ json: { notification: {} } })
  })
  await page.route("**/api/stripe/create-checkout", async (route: Route) => {
    checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ json: { url: "#stripe-checkout" } })
  })

  await page.goto("/corretor/plano", { waitUntil: "domcontentloaded" })
  await expect(page.getByTestId("included-plan-features")).toBeVisible({ timeout: 30_000 })
}

test.describe("Plano do corretor", () => {
  test.describe.configure({ timeout: 90_000 })

  test("mantém Marketplace fora do Free e dentro de Pro e Scale", () => {
    expect(EME_PLANS.free.features).not.toContain("marketplace")
    expect(EME_PLANS.pro.features).toContain("marketplace")
    expect(EME_PLANS.scale.features).toContain("marketplace")
  })

  test("resolve somente upgrades válidos na ordem comercial", () => {
    expect(getNextEmePlanKey("free")).toBe("pro")
    expect(getNextEmePlanKey("pro")).toBe("scale")
    expect(getNextEmePlanKey("scale")).toBeNull()
    expect(resolveEmePlanUpgradeTarget("free")).toBe("pro")
    expect(resolveEmePlanUpgradeTarget("pro")).toBe("scale")
    expect(resolveEmePlanUpgradeTarget("scale", "pro")).toBeNull()
    expect(resolveEmePlanUpgradeTarget("pro", "pro")).toBeNull()
  })

  test("Free abre checkout Pro e comunica a ausência do Marketplace", async ({ page }) => {
    const checkoutBodies: Array<Record<string, unknown>> = []
    await setupPlanPage(page, "free", checkoutBodies)

    await expect(page.getByText("Marketplace não incluso", { exact: true })).toBeVisible()
    await expect(page.getByText("Marketplace incluso", { exact: true })).toHaveCount(2)
    await expect(page.getByText("Marketplace não incluso no plano Free", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Fazer upgrade", exact: true }).click()
    await expect.poll(() => checkoutBodies).toEqual([{ plan: "pro" }])
  })

  test("Pro abre checkout Scale e mostra Marketplace no resumo", async ({ page }) => {
    const checkoutBodies: Array<Record<string, unknown>> = []
    await setupPlanPage(page, "pro", checkoutBodies)

    const includedSummary = page.getByTestId("included-plan-features")
    await expect(includedSummary.getByText("Marketplace", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Fazer upgrade", exact: true }).click()
    await expect.poll(() => checkoutBodies).toEqual([{ plan: "scale" }])
  })

  test("capacidade adicional bloqueia Free e usa o fluxo recorrente em Pro", async ({ page }) => {
    const freeCheckoutBodies: Array<Record<string, unknown>> = []
    await setupPlanPage(page, "free", freeCheckoutBodies)
    await expect(page.getByText("Faça upgrade para expandir o limite da sua carteira de imóveis.", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Adicionar capacidade" })).toHaveCount(0)
    expect(freeCheckoutBodies).toEqual([])

    const proCheckoutBodies: Array<Record<string, unknown>> = []
    await setupPlanPage(page, "pro", proCheckoutBodies)
    await page.getByRole("button", { name: "Adicionar capacidade" }).first().click()
    await expect.poll(() => proCheckoutBodies).toEqual([{ packageKey: "property_250" }])
  })

  test("Scale bloqueia plano inferior, leva aos pacotes e compacta os históricos", async ({ page }) => {
    const checkoutBodies: Array<Record<string, unknown>> = []
    await setupPlanPage(page, "scale", checkoutBodies)

    await expect(page.getByRole("button", { name: "Plano máximo ativo", exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Plano inferior", exact: true })).toHaveCount(2)
    await page.getByRole("button", { name: "Quero evoluir meu plano", exact: true }).click()
    await expect(page.locator("#pacotes-extras")).toBeFocused()
    expect(checkoutBodies).toEqual([])

    await expect(page.getByTestId("credit-history-item")).toHaveCount(3)
    await page.getByTestId("credit-history-toggle").click()
    await expect(page.getByTestId("credit-history-item")).toHaveCount(5)
    await expect(page.getByTestId("credit-history-toggle")).toHaveText("Recolher histórico")
    await page.getByTestId("credit-history-toggle").click()
    await expect(page.getByTestId("credit-history-item")).toHaveCount(3)

    await expect(page.getByTestId("property-history-item")).toHaveCount(3)
    await page.getByTestId("property-history-toggle").click()
    await expect(page.getByTestId("property-history-item")).toHaveCount(5)
    await page.getByTestId("property-history-toggle").click()
    await expect(page.getByTestId("property-history-item")).toHaveCount(3)
  })
})
