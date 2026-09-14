const test = require("node:test"),
  assert = require("node:assert/strict")
const { loader } = require("./load.cjs")
const fixtures = require("./fixtures.cjs")
const load = loader()
const c = load("lib/captacao/contract.ts")
const g = load("lib/captacao/gecko.ts")
test("validated filters reject ranges, unsupported sources, extra keys and invalid page", () => {
  assert.equal(
    c.filterSchema.safeParse({ ...fixtures.filters, priceMin: 700000 }).success,
    false,
  )
  assert.equal(
    c.searchSchema.safeParse({
      filters: fixtures.filters,
      sources: ["portalzuk"],
      page: 1,
    }).success,
    false,
  )
  assert.equal(
    c.searchSchema.safeParse({
      filters: fixtures.filters,
      sources: ["olx"],
      page: 0,
    }).success,
    false,
  )
  assert.equal(
    c.filterSchema.safeParse({ ...fixtures.filters, url: "https://localhost" })
      .success,
    false,
  )
})
test("vendor filters and local filters are explicitly different, page 2 preserved", () => {
  const f = {
    ...fixtures.filters,
    bedrooms: 2,
    parking: 1,
    propertyType: "apartment",
  }
  const vr = g.requestFor("vivareal", f, 2)
  assert.deepEqual(vr.body.bedrooms, [2])
  assert.equal(vr.body.page, 2)
  assert.equal(vr.body.neighborhood, "Centro")
  const olx = g.requestFor("olx", f, 2)
  assert.equal(olx.body.categoryPath, "imoveis")
  assert.equal(olx.body.bedrooms, undefined)
  assert.ok(olx.local.includes("quartos"))
  assert.equal(g.requestFor("zap", f, 1).body.propertyTypes, undefined)
})
for (const source of c.sources)
  test(`normalize actual documented ${source} structure and pagination (synthetic fixture)`, () => {
    const r = g.normalizeResponse(
      source,
      fixtures.response(source),
      new Date().toISOString(),
      fixtures.filters,
    )
    assert.equal(r.items.length, 1)
    assert.equal(r.nextPage, 2)
    assert.equal(r.items[0].price, 500000)
    assert.equal(r.items[0].city, "São Paulo")
    assert.notEqual(r.items[0].checkedAt, r.items[0].publishedAt)
    assert.notEqual(r.items[0].advertiser.kind, "owner")
    assert.equal(
      g.normalizeResponse(
        source,
        fixtures.response(source, 2),
        new Date().toISOString(),
        fixtures.filters,
        2,
      ).nextPage,
      null,
    )
  })
