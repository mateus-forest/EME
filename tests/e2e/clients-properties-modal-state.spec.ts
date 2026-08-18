import { expect, test, type Page } from "@playwright/test"

import { loginAsBroker } from "./helpers/auth"

const now = "2026-08-13T12:00:00.000Z"

const client = {
  id: "client-state-1",
  name: "Cliente Estado Estável",
  email: "cliente@example.com",
  phone: "11999999999",
  whatsApp: "11999999999",
  message: "",
  catalogSlug: "",
  searchTerm: "",
  intent: "Comprar imóvel",
  source: "Manual",
  status: "NEW",
  statusLabel: "Novo interessado",
  propertyId: null,
  propertyTitle: "",
  brokerId: "broker-1",
  brokerName: "Corretor",
  agencyId: null,
  agencyName: "",
  identification: {
    cpfCnpj: "",
    rg: "",
    issuingAuthority: "",
    issueDate: "",
    nationality: "",
    birthPlace: "",
    maritalStatus: "",
    propertyRegime: "",
    profession: "",
  },
  address: { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
  legal: { legalRepresentative: "", powerOfAttorney: "", legalNotes: "" },
  documents: [],
  completion: { score: 40, pending: ["CPF"] },
  createdAt: now,
  updatedAt: now,
}

const property = {
  id: "property-state-1",
  publicCode: 101,
  title: "Apartamento Estado Estável",
  description: "Imóvel para validar o estado do modal.",
  audioUrl: "",
  price: 85000000,
  formattedPrice: "R$ 850.000,00",
  city: "São Paulo",
  neighborhood: "Centro",
  location: "Centro, São Paulo",
  ownerName: "Proprietário",
  bedrooms: 2,
  bathrooms: 2,
  parkingSpots: 1,
  type: "Apartamento",
  purpose: "Venda",
  status: "Publicado",
  published: true,
  marketplacePublished: false,
  marketplaceSlug: "apartamento-estado-estavel",
  images: [],
  views: 10,
  leads: 2,
  brokerId: "broker-1",
  agencyId: null,
  legal: {
    code: "",
    registryNumber: "",
    registryOffice: "",
    registryBook: "",
    registryPage: "",
    municipalRegistration: "",
    taxRegistration: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "São Paulo",
    state: "SP",
    privateArea: "",
    totalArea: "",
    idealFraction: "",
    condominiumName: "",
    condominiumFee: "",
    iptuValue: "",
    additionalFees: "",
    legalNotes: "",
  },
  documents: [],
  completion: { score: 60, pending: ["Matrícula"] },
  createdAt: now,
  updatedAt: now,
}

async function mockPropertyPageDependencies(page: Page) {
  await page.route("**/api/properties/me**", (route) => route.fulfill({ json: { properties: [property] } }))
  await page.route("**/api/brokers/me**", (route) =>
    route.fulfill({
      json: {
        profile: {
          id: "user-1",
          brokerId: "broker-1",
          agencyId: null,
          agencyName: "",
          accountType: "BROKER_INDEPENDENT",
          name: "Corretor Teste",
          email: "corretor@example.com",
          phone: "11999999999",
          photoUrl: "",
          creci: "12345",
          description: "",
        },
      },
    }),
  )
  await page.route("**/api/brokers/subscription**", (route) =>
    route.fulfill({
      json: {
        subscription: {
          id: 1,
          ownerId: 1,
          ownerType: "broker",
          brokerId: "broker-1",
          agencyId: null,
          accountType: "BROKER_INDEPENDENT",
          tipoPlano: "Plano EME",
          ultimoPagamento: "",
          proximaCobranca: "",
          planName: "Plano EME",
          isUpgraded: true,
          isAgencyLinked: false,
          propertyLimit: 10,
          limitLabel: "10 imóveis ativos",
          billingPlan: "BROKER",
          billingStatus: "ACTIVE",
          requiresRegularization: false,
          currentPrice: "R$ 0,00",
          previousPrice: null,
          status: "Ativo",
          nextCharge: "",
          paymentMethod: "",
        },
      },
    }),
  )
}

async function mockBrokerSession(page: Page) {
  await page.route("**/api/auth/me", (route) => route.fulfill({
    json: {
      user: {
        id: "user-1",
        name: "Corretor Teste",
        email: "corretor@example.com",
        role: "BROKER",
        accountType: "BROKER_INDEPENDENT",
        plan: "BROKER",
        subscriptionStatus: "ACTIVE",
        brokerId: "broker-1",
        agencyId: null,
      },
    },
  }))
}

test.describe("estado dos modais de clientes e imóveis", () => {
  test("status comercial persiste na edição e atualiza lista e filtro", async ({ page }) => {
    await loginAsBroker(page)
    let persistedClient = { ...client }
    let savedStatus = ""

    await page.route("**/api/brokers/leads**", (route) => route.fulfill({ json: { leads: [persistedClient] } }))
    await page.route(`**/api/leads/${client.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue()
      const body = route.request().postDataJSON() as { status?: string }
      savedStatus = body.status ?? ""
      persistedClient = {
        ...persistedClient,
        status: body.status ?? persistedClient.status,
        statusLabel: body.status === "NEGOTIATING" ? "Em negociação" : persistedClient.statusLabel,
      }
      await route.fulfill({ json: { lead: persistedClient } })
    })

    await page.goto("/corretor/clientes")
    await page.getByRole("button", { name: "Ver cliente" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("combobox", { name: "Status comercial" }).click()
    await page.getByRole("option", { name: "Em negociação" }).click()
    await dialog.getByRole("button", { name: "Salvar cliente" }).click()

    await expect.poll(() => savedStatus).toBe("NEGOTIATING")
    await expect(dialog.getByRole("combobox", { name: "Status comercial" })).toContainText("Em negociação")
    await dialog.getByRole("button", { name: "Close" }).click()
    await page.getByRole("button", { name: "Em negociação", exact: true }).click()
    await expect(page.getByText(client.name, { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Ver cliente" }).click()
    await expect(page.getByRole("dialog").getByRole("combobox", { name: "Status comercial" })).toContainText("Em negociação")
  })

  test("novo cliente permite escolher o status inicial real", async ({ page }) => {
    await loginAsBroker(page)
    let createdClient: typeof client | null = null
    let createdStatus = ""

    await page.route("**/api/brokers/leads**", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { name?: string; status?: string }
        createdStatus = body.status ?? ""
        createdClient = {
          ...client,
          id: "client-created-status",
          name: body.name ?? "Novo cliente",
          status: body.status ?? "NEW",
          statusLabel: body.status === "LOST" ? "Perdido" : "Novo interessado",
        }
        return route.fulfill({ status: 201, json: { lead: createdClient, created: true } })
      }
      return route.fulfill({ json: { leads: createdClient ? [createdClient] : [] } })
    })

    await page.goto("/corretor/clientes")
    await page.getByRole("button", { name: "Novo cliente" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("combobox", { name: "Status comercial" }).click()
    await page.getByRole("option", { name: "Perdido", exact: true }).click()
    await dialog.getByLabel("Nome completo").fill("Cliente com status inicial")
    await dialog.getByRole("button", { name: "Cadastrar cliente" }).click()

    await expect.poll(() => createdStatus).toBe("LOST")
    await expect(page.getByText("Cliente com status inicial", { exact: true })).toBeVisible()
  })

  test("cliente fecha uma vez, não reabre após refetch e mantém a lista", async ({ page }) => {
    await loginAsBroker(page)
    let leadRequests = 0
    await page.route("**/api/brokers/leads**", async (route) => {
      leadRequests += 1
      if (leadRequests > 1) await new Promise((resolve) => setTimeout(resolve, 150))
      await route.fulfill({ json: { leads: [client] } })
    })

    await page.goto("/corretor/clientes")
    await expect(page.getByText(client.name, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Ver cliente" }).click()
    await expect(page).toHaveURL(new RegExp(`/corretor/clientes/${client.id}$`))

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText(client.name, { exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: "Close" }).click()
    await expect(page).toHaveURL(/\/corretor\/clientes$/)
    await expect(dialog).toHaveCount(0)

    await page.evaluate((entityId) => {
      window.dispatchEvent(new CustomEvent("eme-entity-sync", {
        detail: { type: "lead", entityId, sourceId: "external-test", updatedAt: new Date().toISOString() },
      }))
    }, client.id)

    await expect.poll(() => leadRequests).toBeGreaterThan(1)
    await page.waitForTimeout(250)
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(client.name, { exact: true })).toBeVisible()
  })

  test("imóvel fecha sem remontar a lista ou reabrir após sincronização", async ({ page }) => {
    await loginAsBroker(page)
    let propertyRequests = 0
    await mockPropertyPageDependencies(page)
    await page.unroute("**/api/properties/me**")
    await page.route("**/api/properties/me**", async (route) => {
      propertyRequests += 1
      if (propertyRequests > 1) await new Promise((resolve) => setTimeout(resolve, 150))
      await route.fulfill({ json: { properties: [property] } })
    })

    await page.goto("/corretor/imoveis")
    await expect(page.getByText(property.title, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: `Mais ações para ${property.title}` }).click()
    await page.getByRole("menuitem", { name: "Editar imóvel" }).click()
    await expect(page).toHaveURL(new RegExp(`/corretor/imoveis/${property.id}$`))

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Editar imóvel", { exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: "Close" }).click()
    await expect(page).toHaveURL(/\/corretor\/imoveis$/)
    await expect(dialog).toHaveCount(0)

    await page.evaluate((entityId) => {
      window.dispatchEvent(new CustomEvent("eme-entity-sync", {
        detail: { type: "property", entityId, sourceId: "external-test", updatedAt: new Date().toISOString() },
      }))
    }, property.id)

    await expect.poll(() => propertyRequests).toBeGreaterThan(1)
    await page.waitForTimeout(250)
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(property.title, { exact: true })).toBeVisible()
  })

  test("CEP comercial e cadastro jurídico persistem ao salvar e reabrir", async ({ page }) => {
    await loginAsBroker(page)
    await mockPropertyPageDependencies(page)
    let savedPayload: Record<string, unknown> | null = null

    await page.route("https://viacep.com.br/ws/**", (route) => route.fulfill({
      json: {
        cep: "95200-000",
        logradouro: "Rua Júlio de Castilhos",
        complemento: "",
        bairro: "Centro",
        localidade: "Vacaria",
        uf: "RS",
      },
    }))
    await page.route(`**/api/properties/${property.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue()
      savedPayload = route.request().postDataJSON() as Record<string, unknown>
      const body = savedPayload as { legal?: typeof property.legal; city?: string; neighborhood?: string; ownerName?: string }
      await route.fulfill({
        json: {
          property: {
            ...property,
            city: body.city ?? property.city,
            neighborhood: body.neighborhood ?? property.neighborhood,
            ownerName: body.ownerName ?? property.ownerName,
            legal: body.legal ?? property.legal,
          },
        },
      })
    })

    await page.goto("/corretor/imoveis")
    await page.getByRole("button", { name: `Mais ações para ${property.title}` }).click()
    await page.getByRole("menuitem", { name: "Editar imóvel" }).click()
    const dialog = page.getByRole("dialog")

    await dialog.getByLabel("CEP comercial").fill("95200000")
    await dialog.getByLabel("CEP comercial").locator("xpath=..").getByRole("button", { name: "Buscar CEP" }).click()
    await expect(dialog.getByLabel("Cidade", { exact: true })).toHaveValue("Vacaria")
    await expect(dialog.getByLabel("Bairro", { exact: true })).toHaveValue("Centro")
    await expect(dialog.getByLabel("Rua / endereço", { exact: true })).toHaveValue("Rua Júlio de Castilhos")
    await expect(dialog.getByLabel("Estado / UF", { exact: true })).toHaveValue("RS")
    await dialog.getByRole("textbox", { name: "Matrícula", exact: true }).fill("12.345")
    await dialog.getByRole("button", { name: "Salvar alterações" }).click()

    await expect.poll(() => savedPayload).not.toBeNull()
    expect(savedPayload).toMatchObject({
      city: "Vacaria",
      neighborhood: "Centro",
      legal: {
        cep: "95200-000",
        street: "Rua Júlio de Castilhos",
        district: "Centro",
        city: "Vacaria",
        state: "RS",
        registryNumber: "12.345",
      },
    })

    await dialog.getByRole("button", { name: "Close" }).click()
    await page.getByRole("button", { name: `Mais ações para ${property.title}` }).click()
    await page.getByRole("menuitem", { name: "Editar imóvel" }).click()
    await expect(page.getByRole("dialog").getByRole("textbox", { name: "Matrícula", exact: true })).toHaveValue("12.345")
  })

  test("publicação por canal é independente e o card interno não oferece WhatsApp", async ({ page }) => {
    await mockBrokerSession(page)
    let currentProperty = { ...property, status: "Rascunho", published: false, marketplacePublished: false }
    await mockPropertyPageDependencies(page)
    await page.unroute("**/api/properties/me**")
    await page.route("**/api/properties/me**", (route) => route.fulfill({ json: { properties: [currentProperty] } }))
    await page.route(`**/api/properties/${property.id}/marketplace`, async (route) => {
      const body = route.request().postDataJSON() as { published: boolean }
      currentProperty = { ...currentProperty, marketplacePublished: body.published }
      await route.fulfill({ json: { property: currentProperty } })
    })
    await page.route(`**/api/properties/${property.id}/publish`, async (route) => {
      const body = route.request().postDataJSON() as { status: "Publicado" | "Rascunho" }
      currentProperty = { ...currentProperty, status: body.status, published: body.status === "Publicado" }
      await route.fulfill({ json: { property: currentProperty } })
    })

    await page.goto("/corretor/imoveis")
    const card = page.getByRole("heading", { name: property.title }).locator("xpath=ancestor::*[@data-slot='card'][1]")
    const actions = page.getByRole("button", { name: `Mais ações para ${property.title}` })

    await actions.click()
    await expect(page.getByRole("menuitem", { name: "Publicar no Catálogo" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Publicar no Marketplace" })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: /WhatsApp/i })).toHaveCount(0)
    await page.getByRole("menuitem", { name: "Publicar no Marketplace" }).click()
    await expect(card.getByText("Marketplace", { exact: true })).toBeVisible()
    await expect(card.getByText("Catálogo", { exact: true })).toHaveCount(0)

    await actions.click()
    await page.getByRole("menuitem", { name: "Publicar no Catálogo" }).click()
    await expect(card.getByText("Catálogo", { exact: true })).toBeVisible()
    await expect(card.getByText("Marketplace", { exact: true })).toBeVisible()

    await actions.click()
    await page.getByRole("menuitem", { name: "Despublicar do Marketplace" }).click()
    await expect(card.getByText("Marketplace", { exact: true })).toHaveCount(0)
    await expect(card.getByText("Catálogo", { exact: true })).toBeVisible()
  })

  test("Marketplace bloqueado mostra a lista de correções e atalho para o CRECI", async ({ page }) => {
    await mockBrokerSession(page)
    await mockPropertyPageDependencies(page)
    await page.route(`**/api/properties/${property.id}/marketplace`, (route) => route.fulfill({
      status: 422,
      json: {
        error: "Este imóvel ainda não atende ao padrão de publicação do EME.",
        code: "PROPERTY_NOT_READY",
        channel: "marketplace",
        channelReadiness: {
          ready: false,
          issues: [
            { code: "MINIMUM_PHOTOS_REQUIRED", message: "Adicione pelo menos 4 fotos.", field: "images", scope: "property" },
            { code: "CRECI_NOT_VERIFIED", message: "Seu CRECI precisa estar verificado.", field: "creciValidationStatus", scope: "broker" },
          ],
        },
      },
    }))

    await page.goto("/corretor/imoveis")
    await page.getByRole("button", { name: `Mais ações para ${property.title}` }).click()
    await page.getByRole("menuitem", { name: "Publicar no Marketplace" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Este imóvel ainda não atende ao padrão de publicação do EME." })).toBeVisible()
    await expect(dialog.getByText("Adicione pelo menos 4 fotos.")).toBeVisible()
    await expect(dialog.getByText("Seu CRECI precisa estar verificado.")).toBeVisible()
    await expect(dialog.getByRole("link", { name: "Verificar CRECI" })).toHaveAttribute("href", "/corretor/conta")
    await expect(dialog.getByRole("button", { name: "Corrigir imóvel" })).toBeVisible()
  })

  test("Catálogo bloqueia CRECI não verificado sem exigir o padrão premium", async ({ page }) => {
    await mockBrokerSession(page)
    await mockPropertyPageDependencies(page)
    await page.unroute("**/api/properties/me**")
    await page.route("**/api/properties/me**", (route) => route.fulfill({
      json: { properties: [{ ...property, status: "Rascunho", published: false }] },
    }))
    await page.route(`**/api/properties/${property.id}/publish`, (route) => route.fulfill({
      status: 422,
      json: {
        error: "Este imóvel ainda não atende ao padrão de publicação do EME.",
        code: "PROPERTY_NOT_READY",
        channel: "catalog",
        channelReadiness: {
          ready: false,
          issues: [
            { code: "CRECI_NOT_VERIFIED", message: "Seu CRECI precisa estar verificado.", field: "creciValidationStatus", scope: "broker" },
          ],
        },
      },
    }))

    await page.goto("/corretor/imoveis")
    await page.getByRole("button", { name: `Mais ações para ${property.title}` }).click()
    await page.getByRole("menuitem", { name: "Publicar no Catálogo" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Seu CRECI precisa estar verificado.")).toBeVisible()
    await expect(dialog.getByRole("link", { name: "Verificar CRECI" })).toHaveAttribute("href", "/corretor/conta")
    await expect(dialog.getByTestId("publication-readiness-issues").getByRole("listitem")).toHaveCount(1)
    await expect(dialog).not.toContainText("Adicione pelo menos 4 fotos.")
  })
})
