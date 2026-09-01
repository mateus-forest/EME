import assert from "node:assert/strict"
import test from "node:test"

import { calculateFinancialOperationHealth } from "../lib/operation-health.ts"

test("financeiro vazio mantém estado saudável sem inventar pendências", () => {
  const result = calculateFinancialOperationHealth({
    receipts: [],
    expenses: [],
    commissions: [],
    activeRentals: [],
  })

  assert.deepEqual(result, {
    score: 100,
    trackedRecords: 0,
    expectedReceipts: 0,
    overdueReceipts: 0,
    pendingExpenses: 0,
    incompleteRecords: 0,
  })
})

test("score financeiro considera previstos, atrasados e despesas pendentes", () => {
  const result = calculateFinancialOperationHealth({
    receipts: [
      { id: "expected-1", source: "ENTRY", status: "EXPECTED" },
      { id: "expected-2", source: "RENTAL_PAYMENT", status: "EXPECTED" },
      { id: "overdue-1", source: "ENTRY", status: "OVERDUE" },
      { id: "received-1", source: "COMMISSION", status: "RECEIVED" },
    ],
    expenses: [
      { id: "pending-1", status: "PENDING" },
      { id: "paid-1", status: "PAID" },
    ],
    commissions: [{ id: "received-1", client: { id: "lead-1" }, property: { id: "property-1" } }],
    activeRentals: [{ id: "rental-1", paymentCount: 12 }],
  })

  assert.equal(result.score, 67)
  assert.equal(result.trackedRecords, 6)
  assert.equal(result.expectedReceipts, 2)
  assert.equal(result.overdueReceipts, 1)
  assert.equal(result.pendingExpenses, 1)
  assert.equal(result.incompleteRecords, 0)
})

test("completude identifica comissão sem vínculo e locação sem competências sem duplicar impacto", () => {
  const result = calculateFinancialOperationHealth({
    receipts: [
      { id: "commission-1", source: "COMMISSION", status: "OVERDUE" },
      { id: "expected-1", source: "ENTRY", status: "EXPECTED" },
    ],
    expenses: [],
    commissions: [{ id: "commission-1", client: null, property: { id: "property-1" } }],
    activeRentals: [{ id: "rental-without-schedule", paymentCount: 0 }],
  })

  assert.equal(result.score, 33)
  assert.equal(result.incompleteRecords, 2)
})
