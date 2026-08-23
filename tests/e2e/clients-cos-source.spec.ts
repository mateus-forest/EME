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
  await expect(page.getByText(/Catálogo · COS ·/).filter({ visible: true })).toBeVisible()
  await expect(page.getByText("Assessor EME", { exact: true })).toHaveCount(0)
})