test("OLX hashes are neither names nor phones; malformed phone strings rejected", () => {
  const l = g.normalizeListing(
    "olx",
    fixtures.items.olx,
    new Date().toISOString(),
  )
  assert.equal(l.advertiser.phone, null)
  assert.equal(l.advertiser.name, "")
  assert.equal(c.usablePhone("1234567890abcdef1234567890abcdef"), null)
  assert.equal(c.usablePhone("11999991234<script>"), null)
  assert.equal(c.usablePhone("(11) 99999-1234"), "5511999991234")
})
test("private advertiser is unknown; professional classification requires evidence", () => {
  const l = g.normalizeListing(
    "vivareal",
    fixtures.items.vivareal,
    new Date().toISOString(),
  )
  assert.equal(l.advertiser.kind, "unknown")
  const a = g.normalizeListing(
    "vivareal",
    { ...fixtures.items.vivareal, advertiser: { license: "CRECI J-1234-SP" } },
    new Date().toISOString(),
  )
  assert.equal(a.advertiser.kind, "agency")
})
test("domain allowlist rejects private hosts, malicious subdomain suffixes, credentials and schemes", () => {
  for (const u of [
    "http://olx.com.br/x",
    "https://olx.com.br.evil.test/x",
    "https://127.0.0.1/x",
    "javascript:alert(1)",
    "https://olx.com.br@evil.test/x",
    "https://olx.com.br:8443/x",
  ])
    assert.equal(c.safeUrl(u, "olx"), null)
})
test("missing filtered facts excluded and reported, never inferred", () => {
  const r = g.normalizeResponse(
    "zap",
    fixtures.response("zap"),
    new Date().toISOString(),
    { ...fixtures.filters, propertyType: "apartment" },
  )
  assert.equal(r.items.length, 0)
  assert.equal(r.excluded, 1)
  assert.equal(r.nextPage, 2)
})
test("uncertain duplicate flags preserve both sources", () => {
  const a = g.normalizeListing(
      "chavesnamao",
      fixtures.items.chavesnamao,
      new Date().toISOString(),
    ),
    b = g.normalizeListing(
      "vivareal",
      fixtures.items.vivareal,
      new Date().toISOString(),
    )
  const r = c.possibleDuplicates([a, b])
  assert.equal(r.length, 2)
  assert.deepEqual(r[0].possibleDuplicates, [b.key])
  assert.notEqual(r[0].url, r[1].url)
})
test("removed/malformed/upstream errors never masquerade as empty", async () => {
  assert.throws(
    () =>
      g.normalizeResponse(
        "olx",
        { notFound: true, data: null },
        "",
        fixtures.filters,
      ),
    { code: "LISTING_REMOVED" },
  )
  assert.throws(
    () =>
      g.normalizeResponse(
        "olx",
        { data: { source: "olx.com.br" } },
        "",
        fixtures.filters,
      ),
    { code: "INVALID_RESPONSE" },
  )
  let attempts = 0
  await assert.rejects(
    () =>
      g.extract({}, "fixture", async () => {
        attempts++
        return new Response("{}", { status: 402 })
      }),
    { code: "USAGE_LIMIT" },
  )
  assert.equal(attempts, 1)
  await assert.rejects(
    () =>
      g.extract({}, "fixture", async () => {
        throw new Error("secret provider error")
      }),
    { code: "SOURCE_UNAVAILABLE" },
  )
})
test("outreach does not invent owners, buyers, prior contact or promises", () => {
  const l = g.normalizeListing(
    "olx",
    fixtures.items.olx,
    new Date().toISOString(),
  )
  const a = c.buildApproach(l, "unknown", "service", "Ana", "São Paulo", false)
  assert.match(a.message, /Você é o proprietário/)
  assert.doesNotMatch(a.message, /comprador interessado|garanto|nossa conversa/)
  const f = c.buildApproach(l, "unknown", "followup", "Ana", "", false)
  assert.doesNotMatch(f.message, /nossa conversa/)
  const p = c.buildApproach(l, "broker", "partnership", "Ana", "", true)
  assert.match(p.message, /parceria/)
})

test("actual search handler preserves successful source when another fails", async () => {
  const { NextRequest } = require("next/server")
  const route = loader({
    "@/lib/captacao/route": {
      body: async (req) => req.json(),
      captacaoRoute: async (req, fn) => fn("fixture-broker"),
    },
    "@/lib/captacao/service": {
      configured: () => true,
      runQuery: async (broker, source, filters, page) => {
        if (source === "olx")
          throw new g.ProviderError("SOURCE_UNAVAILABLE", "Fonte indisponível")
        return {
          ...g.normalizeResponse(
            source,
            fixtures.response(source, page),
            new Date().toISOString(),
            filters,
            page,
          ),
          source,
        }
      },
    },
  })("app/api/brokers/captacao/search/route.ts")
  const result = await route.POST(
    new NextRequest("http://localhost/api/brokers/captacao/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: fixtures.filters,
        sources: ["chavesnamao", "olx"],
        page: 1,
      }),
    }),
  )
  assert.equal(result.partial, true)
  assert.equal(result.items.length, 1)
  assert.equal(result.results[1].status, "error")
  assert.equal(result.results[1].code, "SOURCE_UNAVAILABLE")
})
