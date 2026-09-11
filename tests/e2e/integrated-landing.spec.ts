import { expect, test, type Page } from "@playwright/test"

// Keep browser requests away from real accounts, writes and telemetry.
async function mockApis(page: Page) {
  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === "/api/auth/me") {
      await route.fulfill({ status: 401, json: { error: "Não autenticado." } })
    } else if (pathname === "/api/auth/device") {
      await route.fulfill({ json: { trusted: false } })
    } else if (pathname === "/api/auth/register" || pathname === "/api/auth/login") {
      await route.fulfill({ status: 422, json: { error: "Resposta isolada do teste." } })
    } else {
      await route.fulfill({ json: { success: true, user: null, metrics: [], events: [], data: [] } })
    }
  })
}

const areas = [
  { name: "Carteira", word: "MAIS VENDAS.", features: ["Clientes", "Imóveis"] },
  { name: "Vender", word: "MAIS ALCANCE.", features: ["Marketplace", "Catálogo", "Studio IA"] },
  { name: "Documentos", word: "MAIS VELOCIDADE.", features: ["Propostas", "Contratos"] },
  { name: "Operação", word: "MAIS CONTROLE.", features: ["Compromissos", "Financeiro", "Desempenho"] },
  { name: "COS", word: "MAIS OPORTUNIDADES.", features: ["Ações rápidas", "Consultas", "Saúde da operação"] },
] as const

async function ready(page: Page) {
  const root = page.locator(".eme-integrated-landing")
  await expect(root).toHaveAttribute("data-interactions-ready", "true")
  await expect(root.locator("#hero-title")).toBeVisible()
  return root
}

async function selected(page: Page, index: number) {
  const root = page.locator(".eme-integrated-landing")
  await expect(root.locator('.scene-card[data-slot="active"]')).toHaveAttribute("data-index", String(index))
  await expect(root.locator('.scene-card[aria-hidden="false"]')).toHaveCount(1)
  await expect(root.locator("#result-word")).toHaveText(areas[index].word)
  await expect(root.locator("#scene-label")).toHaveText(areas[index].name)
  await expect(root.locator("#result-count")).toHaveText(`${String(index + 1).padStart(2, "0")} / 05`)
  await expect(root.locator('.area-pills [aria-pressed="true"]')).toHaveText(areas[index].name)
}

test.beforeEach(async ({ page }) => {
  await mockApis(page)
})

