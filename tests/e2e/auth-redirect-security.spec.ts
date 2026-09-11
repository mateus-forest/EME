import { expect, test, type Page } from "@playwright/test"

// Isolated browser/component contract tests: login/device APIs are intercepted
// and every post-login destination is aborted before portal loaders execute.
// They verify real UI/router/proxy behavior, not real credential acceptance.
const account = {
  id: "redirect-security-test", name: "Corretor de teste", email: "redirect-test@example.invalid",
  role: "BROKER", accountType: "BROKER_INDEPENDENT", plan: "NONE",
  subscriptionStatus: "INACTIVE", brokerId: "redirect-broker-test", agencyId: null,
}

async function isolateApisAndDestinations(page: Page) {
  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === "/api/auth/me") {
      await route.fulfill({ status: 401, json: { error: "Não autenticado." } })
    } else if (pathname === "/api/auth/device") {
      await route.fulfill({ json: { trusted: false } })
    } else if (route.request().method() === "POST") {
      await route.fulfill({ status: 422, json: { error: "API isolada pelo teste." } })
    } else {
      await route.fulfill({ json: { success: true, data: [], user: null } })
    }
  })
  await page.route(/^https?:\/\/[^/]+\/(?:corretor|admin|dashboard|corporativo|imobiliaria|imoveis|catalogo)(?:[/?]|$)/, route => route.abort())
  await page.route("https://external-redirect.example.invalid/**", route => route.abort())
  await page.route("http://external-redirect.example.invalid/**", route => route.abort())
}

async function gotoLogin(page: Page, pathname: string) {
  const response = await page.goto(pathname)
  await expect(page.locator('.eme-integrated-auth[data-auth-page="login"]')).toHaveAttribute("data-auth-ready", "true")
  return response
}

async function submitLoginAndExpectDestination(page: Page, pathname: string, expectedQuery?: Record<string, string>) {
  const root = page.locator('.eme-integrated-auth[data-auth-page="login"]')
  await root.getByLabel("E-mail", { exact: true }).fill(account.email)
  await root.getByLabel("Senha", { exact: true }).fill("Password-Only-In-Isolated-Test!")
  const destination = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.origin === new URL(page.url()).origin && url.pathname === pathname &&
      Object.entries(expectedQuery ?? {}).every(([key, value]) => url.searchParams.get(key) === value)
  })
  await root.locator('#login-form button[type="submit"]').click()
  const request = await destination
  expect(new URL(request.url()).pathname).toBe(pathname)
}

test.beforeEach(async ({ page }) => {
  await isolateApisAndDestinations(page)
})

const invalidQueries = [
  { name: "absolute external URL", query: `next=${encodeURIComponent("https://external-redirect.example.invalid/steal")}` },
  { name: "protocol-relative URL", query: `next=${encodeURIComponent("//external-redirect.example.invalid/steal")}` },
  { name: "ambiguous duplicate next", query: `next=${encodeURIComponent("/corretor/imoveis")}&next=${encodeURIComponent("//external-redirect.example.invalid/steal")}` },
] as const

for (const { name, query } of invalidQueries) {
  test(`server removes ${name} before rendering login and preserves other query parameters`, async ({ page }) => {
    const externalRequests: string[] = []
    page.on("request", request => {
      if (new URL(request.url()).hostname === "external-redirect.example.invalid") externalRequests.push(request.url())
    })
    const response = await gotoLogin(page, `/login?${query}&source=security-review`)
    const finalUrl = new URL(page.url())
    expect(finalUrl.pathname).toBe("/login")
    expect(finalUrl.searchParams.has("next")).toBe(false)
    expect(finalUrl.searchParams.get("source")).toBe("security-review")

    // A redirect chain proves sanitization happened on the server, before the
    // client could render or alter history. No API success is needed for this.
    const originalRequest = response?.request().redirectedFrom()
    expect(originalRequest).not.toBeNull()
    const originalResponse = await originalRequest?.response()
    expect(originalResponse?.status()).toBe(307)
    const location = originalResponse?.headers()["location"]
    expect(location).toBeTruthy()
    expect(new URL(location!, page.url()).searchParams.has("next")).toBe(false)
    expect(externalRequests).toEqual([])
  })
}

const legitimateLogins = [
  { name: "BROKER legitimate nested destination", role: "BROKER", next: "/corretor/imoveis?origem=login", destination: "/corretor/imoveis", query: { origem: "login" } },
  { name: "BROKER default destination", role: "BROKER", next: undefined, destination: "/corretor" },
  { name: "existing ADMIN default destination", role: "ADMIN", next: undefined, destination: "/admin" },
  { name: "BROKER cannot use an ADMIN destination", role: "BROKER", next: "/admin/usuarios", destination: "/corretor" },
  { name: "existing ADMIN cannot use a BROKER destination", role: "ADMIN", next: "/corretor/imoveis", destination: "/admin" },
] as const

for (const scenario of legitimateLogins) {
  test(`isolated successful login: ${scenario.name}`, async ({ page }) => {
    let logins = 0
    await page.route("**/api/auth/login", async route => {
      logins++
      expect(route.request().postDataJSON()).toEqual({ method: "password", email: account.email, password: "Password-Only-In-Isolated-Test!" })
      await route.fulfill({ json: { user: { ...account, role: scenario.role } } })
    })
    await gotoLogin(page, scenario.next ? `/login?next=${encodeURIComponent(scenario.next)}` : "/login")
    if (scenario.next) expect(new URL(page.url()).searchParams.get("next")).toBe(scenario.next)
    await submitLoginAndExpectDestination(page, scenario.destination, "query" in scenario ? scenario.query : undefined)
    expect(logins).toBe(1)
  })
}

for (const { name, query } of invalidQueries) {
  test(`client independently rejects ${name} injected with history after server render`, async ({ page }) => {
    await page.route("**/api/auth/login", route => route.fulfill({ json: { user: account } }))
    await gotoLogin(page, `/login?next=${encodeURIComponent("/corretor/imoveis")}`)
    const documentsAfterRender: string[] = []
    const externalRequests: string[] = []
    page.on("request", request => {
      if (request.isNavigationRequest()) documentsAfterRender.push(request.url())
      if (new URL(request.url()).hostname === "external-redirect.example.invalid") externalRequests.push(request.url())
    })
    // Native history integrates with Next's useSearchParams. This deliberately
    // changes next without another server request, exercising the client guard.
    await page.evaluate(search => window.history.replaceState(null, "", `/login?${search}`), query)
    await expect(page).toHaveURL(new RegExp(`/login\\?${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`))
    expect(documentsAfterRender).toEqual([])
    await submitLoginAndExpectDestination(page, "/corretor")
    expect(externalRequests).toEqual([])
  })
}
