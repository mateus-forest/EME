import { expect, test, type Page } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const notifications = Array.from({ length: 7 }, (_, index) => ({
  id: `notification-${index + 1}`,
  title: `Aviso ${index + 1}`,
  message: `Contexto persistido da notificação ${index + 1}.`,
  date: `${String(18 - index).padStart(2, "0")}/08/2026`,
  createdAt: new Date(Date.UTC(2026, 7, 18 - index, 12)).toISOString(),
  financialStatus: "notificacao-recebida",
  category: index === 1 ? "sistema" : "aviso-administrativo",
  lida: index > 1,
  priority: "media",
  archived: false,
  contextMessage: `Contexto persistido da notificação ${index + 1}.`,
}))

const archivedNotification = {
  ...notifications[6],
  id: "notification-archived",
  title: "Aviso arquivado",
  archived: true,
  lida: true,
}

async function mockNotificationPage(page: Page) {
  let records = [...notifications, archivedNotification]
  await page.route("**/api/brokers/me", (route) => route.fulfill({ json: { profile: null } }))
  await page.route("**/api/brokers/subscription", (route) => route.fulfill({ json: { subscription: { planName: "Plano Pro" } } }))
  await page.route("**/api/notifications*", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === "GET") {
      const includeArchived = url.searchParams.get("history") === "1"
      return route.fulfill({ json: { notifications: records.filter((notification) => includeArchived || !notification.archived) } })
    }
    const id = url.pathname.split("/").at(-1) ?? ""
    if (request.method() === "PATCH") {
      records = records.map((notification) => notification.id === id ? { ...notification, lida: true } : notification)
      return route.fulfill({ json: { notification: records.find((notification) => notification.id === id) } })
    }
    if (request.method() === "DELETE") {
      records = records.map((notification) => notification.id === id ? { ...notification, lida: true, archived: true } : notification)
      return route.fulfill({ json: { notification: records.find((notification) => notification.id === id) } })
    }
    return route.fulfill({ status: 400, json: { error: "Ação não suportada no teste." } })
  })
}

test("dropdown mostra somente recentes e abre detalhe refinado", async ({ page }) => {
  await loginAsBroker(page)
  await mockNotificationPage(page)
  await page.goto("/corretor/notificacoes")

  await page.getByRole("button", { name: "Abrir notificações" }).click()
  const popover = page.locator('[data-slot="popover-content"]')
  await expect(popover.getByText("Aviso 1", { exact: true })).toBeVisible()
  await expect(popover.getByText("Aviso 5", { exact: true })).toBeVisible()
  await expect(popover.getByText("Aviso 6", { exact: true })).toHaveCount(0)
  await expect(popover.getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/corretor/notificacoes")

  await popover.getByRole("button", { name: "Detalhes" }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Aviso 1" })).toBeVisible()
  await expect(dialog.getByText("Portal EME", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Aviso administrativo", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Contexto persistido da notificação 1.", { exact: true })).toBeVisible()
})

test("histórico reutiliza persistência e filtra por estado e tipo", async ({ page }) => {
  await loginAsBroker(page)
  await mockNotificationPage(page)
  await page.goto("/corretor/notificacoes")

  await expect(page.getByText("Aviso arquivado", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Não lidas", exact: true }).click()
  await expect(page.getByText("Aviso 1", { exact: true })).toBeVisible()
  await expect(page.getByText("Aviso 3", { exact: true })).toHaveCount(0)

  await page.getByRole("button", { name: "Todas", exact: true }).click()
  await page.getByLabel("Tipo").selectOption("sistema")
  await expect(page.getByText("Aviso 2", { exact: true })).toBeVisible()
  await expect(page.getByText("Aviso 1", { exact: true })).toHaveCount(0)

  await page.getByLabel("Tipo").selectOption("all")
  await page.getByRole("button", { name: "Arquivadas", exact: true }).click()
  await expect(page.getByText("Aviso arquivado", { exact: true })).toBeVisible()
  await expect(page.getByText("Aviso 1", { exact: true })).toHaveCount(0)
})
