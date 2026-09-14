import { expect, test, type Locator, type Page } from "@playwright/test"

// Exercise the real browser adapters, while intercepting every API call and
// protected destination. No account, email, device or database is changed.
const account = {
  id: "visual-auth-test", name: "Corretor de teste", email: "auth-test@example.invalid",
  role: "BROKER", accountType: "BROKER_INDEPENDENT", plan: "NONE",
  subscriptionStatus: "INACTIVE", brokerId: "visual-broker-test", agencyId: null,
}
const trustedDevice = {
  trusted: true,
  device: {
    label: "Dispositivo de teste", browser: "Browser de teste", platform: "desktop",
    biometricEnabled: false, pinConfigured: true, remainingPinAttempts: 5,
    lastAccessAt: null, userName: account.name, emailMasked: "a***@example.invalid",
  },
}

async function mockApis(page: Page) {
  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === "/api/auth/me") {
      await route.fulfill({ status: 401, json: { error: "Não autenticado." } })
    } else if (pathname === "/api/auth/device") {
      await route.fulfill({ json: { trusted: false } })
    } else if (route.request().method() === "POST") {
      await route.fulfill({ status: 422, json: { error: "Resposta isolada do teste." } })
    } else {
      await route.fulfill({ json: { success: true, data: [], user: null } })
    }
  })
  // Successful authentication must request its real destination. Intercept it
  // before the portal's server/client loaders can read any business data.
  await page.route(/^https?:\/\/[^/]+\/(?:corretor|admin)(?:[/?]|$)/, route => route.abort())
}

function auth(page: Page, name: "login" | "cadastro" | "recuperar-senha") {
  return page.locator(`.eme-integrated-auth[data-auth-page="${name}"]`)
}

async function gotoAuth(page: Page, pathname: string) {
  // Do not type into visible SSR markup before its real controller is ready.
  await page.goto(pathname)
  await expect(page.locator(".eme-integrated-auth")).toHaveAttribute("data-auth-ready", "true")
}

async function fillAccount(root: Locator, password = "Teste123!") {
  await root.getByLabel("Nome completo", { exact: true }).fill("Corretor de teste")
  await root.getByLabel("E-mail profissional", { exact: true }).fill("auth-test@example.invalid")
  await root.getByLabel("Crie uma senha", { exact: true }).fill(password)
  await root.getByLabel("Confirmar senha", { exact: true }).fill(password)
}

async function professionalStep(page: Page, password?: string) {
  const root = auth(page, "cadastro")
  await fillAccount(root, password)
  await root.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(root.getByLabel("Número do CRECI", { exact: true })).toBeVisible()
  await expect(root.locator("#form-title")).toBeFocused()
  await expect(root.locator("#form-title")).toBeInViewport()
  return root
}

async function fillProfessional(root: Locator) {
  await root.getByLabel("Número do CRECI", { exact: true }).fill("123456 F")
  await root.getByLabel("UF do CRECI", { exact: true }).selectOption("RS")
}

async function fillLogin(root: Locator) {
  await root.getByLabel("E-mail", { exact: true }).fill("Auth-Test@Example.Invalid")
  await root.getByLabel("Senha", { exact: true }).fill("Teste123!")
}

test.beforeEach(async ({ page }) => {
  await mockApis(page)
})

