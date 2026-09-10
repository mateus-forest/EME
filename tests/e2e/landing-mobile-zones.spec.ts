import { expect, test } from "@playwright/test"
import assert from "node:assert/strict"
import { createMobileOrbitLayout, mobileOrbitPoint, mobilePlatformContactY } from "@/lib/eme-mobile-orbit-layout"

const widths = [375, 390, 393, 430, 456]
test("cards maiores mantêm separação visual durante a volta completa nas larguras mobile", () => {
  for (const width of [375, 390, 393, 430]) {
    const cardWidth = Math.round(Math.min(116, width * .27))
    const layout = createMobileOrbitLayout(width - 32, 405.11, cardWidth, Math.round(cardWidth * 160 / 118), 222.76)
    for (let angle = 0; angle < 360; angle += .2) {
      const points = Array.from({ length: 6 }, (_, index) => mobileOrbitPoint(angle + 60 * index, layout))
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        // Minkowski sum of the rounded card silhouettes (20px radius), including depth scale.
        const scale = points[i].scale + points[j].scale, radius = 20 * scale
        const dx = Math.max(0, Math.abs(points[i].x - points[j].x) - (layout.cardWidth * scale / 2 - radius))
        const dy = Math.max(0, Math.abs(points[i].y - points[j].y) - (layout.cardHeight * scale / 2 - radius))
        assert(Math.hypot(dx, dy) >= radius, `${width}px: cards ${i}/${j} overlap at ${angle}`)
      }
    }
  }
})
test("COS mantém abertura, Escape e retorno de foco no rodapé e desktop", async ({ page }) => {
  test.setTimeout(90_000)
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    const cta = page.getByRole("button", { name: "Conheça o papel do COS" })
    await cta.click()
    const dialog = page.getByRole("dialog", { name: "COS, o assistente do EME" })
    await expect(dialog).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(cta).toBeFocused()
    if (width === 1440) {
      await expect(page.locator("[data-mobile-orbit-stage]")).toHaveCount(0)
      await expect(page.getByText("Organize clientes e imóveis, prepare materiais e documentos e apresente sua carteira com apoio de IA.", { exact: true })).toBeVisible()
    }
  }
})

