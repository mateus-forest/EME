import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { URL } from "node:url"
import process from "node:process"
import pg from "pg"

// Explicit opt-in: SELECT-only fixtures in a READ ONLY transaction. No inserts, temp tables or cleanup.
test("PostgreSQL aggregates deduplicate whole-period identities, order funnel stages and separate public/product actors", { skip: process.env.ADMIN_JOURNEY_SQL_TEST !== "true" }, async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, query_timeout: 15000 })
  const sql = readFileSync(new URL("../lib/admin-journey-sql.ts", import.meta.url), "utf8").match(/ADMIN_JOURNEY_SQL = `([\s\S]*)`/)[1]
  const events = []
  const add = (eventName, time, fields = {}) => events.push({ eventId: `event_${events.length}`, eventName, schemaVersion: 1, occurredAt: `2026-09-${time}:00Z`, receivedAt: `2026-09-${time}:00Z`, producer: "browser", sessionId: "session_a", anonymousId: "anonymous_a", userId: null, pathname: "/", route: "/", device: "desktop", module: "landing", metadata: {}, ...fields })
  add("page_view", "09T22:00")
  add("landing_view", "09T22:00")
  add("landing_view", "09T22:05")
  add("signup_started", "09T22:01", { module: "auth" })
  add("signup_completed", "09T22:02", { producer: "server", userId: "user_a", module: "auth" })
  add("checkout_started", "09T22:03", { producer: "server", userId: "user_a", module: "billing" })
  add("checkout_completed", "09T22:04", { producer: "server", userId: "user_a", module: "billing" })
  // Same browser on another day/session: daily uniques sum to more than whole-period uniques.
  add("page_view", "10T12:00", { sessionId: "session_a2" })
  add("signup_completed", "10T12:01", { sessionId: "session_a2", producer: "server", userId: "user_a", module: "auth" })
  // Completion before signup start must not advance the funnel.
  add("page_view", "10T13:00", { sessionId: "session_b", anonymousId: "anonymous_b" })
  add("landing_view", "10T13:00", { sessionId: "session_b", anonymousId: "anonymous_b" })
  add("signup_completed", "10T12:59", { sessionId: "session_b", anonymousId: "anonymous_b", producer: "server", userId: "user_b", module: "auth" })
  add("signup_started", "10T13:01", { sessionId: "session_b", anonymousId: "anonymous_b", module: "auth" })
  add("page_view", "10T02:00") // September 9 in Sao Paulo.
  add("page_view", "10T12:00", { device: "bot", anonymousId: "bot_identity" })
  add("page_view", "10T12:00", { module: "admin", pathname: "/admin" })
  add("page_view", "10T12:00", { module: "billing", pathname: "/admin/assinaturas" })
  add("catalog_view", "10T14:00", { pathname: "/catalogo/:id", route: "/catalogo/:id", module: "catalog", brokerId: "owner_broker", userId: "visitor_user" })
  add("lead_created", "10T14:01", { pathname: "/catalogo/:id", route: "/api/leads", module: "clients", producer: "server", brokerId: "owner_broker" })
  add("cos_message_sent", "10T14:02", { pathname: "/corretor", route: "/api/cos-launch", module: "cos", producer: "server", userId: "user_a" })
  add("error_occurred", "10T14:03", { pathname: "/corretor/plano", route: "/api/stripe/create-checkout", module: "billing", producer: "server", userId: "user_a", errorCode: "HTTP_400" })
  add("checkout_failed", "10T14:03", { pathname: "/corretor/plano", route: "/api/stripe/create-checkout", module: "billing", producer: "server", userId: "user_a", errorCode: "HTTP_400" })
  const fixtureSql = sql.replaceAll('"JourneyEvent"', 'fixture_events').replace('WITH scope AS', 'WITH fixture_events AS (SELECT * FROM jsonb_populate_recordset(NULL::"JourneyEvent", $4::jsonb)), scope AS')
  try {
    await client.connect(); await client.query("BEGIN READ ONLY")
    assert.equal((await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only, "on")
    const data = (await client.query(fixtureSql, ["2026-09-09T03:00:00Z", "2026-09-11T03:00:00Z", "day", JSON.stringify(events)])).rows[0].data
    assert.equal(data.totals.pageViews, 4)
    assert.equal(data.totals.visitors, 2)
    assert.equal(data.totals.sessions, 3)
    assert.deepEqual(data.series.map(p => p.visitors), [1, 2])
    assert.deepEqual(data.series.map(p => p.views), [2, 2])
    assert.equal(data.totals.signupCompleted, 2)
    assert.deepEqual(data.funnel.map(p => p.count), [2, 2, 1, 1, 1])
    assert.equal(data.funnel[0].total, 3)
    assert.deepEqual(data.modules, [{ label: "cos", count: 1, users: 1 }])
    assert.deepEqual(data.actions, [{ label: "cos_message_sent", count: 1 }])
    assert.equal(data.totals.leads, 1)
    assert.equal(data.totals.errors, 1)
    assert.deepEqual(data.errors.codes, [{ label: "HTTP_400", count: 1 }])
    assert.equal(data.errors.users, 1)
    assert.equal(data.sources.reduce((sum, row) => sum + row.count, 0), 3)
    assert.equal(data.routes[0].visitors, 2)
    await client.query("COMMIT")
  } finally { await client.end() }
})
