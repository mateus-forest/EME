import "server-only"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import { after } from "next/server"
import { ANONYMOUS_COOKIE, SESSION_COOKIE, journeyDevice, journeyId, journeyModule, journeyRoute, normalizeJourneyEvent, type JourneyEvent, type JourneyEventName } from "@/lib/journey/contract"
import { journeyErrorCode } from "@/lib/journey/errors"
import { persistJourneyEvents } from "@/lib/journey/persistence"

type Context = { requestId: string; correlationId: string; anonymousId: string | null; sessionId: string | null; pathname: string; route: string; referrer: string | null; device: JourneyEvent["device"]; userId: string | null; events: JourneyEvent[]; scheduled: boolean; errorReported?: boolean; studioOperationId?: string; studioCompleted?: boolean }
const storage = new AsyncLocalStorage<Context>()
const capturedErrors = new WeakSet<object>()
export function getJourneyContext() { return storage.getStore() }
export function setJourneyActor(userId: string) { const context = storage.getStore(); if (context) context.userId = journeyId(userId) }
export function journeyKey(name: JourneyEventName, entity: string) { return createHash("sha256").update(`${name}:${entity}`).digest("hex") }
export function journeyRequestContext(request: Request, route: string): Context {
  const cookies = Object.fromEntries((request.headers.get("cookie") ?? "").split(";").map((part) => part.trim().split("=")))
  const requestId = journeyId(request.headers.get("x-eme-request-id")) ?? randomUUID()
  return { requestId, correlationId: journeyId(request.headers.get("x-eme-correlation-id")) ?? requestId,
    anonymousId: journeyId(cookies[ANONYMOUS_COOKIE]), sessionId: journeyId(cookies[SESSION_COOKIE]),
    pathname: journeyRoute(request.headers.get("x-eme-pathname") ?? new URL(request.url).pathname), route: journeyRoute(route),
    referrer: request.headers.get("referer"), device: journeyDevice(request.headers.get("user-agent") ?? ""), userId: null, events: [], scheduled: false }
}
export function emitJourney(eventName: JourneyEventName, fields: Partial<JourneyEvent> & { dedupeKey?: string } = {}): void {
  try {
    if (process.env.JOURNEY_ANALYTICS_ENABLED !== "true") return
    const context = storage.getStore()
    const event = normalizeJourneyEvent({ ...context, ...fields, eventName, eventId: fields.dedupeKey ? journeyKey(eventName, fields.dedupeKey) : fields.eventId ?? randomUUID(), occurredAt: fields.occurredAt ?? new Date().toISOString(), module: fields.module ?? journeyModule(fields.route ?? context?.route ?? ""), producer: "server" }, "server", fields.userId ?? context?.userId ?? null)
    if (!event) return
    if (eventName === "studio_generation_completed" && context) context.studioCompleted = true
    if (eventName === "error_occurred" && context) context.errorReported = true
    if (["cos_action_failed", "studio_generation_failed", "checkout_failed"].includes(eventName) && !context?.errorReported) {
      emitJourney("error_occurred", { ...fields, dedupeKey: `error:${fields.dedupeKey ?? event.eventId}`, errorCode: fields.errorCode ?? eventName.toUpperCase(), outcome: "failed", metadata: { errorKind: eventName.startsWith("cos_") ? "cos" : eventName.startsWith("studio_") ? "studio" : "stripe" } })
    }
    if (!context) { try { after(() => persistJourneyEvents([event])) } catch { void persistJourneyEvents([event]) }; return }
    if (context.events.length >= 1000) return
    context.events.push(event)
    if (context.scheduled) return
    context.scheduled = true
    const flush = async () => { const batch = context.events.splice(0); context.scheduled = false; await persistJourneyEvents(batch) }
    try { after(flush) } catch { void flush() }
  } catch { /* Observability must never alter the business result. */ }
}
/** Response inspection and storage run after the response, outside the business transaction. */
// Next route handlers have heterogeneous context signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withJourneyRoute<T extends (...args: any[]) => Promise<Response | void>>(route: string, handler: T): T {
  return (async (...args: Parameters<T>) => {
    let context: Context
    try { context = journeyRequestContext(args[0] ?? new Request(`http://localhost${route}`), route) } catch { return handler(...args) }
    return storage.run(context, async () => {
      let response: Response | void
      try {
        response = await handler(...args)
      } catch (error) {
        if (error && typeof error === "object") capturedErrors.add(error)
        failPendingStudio(context, "UNHANDLED_BACKEND")
        if (!context.errorReported) emitJourney("error_occurred", { errorCode: "UNHANDLED_BACKEND", outcome: "failed", metadata: { errorKind: errorKind(route) }, dedupeKey: `${context.requestId}:http_error` })
        throw error
      }
      if (!response) return response
      try {
        if (route === "/api/auth/me" && response.status === 401 && !/(?:^|;\s*)eme_auth=/.test(args[0]?.headers.get("cookie") ?? "")) return response
        if (route === "/api/auth/logout" && response.ok) response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${randomUUID()}; Path=/; SameSite=Lax; Max-Age=1800${args[0] && new URL(args[0].url).protocol === "https:" ? "; Secure" : ""}`)
        const auth = /\/auth\/(register|login|device\/(pin|biometric\/verify))$/.test(route)
        if (!auth && response.status < 400) return response
        const copy = response.clone()
        after(async () => {
          try {
            const body = await copy.json().catch(() => null)
            // Codes only. Never persist exception messages, bodies, emails or stack traces.
            const errorCode = journeyErrorCode(route, response.status, body)
            if (response.status >= 400) {
              failPendingStudio(context, errorCode)
              if (!context.errorReported) emitJourney("error_occurred", { errorCode, outcome: "failed", metadata: { httpStatus: response.status, errorKind: errorKind(route) }, dedupeKey: `${context.requestId}:http_error` })
              if (route === "/api/stripe/create-checkout") emitJourney("checkout_failed", { errorCode, module: "billing", outcome: "failed", step: "payment", dedupeKey: context.requestId })
            }
            if (auth) {
              const signup = route.endsWith("register")
              if (response.ok) {
                if (journeyId(body?.user?.id)) {
                  setJourneyActor(body.user.id)
                  emitJourney(signup ? "signup_completed" : "login_completed", { userId: body.user.id, brokerId: body.user.brokerId ?? null, module: "auth", outcome: "completed", step: "submitted", dedupeKey: signup ? body.user.id : context.requestId })
                }
              } else emitJourney(signup ? "signup_failed" : "login_failed", { module: "auth", outcome: "failed", step: "server_validation", errorCode, dedupeKey: context.requestId })
            }
          } catch { /* Analytics failure cannot replace the response. */ }
        })
      } catch { /* after() may be unavailable outside a Next request. */ }
      return response
    })
  }) as T
}
function errorKind(route: string): string {
  return /auth/.test(route) ? "auth" : /stripe/.test(route) ? "stripe" : /assistant|cos/.test(route) ? "cos" : /studio/.test(route) ? "studio" : /publish|marketplace/.test(route) ? "publication" : /upload|images|audio/.test(route) ? "upload" : "api"
}
function failPendingStudio(context: Context, errorCode: string) {
  if (context.studioOperationId && !context.studioCompleted && !context.errorReported) emitJourney("studio_generation_failed", { dedupeKey: context.studioOperationId, module: "studio", step: "generation", outcome: "failed", errorCode, metadata: { operationId: context.studioOperationId } })
}
export function captureJourneyRequestError(error: unknown, request: { path: string; headers: Record<string, string | string[] | undefined> }, route: string) {
  try {
    if (error && typeof error === "object") { if (capturedErrors.has(error)) return; capturedErrors.add(error) }
    const headers = new Headers()
    for (const [key, value] of Object.entries(request.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join("; ") : value)
    const context = journeyRequestContext(new Request(`http://localhost${request.path.startsWith("/") ? request.path : "/unknown"}`, { headers }), route)
    storage.run(context, () => emitJourney("error_occurred", { errorCode: "UNHANDLED_BACKEND", outcome: "failed", metadata: { errorKind: errorKind(route) }, dedupeKey: `${context.requestId}:http_error` }))
  } catch { /* No error payload or stack trace leaves this hook. */ }
}
