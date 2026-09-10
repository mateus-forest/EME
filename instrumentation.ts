import type { Instrumentation } from "next"

/** Next's uncaught render/API errors. Never await analytics on the error response path. */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge" || process.env.JOURNEY_ANALYTICS_ENABLED !== "true") return
  void import("@/lib/journey/server").then(({ captureJourneyRequestError }) => {
    captureJourneyRequestError(error, request, context.routePath)
  }).catch(() => {})
}
