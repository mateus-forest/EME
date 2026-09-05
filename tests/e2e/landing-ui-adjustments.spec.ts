import { expect, test } from "@playwright/test"

test.describe("Landing — ajustes de Compromissos, Catálogo e Acelerador", () => {
  test("mantém shells únicos, CTA real e Acelerador desktop compacto", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")

    await page.getByRole("button", { name: "Abrir modulo Compromissos" }).click({ force: true })
    const agendaDialog = page.locator('[data-module-dialog="agenda"]')
    await expect(agendaDialog).toBeVisible()
    await expect(agendaDialog).toHaveCSS("opacity", "1")
    await expect(agendaDialog.locator("[data-agenda-modal-layout]")).toBeVisible()
    await expect(agendaDialog.locator("[data-landing-modal-close]")).toHaveCount(1)
    await expect(
      agendaDialog.getByRole("heading", { name: "Sua rotina de compromissos, sempre sob controle." }),
    ).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("compromissos-desktop.png") })
    await agendaDialog.locator("[data-landing-modal-close]").click()
    await expect(agendaDialog).toHaveCount(0)

    await page.getByRole("button", { name: "Abrir modulo Catálogo" }).click({ force: true })
    const catalogDialog = page.locator('[data-module-dialog="catalogo"]')
    const catalogLink = catalogDialog.getByRole("link", { name: "Ver catálogo real" })
    await expect(catalogLink).toBeVisible()
    await expect(catalogLink).toHaveAttribute(
      "href",
      "https://www.meueme.com/catalogo/fabricio-foscarini",
    )
    await expect(catalogLink).toHaveAttribute("target", "_blank")
    await page.screenshot({ path: testInfo.outputPath("catalogo-desktop.png") })
    await catalogDialog.locator("[data-landing-modal-close]").click()
    await expect(catalogDialog).toHaveCount(0)

    await page.getByRole("button", { name: "Conheça o Acelerador EME" }).click({ force: true })
    const accelerator = page.getByRole("region", { name: "Acelerador EME" })
    await expect(accelerator).toBeVisible()
    await expect(accelerator.locator(".eme-accelerator__notify")).toHaveCount(0)
    await expect(accelerator.locator(".eme-accelerator__development")).toHaveCount(0)
    await expect(accelerator.locator(".eme-accelerator-card__arrow")).toHaveCount(0)
    await expect(accelerator.getByText("Novo produto · Em desenvolvimento", { exact: true })).toBeVisible()
    const percentageSize = await accelerator.locator(".eme-accelerator-impact__metric strong").first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    const metricLabelSize = await accelerator.locator(".eme-accelerator-impact__metric p").first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    expect(percentageSize).toBeGreaterThan(metricLabelSize * 2)
    await page.screenshot({ path: testInfo.outputPath("acelerador-desktop.png") })
  })

  test("mantém o CTA do Catálogo acessível no fluxo mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")

    await page.getByRole("button", { name: "Abrir modulo Catálogo" }).click({ force: true })
    const dialog = page.locator('[data-module-dialog="catalogo"]')
    const scrollArea = dialog.locator("[data-mobile-module-scroll]")
    const catalogLink = dialog.getByRole("link", { name: "Ver catálogo real" })

    await expect(scrollArea).toHaveCSS("overflow-y", "auto")
    await expect(catalogLink).toBeVisible()
    await catalogLink.evaluate((element) => element.scrollIntoView({ block: "center" }))
    await expect(catalogLink).toBeInViewport()
    await expect(catalogLink).toHaveAttribute("target", "_blank")
  })
})
