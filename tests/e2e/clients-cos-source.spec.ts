import { expect, test } from "@playwright/test"

import { leadSourceLabel } from "../../lib/lead-contract"
import { loginAsBroker } from "./helpers/auth"

const now = new Date().toISOString()
const cosClient = {
  id: "lead-cos-1",
  name: "Cliente cadastrado pelo COS",
  email: "",
  phone: "11999999999",
  whatsApp: "11999999999",
  message: "",
  catalogSlug: "",
  searchTerm: "",
  intent: "",
  source: "COS",
  status: "NEW",
  statusLabel: "Novo",
  propertyId: null,
  propertyTitle: "",
  brokerId: "broker-1",
  brokerName: "Corretor",
  agencyId: null,
  agencyName: "",
  identification: { cpfCnpj: "", rg: "", issuingAuthority: "", nationality: "", profession: "", maritalStatus: "", propertyRegime: "" },
  address: { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
  legal: { birthDate: "", notes: "" },
  documents: [],
  completion: { score: 40, pending: ["CPF"] },
  createdAt: now,
  updatedAt: now,
}

test("origem histórica assessor_eme é apresentada como COS", async ({ page }) => {
  expect(leadSourceLabel("assessor_eme")).toBe("COS")

  await loginAsBroker(page)
  await page.route("**/api/brokers/leads", (route) => route.fulfill({ json: { leads: [cosClient] } }))
  await page.goto("/corretor/clientes")

  await expect(page.getByText("Cliente cadastrado pelo COS", { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText(/Origem COS ·/).filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Assessor EME", { exact: true })).toHaveCount(0)
})

test("lista usa uma única origem principal em registros históricos", async ({ page }) => {
  await loginAsBroker(page)
  await page.route("**/api/brokers/leads", (route) =>
    route.fulfill({
      json: {
        leads: [
          { ...cosClient, id: "lead-manual-1", name: "Cliente manual", source: "Manual" },
          { ...cosClient, id: "lead-catalog-1", name: "Cliente histórico", source: "Catálogo · Manual" },
        ],
      },
    }),
  )
  await page.goto("/corretor/clientes")

  await expect(page.getByText(/Origem Manual ·/).filter({ visible: true })).toBeVisible()
  await expect(page.getByText(/Origem Catálogo ·/).filter({ visible: true })).toBeVisible()
  await expect(page.getByText(/Catálogo · Manual/).filter({ visible: true })).toHaveCount(0)
})
