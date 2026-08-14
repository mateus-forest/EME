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
  statusLabel: "Novo",
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

test.describe("estado dos modais de clientes e imóveis", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBroker(page)
  })

  test("cliente fecha uma vez, não reabre após refetch e mantém a lista", async ({ page }) => {
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
    await page.getByRole("button", { name: "Editar", exact: true }).last().click()
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
})
