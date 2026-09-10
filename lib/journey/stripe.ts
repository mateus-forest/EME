import "server-only"
import type Stripe from "stripe"
import { journeyId } from "@/lib/journey/contract"
import { emitJourney, getJourneyContext } from "@/lib/journey/server"

/** Only pseudonymous correlation identifiers go to Stripe, never browser URLs or form values. */
export function journeyStripeMetadata(): Record<string, string> {
  const context = getJourneyContext()
  const result: Record<string, string> = {}
  for (const field of ["anonymousId", "sessionId", "correlationId"] as const) {
    const value = journeyId(context?.[field])
    if (value) result[`journey_${field}`] = value
  }
  return result
}
export function checkoutJourney(session: Stripe.Checkout.Session, status: "started" | "completed" | "failed", userId?: string, occurredAt?: string) {
  emitJourney(`checkout_${status}`, {
    dedupeKey: session.id, userId: userId ?? session.metadata?.userId,
    ...(status !== "started" ? { anonymousId: journeyId(session.metadata?.journey_anonymousId), sessionId: journeyId(session.metadata?.journey_sessionId), correlationId: journeyId(session.metadata?.journey_correlationId) } : {}),
    occurredAt, module: "billing", step: "payment", outcome: status,
    errorCode: status === "failed" ? "STRIPE_ASYNC_PAYMENT_FAILED" : null,
    metadata: { checkoutId: session.id, paymentStatus: session.payment_status, surface: status === "started" ? "portal" : "webhook" },
  })
}
export function checkoutResolutionMissingJourney(session: Stripe.Checkout.Session) {
  emitJourney("error_occurred", {
    dedupeKey: `checkout_unresolved:${session.id}`, userId: session.metadata?.userId,
    anonymousId: journeyId(session.metadata?.journey_anonymousId), sessionId: journeyId(session.metadata?.journey_sessionId), correlationId: journeyId(session.metadata?.journey_correlationId),
    module: "billing", outcome: "failed", errorCode: "STRIPE_BILLING_UNRESOLVED",
    metadata: { checkoutId: session.id, paymentStatus: session.payment_status, errorKind: "stripe" },
  })
}
