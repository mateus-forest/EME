import assert from "node:assert/strict"
import test from "node:test"

import { resolveCosLaunchIntent } from "../lib/cos-launch/intent.ts"
import {
  OPEN_ENDED_RENTAL_SCHEDULE_MONTHS,
  buildRentalPaymentSchedule,
} from "../lib/rental-payment-schedule.ts"

test("gera uma competência mensal entre início e fim do contrato", () => {
  const schedule = buildRentalPaymentSchedule({
    rentalId: "rental-1",
    monthlyRent: 720_000,
    dueDay: 10,
    startDate: new Date("2026-09-01T12:00:00.000Z"),
    endDate: new Date("2027-08-31T12:00:00.000Z"),
  })

  assert.equal(schedule.length, 12)
  assert.deepEqual(schedule[0], {
    rentalId: "rental-1",
    competence: "2026-09",
    amount: 720_000,
    dueDate: new Date("2026-09-10T12:00:00.000Z"),
    status: "PENDING",
    notes: "Previsão gerada automaticamente pela locação.",
  })
  assert.equal(schedule.at(-1)?.competence, "2027-08")
})

test("limita o vencimento ao último dia do mês e mantém chaves idempotentes", () => {
  const input = {
    rentalId: "rental-2",
    monthlyRent: 250_000,
    dueDay: 31,
    startDate: new Date("2027-01-01T12:00:00.000Z"),
    endDate: new Date("2027-03-31T12:00:00.000Z"),
  }
  const first = buildRentalPaymentSchedule(input)
  const second = buildRentalPaymentSchedule(input)

  assert.equal(first[1]?.dueDate.toISOString(), "2027-02-28T12:00:00.000Z")
  assert.deepEqual(
    first.map((item) => `${item.rentalId}:${item.competence}`),
    second.map((item) => `${item.rentalId}:${item.competence}`),
  )
  assert.equal(new Set(first.map((item) => `${item.rentalId}:${item.competence}`)).size, first.length)
})

test("locação sem fim recebe horizonte operacional de doze competências", () => {
  const schedule = buildRentalPaymentSchedule({
    rentalId: "rental-open",
    monthlyRent: 180_000,
    dueDay: 5,
    startDate: new Date("2026-09-01T12:00:00.000Z"),
    endDate: null,
  })

  assert.equal(schedule.length, OPEN_ENDED_RENTAL_SCHEDULE_MONTHS)
  assert.equal(schedule.at(-1)?.competence, "2027-08")
})

test("COS Launch reconhece consultas, criações e ajuda do Financeiro", () => {
  assert.equal(resolveCosLaunchIntent("Mostre meu resumo financeiro"), "financial_summary")
  assert.equal(resolveCosLaunchIntent("Quais são meus próximos recebimentos?"), "financial_upcoming")
  assert.equal(resolveCosLaunchIntent("Quero criar uma nova despesa"), "create_financial_expense")
  assert.equal(resolveCosLaunchIntent("Nova comissão"), "create_financial_commission")
  assert.equal(resolveCosLaunchIntent("Como funcionam as locações no Financeiro?"), "help_finance_rentals")
})
