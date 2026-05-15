"use client"

type PublicLeadPayload = {
  propertyId?: string
  catalogSlug?: string
  catalogType?: "broker" | "agency"
  source: string
  name?: string
  email?: string
  phone?: string
  message?: string
  searchTerm?: string
  intent?: string
}

export async function createPublicLead(payload: PublicLeadPayload) {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => null)) as { error?: string; lead?: { id: string } } | null

  if (!response.ok || !data?.lead) {
    throw new Error(data?.error || "Não foi possível registrar seu interesse agora.")
  }

  return data.lead
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