for (const width of [1440, 375, 390, 430]) {
  test(`landing mantém composição, assets e acesso ao final em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const root = await ready(page)
    await expect(root.locator(".scene-card")).toHaveCount(5)
    await selected(page, 0)
    // A CSS reset must not erase SVG presentation attributes such as path d.
    expect(await root.locator("#next-result svg").evaluate(element => {
      const box = (element as SVGSVGElement).getBBox()
      return box.width > 0 && box.height > 0
    })).toBe(true)
    await expect.poll(() => root.locator("img").evaluateAll(images =>
      images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
    )).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const active = await root.locator('.scene-card[data-slot="active"]').boundingBox()
    expect(active).not.toBeNull()
    expect(active!.x).toBeGreaterThanOrEqual(0)
    expect(active!.x + active!.width).toBeLessThanOrEqual(width)
    await root.locator(".closing").scrollIntoViewIfNeeded()
    await expect(root.getByRole("link", { name: "Quero fazer parte" })).toBeVisible()
    await root.locator(".footer").scrollIntoViewIfNeeded()
    await expect(root.locator(".footer")).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", process.env.LANDING_EXPECT_INDEX === "true" ? /^index, follow$/ : /noindex.*nofollow/)
  })
}

test("cinco áreas atualizam card, resultado e anúncio acessível por clique real", async ({ page }) => {
  await page.goto("/")
  const root = await ready(page)
  await expect(root).toHaveAttribute("data-motion-engine", "gsap")
  for (let index = 0; index < areas.length; index++) {
    await root.locator(`.area-pills [data-choose="${index}"]`).click()
    await selected(page, index)
    await expect(root.locator("#result-announcement")).toContainText(areas[index].name)
    await expect(root.locator('.scene-card[data-slot="active"]')).toHaveCSS("opacity", "1")
  }
  await expect(root.locator(".result-outgoing")).toHaveCount(0)
})

test("setas e teclado percorrem cinco resultados e voltam ao início", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const root = await ready(page)
  for (let index = 1; index <= 5; index++) {
    await root.getByRole("button", { name: "Mostrar próximo resultado" }).click()
    await selected(page, index % 5)
  }
  await root.getByRole("button", { name: "Mostrar resultado anterior" }).click()
  await selected(page, 4)
  await root.locator('.area-pills [data-choose="4"]').focus()
  await page.keyboard.press("Home")
  await selected(page, 0)
  await expect(root.locator('.area-pills [data-choose="0"]')).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await selected(page, 1)
  await page.keyboard.press("ArrowLeft")
  await selected(page, 0)
  await page.keyboard.press("End")
  await selected(page, 4)
})

test("swipe touch horizontal avança e retorna sem confundir rolagem vertical", async ({ browser, browserName, baseURL }) => {
  test.skip(browserName !== "chromium", "Entrada touch real via CDP disponível neste cenário Chromium.")
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" })
  const page = await context.newPage()
  try {
    await mockApis(page)
    await page.goto("/")
    const root = await ready(page)
    const scene = await root.locator("#results-scene").boundingBox()
    expect(scene).not.toBeNull()
    const session = await context.newCDPSession(page)
    const y = scene!.y + scene!.height * .62
    async function swipe(fromX: number, fromY: number, toX: number, toY: number) {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y: fromY }] })
      for (let step = 1; step <= 8; step++) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + (toX - fromX) * step / 8, y: fromY + (toY - fromY) * step / 8 }] })
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    }
    await swipe(300, y, 100, y)
    await selected(page, 1)
    await swipe(100, y, 300, y)
    await selected(page, 0)
    await swipe(195, y, 195, y - 120)
    await selected(page, 0)
    await session.detach()
  } finally {
    await context.close()
  }
})

test("ecossistema apresenta as cinco frentes e conecta cada ação a um acesso real", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const root = await ready(page)
  for (let index = 0; index < areas.length; index++) {
    await root.locator(`[data-ecosystem="${index}"]`).click()
    await expect(root.locator("#eco-label")).toHaveText(areas[index].name)
    await expect(root.locator("#eco-features li")).toHaveText([...areas[index].features])
    await expect(root.locator('[data-ecosystem][aria-pressed="true"]')).toHaveCount(1)
    await expect(root.locator("#eco-link")).toHaveAttribute("href", index === 1 ? "/imoveis" : "/cadastro")
    await expect(root.locator("#eco-link")).toContainText(index === 1 ? "Explorar o Marketplace" : "Conhecer o EME por dentro")
  }
  await root.locator('[data-ecosystem="0"]').focus()
  await page.keyboard.press("ArrowRight")
  await expect(root.locator("#eco-label")).toHaveText("Vender")
  await expect(root.locator('[data-ecosystem="1"]')).toBeFocused()
})

test("âncoras internas e CTAs conservam destinos nativos sem páginas HTML fictícias", async ({ page }) => {
  // These two header anchors are intentionally desktop-only in the package.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const root = await ready(page)
  await expect(root.locator('.header a[href="/login"]')).toHaveCount(1)
  await expect(root.locator(".decision-cta")).toHaveAttribute("href", "/cadastro")
  await expect(root.getByRole("link", { name: "Quero fazer parte" })).toHaveAttribute("href", "/cadastro")
  expect(await root.locator('a[href$=".html"]').count()).toBe(0)
  await root.getByRole("link", { name: "O que muda", exact: true }).click()
  await expect(page).toHaveURL(/#resultados$/)
  await expect(root.locator("#decision-title")).toBeInViewport()
  await page.goto("/#ecossistema")
  await ready(page)
  await expect(root.locator("#ecosystem-title")).toBeInViewport()
})

test("login e cadastro existentes abrem, alternam e fecham para a nova home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  let root = await ready(page)
  await root.locator('.header a[href="/login"]').click()
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
  root = await ready(page)
  await root.locator(".decision-cta").click()
  await expect(signup).toBeVisible()
  await expect(signup).toHaveAttribute("data-auth-ready", "true")
  await page.keyboard.press("Escape")
  await ready(page)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("")
  await root.locator('.header a[href="/login"]').click()
  await expect(login).toBeVisible()
  await expect(login).toHaveAttribute("data-auth-ready", "true")
  await login.getByRole("link", { name: "Voltar ao início", exact: true }).click()
  await ready(page)
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

test("preferência do sistema reduz movimento sem bloquear navegação dos cards", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const root = await ready(page)
  const toggle = root.locator("#motion-toggle")
  await expect(toggle).toBeDisabled()
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await expect(toggle).toContainText("Movimento reduzido")
  await root.locator('.area-pills [data-choose="3"]').click()
  await selected(page, 3)
  await expect(root.locator(".result-outgoing")).toHaveCount(0)
  const card = root.locator('.scene-card[data-slot="active"]')
  const transform = await card.evaluate(element => getComputedStyle(element).transform)
  await page.waitForTimeout(250)
  expect(await card.evaluate(element => getComputedStyle(element).transform)).toBe(transform)
})

test("controle manual desliga e reativa movimento mantendo o resultado escolhido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  const root = await ready(page)
  await expect(root).toHaveAttribute("data-motion-engine", "gsap")
  const toggle = root.locator("#motion-toggle")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await expect(toggle).toContainText("Ativar movimento")
  await root.locator('.area-pills [data-choose="2"]').click()
  await selected(page, 2)
  await expect(root.locator(".result-outgoing")).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-pressed", "false")
  await expect(toggle).toContainText("Reduzir movimento")
  await selected(page, 2)
})

test("falha no vendor de animação mantém conteúdo e interações funcionais", async ({ page }) => {
  await page.route(/\/(?:gsap|ScrollTrigger)[^/]*\.js(?:\?.*)?$/i, route => route.abort())
  await page.goto("/")
  const root = await ready(page)
  await root.getByRole("button", { name: "Mostrar próximo resultado" }).click()
  await selected(page, 1)
  await root.locator('[data-ecosystem="1"]').click()
  await expect(root.locator("#eco-link")).toHaveAttribute("href", "/imoveis")
  await expect(root.locator("#eco-title")).toBeVisible()
  await root.locator(".decision-cta").click()
  await expect(page.locator('.eme-integrated-auth[data-auth-page="cadastro"]')).toBeVisible()
})

test("refresh, retorno e pageshow repetidos não duplicam o avanço dos cards", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  let root = await ready(page)
  await root.getByRole("button", { name: "Mostrar próximo resultado" }).click()
  await selected(page, 1)
  await page.reload()
  root = await ready(page)
  await selected(page, 0)
  for (let iteration = 0; iteration < 2; iteration++) {
    await root.locator('.header a[href="/login"]').click()
    await expect(page.locator('.eme-integrated-auth[data-auth-page="login"]')).toBeVisible()
    await page.goBack()
    root = await ready(page)
    await page.evaluate(() => {
      for (let count = 0; count < 3; count++) {
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
      }
    })
    // Reset explicitly: browser history may retain the prior carousel position.
    await root.locator('.area-pills [data-choose="0"]').click()
    await root.getByRole("button", { name: "Mostrar próximo resultado" }).click()
    await selected(page, 1)
  }
})

test("vendor atrasado preserva escolhas e controles usados antes da animação", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  let releaseVendor!: () => void
  const gate = new Promise<void>(resolve => { releaseVendor = resolve })
  await page.route("**/landing-2026/vendor/gsap-3.14.2.min.js", async route => {
    await gate
    await route.continue()
  })
  try {
    // A held script may delay window.load; DOM readiness is the relevant gate.
    await page.goto("/", { waitUntil: "domcontentloaded" })
    const root = await ready(page)
    await root.locator("#motion-toggle").click()
    await root.locator('.area-pills [data-choose="3"]').click()
    await selected(page, 3)
    await root.locator('[data-ecosystem="1"]').click()
    releaseVendor()
    await expect(root).toHaveAttribute("data-motion-engine", "gsap")
    await selected(page, 3)
    await expect(root.locator("#motion-toggle")).toHaveAttribute("aria-pressed", "true")
    await expect(root.locator("#eco-label")).toHaveText("Vender")
    await expect(root.locator("#eco-link")).toHaveAttribute("href", "/imoveis")
    await root.locator("#next-result").click()
    await selected(page, 4)
  } finally {
    releaseVendor()
  }
})

test("Marketplace mantém estilo próprio após navegação desde a nova landing", async ({ page }) => {
  // Browser API mocks do not intercept the Marketplace's server-side reads.
  test.skip(process.env.LANDING_MARKETPLACE_FIXTURE !== "true", "Requer servidor local com fixture de inventário vazio.")
  test.setTimeout(90_000)
  const marketplaceStyle = () => page.locator(".marketplace-page").evaluate(element => {
    const style = getComputedStyle(element)
    const heading = element.querySelector("h1")
    return { fontFamily: style.fontFamily, color: style.color, background: style.backgroundColor,
      headingFont: heading ? getComputedStyle(heading).fontFamily : null }
  })
  await page.goto("/imoveis")
  await expect(page.locator(".marketplace-page")).toBeVisible()
  const before = await marketplaceStyle()
  await page.goto("/")
  const root = await ready(page)
  await root.locator('[data-ecosystem="1"]').click()
  await root.locator("#eco-link").click()
  await expect(page).toHaveURL(/\/imoveis$/)
  await expect(page.locator(".marketplace-page")).toBeVisible()
  await expect(page.locator(".eme-integrated-landing")).toHaveCount(0)
  expect(await marketplaceStyle()).toEqual(before)
  expect(await page.evaluate(() => document.documentElement.classList.contains("motion-off"))).toBe(false)
})
