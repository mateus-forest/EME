import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { URL } from "node:url"
import process from "node:process"
import pg from "pg"

// SELECT-only fixture CTE in a READ ONLY transaction: no DDL, inserts or cleanup.
test("traffic SQL respects whole-period uniqueness, historical entries, explicit attribution and surface filters", { skip: process.env.ADMIN_TRAFFIC_SQL_TEST !== "true" }, async () => {
  const sql = readFileSync(new URL("../lib/admin-traffic-sql.ts", import.meta.url), "utf8").match(/ADMIN_TRAFFIC_SQL = `([\s\S]*?)`/)[1]
  const events = []
  const add = (time, pathname = "/", fields = {}) => events.push({ eventId: `event_${String(events.length).padStart(3, "0")}`, eventName: "page_view", schemaVersion: 1, occurredAt: `2026-09-${time}:00Z`, receivedAt: `2026-09-${time}:00Z`, producer: "browser", sessionId: "session_a", anonymousId: "anonymous_a", userId: null, pathname, route: pathname, device: "desktop", module: "other", metadata: {}, ...fields })
  add("08T12:00", "/", { sessionId: "old_a" })
  add("09T02:59", "/", { sessionId: "session_b", anonymousId: "anonymous_b", referrer: "google.com", metadata: { utmSource: "google", utmMedium: "cpc" } })
  add("09T04:00")
  add("09T04:01", "/imoveis")
  add("09T04:02", "/imoveis/:id")
  add("10T04:00", "/corretor/studio-ia", { sessionId: "session_a2", userId: "user_a" })
  add("09T03:10", "/catalogo/:id", { sessionId: "session_b", anonymousId: "anonymous_b", brokerId: "owner_broker" })
  add("10T05:00", "/catalogo/:id", { sessionId: "session_b2", anonymousId: "anonymous_b", brokerId: "owner_broker" })
  add("10T05:30", "/login", { sessionId: "session_c", anonymousId: "anonymous_c" })
  add("10T17:45", "/imoveis", { sessionId: "session_d", anonymousId: "anonymous_d" })
  add("10T17:00", "/", { sessionId: "session_e", anonymousId: "anonymous_e" })
  add("10T18:05", "/imoveis", { sessionId: "session_e", anonymousId: "anonymous_e" }) // beyond cutoff: cannot claim an exit inside the range
  add("10T15:00", "/", { sessionId: null, anonymousId: null })
  add("10T12:00", "/", { device: "bot", anonymousId: "bot_identity" })
  add("10T12:00", "/admin/assinaturas", { module: "billing", anonymousId: "admin_identity" })
  add("10T12:00", "/", { producer: "server", anonymousId: "invalid_producer" })
  add("09T04:01", "/imoveis", { eventName: "marketplace_view" })
  const search = (time, searchId, fields = {}) => add(time, "/imoveis", { eventName: "marketplace_search", metadata: { searchId }, ...fields })
  const open = (time, searchId, fields = {}) => add(time, "/imoveis/:id", { eventName: "marketplace_result_opened", metadata: { searchId }, ...fields })
  search("09T04:01", "search_1"); search("09T04:02", "search_2"); search("09T04:03", null)
  open("09T04:02", "search_1"); open("09T04:03", "search_1")
  open("09T04:01", "search_2") // before search, must not convert
  open("09T04:04", "search_2", { sessionId: "wrong_session" })
  const catalog = (time, name, fields = {}) => add(time, "/catalogo/:id", { eventName: name, sessionId: "session_b", anonymousId: "anonymous_b", catalogId: "catalog_a", brokerId: "owner_broker", ...fields })
  catalog("09T03:10", "catalog_view"); catalog("10T05:00", "catalog_view", { sessionId: "session_b2" })
  catalog("10T05:01", "catalog_property_opened")
  catalog("10T05:02", "lead_created", { producer: "server", metadata: { channel: "catalog" } })
  catalog("10T05:03", "lead_created", { producer: "server", metadata: { channel: "manual" } }) // never attributed just because route/catalogId match
  catalog("10T05:04", "catalog_view", { catalogId: null })
  add("10T05:05", "/api/marketplace/leads", { producer: "server", eventName: "lead_created", metadata: { channel: "marketplace" } })
  add("10T05:06", "/api/leads", { producer: "browser", eventName: "lead_created", metadata: { channel: "marketplace" } }) // forged success excluded
  const fixtureSql = sql.replaceAll('"JourneyEvent"', "fixture_events").replace("WITH period_events AS", 'WITH fixture_events AS (SELECT * FROM jsonb_populate_recordset(NULL::"JourneyEvent",$6::jsonb)), period_events AS')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, query_timeout: 20000 })
  try {
    await client.connect(); await client.query("BEGIN READ ONLY")
    assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on")
    const read = async (surface = "all", route = null, start = "2026-09-09T03:00:00Z") => (await client.query(fixtureSql, [start, "2026-09-10T18:00:00Z", "day", surface, route, JSON.stringify(events)])).rows[0].data
    const data = await read()
    assert.deepEqual(data.totals, { views: 10, visitors: 5, sessions: 7, pagesPerSession: 1.29, newVisitors: 3, returningVisitors: 2, entries: 6 })
    assert.deepEqual(data.series.map(row => row.visitors), [2, 5]) // never sum these to get 5
    assert.deepEqual(data.marketplace, { views: 1, searches: 3, opened: 4, leads: 1, linkedSearches: 2, convertedSearches: 1, searchRate: 50, unlinkedOpens: 2 })
    assert.equal(data.catalogs[0].visitors, 1) // visitor B, not owner_broker
    assert.equal(data.catalogs[0].sessions, 2)
    assert.equal(data.catalogs[0].leads, 1)
    assert.equal(data.catalogs[0].owner, null)
    assert.equal(data.catalogTotals.views, 3)
    assert.equal(data.quality.missingCatalogId, 1)
    assert.equal(data.quality.missingPageIdentity, 1)
    assert.equal(data.quality.missingSearchIdentity, 1)
    assert.equal(data.routes.reduce((sum, row) => sum + row.exits, 0), 5) // active D and future E excluded
    const catalogs = await read("catalog")
    assert.equal(catalogs.totals.views, 2)
    assert.equal(catalogs.totals.visitors, 1)
    assert.equal(catalogs.totals.newVisitors, 0) // prior visit to landing still makes B returning
    assert.equal(catalogs.totals.entries, 1) // B's first entry is before the range, never re-created at catalog
    assert.equal(catalogs.acquisition.find(row => row.source === "google").sessions, 1)
    assert.equal(catalogs.marketplace.leads, 0)
    const market = await read("marketplace")
    assert.equal(market.totals.views, 3)
    assert.equal(market.totals.entries, 1) // only D entered at Marketplace
    assert.equal(market.totals.visitors, 2)
    assert.equal((await read("portal")).totals.visitors, 1)
    assert.equal((await read("other")).totals.views, 1)
    assert.equal((await read("all", "/imoveis/:id")).marketplace.searchRate, null) // no searches inside narrowed route
    const noPages = await read("all", "/missing")
    assert.equal(noPages.totals.pagesPerSession, null)
    assert.equal(noPages.marketplace.searchRate, null)
    assert.deepEqual(noPages.routes, [])
    const lastDay = await read("all", null, "2026-09-10T03:00:00Z")
    assert.equal(lastDay.totals.visitors, 5)
    assert.equal(lastDay.totals.returningVisitors, 2)
    await client.query("COMMIT")
  } finally { await client.end() }
})

