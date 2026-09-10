import "server-only"
import { Pool } from "pg"
import type { JourneyEvent } from "@/lib/journey/contract"

const state = globalThis as unknown as { journeyPool?: Pool; journeyWrites?: number; journeyWarningAt?: number }
export async function persistJourneyEvents(events: readonly JourneyEvent[]): Promise<void> {
  if (!events.length || process.env.JOURNEY_ANALYTICS_ENABLED !== "true") return
  if ((state.journeyWrites ?? 0) >= 4) { warnDrop("capacity"); return }
  state.journeyWrites = (state.journeyWrites ?? 0) + 1
  try {
    if (!process.env.DATABASE_URL) return
    if (!state.journeyPool) {
      state.journeyPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 700, idleTimeoutMillis: 5000, statement_timeout: 1500, query_timeout: 2000, allowExitOnIdle: true })
      state.journeyPool.on("error", () => warnDrop("connection"))
    }
    await state.journeyPool.query({ text: `WITH inserted AS (
      INSERT INTO "JourneyEvent" ("eventId","eventName","schemaVersion","occurredAt",producer,"userId","anonymousId","sessionId",pathname,route,referrer,device,module,step,outcome,"requestId","correlationId","brokerId","propertyId","catalogId","errorCode",metadata)
      SELECT e->>'eventId',e->>'eventName',1,(e->>'occurredAt')::timestamptz,e->>'producer',e->>'userId',e->>'anonymousId',e->>'sessionId',e->>'pathname',e->>'route',e->>'referrer',e->>'device',e->>'module',e->>'step',e->>'outcome',e->>'requestId',e->>'correlationId',e->>'brokerId',e->>'propertyId',e->>'catalogId',e->>'errorCode',e->'metadata'
      FROM jsonb_array_elements($1::jsonb) e ON CONFLICT ("eventId") DO NOTHING RETURNING *
    ) INSERT INTO "JourneyIdentityLink" ("anonymousId","sessionId","userId","authenticatedAt")
      SELECT "anonymousId","sessionId","userId",MIN("occurredAt") FROM inserted
      WHERE "eventName" IN ('signup_completed','login_completed') AND "userId" IS NOT NULL AND "anonymousId" IS NOT NULL AND "sessionId" IS NOT NULL
      GROUP BY "anonymousId","sessionId","userId"
      ON CONFLICT ("anonymousId","sessionId","userId") DO UPDATE SET "authenticatedAt"=LEAST("JourneyIdentityLink"."authenticatedAt",EXCLUDED."authenticatedAt")`, values: [JSON.stringify(events.slice(0, 1000))] })
  } catch { warnDrop("storage") } finally { state.journeyWrites = Math.max(0, (state.journeyWrites ?? 1) - 1) }
}
function warnDrop(reason: string) {
  if (Date.now() - (state.journeyWarningAt ?? 0) > 60_000) {
    state.journeyWarningAt = Date.now()
    console.warn("[journey] events not persisted", { reason })
  }
}
