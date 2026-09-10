import { test, expect } from "@playwright/test"
import { resolveAccountBilling } from "../../lib/billing-resolution"

const input = {
  user: { id: "billing-fixture", role: "BROKER", plan: "BROKER", subscriptionStatus: "ACTIVE", stripeCustomerId: "cus_fixture", stripeSubscriptionId: "sub_fixture" },
  planAccount: { planKey: "pro", currentStripeSubscriptionId: "sub_fixture" },
  subscription: { status: "ACTIVE", createdAt: "2026-09-01T00:00:00Z", nextBillingAt: "2026-10-01T00:00:00Z", cancelAtPeriodEnd: false, cancelAt: null },
}
const localResolution = resolveAccountBilling(input)
const details = {
  user: { id: input.user.id, name: "Conta de teste", email: "fixture@example.invalid", role: "BROKER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00Z", lastAccessAt: null },
  account: { plan: "Pro", brokerStatus: "ACTIVE", creci: null, creciStatus: null, creditsBalance: 10, creditsUsed: 0 },
  devices: [], operation: { properties: 0, publishedProperties: 0, clients: 0, proposals: 0, contracts: 0, cosInteractions: 0, studioCampaigns: 0, studioAssets: 0, aiOperations: 0, aiCredits: 0, aiCostBrl: 0 },
  catalog: { slug: null, publishedProperties: 0, views: 0, contacts: 0, shares: 0, status: "Inativo" },
  marketplace: { publishedProperties: 0, views: 0, leads: 0, conversations: 0, profileStatus: "Não configurado" },
  billing: { resolution: localResolution, subscriptionStatus: "Ativa", stripeLinked: true, localSubscriptionStatus: "ACTIVE", recentPurchases: [] },
  clients: [], unavailableBlocks: [],
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`verificação read-only e pendência visível em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const methods: string[] = []
    let checks = 0
    await page.route("**/api/**", async (route) => {
      methods.push(route.request().method())
      const path = new URL(route.request().url()).pathname
      if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: "admin", name: "Admin", role: "ADMIN", accountType: "ADMIN" } } })
      if (path === "/api/admin/users") return route.fulfill({ json: { users: [{ id: input.user.id, name: "Conta de teste", type: "Corretor", email: details.user.email, whatsApp: "", status: "Ativo", createdAt: "01/09/2026", plan: "Pro", billing: localResolution }] } })
      if (path === `/api/admin/users/${input.user.id}`) return route.fulfill({ json: details })
      if (path === `/api/admin/users/${input.user.id}/billing`) {
        checks++
        const issues = [{ code: "UNKNOWN_STRIPE_PRICE", message: "Price price_unknown não mapeado como plano ou adicional." }]
        const checkedAt = new Date().toISOString()
        return route.fulfill({ json: {
          userId: input.user.id, local: { userPlan: "BROKER", accountPlan: "pro", userStatus: "ACTIVE", subscriptionStatus: "ACTIVE", customerId: "cus_fixture", subscriptionId: "sub_fixture", accountSubscriptionId: "sub_fixture" },
          localResolution, resolution: resolveAccountBilling({ ...input, stripeCheck: { status: "incomplete", checkedAt, issues } }),
          evidence: { status: "incomplete", checkedAt, completedAt: checkedAt, customer: { id: "cus_fixture", deleted: false, livemode: false, metadata: {} }, subscriptions: [], items: [], snapshot: null, issues, limitations: [] },
        } })
      }
      return route.fulfill({ json: {} })
    })
    await page.goto("/admin/usuarios")
    await page.getByRole("button", { name: "Detalhes", exact: true }).click()
    const dialog = page.getByRole("dialog")
    const verify = dialog.getByRole("button", { name: "Verificar Stripe", exact: true })
    await expect(verify).toBeVisible()
    expect(checks).toBe(0)
    await verify.click()
    await expect(dialog.getByText("Price price_unknown não mapeado como plano ou adicional.", { exact: true })).toBeVisible()
    await expect(dialog.getByText(/Última verificação:/)).toBeVisible()
    await expect(dialog.getByText("Plano local / acesso registrado", { exact: true })).toBeVisible()
    expect(checks).toBe(1)
    expect(methods.every((method) => method === "GET")).toBe(true)
    const comparison = dialog.getByText("Comparação com Stripe", { exact: true }).locator("../../..")
    expect(await comparison.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `test-results/admin-stripe-readonly-${viewport.width}.png`, fullPage: false })
  })
}
