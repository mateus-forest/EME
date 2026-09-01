import assert from "node:assert/strict"
import test from "node:test"

import { calculateFinancialAccountBalance } from "../lib/broker-financial-account-balance.ts"
import {
  buildAdImportCreditKeys,
  buildImportedDraftPersistence,
  formatPropertyImportBatchFeedback,
  type AdImportDraft,
} from "../lib/property-ad-import-shared.ts"

const incompleteDraft = {
  title: "",
  description: "Sala extraída do anúncio.",
  price: "",
  type: "Sala comercial",
  city: "",
  neighborhood: "",
  address: "",
  bedrooms: 0,
  bathrooms: 0,
  parking: 0,
  area: "",
  features: ["Portaria"],
  tags: [],
  images: [],
  sourceUrl: "https://example.com/anuncio",
  notes: "",
  lowConfidenceFields: ["price"],
  missingFields: ["title", "city", "neighborhood", "price"],
  status: "needs_review",
} satisfies AdImportDraft

test("imóvel importado incompleto persiste como rascunho editável", () => {
  const data = buildImportedDraftPersistence(incompleteDraft, { price: null, propertyType: "OFFICE" })
  assert.deepEqual(data, {
    title: "Imóvel importado em revisão",
    price: 0,
    city: "",
    neighborhood: null,
    type: "OFFICE",
    status: "DRAFT",
    published: false,
  })
})

test("lote informa quantos rascunhos foram criados e quais falharam", () => {
  assert.equal(
    formatPropertyImportBatchFeedback(2, [{ title: "Sala Comercial", message: "Limite da carteira atingido." }]),
    "2 rascunhos criados. 1 falhou: Sala Comercial — Limite da carteira atingido.",
  )
})

test("chaves de crédito são estáveis por processamento e separam débito de estorno", () => {
  const first = buildAdImportCreditKeys("broker-1", "operation-1")
  const retry = buildAdImportCreditKeys("broker-1", "operation-1")
  assert.deepEqual(first, retry)
  assert.notEqual(first.usage, first.refund)
})

test("saldo de conta ignora previsões e usa apenas recebidos e pagos vinculados", () => {
  const balance = calculateFinancialAccountBalance("account-1", 100_000, [
    { accountId: "account-1", direction: "INCOME", status: "EXPECTED", amount: 900_000, occurredAt: null },
    { accountId: "account-1", direction: "INCOME", status: "RECEIVED", amount: 250_000, occurredAt: new Date() },
    { accountId: "account-1", direction: "EXPENSE", status: "PENDING", amount: 300_000, occurredAt: null },
    { accountId: "account-1", direction: "EXPENSE", status: "PAID", amount: 50_000, occurredAt: new Date() },
    { accountId: "account-2", direction: "INCOME", status: "RECEIVED", amount: 700_000, occurredAt: new Date() },
  ])
  assert.equal(balance, 300_000)
})
