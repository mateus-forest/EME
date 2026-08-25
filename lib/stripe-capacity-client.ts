export type CapacityChangePreview = {
  operation: "add" | "change" | "remove"
  packageKey: string | null
  token: string
  currentLimit: number
  newLimit: number
  currentCapacity: { amount: number; currency: string; quantity: number } | null
  targetCapacity: { amount: number; currency: string; quantity: number } | null
  proration: {
    creditAmount: number
    currency: string
    debitAmount: number
    netAmount: number
    netCreditAmount: number
    periodEnd: number
  }
  plan: { amount: number; currency: string; name: string }
  nextMonthly: { amount: number; currency: string; date: number }
  effective: "immediate"
}

type CapacityPreviewInput =
  | { action: "remove"; packageKey?: never }
  | { action?: never; packageKey: string }

async function readJson(response: Response) {
  const value: unknown = await response.json().catch(() => null)
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

export async function requestCapacityChangePreview(input: CapacityPreviewInput) {
  const response = await fetch("/api/stripe/capacity-preview", {
    body: JSON.stringify(input),
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  const data = await readJson(response)
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Não foi possível preparar a alteração.")
  }
  return data as CapacityChangePreview
}

export async function confirmCapacityChange(preview: CapacityChangePreview) {
  const response = await fetch("/api/stripe/create-checkout", {
    body: JSON.stringify({
      capacityAction: preview.operation === "remove" ? "remove" : undefined,
      capacityPreviewToken: preview.token,
      packageKey: preview.operation === "remove" ? undefined : preview.packageKey,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  const data = await readJson(response)
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Não foi possível confirmar a alteração.")
  }
  if (typeof data?.url !== "string") {
    throw new Error("A Stripe não retornou o endereço de confirmação.")
  }
  window.location.assign(data.url)
}
