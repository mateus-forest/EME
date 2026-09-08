import { expect, test } from "@playwright/test"

// Scoped to the mobile platform finish; legacy composition coverage is separate.

test("retira o apoio apenas do mobile e respeita reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const support = page.getByText("Organize clientes e imóveis, prepare materiais e documentos e apresente sua carteira com apoio de IA.", { exact: true })
  await expect(page.locator("[data-mobile-orbit-logo]")).toBeVisible()
  await expect(support).toHaveCount(0)
  const trail = page.locator("svg[class*=orbitTrail]")
  const box = await trail.boundingBox()
  expect(box!.width).toBeGreaterThan(280)
  expect(box!.x).toBeGreaterThan(0)
  expect(box!.x + box!.width).toBeLessThan(390)
  await expect(trail.locator("ellipse[stroke-dasharray]")).toBeHidden()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(support).toBeVisible()
  await expect(trail).toHaveCount(0)
})

test("o destaque acompanha o giro e inverte junto com o arraste", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  const trail = page.locator("svg[class*=orbitTrail] ellipse[stroke-dasharray]")
  await expect(trail).toBeVisible()
  const offset = () => trail.evaluate((element) => Number.parseFloat((element as SVGElement).style.strokeDashoffset))
  const stage = await page.locator("[data-mobile-orbit-stage]").boundingBox()
  const y = stage!.y + stage!.height / 2
  const initial = await offset()
  await page.mouse.move(320, y)
  await page.mouse.down()
  await page.mouse.move(70, y, { steps: 16 })
  await page.mouse.up()
  await expect.poll(offset).toBeLessThan(initial - 10)
  const forward = await offset()
  await page.mouse.move(70, y)
  await page.mouse.down()
  await page.mouse.move(320, y, { steps: 16 })
  await page.mouse.up()
  await expect.poll(offset).toBeGreaterThan(forward + 10)
})
