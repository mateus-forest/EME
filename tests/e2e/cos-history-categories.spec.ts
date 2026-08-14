import { expect, test } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const now = "2026-08-13T18:00:00.000Z"
const conversations = [
  { id: "conversation-client", title: "Cadastrar cliente Ana", category: "clients", createdAt: now, updatedAt: now, lastInteractionAt: now },
  { id: "conversation-property", title: "Buscar imóvel no Centro", category: "properties", createdAt: now, updatedAt: now, lastInteractionAt: now },
  { id: "conversation-contract", title: "Preparar contrato de venda", category: "contracts", createdAt: now, updatedAt: now, lastInteractionAt: now },
]

test("histórico organiza e filtra por categoria sem duplicar conversas", async ({ page }) => {
  await loginAsBroker(page)

  let conversationListRequests = 0
  await page.route("**/api/assistant/eme**", (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/assistant/eme/conversations") {
      conversationListRequests += 1
      return route.fulfill({ json: { conversations, total: conversations.length, hasMore: false, nextOffset: conversations.length } })
    }
    if (url.pathname.startsWith("/api/assistant/eme/conversations/")) {
      const id = url.pathname.split("/").pop()
      const conversation = conversations.find((item) => item.id === id)
      return route.fulfill({ json: { conversation, messages: [], pendingConfirmation: null } })
    }
    if (url.pathname === "/api/assistant/eme") {
      return route.fulfill({ json: { credits: { balance: 20, usedThisMonth: 0 }, aiAssistantEnabled: true } })
    }
    return route.continue()
  })

  await page.evaluate(() => sessionStorage.removeItem("eme-cos-conversation-cache"))
  await page.goto("/corretor/historico")
  await expect(page.getByTestId("cos-history-category-filters")).toBeVisible()
  await expect.poll(() => conversationListRequests).toBeGreaterThan(0)
  const organizedList = page.locator("[data-category]")

  for (const conversation of conversations) {
    await expect(organizedList.getByText(conversation.title, { exact: true })).toHaveCount(1)
  }

  await page.getByTestId("cos-history-category-contracts").click()
  await expect(organizedList.getByText(conversations[2].title, { exact: true })).toHaveCount(1)
  await expect(organizedList.getByText(conversations[0].title, { exact: true })).toHaveCount(0)
  await expect(organizedList.getByText(conversations[1].title, { exact: true })).toHaveCount(0)

  await page.getByTestId("cos-history-category-all").click()
  for (const conversation of conversations) {
    await expect(organizedList.getByText(conversation.title, { exact: true })).toHaveCount(1)
  }

  const uniqueConversationIds = await page.locator("[data-category] button").evaluateAll((buttons) => {
    return buttons
      .map((button) => button.textContent?.trim())
      .filter((value): value is string => Boolean(value))
  })
  expect(new Set(uniqueConversationIds).size).toBe(uniqueConversationIds.length)
})
