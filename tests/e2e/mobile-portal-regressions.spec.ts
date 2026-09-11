import { expect, test, type Page } from "@playwright/test"
import { buildProposalHtml } from "@/lib/proposal-template"

test.setTimeout(90_000)

async function publicSession(page: Page) {
  await page.route("**/api/**", route => route.fulfill({ json: { user: null, metrics: [] } }))
}

for (const width of [375, 390, 393, 430]) test(`mobile landing restores scale and Accelerator access at ${width}px`, async ({ page }) => {
  await publicSession(page)
  await page.setViewportSize({ width, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const logo = page.locator("[data-mobile-orbit-logo]")
  await expect(logo).toBeVisible()
  const baseline = { 375: 147.49, 390: 153.94, 393: 155.22, 430: 165.47 }[width]!
  expect((await logo.boundingBox())!.width).toBeGreaterThan(baseline * 1.1)
  expect((await page.locator('[data-mobile-orbit-card="imoveis"]').boundingBox())!.width).toBeGreaterThan(92)
  const accelerator = page.getByRole("button", { name: "Conheça o Acelerador EME", exact: true })
  await expect(accelerator).toBeInViewport()
  await page.screenshot({ path: `.qa-audit-tmp/mobile-regressions-landing-${width}.png` })
  await accelerator.click()
  const screen = page.getByRole("region", { name: "Acelerador EME", exact: true })
  await expect(screen).toBeVisible()
  await expect(screen.getByRole("heading", { name: "Acelerador EME" })).toBeVisible()
  await expect(screen.getByRole("button", { name: "Entrar", exact: true })).toBeVisible()
  await screen.getByRole("button", { name: "Voltar ao EME", exact: true }).click()
  await expect(screen).toHaveCount(0)
  await expect(accelerator).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

async function proposalSession(page: Page, content: string) {
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/me") return route.fulfill({ json: { user: { id: "user_fixture", role: "BROKER", brokerId: "broker_fixture", name: "Corretor Teste" } } })
    if (path === "/api/brokers/me") return route.fulfill({ json: { profile: { id: "user_fixture", brokerId: "broker_fixture", name: "Corretor Teste", email: "", phone: "", accountType: "BROKER_INDEPENDENT" } } })
    if (path === "/api/brokers/documents") return route.fulfill({ json: { documents: [{ id: "proposal_fixture", type: "proposal", title: "Proposta para revisão", status: "generated", content, createdAt: "2026-09-10T12:00:00Z" }] } })
    if (path === "/api/brokers/subscription") return route.fulfill({ json: { subscription: { isUpgraded: true, planName: "Plano EME", status: "Ativo", propertyLimit: 10 } } })
    return route.fulfill({ json: { leads: [], properties: [] } })
  })
}

for (const width of [390, 1440]) for (const html of [true, false]) for (const long of [true, false]) test(`proposal ${html ? "HTML" : "text"}, ${long ? "long" : "short"}, scrolls without trapping actions at ${width}px`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 768 })
  try {
    const page = await context.newPage()
    const conditions = long ? Array.from({ length: 40 }, (_, i) => `Condição ${i + 1}: prazo, pagamento e entrega conforme acordado entre as partes.`).join("\n") : "Condições da proposta curta."
    const end = "Fim integral da proposta"
    const content = html ? long ? buildProposalHtml({ lead: { name: "Cliente Teste" }, property: { id: "property_fixture", title: "Apartamento Teste" }, broker: { name: "Corretor Teste" }, conditions: { notes: conditions } }).replace("</body>", `<p style="margin:20px">${end}</p></body>`) : `<html><body><p>${conditions}</p><p>${end}</p></body></html>` : `${conditions}\n${end}`
    await proposalSession(page, content)
    await page.goto("/corretor/documentos")
    const preview = page.getByTestId(html ? "proposal-html-preview" : "proposal-preview")
    await expect(preview).toBeVisible()
    await preview.scrollIntoViewIfNeeded()
    expect((await preview.boundingBox())!.height).toBeLessThanOrEqual(844 * .6 + 1)
    await expect(html ? page.getByTestId("proposal-preview-viewport") : preview).toHaveCSS("overflow-y", "auto")
    const scrollTop = () => html ? page.frameLocator('iframe[title="Proposta para revisão"]').locator("html").evaluate(() => document.scrollingElement!.scrollTop) : preview.evaluate(el => el.scrollTop)
    const remaining = () => html ? page.frameLocator('iframe[title="Proposta para revisão"]').locator("html").evaluate(() => { const el = document.scrollingElement!; return el.scrollHeight - el.clientHeight - el.scrollTop }) : preview.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)
    if (long) {
      if (width < 768) {
        const cdp = await context.newCDPSession(page)
        // Use actual repeated touch input to the end. Chromium mobile emulation ignores
        // mouseWheel/synthesizeScrollGesture after touch, even on a standalone scroll div.
        for (let gesture = 0; gesture < 80 && await remaining() > 1; gesture++) {
          const box = (await preview.boundingBox())!
          const x = box.x + box.width / 2, start = Math.min(box.y + box.height, 844) - 24, finish = Math.max(box.y, 0) + 24
          const before = await scrollTop()
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: start }] })
          for (let step = 1; step <= 10; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: start - (start - finish) * step / 10 }] })
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
          await expect.poll(scrollTop).toBeGreaterThan(before)
        }
        await cdp.detach()
      } else {
        await preview.hover({ position: { x: 100, y: 100 } })
        const before = await scrollTop()
        await page.mouse.wheel(0, 300)
        await expect.poll(scrollTop).toBeGreaterThan(before)
        await page.mouse.wheel(0, 100000)
      }
      await expect.poll(remaining).toBeLessThan(2)
    }
    if (html) await expect(page.frameLocator('iframe[title="Proposta para revisão"]').getByText(end, { exact: true })).toBeInViewport()
    else await expect(preview).toContainText(end)
    for (const label of ["Abrir", "Baixar PDF", "Copiar texto", "Marcar assinado"]) { const action = page.getByTestId("proposal-preview-card").getByRole("button", { name: label, exact: true }); await action.scrollIntoViewIfNeeded(); await expect(action).toBeInViewport() }
    await expect(page.getByTestId("proposal-preview-card").locator('[data-slot="card-title"]')).toHaveText("Proposta para revisão")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally { await context.close() }
})