for (const width of widths) {
  test(`exclusion zone e continuidade no ciclo completo: ${width}px`, () => {
    for (const height of [270, 360, 480]) {
      const cardWidth = Math.min(116, Math.max(100, width * .27))
      const layout = createMobileOrbitLayout(width - 32, height, cardWidth, cardWidth * 160 / 118)
      expect(layout.centerX).toBe((width - 32) / 2)
      expect(layout.centerY).toBeLessThan(height / 2)
      let previous = mobileOrbitPoint(-.2, layout)
      for (let angle = 0; angle <= 360; angle += .2) {
        const p = mobileOrbitPoint(angle, layout)
        const halfWidth = layout.cardWidth * p.scale / 2
        const halfHeight = layout.cardHeight * p.scale / 2
        const clear = Math.abs(p.x) >= layout.logoWidth * layout.fit / 2 + halfWidth || Math.abs(p.y) >= layout.logoWidth * layout.fit / 5 + halfHeight
        assert(clear, `logo overlap at ${angle}`)
        assert(Math.abs(p.x) + halfWidth < (width - 32) / 2)
        assert(Math.abs(p.y) + halfHeight < height / 2)
        assert(layout.centerY + p.y - halfHeight >= 5)
        assert(layout.centerY + p.y + halfHeight <= height - 5)
        assert(Math.hypot(p.x - previous.x, p.y - previous.y) < 3)
        previous = p
      }
    }
  })

  test(`logo ancorado à plataforma durante resize: ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/")
    await expect(page.locator("[data-mobile-orbit-logo]")).toBeVisible()
    for (const height of [740, 844, 932, 844]) {
      await page.setViewportSize({ width, height })
      await expect.poll(async () => {
        const logo = (await page.locator("[data-mobile-orbit-logo]").boundingBox())!
        const background = (await page.locator('img[src="/images/eme-landing-hero-2026-08-13.webp"]').boundingBox())!
        return Math.abs(logo.y + logo.height - background.y - mobilePlatformContactY(background.width, background.height))
      }).toBeLessThan(1)
      const logo = (await page.locator("[data-mobile-orbit-logo]").boundingBox())!
      const stage = (await page.locator("[data-mobile-orbit-stage]").boundingBox())!
      expect(logo.x + logo.width / 2).toBeCloseTo(stage.x + stage.width / 2, 0)
      expect(logo.y + logo.height / 2).toBeLessThan(stage.y + stage.height / 2)
      expect(stage.height).toBeLessThanOrEqual(460)
    }
  })

  test(`zonas em fluxo, atividade estável e conteúdo íntegro: ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    await page.route("**/api/landing/activity", async (route) => {
      await pending
      await route.fulfill({ json: { metrics: [{ id: "studioMaterials", value: 21, period: "thirtyDays", title: "21 materiais criados nos últimos 30 dias", subtitle: "Conteúdo real produzido no Studio IA." }] } })
    })
    await page.goto("/", { waitUntil: "domcontentloaded" })
    const stage = page.locator("[data-mobile-orbit-stage]")
    await expect(stage).toBeVisible()
    const before = await stage.boundingBox()
    release()
    await expect(page.getByText("21 materiais criados nos últimos 30 dias")).toBeVisible()
    const after = await stage.boundingBox()
    expect(after!.y).toBeCloseTo(before!.y, 0)
    expect(after!.height).toBeCloseTo(before!.height, 0)
    const activity = page.locator("[data-mobile-landing-activity]")
    await expect(activity).toHaveCSS("position", "relative")
    const hero = await page.locator("[data-mobile-hero-zone]").boundingBox()
    const footer = await page.locator("[data-mobile-footer-zone]").boundingBox()
    expect(hero!.y + hero!.height).toBeLessThanOrEqual(after!.y)
    expect(after!.y + after!.height).toBeLessThanOrEqual(footer!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator("main").evaluateAll(elements => elements.every(el => el.scrollWidth <= el.clientWidth))).toBe(true)
    const clipped = await page.locator('[data-module-card="mobile"]').evaluateAll((cards) => cards.some(card => {
      const outer = card.getBoundingClientRect()
      return [...card.querySelectorAll("h3,p,span")].some(child => {
        const r = child.getBoundingClientRect()
        return r.left < outer.left - 1 || r.right > outer.right + 1 || r.top < outer.top - 1 || r.bottom > outer.bottom + 1
      })
    }))
    expect(clipped).toBe(false)
    await expect(page.getByText("Deslize para conhecer", { exact: true })).toHaveCount(0)
    await expect(activity.getByText("Agora no EME", { exact: true })).toBeVisible()
    await expect(activity.getByText("Conteúdo real produzido no Studio IA.", { exact: true })).toBeVisible()

    // Sample rendered hitboxes during real drag input, not only the layout helper.
    await page.evaluate(() => {
      const audit = { running: true, frames: 0, overlaps: 0, overflow: 0 }
      Object.assign(window, { mobileOrbitAudit: audit })
      const sample = () => {
        const logo = document.querySelector("[data-mobile-orbit-logo]")!.getBoundingClientRect()
        const stage = document.querySelector("[data-mobile-orbit-stage]")!.getBoundingClientRect()
        for (const card of document.querySelectorAll('[data-module-card="mobile"]')) {
          const rect = card.getBoundingClientRect()
          if (rect.left < logo.right && rect.right > logo.left && rect.top < logo.bottom && rect.bottom > logo.top) audit.overlaps++
          if (rect.left < stage.left - 1 || rect.right > stage.right + 1 || rect.top < stage.top - 1 || rect.bottom > stage.bottom + 1) audit.overflow++
        }
        audit.frames++
        if (audit.running) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const box = (await stage.boundingBox())!
    // Both directions, including the inertia/spring settling between gestures.
    for (const direction of [1, -1]) {
      for (let gesture = 0; gesture < 12; gesture++) {
        const start = direction === 1 ? .9 : .1
        await page.mouse.move(box.x + box.width * start, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * (1 - start), box.y + box.height / 2, { steps: 8 })
        await page.mouse.up()
        await page.waitForTimeout(100)
      }
    }
    const audit = await page.evaluate(() => {
      const audit = (window as unknown as { mobileOrbitAudit: { running: boolean; frames: number; overlaps: number; overflow: number } }).mobileOrbitAudit
      audit.running = false
      return audit
    })
    expect(audit.frames).toBeGreaterThan(20)
    expect(audit.overlaps).toBe(0)
    expect(audit.overflow).toBe(0)
  })
}
