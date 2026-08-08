import { expect, type Locator, type Page } from "@playwright/test"

const TECHNICAL_MESSAGE_PATTERNS = [/fallback/i, /legacy/i, /erro interno/i, /stack/i, /exception/i]

export function getCosComposer(page: Page) {
  return page.getByPlaceholder("Fale com o COS...")
}

export function getCosSendButton(page: Page) {
  return page.getByRole("button", { name: /Enviar mensagem ao COS/i })
}

export async function waitForCosReady(page: Page) {
  await expect(getCosComposer(page)).toBeVisible()
  await expect(getCosSendButton(page)).toBeVisible()
  await expect(getCosSendButton(page)).toBeEnabled({ timeout: 30000 })
}

export async function openCosHome(page: Page) {
  await page.goto("/corretor")
  await waitForCosReady(page)
}

export async function sendCosMessage(page: Page, message: string) {
  await waitForCosReady(page)
  const startUrl = page.url()
  await getCosComposer(page).fill(message)
  await getCosSendButton(page).click()
  await waitForCosSettled(page, startUrl)
}

export async function waitForCosSettled(page: Page, startUrl?: string) {
  await Promise.race([
    expect(getCosSendButton(page)).toBeEnabled({ timeout: 30000 }),
    startUrl
      ? page.waitForURL((url) => url.toString() !== startUrl, { timeout: 30000 })
      : new Promise(() => undefined),
  ]).catch(async () => {
    await page.waitForLoadState("networkidle").catch(() => null)
    if (startUrl && page.url() !== startUrl) return
    await expect(getCosSendButton(page)).toBeEnabled({ timeout: 30000 })
  })
  await page.waitForTimeout(800)
}

export async function collectBodyText(page: Page) {
  return page.locator("body").innerText()
}

export async function expectNoTechnicalMessages(page: Page) {
  const text = await collectBodyText(page)
  for (const pattern of TECHNICAL_MESSAGE_PATTERNS) {
    expect.soft(text).not.toMatch(pattern)
  }
}

export async function clickSidebarLink(page: Page, href: string) {
  await page.goto(href)
  await page.waitForLoadState("networkidle").catch(() => null)
}

export async function expectAnyVisibleText(page: Page, patterns: RegExp[]) {
  const text = await collectBodyText(page)
  const matched = patterns.some((pattern) => pattern.test(text))
  expect(matched).toBeTruthy()
}

export async function findVisibleButtonsByLabels(page: Page, labels: string[]) {
  const matches: Locator[] = []

  for (const label of labels) {
    const locator = page.getByRole("button", { name: new RegExp(`^${escapeForRegex(label)}$`, "i") })
    if (await locator.count()) {
      const first = locator.first()
      if (await first.isVisible().catch(() => false)) {
        matches.push(first)
      }
    }
  }

  return matches
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
