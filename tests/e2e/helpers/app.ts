import type { Page } from "@playwright/test"

export async function openLoginPage(page: Page) {
  return page.goto("/login")
}

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState("domcontentloaded")
}
