import { expect, test } from "@playwright/test"

import { openLoginPage, waitForAppReady } from "./helpers/app"

test.describe("Smoke", () => {
  test("abre a rota de login", async ({ page }) => {
    const response = await openLoginPage(page)
    await waitForAppReady(page)

    expect(response?.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page).toHaveTitle(/Entrar - EME/i)
    await expect(page.locator("body")).toBeVisible()
  })
})
