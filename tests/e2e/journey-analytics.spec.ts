import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import ts from "typescript"

type Fact = { eventId: string; eventName: string; sessionId: string; anonymousId: string; userId: string | null; pathname: string; step: string | null; metadata: Record<string, unknown> }

for (const width of [1440, 390]) test(`landing/signup tracks journey without leaking values (${width}px)`, async ({ page }) => {
  const facts: Fact[] = []
  let registerHeaders: Record<string, string> = {}
  await page.setViewportSize({ width, height: 900 })
  // ALL APIs are mocked: no registration, telemetry, device or production DB writes.
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/journey/events") { facts.push(...route.request().postDataJSON().events); return route.fulfill({ status: 202, json: { accepted: true } }) }
    if (path === "/api/auth/register") { registerHeaders = route.request().headers(); return route.fulfill({ status: 409, json: { error: "Email já cadastrado.", code: "EMAIL_ALREADY_REGISTERED" } }) }
    return route.fulfill({ status: 200, json: { user: null, pinAvailable: false, biometricAvailable: false } })
  })
  await page.goto("/?utm_source=google&utm_medium=cpc&email=private@example.test")
  await expect.poll(() => facts.filter(e => e.eventName === "landing_view").length).toBe(1)
  expect(facts.filter(e => e.eventName === "page_view")).toHaveLength(1)
  await page.getByRole("button", { name: /^(Criar conta|Começar agora)$/ }).click()
  const dialog = page.getByRole("dialog", { name: "Criar conta no EME" })
  await expect(dialog).toBeVisible()
  await expect.poll(() => facts.some(e => e.eventName === "signup_started")).toBeTruthy()
  await dialog.getByRole("button", { name: "Criar conta", exact: true }).click()
  await expect.poll(() => facts.some(e => e.eventName === "signup_failed" && e.step === "client_validation")).toBeTruthy()
  await dialog.getByLabel("Nome", { exact: true }).fill("Pessoa privada")
  await dialog.getByLabel("UF do CRECI", { exact: true }).selectOption("SP")
  await dialog.getByLabel("Número do CRECI", { exact: true }).fill("123456")
  await dialog.getByLabel("Email", { exact: true }).fill("private@example.test")
  await dialog.getByLabel("Senha", { exact: true }).fill("SecretPassword123!")
  await dialog.getByLabel("Confirmar senha", { exact: true }).fill("SecretPassword123!")
  await dialog.getByRole("button", { name: "Criar conta", exact: true }).click()
  await expect(dialog.getByText("Email já cadastrado.", { exact: true })).toBeVisible()
  await expect.poll(() => facts.some(e => e.eventName === "signup_step_completed" && e.step === "submitted")).toBeTruthy()
  expect(facts.some(e => e.eventName === "signup_step_completed" && e.step === "identity")).toBeTruthy()
  expect(facts.some(e => e.eventName === "signup_step_completed" && e.step === "credentials")).toBeTruthy()
  expect(registerHeaders["x-eme-correlation-id"]).toBeTruthy()
  expect(facts.find(e => e.step === "submitted")?.sessionId).toBe(facts[0].sessionId)
  expect(facts.filter(e => e.eventName === "signup_completed")).toHaveLength(0)
  expect(JSON.stringify(facts)).not.toMatch(/Pessoa privada|private@example|SecretPassword|123456/)
  expect(facts[0].metadata.utmSource).toBe("google")
})

test("unavailable collector cannot block a signup submission", async ({ page }) => {
  let submitted = false
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/journey/events") return route.abort("failed")
    if (path === "/api/auth/register") { submitted = true; return route.fulfill({ status: 409, json: { error: "Resposta do cadastro preservada." } }) }
    return route.fulfill({ status: 200, json: { user: null } })
  })
  await page.goto("/cadastro/corretor")
  const form = page.locator("form").first()
  await form.locator('input[type="text"]').first().fill("Pessoa de teste")
  await form.locator('input[type="email"]').fill("fixture@example.test")
  for (const input of await form.locator('input[type="password"]').all()) await input.fill("SecretPassword123!")
  await form.locator("select").selectOption("SP")
  await form.locator('input[placeholder*="123456"]').fill("123456")
  await form.locator('button[type="submit"]').click()
  await expect.poll(() => submitted).toBeTruthy()
  await expect(page.getByText("Resposta do cadastro preservada.")).toBeVisible()
})

test("browser bridges zero-result search once; blocked storage and collector never break interactions", async ({ page }) => {
  const facts: Fact[] = []
  await page.route("**/journey-fixture", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body>Journey fixture</body></html>" }))
  await page.route("**/api/**", async route => {
    if (new URL(route.request().url()).pathname === "/api/journey/events") facts.push(...route.request().postDataJSON().events)
    return route.fulfill({ status: 202, json: {} })
  })
  await page.goto("/journey-fixture")
  const compile = (file: string) => ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  await page.evaluate(({ contract, browser, marketplace }) => {
    const modules: Record<string, Record<string, any>> = {}
    const load = (name: string, code: string) => { const exports = {}; new Function("require", "exports", code)((id: string) => modules[id], exports); modules[name] = exports; return exports as Record<string, any> }
    load("@/lib/journey/contract", contract)
    const tracking = load("@/lib/journey/browser", browser)
    const legacy = load("@/lib/marketplace/analytics", marketplace)
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("blocked") } })
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => { throw new Error("blocked") } })
    tracking.installJourneyBrowser()
    legacy.trackMarketplaceEvent({ eventType: "marketplace_search", query: "private address", resultCount: 0, propertyIds: [] })
    legacy.trackMarketplaceEvent({ eventType: "property_view", propertyId: "property_fixture" })
    legacy.trackMarketplaceEvent({ eventType: "property_view", propertyId: "property_fixture" })
    tracking.trackJourney("catalog_view", { catalogId: "catalog-fixture", module: "catalog" })
    tracking.trackJourney("catalog_property_opened", { catalogId: "catalog-fixture", propertyId: "property_fixture", module: "catalog" })
    window.dispatchEvent(new Event("pagehide"))
  }, { contract: compile("lib/journey/contract.ts"), browser: compile("lib/journey/browser.ts"), marketplace: compile("lib/marketplace/analytics.ts") })
  await expect.poll(() => facts.length).toBe(4)
  expect(facts.filter(e => e.eventName === "marketplace_search")).toHaveLength(1)
  expect(facts.find(e => e.eventName === "marketplace_search")?.metadata.resultCount).toBe(0)
  expect(facts.filter(e => e.eventName === "marketplace_result_opened")).toHaveLength(1)
  expect(new Set(facts.map(e => e.sessionId)).size).toBe(1)
  expect(facts.every(e => e.userId === null)).toBeTruthy()
  expect(JSON.stringify(facts)).not.toContain("private address")
})