test("catalog owner lookup honors current Catalog links, aliases and fallback without reading activity", { skip: process.env.ADMIN_TRAFFIC_SQL_TEST !== "true" }, async () => {
  let sql = readFileSync(new URL("../lib/admin-traffic-sql.ts", import.meta.url), "utf8").match(/ADMIN_TRAFFIC_OWNERS_SQL = `([\s\S]*?)`/)[1]
  for (const table of ["Catalog", "Broker", "Agency", "User"]) sql = sql.replaceAll(`"${table}"`, `fixture_${table.toLowerCase()}`)
  sql = sql.replace("WITH owner_refs AS", `WITH
    fixture_catalog AS (SELECT * FROM jsonb_populate_recordset(NULL::"Catalog",$2::jsonb)),
    fixture_broker AS (SELECT * FROM jsonb_populate_recordset(NULL::"Broker",$3::jsonb)),
    fixture_agency AS (SELECT * FROM jsonb_populate_recordset(NULL::"Agency",$4::jsonb)),
    fixture_user AS (SELECT * FROM jsonb_populate_recordset(NULL::"User",$5::jsonb)), owner_refs AS`)
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, query_timeout: 15000 })
  try {
    await client.connect(); await client.query("BEGIN READ ONLY")
    const result = await client.query(sql, [
      ["canonical", "alias", "agency_alias", "missing"],
      JSON.stringify([{ id: "c1", slug: "alias", ownerId: "b1", ownerType: "BROKER" }, { id: "c2", slug: "agency_alias", ownerId: "a1", ownerType: "AGENCY" }]),
      JSON.stringify([{ id: "b1", userId: "u1", catalogSlug: "canonical" }, { id: "wrong_broker", userId: "u2", catalogSlug: "alias" }]),
      JSON.stringify([{ id: "a1", ownerUserId: "u3", catalogSlug: "agency_canonical", name: "Agency A" }]),
      JSON.stringify([{ id: "u1", name: "Broker A" }, { id: "u2", name: "Incorrect fallback" }]),
    ])
    assert.deepEqual(result.rows.sort((a, b) => a.slug.localeCompare(b.slug)), [
      { slug: "agency_alias", owner: "Agency A", ownerType: "AGENCY" },
      { slug: "alias", owner: "Broker A", ownerType: "BROKER" },
      { slug: "canonical", owner: "Broker A", ownerType: "BROKER" },
    ])
    await client.query("COMMIT")
  } finally { await client.end() }
})
