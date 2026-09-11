import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require("next/server")

// Execute the actual route with an explicit dependency boundary. No database,
// credentials, providers or network are available to the handler in this suite.
function load(file, dependencies = {}) {
  const source = readFileSync(new globalThis.URL(`../${file}`, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const exports = {}
  new Function("require", "exports", outputText)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}

const enums = load("lib/prisma-enums.ts")
const base = {
  name: "Corretor de teste",
  email: " PUBLIC-SIGNUP@example.invalid ",
  password: " exact password with spaces ",
  phone: "11999999999",
  creci: "12345-F",
  creciUf: "sp",
  companyName: "Imobiliária de teste",
}

function harness({ existingUser = null, creciStatus = "VERIFIED" } = {}) {
  const calls = []
  const record = (name, value) => { calls.push({ name, value }) }
  const create = (model, id) => async ({ data }) => {
    record(`${model}.create`, data)
    return { id, ...data }
  }
  const findSlug = (model) => async (args) => { record(`${model}.findUnique`, args); return null }
  const tx = {
    user: { create: create("user", "user-test") },
    broker: { create: create("broker", "broker-test"), findUnique: findSlug("broker") },
    agency: { create: create("agency", "agency-test"), findUnique: findSlug("agency") },
    catalog: { create: create("catalog", "catalog-test"), findUnique: findSlug("catalog") },
    subscription: { create: create("subscription", "subscription-test") },
  }
  const route = load("app/api/auth/register/route.ts", {
    "@/lib/journey/server": {
      withJourneyRoute: (pathname, handler) => {
        assert.equal(pathname, "/api/auth/register")
        return handler
      },
    },
    "@/lib/prisma-enums": enums,
    bcryptjs: { hash: async (password, rounds) => { record("hash", { password, rounds }); return "test-only-hash" } },
    "next/server": { NextRequest, NextResponse },
    "@/lib/auth-errors": { isDatabaseUnavailableError: () => false },
    "@/lib/auth": {
      createAuthToken: async (payload) => { record("createAuthToken", payload); return "test-only-token" },
      setAuthCookie: (response, token) => { record("setAuthCookie", token); response.cookies.set("eme_auth", token, { httpOnly: true }) },
    },
    "@/lib/imobisec.server": {
      validateBrokerCreci: async (input) => {
        record("validateBrokerCreci", input)
        return {
          state: input.state, creci: input.creci, status: creciStatus, reason: "NOT_FOUND",
          checkedAt: new Date("2026-09-11T00:00:00.000Z"), officialName: base.name,
          officialRegistration: input.creci, providerStatus: "ACTIVE", provider: "IMOBISEC", nameMismatch: false,
        }
      },
    },
    "@/lib/prisma": {
      prisma: {
        user: { findUnique: async (args) => { record("user.findUnique", args); return existingUser } },
        $transaction: async (callback) => { record("transaction", null); return callback(tx) },
      },
    },
  })
  const post = (body) => route.POST(new NextRequest("http://localhost/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }))
  return { post, calls, POST: route.POST }
}

const deniedRoles = [
  "ADMIN", "SUPERADMIN", "OWNER", "STAFF", "SUPPORT", "ROOT", "USER", "UNKNOWN",
  "admin", "broker", " ADMIN ", "BROKER\u0000", "", null, undefined, true, 1,
  ["BROKER"], { role: "BROKER" }, { toString: "BROKER" }, "__proto__", "constructor",
]

for (const role of deniedRoles) {
  test(`public signup rejects role ${JSON.stringify(role)} before any provider, lookup, write or session`, async () => {
    const h = harness()
    const response = await h.post({ ...base, role })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, "PUBLIC_REGISTRATION_ROLE_INVALID")
    assert.equal(response.headers.get("set-cookie"), null)
    assert.deepEqual(h.calls, [])
  })
}

test("malformed or absent JSON cannot reach account creation", async () => {
  const h = harness()
  for (const body of ["{", "null", "[]"]) {
    const response = await h.POST(new NextRequest("http://localhost/api/auth/register", {
      method: "POST", headers: { "content-type": "application/json" }, body,
    }))
    assert.equal(response.status, 400)
    assert.equal(response.headers.get("set-cookie"), null)
  }
  assert.deepEqual(h.calls, [])
})

for (const role of ["BROKER", "AGENCY"]) {
  test(`legitimate ${role} signup preserves owner, catalogue, trial and session`, async () => {
    const h = harness()
    const started = Date.now()
    const response = await h.post({ ...base, role, isAdmin: true, permissions: ["ADMIN"], user: { role: "ADMIN" } })
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.user.role, role)
    assert.equal(body.user.email, "public-signup@example.invalid")
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0")
    assert.match(response.headers.get("set-cookie"), /eme_auth=/)
    const call = (name) => h.calls.filter((entry) => entry.name === name)
    assert.equal(call("transaction").length, 1)
    assert.deepEqual(call("hash")[0].value, { password: base.password, rounds: 10 })
    assert.deepEqual(call("user.create")[0].value, {
      name: base.name, email: "public-signup@example.invalid", passwordHash: "test-only-hash", role,
    })
    assert.deepEqual(call("createAuthToken")[0].value, { sub: "user-test", email: "public-signup@example.invalid", role })
    assert.equal(call("setAuthCookie").length, 1)
    assert.ok(h.calls.findIndex((entry) => entry.name === "createAuthToken") > h.calls.findIndex((entry) => entry.name === "subscription.create"))

    const model = role === "BROKER" ? "broker" : "agency"
    const ownerId = `${model}-test`
    assert.equal(body.user[`${model}Id`], ownerId)
    assert.equal(body.user[role === "BROKER" ? "agencyId" : "brokerId"], null)
    assert.equal(call(role === "BROKER" ? "agency.create" : "broker.create").length, 0)
    const owner = call(`${model}.create`)[0].value
    assert.equal(owner[role === "BROKER" ? "userId" : "ownerUserId"], "user-test")
    assert.deepEqual(call("catalog.create")[0].value, { slug: owner.catalogSlug, ownerType: role, ownerId })
    const subscription = call("subscription.create")[0].value
    assert.equal(subscription.ownerType, role)
    assert.equal(subscription.ownerId, ownerId)
    assert.equal(subscription.status, "TRIALING")
    assert.ok(subscription.nextBillingAt.getTime() >= started + 7 * 86400000)
    assert.ok(subscription.nextBillingAt.getTime() <= Date.now() + 7 * 86400000)
    if (role === "BROKER") {
      assert.deepEqual(call("validateBrokerCreci")[0].value, { state: "SP", creci: base.creci, informedName: base.name })
      assert.equal(owner.creciUf, "SP")
      assert.equal(owner.creci, base.creci)
      assert.equal(body.user.creciValidationStatus, "VERIFIED")
    } else {
      assert.equal(call("validateBrokerCreci").length, 0)
      assert.equal(owner.name, base.companyName)
    }
  })
}

for (const [role, field] of [["BROKER", "creci"], ["BROKER", "creciUf"], ["AGENCY", "companyName"], ["BROKER", "name"], ["AGENCY", "email"], ["BROKER", "password"]]) {
  test(`${role} still requires ${field} before creating an account`, async () => {
    const h = harness()
    const response = await h.post({ ...base, role, [field]: "" })
    assert.equal(response.status, 400)
    assert.equal(response.headers.get("set-cookie"), null)
    assert.deepEqual(h.calls, [])
  })
}

test("existing accounts, including ADMIN, are not overwritten, downgraded or issued a session", async () => {
  const existingUser = { id: "existing-admin", role: "ADMIN", email: "public-signup@example.invalid" }
  const before = { ...existingUser }
  const h = harness({ existingUser })
  const response = await h.post({ ...base, role: "BROKER" })
  assert.equal(response.status, 409)
  assert.equal(response.headers.get("set-cookie"), null)
  assert.deepEqual(h.calls.map((call) => call.name), ["user.findUnique"])
  assert.deepEqual(existingUser, before)
})

test("rejected CRECI preserves the real validation failure and prevents writes and session", async () => {
  const h = harness({ creciStatus: "REJECTED" })
  const response = await h.post({ ...base, role: "BROKER" })
  assert.equal(response.status, 422)
  assert.equal(response.headers.get("set-cookie"), null)
  assert.deepEqual(h.calls.map((call) => call.name), ["user.findUnique", "validateBrokerCreci"])
})
