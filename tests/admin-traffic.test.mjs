import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { URL, URLSearchParams } from "node:url"
import console from "node:console"
import ts from "typescript"

const { Request, Response } = globalThis
function load(path, dependencies = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function("require", "exports", code)(name => {
    if (name === "server-only") return {}
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}
const periods = load("lib/admin-journey-contract.ts", { "@/lib/journey/contract": { ADMIN_ANALYTICS_TIME_ZONE: "America/Sao_Paulo" } })
const contract = load("lib/admin-traffic-contract.ts", { "@/lib/admin-journey-contract": periods })
const service = load("lib/admin-traffic.ts", { pg: {}, "@/lib/admin-traffic-sql": {}, "@/lib/admin-traffic-contract": contract })
const now = new Date("2026-09-10T02:30:00Z")
const filters = contract.resolveTrafficFilters(new URLSearchParams("period=today&surface=catalog&route=/catalogo/:id"), now)
const data = { catalogs: [{ label: "catalog_a", views: 3, visitors: 2, sessions: 3, leads: 1 }], quality: { firstReceivedAt: "2026-09-01T03:00:00Z", missingPageIdentity: 0, missingCatalogId: 0, missingSearchIdentity: 0 } }

test("traffic reuses Sao Paulo boundaries and validates surface/normalized route", () => {
  assert.equal(filters.period.start, "2026-09-09T03:00:00.000Z")
  assert.equal(filters.surface, "catalog")
  assert.equal(filters.route, "/catalogo/:id")
  for (const query of ["surface=__proto__", "surface=unknown", "route=//external", "route=/?secret=x", "route=/';DROP", "period=custom&from=2026-09-10&to=2026-09-09"]) assert.throws(() => contract.resolveTrafficFilters(new URLSearchParams(query), now))
  for (const surface of Object.keys(contract.TRAFFIC_SURFACES)) assert.equal(contract.resolveTrafficFilters(new URLSearchParams({ surface }), now).surface, surface)
})

test("missing identities and catalog/search attribution are explicitly partial", () => {
  assert.equal(contract.trafficSourceState(data, filters, true).status, "available")
  for (const field of ["missingPageIdentity", "missingCatalogId", "missingSearchIdentity"]) assert.equal(contract.trafficSourceState({ ...data, quality: { ...data.quality, [field]: 1 } }, filters, true).status, "partial")
  assert.equal(contract.trafficSourceState({ ...data, quality: { ...data.quality, firstReceivedAt: null } }, filters, true).status, "partial")
  assert.equal(contract.trafficSourceState(data, filters, false).status, "partial")
})

test("failed metrics remain unavailable/null and do not query owners", async () => {
  const warn = console.warn; console.warn = () => {}
  try {
    const result = await service.getAdminTraffic(filters, { traffic: async () => { throw Error("offline") }, owners: async () => assert.fail("must not read owners") })
    assert.equal(result.data, null)
    assert.equal(result.state.status, "unavailable")
  } finally { console.warn = warn }
})

test("owner enrichment is descriptive and failure never removes Journey counts", async () => {
  const success = await service.getAdminTraffic(filters, { traffic: async () => data, owners: async slugs => { assert.deepEqual(slugs, ["catalog_a"]); return [{ slug: "catalog_a", owner: "Corretor A", ownerType: "BROKER" }] } })
  assert.equal(success.data.catalogs[0].owner, "Corretor A")
  assert.equal(success.data.catalogs[0].visitors, 2)
  const failed = await service.getAdminTraffic(filters, { traffic: async () => data, owners: async () => { throw Error("offline") } })
  assert.equal(failed.data.catalogs[0].views, 3)
  assert.equal(failed.ownersState.status, "unavailable")
  const ambiguous = await service.getAdminTraffic(filters, { traffic: async () => data, owners: async () => [{ slug: "catalog_a", owner: "A", ownerType: "BROKER" }, { slug: "catalog_a", owner: "B", ownerType: "AGENCY" }] })
  assert.equal(ambiguous.data.catalogs[0].owner, null)
  assert.equal(ambiguous.ownersState.status, "partial")
})

test("API enforces ADMIN, rejects invalid filters before reads, and disables caching", async () => {
  let user = null, reads = 0
  const api = load("app/api/admin/journey-traffic/route.ts", {
    "next/server": { NextResponse: { json: (value, options) => Response.json(value, options) } },
    "@/lib/auth-route": { getAuthenticatedUser: async () => ({ user }), ensureRole: role => role === "ADMIN" ? null : Response.json({}, { status: 403 }) },
    "@/lib/prisma-enums": { UserRole: { ADMIN: "ADMIN" } }, "@/lib/admin-traffic-contract": contract,
    "@/lib/admin-traffic": { getAdminTraffic: async selected => { reads++; return { filters: selected, data: null } } },
  })
  const request = new Request("http://localhost/api/admin/journey-traffic?period=7d")
  assert.equal((await api.GET(request)).status, 401)
  user = { role: "BROKER" }; assert.equal((await api.GET(request)).status, 403)
  user = { role: "ADMIN" }; assert.equal((await api.GET(new Request(`${request.url}&surface=bad`))).status, 400)
  assert.equal(reads, 0)
  const result = await api.GET(request)
  assert.equal(result.status, 200)
  assert.equal(result.headers.get("Cache-Control"), "private, no-store")
  assert.equal((await result.json()).traffic.data, null)
  assert.equal(reads, 1)
})
