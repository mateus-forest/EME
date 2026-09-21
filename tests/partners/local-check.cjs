/* global require, process, console, URL, fetch */
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CommonJS test. */
// Opt-in real HTTP/database tests. Never reads the project's .env files.
const fs = require('node:fs')
const { parse } = require('dotenv')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { Pool } = require('pg')
const { loader } = require('../captacao/load.cjs')
if (!process.env.PARTNERS_TEST_ENV || !process.env.PARTNERS_TEST_ACCESS) throw Error('Explicit isolated test files required')
const environment = parse(fs.readFileSync(process.env.PARTNERS_TEST_ENV))
const db = new URL(environment.DATABASE_URL)
if (db.hostname !== '127.0.0.1' || db.port !== '55449' || db.pathname !== '/captacao_preview') throw Error('Refusing non-test DB')
const access = JSON.parse(fs.readFileSync(process.env.PARTNERS_TEST_ACCESS, 'utf8').replace(/^\uFEFF/, ''))
const base = 'http://localhost:3116'
const endpoint = '/api/brokers/partners'
const pool = new Pool({ connectionString: environment.DATABASE_URL })
const load = loader()
const { createReferralSchema } = load('lib/partners/contract.ts')
let checks = 0
function ok(name) { console.log('PASS ' + name); checks++ }
async function api(route, method = 'GET', body, cookie = '', origin = base) {
  const r = await fetch(base + route, { method, headers: { Cookie: cookie, Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] }
}
async function snapshot() {
  const names = ['User','Broker','Property','Lead','Subscription','Captacao','AgendaEvent']
  const result = {}
  for (const name of names) result[name] = Number((await pool.query(`SELECT count(*) AS count FROM "${name}"`)).rows[0].count)
  return result
}
;(async () => {
  const before = await snapshot()
  assert.equal((await api(endpoint)).status, 401); ok('anonymous rejected')
  const first = await api('/api/auth/login', 'POST', { email: access.email, password: access.password })
  const second = await api('/api/auth/login', 'POST', { email: 'captacao.outro@example.invalid', password: access.password })
  assert.equal(first.status, 200); assert.equal(second.status, 200); ok('two real local broker logins')
  const data = { operationKey: randomUUID(), name: 'FIXTURE Parceiros integração', email: `partner-${randomUUID()}@example.invalid`, phone: '', company: 'FIXTURE Equipe', offer: 'TEAM', seats: 10, notes: 'Teste local identificado', nextAction: 'Demonstração', followUpAt: '2026-10-05T14:00:00-03:00', doNotContact: false, contactPermission: true }
  assert.equal(createReferralSchema.safeParse(data).success, true)
  assert.equal((await api(endpoint, 'POST', data, first.cookie, 'https://external.invalid')).status, 403); ok('cross-origin write rejected')
  assert.equal((await api(endpoint, 'POST', { ...data, brokerId: 'other' }, first.cookie)).status, 400); ok('owner injection rejected')
  const saved = await Promise.all([api(endpoint, 'POST', data, first.cookie), api(endpoint, 'POST', data, first.cookie)])
  assert.equal(saved[0].status, 200); assert.equal(saved[1].status, 200)
  assert.equal(saved[0].data.referral.id, saved[1].data.referral.id); ok('concurrent create idempotent')
  const referral = saved[0].data.referral
  assert.equal(referral.activities.length, 1)
  assert.equal((await api(endpoint, 'POST', { ...data, operationKey: randomUUID(), email: data.email.toUpperCase() }, first.cookie)).status, 409); ok('case-insensitive duplicate rejected')
  const listing = await api(endpoint, 'GET', undefined, second.cookie)
  assert.equal(listing.data.items.some(i => i.id === referral.id), false); ok('other broker cannot list referral')
  const { contactPermission, ...common } = data
  void contactPermission
  const update = { ...common, expectedVersion: 1, operationKey: randomUUID(), stage: 'CONTACTED', activityNote: 'Contato confirmado pelo parceiro' }
  assert.equal((await api(endpoint + '/' + referral.id, 'PATCH', update, second.cookie)).status, 404); ok('other broker cannot edit')
  const updated = await api(endpoint + '/' + referral.id, 'PATCH', update, first.cookie)
  assert.equal(updated.status, 200); assert.equal(updated.data.referral.version, 2)
  assert.equal(updated.data.referral.activities.length, 2)
  assert.equal(updated.data.referral.followUpAt, '2026-10-05T17:00:00.000Z'); ok('contact, history, next action and UTC persisted')
  const repeat = await api(endpoint + '/' + referral.id, 'PATCH', update, first.cookie)
  assert.equal(repeat.data.referral.activities.length, 2); ok('update retry does not duplicate history')
  assert.equal((await api(endpoint + '/' + referral.id, 'PATCH', { ...update, operationKey: randomUUID() }, first.cookie)).status, 409); ok('stale version rejected')
  const stop = await api(endpoint + '/' + referral.id, 'PATCH', { ...update, expectedVersion: 2, operationKey: randomUUID(), stage: 'DEMO', doNotContact: true }, first.cookie)
  assert.equal(stop.status, 200)
  const retryContact = await api(endpoint + '/' + referral.id, 'PATCH', { ...update, expectedVersion: 3, operationKey: randomUUID() }, first.cookie)
  assert.equal(retryContact.status, 400); ok('do-not-contact prevents a new recorded approach')
  assert.equal((await api(endpoint + '?offset=-1', 'GET', undefined, first.cookie)).status, 400); ok('invalid pagination rejected')
  // Real pagination, isolated synthetic rows; leave test history for user review.
  for (let i = 0; i < 21; i++) {
    const response = await api(endpoint, 'POST', { ...data, operationKey: randomUUID(), email: `partner-page-${randomUUID()}@example.invalid`, name: `FIXTURE Paginação ${i + 1}` }, first.cookie)
    assert.equal(response.status, 200)
  }
  const page1 = await api(endpoint, 'GET', undefined, first.cookie)
  const page2 = await api(endpoint + '?offset=' + page1.data.nextOffset, 'GET', undefined, first.cookie)
  assert.equal(page1.data.items.length, 20)
  assert.ok(page2.data.items.length > 0)
  assert.equal(page2.data.items.some(i => page1.data.items.some(j => j.id === i.id)), false); ok('pagination has no overlap')
  assert.ok(page1.data.metrics.contacted >= 1); ok('contact metric derives from recorded history')
  assert.deepEqual(await snapshot(), before); ok('existing account, billing, property, leads and agenda counts preserved')
  console.log(JSON.stringify({ checks, referralId: referral.id }))
})().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => pool.end())
