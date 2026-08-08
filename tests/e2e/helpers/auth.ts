import { expect, type Page } from "@playwright/test"

const defaultEmail = process.env.E2E_EMAIL || "corretor@eme.com"
const defaultPassword = process.env.E2E_PASSWORD || "corretor123"

export async function loginAsBroker(page: Page, credentials?: { email?: string; password?: string }) {
  const email = credentials?.email || defaultEmail
  const password = credentials?.password || defaultPassword

  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Senha").fill(password)
  await page.getByRole("button", { name: "Entrar" }).click()

  await expect(page).not.toHaveURL(/\/login(?:\?.*)?$/)
}
