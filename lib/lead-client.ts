"use client"

type PublicLeadPayload = {
  propertyId?: string
  catalogSlug?: string
  catalogType?: "broker" | "agency"
  source: string
  message?: string
}

export function recordPublicLead(payload: PublicLeadPayload) {
  const body = JSON.stringify(payload)

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" })
    navigator.sendBeacon("/api/leads", blob)
    return
  }

  void fetch("/api/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => null)
}