for (const width of [1440, 375, 390, 430]) {
  test(`login e as duas etapas de cadastro ficam acessíveis sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await gotoAuth(page, "/login")
    const login = auth(page, "login")
    await expect(login.locator("#login-form")).toBeVisible()
    await expect(login.getByRole("button", { name: "Email e senha", exact: true })).toBeVisible()
    await expect(login.getByRole("button", { name: "Entrar com PIN", exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await login.locator('#login-form button[type="submit"]').scrollIntoViewIfNeeded()
    await expect(login.locator('#login-form button[type="submit"]')).toBeInViewport()
    await gotoAuth(page, "/cadastro")
    const signup = auth(page, "cadastro")
    await expect(signup.locator("#signup-form")).toBeVisible()
    await professionalStep(page)
    await signup.getByRole("button", { name: "Criar minha conta", exact: true }).scrollIntoViewIfNeeded()
    await expect(signup.getByRole("button", { name: "Criar minha conta", exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect.poll(() => signup.locator("img").evaluateAll(images => images.every(image =>
      (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
    ))).toBe(true)
    await expect(page.locator(".eme-integrated-landing")).toHaveCount(0)
  })
}

test("cadastro exige campos da conta e CRECI/UF em etapas, sem enviar dados incompletos", async ({ page }) => {
  let submissions = 0
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/auth/register") submissions++ })
  await gotoAuth(page, "/cadastro")
  const root = auth(page, "cadastro")
  for (const label of ["Nome completo", "E-mail profissional", "Crie uma senha", "Confirmar senha"]) {
    await expect(root.getByLabel(label, { exact: true })).toHaveAttribute("required", "")
  }
  await root.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(root.getByLabel("Nome completo", { exact: true })).toBeVisible()
  await expect(root.getByLabel("Número do CRECI", { exact: true })).toBeHidden()
  await professionalStep(page)
  await root.getByRole("button", { name: "Criar minha conta", exact: true }).click()
  await expect(root.getByLabel("Número do CRECI", { exact: true })).toBeVisible()
  await expect(root.getByLabel("Número do CRECI", { exact: true })).toHaveAttribute("required", "")
  await expect(root.getByLabel("UF do CRECI", { exact: true })).toHaveAttribute("required", "")
  await expect(root.getByLabel("UF do CRECI", { exact: true }).locator("option")).toHaveCount(28)
  await root.getByLabel("Número do CRECI", { exact: true }).fill("123456 F")
  await root.getByRole("button", { name: "Criar minha conta", exact: true }).click()
  expect(submissions).toBe(0)
})

test("voltar à conta preserva valores e a divergência de senha impede o envio", async ({ page }) => {
  let submissions = 0
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/auth/register") submissions++ })
  await gotoAuth(page, "/cadastro")
  const root = await professionalStep(page)
  await fillProfessional(root)
  await root.getByRole("button", { name: /Voltar para sua conta$/ }).click()
  await expect(root.getByLabel("Nome completo", { exact: true })).toHaveValue(account.name)
  await expect(root.getByLabel("E-mail profissional", { exact: true })).toHaveValue(account.email)
  await root.getByLabel("Confirmar senha", { exact: true }).fill("OutraSenha123!")
  await root.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(root.getByText("As senhas não coincidem.", { exact: true })).toBeVisible()
  expect(submissions).toBe(0)
  await root.getByLabel("Confirmar senha", { exact: true }).fill("Teste123!")
  await root.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(root.getByLabel("Número do CRECI", { exact: true })).toHaveValue("123456 F")
  await expect(root.getByLabel("UF do CRECI", { exact: true })).toHaveValue("RS")
})

test("cadastro usa payload real normalizado e mostra a recusa do servidor, sem simular sucesso", async ({ page }) => {
  await page.route("**/api/auth/register", route => route.fulfill({ status: 422, json: { error: "CRECI não foi validado pelo serviço." } }))
  await gotoAuth(page, "/cadastro/corretor")
  const root = auth(page, "cadastro")
  // The visual package must not introduce its own minimum password length.
  await fillAccount(root, "Ab123!")
  await root.getByLabel("Nome completo", { exact: true }).fill("  Corretor de teste  ")
  await root.getByLabel("E-mail profissional", { exact: true }).fill("AUTH-TEST@EXAMPLE.INVALID")
  await root.getByRole("button", { name: "Continuar", exact: true }).click()
  await fillProfessional(root)
  const requestPromise = page.waitForRequest("**/api/auth/register")
  await root.getByRole("button", { name: "Criar minha conta", exact: true }).click()
  const request = await requestPromise
  expect(request.method()).toBe("POST")
  expect(request.postDataJSON()).toEqual({ role: "BROKER", name: account.name, email: account.email, creci: "123456 F", creciUf: "RS", password: "Ab123!" })
  await expect(root.getByText("CRECI não foi validado pelo serviço.", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/cadastro\/corretor$/)
  await expect(root.getByRole("button", { name: "Criar minha conta", exact: true })).toBeEnabled()
})

test("cadastro exibe falha de conexão e permite tentar novamente sem perder os campos", async ({ page }) => {
  await page.route("**/api/auth/register", route => route.abort("failed"))
  await gotoAuth(page, "/cadastro")
  const root = await professionalStep(page)
  await fillProfessional(root)
  await root.getByRole("button", { name: "Criar minha conta", exact: true }).click()
  await expect(root.getByText("Não foi possível criar sua conta agora. Verifique sua conexão e tente novamente.", { exact: true })).toBeVisible()
  await expect(root.getByRole("alert")).toBeFocused()
  await expect(root.getByRole("alert")).toBeInViewport()
  await expect(root.getByLabel("Número do CRECI", { exact: true })).toHaveValue("123456 F")
  await expect(root.getByRole("button", { name: "Criar minha conta", exact: true })).toBeEnabled()
})

test("cadastro confirmado pelo endpoint solicita o portal real do corretor", async ({ page }) => {
  await page.route("**/api/auth/register", route => route.fulfill({ json: { user: account } }))
  await gotoAuth(page, "/cadastro")
  const root = await professionalStep(page)
  await fillProfessional(root)
  const destination = page.waitForRequest(request => new URL(request.url()).pathname === "/corretor")
  await root.getByRole("button", { name: "Criar minha conta", exact: true }).click()
  await destination
})

test("Enter conclui as etapas e envia o cadastro completo pelo teclado", async ({ page }) => {
  let submissions = 0
  await page.route("**/api/auth/register", async route => {
    submissions++
    await route.fulfill({ status: 422, json: { error: "Envio por teclado recebido no endpoint." } })
  })
  await gotoAuth(page, "/cadastro")
  const root = auth(page, "cadastro")
  await fillAccount(root)
  await root.getByLabel("Confirmar senha", { exact: true }).press("Enter")
  await expect(root.getByLabel("Número do CRECI", { exact: true })).toBeVisible()
  await fillProfessional(root)
  await root.getByLabel("Número do CRECI", { exact: true }).press("Enter")
  await expect.poll(() => submissions).toBe(1)
  await expect(root.getByText("Envio por teclado recebido no endpoint.", { exact: true })).toBeVisible()
})

test("login usa adaptador real, bloqueia envio duplicado e apresenta erro recebido", async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let submissions = 0
  await page.route("**/api/auth/login", async route => {
    submissions++
    expect(route.request().postDataJSON()).toEqual({ method: "password", email: account.email, password: "Teste123!" })
    await pending
    await route.fulfill({ status: 401, json: { error: "Credenciais inválidas do teste." } })
  })
  try {
    await gotoAuth(page, "/login")
    const root = auth(page, "login")
    await fillLogin(root)
    await root.locator('#login-form button[type="submit"]').click()
    await expect(root.locator('#login-form button[type="submit"]')).toBeDisabled()
    await expect(root.locator('#login-form button[type="submit"]')).toContainText("Entrando")
    await expect.poll(() => submissions).toBe(1)
    release()
    await expect(root.getByText("Credenciais inválidas do teste.", { exact: true })).toBeVisible()
    await expect(root.locator('#login-form button[type="submit"]')).toBeEnabled()
    await expect(page).toHaveURL(/\/login$/)
  } finally { release() }
})

for (const [role, path, next] of [["BROKER", "/corretor/imoveis", true], ["ADMIN", "/admin", false]] as const) {
  test(`login confirmado preserva redirecionamento ${next ? "next" : "por papel"}: ${path}`, async ({ page }) => {
    await page.route("**/api/auth/login", route => route.fulfill({ json: { user: { ...account, role } } }))
    await gotoAuth(page, next ? `/login?next=${encodeURIComponent(path)}` : "/login")
    await page.evaluate(() => localStorage.setItem("eme-user-session", "obsolete-test-only"))
    const root = auth(page, "login")
    await fillLogin(root)
    const destination = page.waitForRequest(request => new URL(request.url()).pathname === path)
    await root.locator('#login-form button[type="submit"]').click()
    await destination
    expect(await page.evaluate(() => localStorage.getItem("eme-user-session"))).toBeNull()
  })
}

for (const previousValues of [false, true]) {
  test(`login envia os valores atuais do autofill, com estado anterior ${previousValues ? "preenchido" : "vazio"}`, async ({ page }) => {
    await page.route("**/api/auth/login", route => route.fulfill({ status: 401, json: { error: "Resposta de validação do teste." } }))
    await gotoAuth(page, "/login")
    const root = auth(page, "login")
    if (previousValues) {
      await root.getByLabel("E-mail", { exact: true }).fill("conta-anterior@example.invalid")
      await root.getByLabel("Senha", { exact: true }).fill("SenhaAnterior")
      await root.getByRole("button", { name: "Mostrar senha", exact: true }).click()
    }
    const credentials = { email: "Autofill@Example.Invalid", password: " Senha com espaços preservados " }
    await root.locator("#login-form").evaluate((form, values) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(form.querySelector('input[type="email"]'), values.email)
      setter.call(form.querySelector('input[autocomplete="current-password"]'), values.password)
    }, credentials)
    await expect(root.getByLabel("E-mail", { exact: true })).toHaveValue(credentials.email)
    await expect(root.getByLabel("Senha", { exact: true })).toHaveValue(credentials.password)
    const pending = page.waitForRequest("**/api/auth/login")
    if (previousValues) await root.getByLabel("Senha", { exact: true }).press("Enter")
    else await root.getByRole("button", { name: "Entrar no EME", exact: true }).click()
    expect((await pending).postDataJSON()).toEqual({ method: "password", email: credentials.email.toLowerCase(), password: credentials.password })
    await expect(root.getByRole("alert")).toHaveText("Resposta de validação do teste.")
    await expect(root.getByLabel("E-mail", { exact: true })).toHaveValue(credentials.email)
    await expect(root.getByLabel("Senha", { exact: true })).toHaveValue(credentials.password)
  })
}

test("PIN conserva seis dígitos e chama o endpoint real do dispositivo confiável", async ({ page }) => {
  await page.route("**/api/auth/device", route => route.fulfill({ json: trustedDevice }))
  await page.route("**/api/auth/device/pin", route => route.fulfill({ status: 401, json: { error: "PIN inválido. Restam 4 tentativas." } }))
  await gotoAuth(page, "/login")
  const root = auth(page, "login")
  await root.getByRole("button", { name: "Entrar com PIN", exact: true }).click()
  await expect(root.getByText(trustedDevice.device.emailMasked, { exact: true })).toBeVisible()
  await expect(root.getByRole("group", { name: "PIN de acesso", exact: true }).locator("input")).toHaveCount(6)
  const submit = root.locator('#login-form button[type="submit"]')
  await expect(submit).toBeDisabled()
  for (let digit = 1; digit <= 6; digit++) await root.getByLabel(`Digito ${digit} do PIN`, { exact: true }).fill(String(digit))
  await expect(submit).toBeEnabled()
  const requestPromise = page.waitForRequest("**/api/auth/device/pin")
  await submit.click()
  expect((await requestPromise).postDataJSON()).toEqual({ pin: "123456" })
  await expect(root.getByText("PIN inválido. Restam 4 tentativas.", { exact: true })).toBeVisible()
  await root.getByRole("button", { name: "Email e senha", exact: true }).click()
  await expect(root.getByLabel("E-mail", { exact: true })).toBeVisible()
})

test("PIN sem vínculo não simula acesso nem chama o endpoint", async ({ page }) => {
  let pinRequests = 0
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/auth/device/pin") pinRequests++ })
  await gotoAuth(page, "/login")
  const root = auth(page, "login")
  await root.getByRole("button", { name: "Entrar com PIN", exact: true }).click()
  await root.locator('#login-form button[type="submit"]').click()
  await expect(root.getByText(/Voce ainda nao configurou um PIN de acesso/)).toBeVisible()
  expect(pinRequests).toBe(0)
})

test("biometria mantém a cadeia options, WebAuthn e verify sem sucesso demonstrativo", async ({ page }) => {
  await page.addInitScript(() => {
    // Browser capability/assertion fixtures only; application code remains real.
    Object.defineProperty(window, "PublicKeyCredential", { configurable: true, value: class {
      static async isUserVerifyingPlatformAuthenticatorAvailable() { return true }
    } })
    Object.defineProperty(navigator, "credentials", { configurable: true, value: { get: async () => ({
      id: "dGVzdA", rawId: new Uint8Array([116, 101, 115, 116]).buffer, type: "public-key",
      authenticatorAttachment: "platform", getClientExtensionResults: () => ({}),
      response: { authenticatorData: new Uint8Array([1]).buffer, clientDataJSON: new Uint8Array([2]).buffer,
        signature: new Uint8Array([3]).buffer, userHandle: null },
    }) } })
  })
  await page.route("**/api/auth/device", route => route.fulfill({ json: { ...trustedDevice, device: { ...trustedDevice.device, biometricEnabled: true } } }))
  await page.route("**/api/auth/device/biometric/options", route => route.fulfill({ json: {
    options: { challenge: "dGVzdA", rpId: "127.0.0.1", timeout: 30_000, userVerification: "required", allowCredentials: [] },
  } }))
  await page.route("**/api/auth/device/biometric/verify", route => route.fulfill({ status: 401, json: { error: "Assinatura biométrica não confirmada pelo servidor." } }))
  await gotoAuth(page, "/login")
  const root = auth(page, "login")
  await root.getByRole("button", { name: "Entrar com PIN", exact: true }).click()
  const button = root.getByRole("button", { name: /Entrar com (Windows Hello|Face ID|biometria)/ })
  await expect(button).toBeVisible()
  const optionsRequest = page.waitForRequest("**/api/auth/device/biometric/options")
  const verifyRequest = page.waitForRequest("**/api/auth/device/biometric/verify")
  await button.click()
  expect((await optionsRequest).method()).toBe("POST")
  expect((await verifyRequest).postDataJSON()).toMatchObject({ id: "dGVzdA", type: "public-key", response: { authenticatorData: "AQ", clientDataJSON: "Ag", signature: "Aw" } })
  await expect(root.getByText("Assinatura biométrica não confirmada pelo servidor.", { exact: true })).toBeVisible()
})

test("visibilidade da senha pode ser alternada sem alterar seu valor", async ({ page }) => {
  await gotoAuth(page, "/login")
  const root = auth(page, "login")
  const password = root.getByLabel("Senha", { exact: true })
  await password.fill("Teste123!")
  await expect(password).toHaveAttribute("type", "password")
  await root.getByRole("button", { name: /Mostrar senha/i }).click()
  await expect(password).toHaveAttribute("type", "text")
  await expect(password).toHaveValue("Teste123!")
  await root.getByRole("button", { name: /Ocultar senha/i }).click()
  await expect(password).toHaveAttribute("type", "password")
})

test("revelar senha não antecipa a etapa de credenciais nem expõe valores à telemetria", async ({ page }) => {
  const events: Array<{ eventName: string; step?: string }> = []
  const batches: string[] = []
  await page.route("**/api/journey/events", async route => {
    const body = route.request().postDataJSON() as { events: Array<{ eventName: string; step?: string }> }
    events.push(...body.events)
    batches.push(route.request().postData() || "")
    await route.fulfill({ json: { accepted: body.events.length } })
  })
  await gotoAuth(page, "/cadastro")
  const root = auth(page, "cadastro")
  await root.getByLabel("Crie uma senha", { exact: true }).fill("SenhaSemVazamento123!")
  await root.getByLabel("Confirmar senha", { exact: true }).fill("OutraSenhaSemVazamento123!")
  await root.getByRole("button", { name: "Mostrar crie uma senha", exact: true }).click()
  await root.getByLabel("Nome completo", { exact: true }).focus()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")))
  await expect.poll(() => events.some(event => event.eventName === "signup_started")).toBe(true)
  const credentials = () => events.filter(event => event.eventName === "signup_step_completed" && event.step === "credentials")
  expect(credentials()).toHaveLength(0)
  await root.getByLabel("Confirmar senha", { exact: true }).fill("SenhaSemVazamento123!")
  await root.getByLabel("Nome completo", { exact: true }).focus()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")))
  await expect.poll(() => credentials().length).toBe(1)
  await root.getByRole("button", { name: "Ocultar crie uma senha", exact: true }).click()
  await root.getByLabel("Confirmar senha", { exact: true }).focus()
  await root.getByLabel("Nome completo", { exact: true }).focus()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")))
  expect(credentials()).toHaveLength(1)
  expect(batches.join("")).not.toContain("SenhaSemVazamento123!")
})

test("recuperação informa a pendência sem postar formulário ou confirmar envio fictício", async ({ page }) => {
  const posts: string[] = []
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/auth/")) posts.push(request.url()) })
  await gotoAuth(page, "/login")
  const login = auth(page, "login")
  await login.getByRole("link", { name: "Esqueci minha senha", exact: true }).click()
  await expect(page).toHaveURL(/\/recuperar-senha$/)
  const recovery = auth(page, "recuperar-senha")
  await expect(recovery.getByRole("status")).toContainText("A recuperação de senha ainda não está disponível.")
  await expect(recovery.locator('input[type="email"]')).toBeDisabled()
  await expect(recovery.locator('#recovery-form button[type="button"]')).toBeDisabled()
  await expect(recovery.locator("form")).toHaveCount(0)
  await expect(recovery).not.toContainText(/enviamos|e-mail enviado|link enviado/i)
  expect(posts).toEqual([])
  const scripts = await page.locator("script[src]").evaluateAll(nodes => nodes.map(node => node.getAttribute("src")))
  expect(scripts.some(src => /(?:^|\/)auth\.js(?:\?|$)/.test(src || ""))).toBe(false)
})

test("voltar à landing preserva identidade, links e navegação sem CSS da autenticação", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const landing = page.locator(".eme-integrated-landing")
  await expect(landing).toHaveAttribute("data-interactions-ready", "true")
  const appearance = () => landing.locator("#hero-title").evaluate(element => {
    const style = getComputedStyle(element)
    return { font: style.fontFamily, size: style.fontSize, color: style.color, weight: style.fontWeight }
  })
  const before = await appearance()
  await landing.locator('.header a[href="/login"]').click()
  await expect(auth(page, "login")).toBeVisible()
  await expect(auth(page, "login")).toHaveAttribute("data-auth-ready", "true")
  await page.keyboard.press("Escape")
  await expect(landing).toHaveAttribute("data-interactions-ready", "true")
  expect(await appearance()).toEqual(before)
  await expect(page.locator(".eme-integrated-auth")).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("")
  await landing.locator("#next-result").click()
  await expect(landing.locator("#scene-label")).toHaveText("Vender")
})

test("rota antiga de imobiliária mantém o encaminhamento para cadastro de corretor", async ({ page }) => {
  await gotoAuth(page, "/cadastro/imobiliaria")
  await expect(page).toHaveURL(/\/cadastro\/corretor$/)
  await expect(auth(page, "cadastro").getByLabel("Nome completo", { exact: true })).toBeVisible()
})
