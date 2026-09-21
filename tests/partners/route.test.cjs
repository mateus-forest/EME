/* global require */
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CommonJS test. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { NextRequest, NextResponse } = require('next/server')
const { loader } = require('../captacao/load.cjs')

function setup(role = 'BROKER', brokerId = 'own-broker') {
  return loader({ '@/lib/prisma': { prisma: {} }, '@/lib/auth-route': {
    getAuthenticatedUser: async () => ({ user: role ? { role, broker: brokerId ? { id: brokerId } : null } : null }),
    ensureRole: r => r === 'BROKER' ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  } })('lib/partners/route.ts')
}
test('API requires an authenticated broker and passes only server identity to persistence', async () => {
  const req = new NextRequest('http://localhost/api/brokers/partners')
  for (const role of [null, 'AGENCY', 'ADMIN']) {
    const res = await setup(role).partnerRoute(req, async () => { throw Error('must not run') })
    assert.equal(res.status, role ? 403 : 401)
  }
  const res = await setup().partnerRoute(req, async id => ({ id }))
  assert.deepEqual(await res.json(), { id: 'own-broker' })
  assert.match(res.headers.get('cache-control'), /no-store/)
})
test('cross-site writes are blocked even without Origin', async () => {
  const req = new NextRequest('http://localhost/api/brokers/partners', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } })
  const res = await setup().partnerRoute(req, async () => { throw Error('must not run') })
  assert.equal(res.status, 403)
})
test('unavailable storage is an explicit 503 rather than an empty list or zero balance', async () => {
  const res = await setup().partnerRoute(new NextRequest('http://localhost/api/brokers/partners'), async () => { throw Error('database inaccessible') })
  assert.equal(res.status, 503)
  assert.match((await res.json()).error, /indisponíveis/)
})
test('invalid and oversized bodies are rejected', async () => {
  const { partnerBody } = setup()
  await assert.rejects(() => partnerBody(new NextRequest('http://localhost', { method: 'POST', body: '{}' })))
  await assert.rejects(() => partnerBody(new NextRequest('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'invalid' })))
  await assert.rejects(() => partnerBody(new NextRequest('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ' '.repeat(16001) })))
})
