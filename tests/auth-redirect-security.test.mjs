import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"

const require = createRequire(import.meta.url)
const { NextRequest, NextResponse } = require("next/server")

// Exercise the actual helper and proxy with Next's request/response classes.
// No network, database, browser state or authentication credentials are needed.
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

const helpers = load("lib/auth-redirect.ts")
const { getDefaultRouteByRole, getInternalAuthDestination, resolveAuthRedirect } = helpers
const { proxy, config } = load("proxy.ts", {
  "next/server": { NextRequest, NextResponse },
  "./lib/auth-redirect": helpers,
})
const origin = "https://www.meueme.com"
const roles = ["BROKER", "ADMIN", "AGENCY"]
const defaults = { BROKER: "/corretor", ADMIN: "/admin", AGENCY: "/" }

const invalidDestinations = [
  "//outside.example/path", "///outside.example", "/\\outside.example/path",
  "\\\\outside.example/path", "https://outside.example/", "https://www.meueme.com/corretor",
  "http://outside.example", "javascript:alert(1)", "data:text/html,example",
  "corretor", "?next=/corretor", "#corretor", " /corretor", "/corretor ",
  "/\t/outside.example", "/\n/outside.example", "/corretor\u0000", "/corretor\u007f",
  "/%2f%2foutside.example", "/%5coutside.example", "/%252f%252foutside.example",
  "/corretor/%2F../admin", "/corretor/%5c../admin", "/corretor/%252e%252e/admin",
  "/corretor/%00", "/corretor/%09", "/corretor/%0a", "/corretor/%0D", "/corretor/%7f",
  "/corretor/%", "/corretor/%ZZ", "/corretor/%E0%A4%A", "/corretor//imoveis",
  "/login", "/login?next=//outside.example", "/cadastro", "/cadastro/corretor",
  "/recuperar-senha", "/api/auth/logout", "/api/auth/me", "/logout", "/_next/static/app.js",
  "/favicon.ico", "/admin-other", "/corretor-unknown", "/constructor", "/toString", "/__proto__",
  "/hasOwnProperty", "/corretor/../../login", "/corretor/%2e%2e/api/auth/logout",
  "/%3Fanything", "/%23/admin", "/imoveis%3F/admin",
]

for (const value of invalidDestinations) {
  test(`rejects inappropriate destination ${JSON.stringify(value)} on server and client`, () => {
    assert.equal(getInternalAuthDestination(value), null)
    for (const role of roles) assert.equal(resolveAuthRedirect(value, role), defaults[role])
  })
}

test("absent, malformed, duplicate and overlong values use each existing role's default", () => {
  for (const role of roles) {
    assert.equal(getDefaultRouteByRole(role), defaults[role])
    for (const value of [undefined, null, "", 1, true, {}, [], ["/imoveis", "/catalogo/test"], ["/imoveis", "/imoveis"], [null], [["/imoveis"]], `/imoveis?q=${"a".repeat(2048)}`]) {
      assert.equal(getInternalAuthDestination(value), null)
      assert.equal(resolveAuthRedirect(value, role), defaults[role])
    }
  }
})

const publicDestinations = [
  "/", "/?utm_source=launch#como-funciona", "/imoveis", "/imoveis/busca?q=S%C3%A3o%20Paulo#resultados",
  "/imoveis/imovel/casa-em-sao-paulo", "/catalogo/corretor-teste/imoveis?tipo=apartamento#imoveis",
  "/imoveis/busca?q=https%3A%2F%2Fexample.invalid%2Foferta&source=a%2Bb",
]

for (const value of publicDestinations) {
  test(`preserves public destination with query/hash ${value} for every role`, () => {
    assert.equal(getInternalAuthDestination(value), value)
    assert.equal(getInternalAuthDestination([value]), value)
    for (const role of roles) assert.equal(resolveAuthRedirect(value, role), value)
  })
}

const privateDestinations = [
  ["BROKER", "/corretor/imoveis?status=PUBLICADO#lista"],
  ["BROKER", "/corretor/studio-ia/preparar-imovel?propertyId=test-property"],
  ["BROKER", "/dashboard"],
  ["ADMIN", "/admin/usuarios?busca=Jo%C3%A3o#assinatura"],
  ["ADMIN", "/admin"],
  ["AGENCY", "/corporativo"],
  ["AGENCY", "/imobiliaria/conta"],
]

