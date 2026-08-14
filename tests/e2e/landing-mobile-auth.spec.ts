import { expect, test } from "@playwright/test"

test.describe("Landing EME mobile e autenticação", () => {
  test("mantém a órbita mobile contínua por 22 segundos sem saltos ou overflow", async ({ page }) => {
    test.setTimeout(45_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")

    const stage = page.locator("[data-mobile-orbit-stage]")
    await expect(stage).toBeVisible()
    await expect(page.locator('[data-mobile-orbit-card="contratos"]')).toBeVisible()

    const overflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }))
    expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth)
    expect(overflow.bodyWidth).toBeLessThanOrEqual(overflow.viewportWidth)

    const marketplaceButton = page.getByRole("button", { name: "Abrir modulo Marketplace" })
    const marketplaceStart = await marketplaceButton.boundingBox()
    await page.waitForTimeout(2_500)
    const marketplaceEnd = await marketplaceButton.boundingBox()
    expect(marketplaceStart).not.toBeNull()
    expect(marketplaceEnd).not.toBeNull()
    expect(Math.abs(marketplaceEnd!.x - marketplaceStart!.x)).toBeLessThan(1)
    expect(Math.abs(marketplaceEnd!.y - marketplaceStart!.y)).toBeLessThan(5)

    const samples = await page.evaluate(async () => {
      const card = document.querySelector<HTMLElement>('[data-mobile-orbit-card="contratos"]')
      if (!card) throw new Error("Card de contrato não encontrado")

      const values: Array<{ x: number; y: number; opacity: number }> = []
      const startedAt = performance.now()
      while (performance.now() - startedAt < 22_000) {
        const style = getComputedStyle(card)
        const matrix = new DOMMatrixReadOnly(style.transform)
        values.push({ x: matrix.m41, y: matrix.m42, opacity: Number(style.opacity) })
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      return values
    })

    expect(samples.length).toBeGreaterThanOrEqual(100)
    let movingSamples = 0
    let maximumStep = 0
    let maximumOpacityStep = 0

    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1]
      const current = samples[index]
      const distance = Math.hypot(current.x - previous.x, current.y - previous.y)
      if (distance > 0.05) movingSamples += 1
      maximumStep = Math.max(maximumStep, distance)
      maximumOpacityStep = Math.max(maximumOpacityStep, Math.abs(current.opacity - previous.opacity))
    }

    expect(movingSamples).toBeGreaterThan(samples.length * 0.8)
    expect(maximumStep).toBeLessThan(12)
    expect(maximumOpacityStep).toBeLessThan(0.12)

    const compositorStyles = await page.locator('[data-mobile-orbit-card="contratos"]').evaluate((element) => {
      const cardStyle = getComputedStyle(element)
      const glass = element.querySelector<HTMLElement>('[data-mobile-glass="static"]')
      const glassStyle = glass ? getComputedStyle(glass) : null
      return {
        willChange: cardStyle.willChange,
        filter: cardStyle.filter,
        backdropFilter: glassStyle?.backdropFilter ?? "",
      }
    })
    expect(compositorStyles.willChange).toContain("transform")
    expect(compositorStyles.willChange).toContain("opacity")
    expect(compositorStyles.filter).toBe("none")
    expect(compositorStyles.backdropFilter).toBe("none")
  })

  test("abre módulo como painel mobile amplo, mantém scroll interno e fecha", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await expect(page.locator("[data-mobile-orbit-stage]")).toBeVisible()

    await page.locator('[data-mobile-orbit-card="contratos"] button').click({ force: true })
    const dialog = page.getByRole("dialog", { name: "Contratos" })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(700)

    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    expect(dialogBox!.width).toBeGreaterThanOrEqual(370)
    expect(dialogBox!.height).toBeGreaterThanOrEqual(820)
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390)
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(844)

    const scrollArea = dialog.locator("[data-mobile-module-scroll]")
    await expect(scrollArea).toHaveCSS("overflow-y", "auto")
    await scrollArea.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
    await expect(dialog.getByRole("button", { name: "Fechar" })).toBeVisible()

    const bodyLock = await page.evaluate(() => ({
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    }))
    expect(bodyLock).toEqual({ html: "hidden", body: "hidden" })

    await dialog.getByRole("button", { name: "Fechar" }).click()
    await expect(dialog).toBeHidden()
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("")
  })

  test("fecha login e cadastro por X, overlay e ESC sem reabrir", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")

    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    const loginDialog = page.getByRole("dialog", { name: "Entrar no EME" })
    await expect(loginDialog).toBeVisible()

    const loginCloseBox = await loginDialog.getByRole("button", { name: "Fechar" }).boundingBox()
    expect(loginCloseBox).not.toBeNull()
    expect(loginCloseBox!.width).toBeGreaterThanOrEqual(44)
    expect(loginCloseBox!.height).toBeGreaterThanOrEqual(44)
    await loginDialog.getByRole("button", { name: "Fechar" }).click()
    await expect(loginDialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
    await page.waitForTimeout(500)
    await expect(loginDialog).toBeHidden()

    await page.getByRole("button", { name: "Criar conta", exact: true }).click()
    await expect(page).toHaveURL(/\/cadastro$/)
    const signupDialog = page.getByRole("dialog", { name: "Criar conta no EME" })
    await expect(signupDialog).toBeVisible()
    const signupBox = await signupDialog.boundingBox()
    expect(signupBox).not.toBeNull()
    expect(signupBox!.width).toBeGreaterThanOrEqual(370)
    expect(signupBox!.height).toBeLessThanOrEqual(828)
    await expect(signupDialog.locator("[data-auth-scroll]")).toHaveCSS("overflow-y", "auto")
    await signupDialog.getByRole("button", { name: "Fechar" }).click()
    await expect(signupDialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)

    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(loginDialog).toBeVisible()
    await page.getByRole("button", { name: "Fechar autenticação" }).click({ position: { x: 10, y: 400 } })
    await expect(loginDialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)

    await page.setViewportSize({ width: 1440, height: 960 })
    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(loginDialog).toBeVisible()
    const desktopBox = await loginDialog.boundingBox()
    expect(desktopBox).not.toBeNull()
    expect(desktopBox!.width).toBeLessThanOrEqual(420)
    expect(desktopBox!.x).toBeGreaterThan(900)
    await page.keyboard.press("Escape")
    await expect(loginDialog).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
  })

  test("respeita prefers-reduced-motion no mobile", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")

    const card = page.locator('[data-mobile-orbit-card="contratos"]')
    await expect(card).toBeVisible()
    const startTransform = await card.evaluate((element) => getComputedStyle(element).transform)
    await page.waitForTimeout(1_200)
    const endTransform = await card.evaluate((element) => getComputedStyle(element).transform)
    expect(endTransform).toBe(startTransform)
    await expect(page.locator(".eme-marketplace-mobile-float")).toHaveCSS("animation-name", "none")
  })

  test("preserva a composição e o modal tradicionais no desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto("/")

    await expect(page.locator("[data-mobile-orbit-stage]")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Abrir modulo Contratos" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)

    await page.getByRole("button", { name: "Abrir modulo Contratos" }).dispatchEvent("click")
    const dialog = page.getByRole("dialog", { name: "Contratos" })
    await expect(dialog).toBeVisible()
    await expect.poll(async () => (await dialog.boundingBox())?.width ?? 0).toBeGreaterThan(1_200)
    await expect(dialog.getByAltText("Módulo Contratos", { exact: true })).toBeVisible()

    await dialog.getByRole("button", { name: "Fechar" }).click({ force: true })
    await expect(dialog).toBeHidden()
  })
})
