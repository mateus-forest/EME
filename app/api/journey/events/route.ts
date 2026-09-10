import { after, NextRequest, NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth"
import { ANONYMOUS_COOKIE, SESSION_COOKIE, normalizeJourneyEvent } from "@/lib/journey/contract"
import { persistJourneyEvents } from "@/lib/journey/persistence"

const buckets = new Map<string, { count: number; until: number }>()
export async function POST(request: NextRequest) {
  const accepted = () => NextResponse.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } })
  try {
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 })
    if (Number(request.headers.get("content-length") ?? 0) > 32_768) return new NextResponse(null, { status: 413 })
    // Stream limit also protects requests without Content-Length.
    const reader = request.body?.getReader()
    if (!reader) return accepted()
    let size = 0; const chunks: Uint8Array[] = []
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 32_768) { await reader.cancel(); return new NextResponse(null, { status: 413 }) }; chunks.push(part.value) }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!Array.isArray(body.events) || body.events.length > 20) return new NextResponse(null, { status: 400 })
    let actorId: string | null = null
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
    if (token) { try { actorId = (await verifyAuthToken(token)).userId } catch { /* anonymous */ } }
    const events = body.events.map((value: unknown) => {
      const event = normalizeJourneyEvent(value, "browser")
      if (event && event.sessionId === request.cookies.get(SESSION_COOKIE)?.value && event.anonymousId === request.cookies.get(ANONYMOUS_COOKIE)?.value) event.userId = actorId
      return event
    }).filter((value: ReturnType<typeof normalizeJourneyEvent>): value is NonNullable<typeof value> => Boolean(value))
    const key = events[0]?.sessionId
    if (!key) return accepted()
    const now = Date.now()
    const bucket = buckets.get(key)
    if (bucket && bucket.until > now && bucket.count >= 240) return new NextResponse(null, { status: 429 })
    buckets.set(key, { count: (bucket && bucket.until > now ? bucket.count : 0) + events.length, until: bucket && bucket.until > now ? bucket.until : now + 60_000 })
    if (buckets.size > 2000) for (const [id, value] of buckets) { if (value.until < now) buckets.delete(id) }
    if (buckets.size > 3000) buckets.delete(buckets.keys().next().value!)
    after(() => persistJourneyEvents(events))
    return accepted()
  } catch { return accepted() }
}
