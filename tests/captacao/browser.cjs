// UI checks use a clearly identified provider fixture boundary; auth and writes are real local APIs.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict")
const { chromium } = require("playwright")
const { loader } = require("./load.cjs")
const fixtures = require("./fixtures.cjs")
if (!process.env.EME_CAPTACAO_LOCAL_ACCESS)
  throw Error("Local access file required")
const accessFile = process.env.EME_CAPTACAO_LOCAL_ACCESS,
  qa = path.dirname(accessFile)
const access = JSON.parse(
  fs.readFileSync(accessFile, "utf8").replace(/^\uFEFF/, ""),
)
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env.local"),
  quiet: true,
})
const url = new URL(process.env.DATABASE_URL)
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55449" ||
  url.pathname !== "/captacao_preview"
)
  throw Error("Isolated local DB only")
const load = loader(),
  { prisma } = load("lib/prisma.ts"),
  service = load("lib/captacao/service.ts"),
  gecko = load("lib/captacao/gecko.ts")
;(async () => {
  const broker = await prisma.broker.findFirst({
    where: { user: { email: access.email } },
  })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    locale: "pt-BR",
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  const deviceReady = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/device",
  )
  await page.goto("http://localhost:3116/login")
  await deviceReady
  await page.waitForTimeout(1000)
  await page.locator("#login-email").fill(access.email)
  await page.locator("#login-password").fill(access.password)
  await page.getByRole("button", { name: "Entrar no EME", exact: true }).click()
  await page.waitForURL("**/corretor", {
    timeout: 60000,
    waitUntil: "domcontentloaded",
  })
  await page.goto("http://localhost:3116/corretor/captacao")
  await page
    .getByRole("heading", { name: "Encontre sua próxima captação." })
    .waitFor()
  await page.getByText("Integração não configurada.", { exact: true }).waitFor()
  assert.equal(
    await page
      .getByRole("button", { name: "Buscar imóveis", exact: true })
      .isDisabled(),
    true,
  )
  await page.screenshot({
    path: path.join(qa, "captacao-desktop-real.png"),
    fullPage: true,
  })
  console.log("OK real UI login, sidebar, unconfigured source")
  // No fixture code is exposed to the normal application. Only this test browser intercepts provider reads.
  await page.route("**/api/brokers/captacao", async (route) => {
    if (route.request().method() !== "GET") return route.continue()
    const r = await route.fetch()
    const j = await r.json()
    await route.fulfill({ response: r, json: { ...j, configured: true } })
  })
  const requests = []
  await page.route("**/api/brokers/captacao/search", async (route) => {
    const body = route.request().postDataJSON()
    requests.push(body)
    const results = body.sources.map((source) => {
      if (source === "olx")
        return {
          source,
          status: "error",
          code: "SOURCE_UNAVAILABLE",
          error: "FIXTURE · Fonte indisponível no teste",
        }
      const result = gecko.normalizeResponse(
        source,
        fixtures.response(source, body.page),
        new Date().toISOString(),
        body.filters,
        body.page,
      )
      return {
        ...result,
        source,
        status: "ok",
        items: result.items.map((l) => ({
          ...l,
          receipt: service.receipt(l, broker.id),
        })),
      }
    })
    await route.fulfill({
      json: {
        results,
        items: results.flatMap((r) => r.items || []),
        partial: results.some((r) => r.status === "error"),
        coverage: "FIXTURES IDENTIFICADAS · não é uma consulta real",
      },
    })
  })
  await page.reload()
  await page
    .getByRole("button", { name: "Buscar imóveis", exact: true })
    .waitFor()
  await page.locator("select[name=state]").selectOption("SP")
  await page.locator("input[name=city]").fill("São Paulo")
  await page.locator("input[name=neighborhoods]").fill("Centro")
  await page.getByLabel("OLX", { exact: true }).check()
  assert.equal(requests.length, 0)
  await page
    .getByRole("button", { name: "Buscar imóveis", exact: true })
    .click()
  await page
    .getByText("FIXTURE · Fonte indisponível no teste", { exact: true })
    .waitFor()
  assert.equal(
    await page
      .getByRole("button", { name: "Ver detalhes", exact: true })
      .count(),
    2,
  )
  console.log("OK explicit search, no typing calls, partial sources preserved")
  await page
    .getByRole("button", { name: "Carregar página 2", exact: true })
    .first()
    .click()
  await page.waitForFunction(
    () => document.querySelectorAll("button").length > 0,
  )
  await page
    .getByRole("button", { name: "Ver detalhes", exact: true })
    .nth(2)
    .waitFor()
  assert.equal(requests.at(-1).page, 2)
  console.log("OK provider page 2 and earlier results retained")
  await page
    .getByRole("button", { name: "Ver detalhes", exact: true })
    .first()
    .click()
  await page.getByRole("dialog").waitFor()
  await page
    .getByRole("tab", { name: "Preparar abordagem", exact: true })
    .click()
  await page.getByText("1. Resumo da oportunidade", { exact: true }).waitFor()
  assert.match(
    await page.getByLabel("Revise e edite antes de usar").inputValue(),
    /Você é o proprietário/,
  )
  await page
    .getByLabel("Revise e edite antes de usar")
    .fill("Mensagem editada pelo corretor no teste.")
  await page.keyboard.press("Escape")
  console.log("OK contextual editable outreach and modal keyboard close")
  const existingCapture = await prisma.captacao.findUnique({
    where: {
      brokerId_sourceKey: {
        brokerId: broker.id,
        sourceKey: "chavesnamao:991100",
      },
    },
  })
  if (!existingCapture?.propertyId) {
    await page
      .getByRole("button", { name: "Salvar captação", exact: true })
      .first()
      .click()
    await page
      .getByRole("tab", { name: "Acompanhamento", exact: true })
      .waitFor()
    await page.getByRole("tab", { name: "Acompanhamento", exact: true }).click()
    await page
      .getByLabel("Observação / resumo do contato / evidência da confirmação")
      .fill("FIXTURE · Registro pelo navegador: contato realizado.")
    await page
      .getByRole("button", { name: "Confirmar contato realizado", exact: true })
      .click()
    await page
      .getByText("Etapa atual: Contato realizado", { exact: true })
      .waitFor()
    await page
      .getByLabel("Observação / resumo do contato / evidência da confirmação")
      .fill(
        "FIXTURE · Confirmação revisada com autorização para intermediação.",
      )
    await page.getByLabel("Etapa", { exact: true }).selectOption("CONFIRMED")
    await page
      .getByRole("button", { name: "Confirmar mudança de etapa", exact: true })
      .click()
    await page
      .getByRole("link", {
        name: "Adicionar à carteira com revisão",
        exact: true,
      })
      .click()
    await page
      .getByRole("heading", {
        name: "Revisar inclusão na carteira",
        exact: true,
      })
      .waitFor()
    const contacts = page.getByLabel("Contato associado", { exact: true })
    const firstContact = await contacts
      .locator("option")
      .nth(1)
      .getAttribute("value")
    await contacts.selectOption(firstContact)
    await page.getByRole("checkbox").check()
    await page
      .getByRole("button", {
        name: "Continuar para o cadastro de imóvel",
        exact: true,
      })
      .click()
    await page.getByText("Origem: Captação.", { exact: false }).waitFor()
    assert.equal(await page.locator("textarea").first().inputValue(), "")
    await page
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click()
    await page
      .getByText("Rascunho criado com sucesso", { exact: true })
      .first()
      .waitFor()
    console.log(
      "OK browser save, contact, confirmation, conscious contact selection, current property form, draft persistence",
    )
  } else {
    const existing = await prisma.property.findUnique({
      where: { id: existingCapture.propertyId },
    })
    assert.equal(existing.status, "DRAFT")
    assert.equal(existing.published, false)
    console.log(
      "OK resumed after prior successful UI draft creation; existing local data preserved",
    )
  }
  await page.goto("http://localhost:3116/corretor/captacao")
  await page.getByRole("tab", { name: "Minhas captações", exact: true }).click()
  await page
    .getByRole("button", { name: "Acompanhar", exact: true })
    .first()
    .waitFor()
  await page.screenshot({
    path: path.join(qa, "captacao-desktop-saved.png"),
    fullPage: true,
  })
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    await page.waitForTimeout(350)
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "mobile horizontal overflow " + width,
    )
    await page
      .getByRole("button", { name: "Acompanhar", exact: true })
      .first()
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.waitFor()
    assert.notEqual(await dialog.evaluate(el=>getComputedStyle(el).color), 'rgb(255, 255, 255)', 'modal must retain broker text contrast')
    await page.getByRole("tab", { name: "Acompanhamento", exact: true }).click()
    await dialog.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await page.getByText("Histórico de atividades", { exact: true }).waitFor()
    assert.equal(
      await dialog.evaluate(
        (el) => el.scrollHeight <= el.clientHeight || el.scrollTop > 0,
      ),
      true,
    )
    await page.screenshot({
      path: path.join(qa, `captacao-mobile-${width}.png`),
      fullPage: false,
    })
    await page.keyboard.press("Escape")
    console.log("OK mobile " + width + "px and complete modal scrolling")
  }
  assert.deepEqual(errors, [])
  await page.unrouteAll({ behavior: "wait" })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByText("Integração não configurada.", { exact: true }).waitFor()
  await page.screenshot({
    path: path.join(qa, "captacao-mobile-real.png"),
    fullPage: true,
  })
  console.log(
    "PASS browser checks; fixture boundary removed; normal UI stays unconfigured.",
  )
  await browser.close()
  await prisma.$disconnect()
})().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exitCode = 1
  setTimeout(() => process.exit(1), 500)
})
