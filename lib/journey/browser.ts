"use client"
import { ANONYMOUS_COOKIE, SESSION_COOKIE, SESSION_IDLE_MS, journeyDevice, journeyId, journeyModule, journeyRoute, normalizeJourneyEvent, type JourneyEvent, type JourneyEventName } from "@/lib/journey/contract"

let memoryAnonymous = ""
let memorySession = ""
let touchedAt = 0
const queue: JourneyEvent[] = []
let timer: ReturnType<typeof setTimeout> | undefined
let originalFetch: typeof fetch | undefined
const seen = new Map<string, number>()
const signupSteps = new WeakMap<HTMLFormElement, Set<string>>()
const reportedErrors = new WeakSet<object>()
function cookie(key: string) { try { return document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1) ?? "" } catch { return "" } }
function saveCookie(key: string, value: string, seconds: number) { try { document.cookie = `${key}=${value}; Path=/; SameSite=Lax; Max-Age=${seconds}${location.protocol === "https:" ? "; Secure" : ""}` } catch { /* memory fallback */ } }
export function browserJourneyContext() {
  const now = Date.now()
  memoryAnonymous = journeyId(cookie(ANONYMOUS_COOKIE)) ?? (memoryAnonymous || crypto.randomUUID())
  const sharedSession = journeyId(cookie(SESSION_COOKIE))
  if (sharedSession) memorySession = sharedSession
  else if (!memorySession || now - touchedAt >= SESSION_IDLE_MS) memorySession = crypto.randomUUID()
  touchedAt = now
  saveCookie(ANONYMOUS_COOKIE, memoryAnonymous, 365 * 24 * 3600)
  saveCookie(SESSION_COOKIE, memorySession, SESSION_IDLE_MS / 1000)
  return { anonymousId: memoryAnonymous, sessionId: memorySession, pathname: journeyRoute(location.pathname), referrer: document.referrer, device: journeyDevice(navigator.userAgent) }
}
export function trackJourney(eventName: JourneyEventName, fields: Partial<JourneyEvent> & { dedupeKey?: string } = {}) {
  try {
    if (typeof window === "undefined") return
    if (fields.dedupeKey) {
      const key = `${eventName}:${fields.dedupeKey}`
      if (Date.now() - (seen.get(key) ?? 0) < 1500) return
      seen.set(key, Date.now())
      if (seen.size > 200) seen.delete(seen.keys().next().value!)
    }
    const context = browserJourneyContext()
    const event = normalizeJourneyEvent({ ...context, ...fields, eventName, eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), module: fields.module ?? journeyModule(location.pathname), route: context.pathname }, "browser")
    if (!event || queue.length >= 80) return
    queue.push(event)
    timer ??= setTimeout(flushJourney, 600)
  } catch { /* Never interrupt navigation, forms or fetch. */ }
}
export function flushJourney() {
  try {
    if (timer) clearTimeout(timer)
    timer = undefined
    const batch = queue.splice(0, 20)
    if (!batch.length) return
    const body = JSON.stringify({ events: batch })
    const send = originalFetch ?? window.fetch.bind(window)
    void send("/api/journey/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => {})
    if (queue.length) timer = setTimeout(flushJourney, 600)
  } catch { /* Browsers may reject keepalive during shutdown. */ }
}
export function signupJourneyStarted(surface: "landing_modal" | "auth_page" | "signup_page") {
  trackJourney("signup_started", { module: "auth", outcome: "started", step: "form_opened", metadata: { surface }, dedupeKey: `signup:${memorySession}:${surface}` })
}
export function signupJourneyInvalid(errorCode = "CLIENT_VALIDATION") {
  trackJourney("signup_failed", { module: "auth", outcome: "failed", step: "client_validation", errorCode, dedupeKey: `invalid:${errorCode}` })
}
/** Milestones in the existing single-page form. Only validity is observed; no values leave the form. */
export function signupJourneyProgress(form: HTMLFormElement) {
  try {
    const steps = signupSteps.get(form) ?? new Set<string>()
    signupSteps.set(form, steps)
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[type="text"], input[type="email"], input[type="password"], select')).filter(input => input.getAttribute("autocomplete") !== "tel" && input.getAttribute("inputmode") !== "tel")
    const identity = inputs.filter(input => input.type !== "password")
    const credentials = inputs.filter(input => input.type === "password")
    for (const [step, fields] of [["identity", identity], ["credentials", credentials]] as const) {
      if (!steps.has(step) && fields.length && fields.every(field => field.validity.valid && Boolean(field.value)) && (step !== "credentials" || fields.every(field => field.value === fields[0].value))) {
        steps.add(step)
        trackJourney("signup_step_completed", { module: "auth", step, outcome: "completed" })
      }
    }
  } catch { /* Form behavior stays intact. */ }
}
/** Only same-origin API requests gain correlation headers. No request/response body is captured. */
export function installJourneyBrowser() {
  originalFetch ??= window.fetch.bind(window)
  const send = originalFetch
  const wrapped: typeof fetch = (input, init) => {
    let url: URL | null = null
    let requestId: string | null = null
    let options = init
    try {
      url = new URL(input instanceof Request ? input.url : String(input), location.origin)
      if (url.origin === location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/journey/")) {
        const context = browserJourneyContext()
        requestId = crypto.randomUUID()
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        headers.set("x-eme-request-id", requestId)
        headers.set("x-eme-correlation-id", requestId)
        headers.set("x-eme-pathname", context.pathname)
        options = { ...init, headers }
        if (url.pathname === "/api/auth/register") trackJourney("signup_step_completed", { module: "auth", step: "submitted", outcome: "completed", requestId, correlationId: requestId })
      }
    } catch { options = init }
    return send(input, options).catch((error) => {
      if (url?.origin === location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/journey/") && (error as { name?: string })?.name !== "AbortError") {
        trackJourney("error_occurred", { errorCode: "NETWORK_REQUEST_FAILED", outcome: "failed", requestId, correlationId: requestId, metadata: { errorKind: "frontend" } })
        if (error && typeof error === "object") reportedErrors.add(error)
      }
      throw error
    })
  }
  window.fetch = wrapped
  const error = (event: ErrorEvent | PromiseRejectionEvent) => {
    try {
      const reason = "reason" in event ? event.reason : event.error
      if (reason && typeof reason === "object") { if (reportedErrors.has(reason)) return; reportedErrors.add(reason) }
      const names: Record<string, string> = { TypeError: "JS_TYPE_ERROR", ReferenceError: "JS_REFERENCE_ERROR", SyntaxError: "JS_SYNTAX_ERROR", RangeError: "JS_RANGE_ERROR" }
      trackJourney("error_occurred", { errorCode: names[reason?.name] ?? "UNHANDLED_FRONTEND", outcome: "failed", metadata: { errorKind: "frontend" } })
    } catch { /* The diagnostic itself may not be readable. */ }
  }
  const visibility = () => { if (document.visibilityState === "hidden") flushJourney() }
  window.addEventListener("error", error)
  window.addEventListener("unhandledrejection", error)
  window.addEventListener("pagehide", flushJourney)
  document.addEventListener("visibilitychange", visibility)
  return () => {
    if (window.fetch === wrapped) window.fetch = send
    window.removeEventListener("error", error); window.removeEventListener("unhandledrejection", error)
    window.removeEventListener("pagehide", flushJourney); document.removeEventListener("visibilitychange", visibility)
  }
}