for (const [requiredRole, value] of privateDestinations) {
  test(`preserves ${requiredRole} destination but falls back for other roles: ${value}`, () => {
    assert.equal(getInternalAuthDestination(value), value)
    assert.equal(resolveAuthRedirect(value, requiredRole), value)
    for (const role of roles.filter((entry) => entry !== requiredRole)) {
      assert.equal(getInternalAuthDestination(value, role), null)
      assert.equal(resolveAuthRedirect(value, role), defaults[role])
    }
  })
}

test("normalizes dot segments before choosing the role and preserves search/hash", () => {
  const value = "/corretor/%2e%2e/admin/usuarios?tab=contas#ativa"
  const expected = "/admin/usuarios?tab=contas#ativa"
  assert.equal(getInternalAuthDestination(value), expected)
  assert.equal(resolveAuthRedirect(value, "ADMIN"), expected)
  assert.equal(resolveAuthRedirect(value, "BROKER"), "/corretor")
})

function loginRequest(values, pathname = "/login") {
  const url = new globalThis.URL(pathname, origin)
  url.searchParams.set("utm_source", "launch")
  url.searchParams.set("notice", "email+confirmed")
  for (const value of values) url.searchParams.append("next", value)
  return new NextRequest(url)
}

function assertContinues(response) {
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("x-middleware-next"), "1")
  assert.equal(response.headers.get("location"), null)
}

test("proxy matcher covers the actual login route and its trailing slash", () => {
  assert.ok(config.matcher.includes("/login"))
  assert.ok(config.matcher.includes("/login/:path*"))
})

test("proxy removes all invalid and duplicate next values without losing other parameters", () => {
  for (const values of [...invalidDestinations.map((value) => [value]), [""], ["/imoveis", "/admin"], ["/imoveis", "/imoveis"]]) {
    for (const path of ["/login", "/login/"]) {
      const response = proxy(loginRequest(values, path))
      assert.equal(response.status, 307, JSON.stringify({ values, path }))
      const target = new globalThis.URL(response.headers.get("location"))
      assert.equal(target.origin, origin)
      assert.equal(target.pathname, path)
      assert.equal(target.searchParams.has("next"), false)
      assert.equal(target.searchParams.get("utm_source"), "launch")
      assert.equal(target.searchParams.get("notice"), "email+confirmed")
      assert.equal(response.headers.get("set-cookie"), null)
      assertContinues(proxy(new NextRequest(target)))
    }
  }
})

test("proxy leaves legitimate login destinations and login without next unchanged", () => {
  assertContinues(proxy(loginRequest([])))
  for (const value of [...publicDestinations, ...privateDestinations.map(([, path]) => path)]) {
    assertContinues(proxy(loginRequest([value])))
  }
})

test("proxy replaces a noncanonical next once without an external redirect or loop", () => {
  const response = proxy(loginRequest(["/corretor/../admin?view=users#recent"]))
  assert.equal(response.status, 307)
  const target = new globalThis.URL(response.headers.get("location"))
  assert.equal(target.origin, origin)
  assert.equal(target.pathname, "/login")
  assert.equal(target.searchParams.get("next"), "/admin?view=users#recent")
  assert.equal(target.searchParams.get("utm_source"), "launch")
  assertContinues(proxy(new NextRequest(target)))
})

test("proxy preserves all disabled agency page redirects", () => {
  const redirects = [
    ["/admin/imobiliarias", "/admin/corretores"], ["/cadastro/imobiliaria", "/cadastro/corretor"],
    ["/catalogo/imobiliaria", "/"], ["/corporativo", "/"], ["/imobiliaria", "/"],
  ]
  for (const [path, expected] of redirects) {
    for (const suffix of ["", "/exemplo"]) {
      const response = proxy(new NextRequest(`${origin}${path}${suffix}?next=%2F%2Fevil.example`))
      assert.equal(response.status, 307)
      assert.equal(response.headers.get("location"), `${origin}${expected}`)
    }
  }
})

test("proxy preserves 410 for all disabled agency APIs", async () => {
  for (const path of ["/api/agencies", "/api/agency/brokers", "/api/properties/agency", "/api/catalogs/agency"]) {
    for (const suffix of ["", "/test"]) {
      const response = proxy(new NextRequest(`${origin}${path}${suffix}`))
      assert.equal(response.status, 410)
      assert.equal((await response.json()).error, "Fluxo de imobiliária indisponível no MVP do EME para corretores individuais.")
      assert.equal(response.headers.get("location"), null)
    }
  }
})

test("proxy does not consume unrelated next parameters outside the login route", () => {
  for (const path of ["/", "/imoveis/busca", "/catalogo/corretor-teste", "/corretor", "/login-other", "/api/auth/login"]) {
    assertContinues(proxy(loginRequest(["//outside.example"], path)))
  }
})
