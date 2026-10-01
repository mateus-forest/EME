import { expect, test } from "@playwright/test"

// Public presentation tests only. APIs are intercepted: no accounts, writes or analytics.
const groups = [
  ["Carteira", [["Clientes", "/corretor/clientes"], ["Imóveis", "/corretor/imoveis"], ["Captação", "/corretor/captacao"]]],
  ["Vender", [["Marketplace", "/corretor/marketplace"], ["Catálogo", "/corretor/catalogo"], ["Studio IA", "/corretor/studio-ia"]]],
  ["COS", [["COS", "/corretor"]]],
  ["Documentos", [["Propostas", "/corretor/documentos"], ["Contratos", "/corretor/documentos/contratos"]]],
  ["Operação", [["Compromissos", "/corretor/agenda"], ["Financeiro", "/corretor/financeiro"], ["Desempenho", "/corretor/analytics"], ["Parceiros EME", "/corretor/parceiros"]]],
] as const

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Local preview only")
  await page.route("**/api/**", route => route.fulfill({ status: 401, json: { error: "Teste de interface isolado" } }))
})

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`office navigation, keyboard and layout at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A estrutura de uma imobiliária.")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await page.locator('img[src*="office-ecosystem"]').evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await expect(page.getByRole("navigation").getByRole("link", { name: "Planos" })).toHaveCount(0)
    await expect(page.getByRole("navigation").getByRole("link", { name: "Marketplace" })).toHaveAttribute("href", "/imoveis")
    await expect(page.getByRole("navigation").getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login")
    await expect(page.getByRole("navigation").getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro")
    const markers = page.locator('[aria-label="Setores do escritório"] button')
    await expect(markers).toHaveCount(5)
    const boxes = await markers.evaluateAll(nodes => nodes.map(n => { const b=n.getBoundingClientRect();return {x:b.x,y:b.y,r:b.right,b:b.bottom,h:b.height} }))
    for (const [i, a] of boxes.entries()) {
      expect(a.x).toBeGreaterThanOrEqual(0); expect(a.r).toBeLessThanOrEqual(width); expect(a.h).toBeGreaterThanOrEqual(44)
      for (const b of boxes.slice(i+1)) expect(a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y).toBe(false)
    }
    for (const [group, items] of groups) {
      const trigger = page.getByRole("button", { name: group, exact: true }).first()
      await trigger.focus(); await page.keyboard.press("Enter")
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole("heading", { name: group, exact: true, level: 2 })).toBeVisible()
      for (const [name, route] of items) {
        await dialog.getByRole("button", { name, exact: true }).click()
        await expect(dialog.getByRole("heading", { name, exact: true, level: 3 })).toBeVisible()
        await expect(dialog.getByRole("link", { name: `Acessar ${name}` })).toHaveAttribute("href", `/login?next=${encodeURIComponent(route)}`)
      }
      expect(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true)
      for (let i=0;i<12;i++) { await page.keyboard.press("Tab");expect(await dialog.evaluate(n => n.contains(document.activeElement))).toBe(true) }
      await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused()
    }
    await page.screenshot({ path: `.qa-audit-tmp/office-landing-20261001/landing-${width}.png`, fullPage: true })
    await page.getByRole("button", { name: "Operação", exact: true }).first().click()
    await page.screenshot({ path: `.qa-audit-tmp/office-landing-20261001/dialog-${width}.png` })
    await page.getByRole("button", { name: "Fechar", exact: true }).click()
    expect(errors).toEqual([])
  })
}

test("access pages remain reachable and preview stays non-indexable", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
  await page.getByRole("navigation").getByRole("link", { name: "Entrar" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('input[type="password"]').first()).toBeVisible()
  await page.goto("/")
  await page.getByRole("navigation").getByRole("link", { name: "Criar conta" }).click()
  await expect(page).toHaveURL(/\/cadastro$/)
  await expect(page.locator('input[type="email"]').first()).toBeVisible()
})
test("cadastro preserva obrigatoriedade e validação sem criar usuário", async ({ page }) => {
  let submissions = 0
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/auth/register") submissions++
  })
  await page.goto("/cadastro")
  const signup = page.locator('.eme-integrated-auth[data-auth-page="cadastro"]')
  await expect(signup).toBeVisible()
  await expect(signup).toHaveAttribute("data-auth-ready", "true")
  await signup.getByRole("button", { name: "Continuar", exact: true }).click()
  expect(await signup.locator("form").evaluate(element => (element as HTMLFormElement).checkValidity())).toBe(false)
  await signup.getByLabel("Nome completo", { exact: true }).fill("Visitante de teste")
  await signup.getByLabel("E-mail profissional", { exact: true }).fill("landing-test@example.invalid")
  await signup.getByLabel("Crie uma senha", { exact: true }).fill("ApenasTeste123!")
  await signup.getByLabel("Confirmar senha", { exact: true }).fill("OutraSenha123!")
  await signup.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(signup.getByText("As senhas não coincidem.", { exact: true })).toBeVisible()
  expect(submissions).toBe(0)
})


test("login e cadastro existentes abrem, alternam e fecham para a nova home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  const root = page.locator("main")
  await page.getByRole("navigation").getByRole("link", { name: "Entrar" }).click()
  await expect(page).toHaveURL(/\/login$/)
  const login = page.locator('.eme-integrated-auth[data-auth-page="login"]')
  await expect(login).toBeVisible()
  await expect(login).toHaveAttribute("data-auth-ready", "true")
  await expect(login.getByRole("button", { name: "Email e senha", exact: true })).toBeVisible()
  await expect(login.getByRole("button", { name: "Entrar com PIN", exact: true })).toBeVisible()
  await login.locator('.mode-switch a[href="/cadastro"]').click()
  await expect(page).toHaveURL(/\/cadastro$/)
  const signup = page.locator('.eme-integrated-auth[data-auth-page="cadastro"]')
  await expect(signup).toBeVisible()
  await expect(signup).toHaveAttribute("data-auth-ready", "true")
  await expect(signup.getByLabel("Nome completo")).toBeVisible()
  await signup.getByRole("link", { name: "Voltar ao início", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(root).toBeVisible()
  await page.getByRole("link", { name: "Criar minha conta", exact: true }).click()
  await expect(signup).toBeVisible()
  await expect(signup).toHaveAttribute("data-auth-ready", "true")
  await page.keyboard.press("Escape")
  await expect(root).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("")
  await page.getByRole("navigation").getByRole("link", { name: "Entrar" }).click()
  await expect(login).toBeVisible()
  await expect(login).toHaveAttribute("data-auth-ready", "true")
  await login.getByRole("link", { name: "Voltar ao início", exact: true }).click()
  await expect(root).toBeVisible()
})
