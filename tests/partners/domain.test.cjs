/* global require */
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CommonJS test. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('../captacao/load.cjs')
const { simulate, createReferralSchema, updateReferralSchema } = loader()('lib/partners/contract.ts')

test('individual and conveniada commissions use cents and the actual promotional periods', () => {
  assert.equal(simulate({ offer: 'PRO', seats: 1 }).commissionCents, 2580)
  assert.equal(simulate({ offer: 'SCALE', seats: 1 }).commissionCents, 7780)
  const promo = simulate({ offer: 'AGREEMENT', seats: 1 })
  assert.equal(promo.commissionCents, 2380)
  assert.equal(promo.regularCommissionCents, 2580)
  assert.equal(promo.periodCommissionCents, 30360)
})
test('team tiers apply 20%, including exactly R$198 for ten accesses', () => {
  for (const [seats, unit, commission] of [[3,11900,7140],[4,11900,9520],[5,10900,10900],[9,10900,19620],[10,9900,19800],[20,9900,39600]]) {
    const result = simulate({ offer: 'TEAM', seats })
    assert.equal(result.unitCents, unit)
    assert.equal(result.commissionCents, commission)
    assert.equal(result.periodMonths, 6)
    assert.equal(result.periodCommissionCents, commission * 6)
  }
})
test('simulation refuses invalid quantities and never silently prices unsupported plans', () => {
  for (const seats of [0, -1, 1.5, NaN, Infinity, 1001]) assert.throws(() => simulate({ offer: 'PRO', seats }))
  assert.throws(() => simulate({ offer: 'TEAM', seats: 2 }))
  assert.throws(() => simulate({ offer: 'UNKNOWN', seats: 1 }))
})
const input = { operationKey: '10000000-0000-4000-8000-000000000001', name: 'Contato teste', email: 'TEST@example.invalid', phone: '', company: '', offer: 'PRO', seats: 1, notes: '', nextAction: '', followUpAt: null, doNotContact: false, contactPermission: true }
test('referrals normalize email and require permission without accepting financial or identity injection', () => {
  assert.equal(createReferralSchema.parse(input).email, 'test@example.invalid')
  for (const patch of [{ contactPermission: false }, { brokerId: 'other' }, { stage: 'WON_REPORTED' }, { paid: true }, { commissionCents: 19800 }, { seats: 2 }, { followUpAt: 'bad' }, { email: 'invalid' }]) {
    assert.equal(createReferralSchema.safeParse({ ...input, ...patch }).success, false)
  }
})
test('updates require version/idempotency key and enforce team minimum and known stages', () => {
  const { contactPermission, ...rest } = input
  void contactPermission
  const update = { ...rest, expectedVersion: 1, activityNote: '', stage: 'CONTACTED', offer: 'TEAM', seats: 10 }
  assert.equal(updateReferralSchema.safeParse(update).success, true)
  assert.equal(updateReferralSchema.safeParse({ ...update, seats: 2 }).success, false)
  assert.equal(updateReferralSchema.safeParse({ ...update, expectedVersion: 0 }).success, false)
  assert.equal(updateReferralSchema.safeParse({ ...update, stage: 'PAID' }).success, false)
})
