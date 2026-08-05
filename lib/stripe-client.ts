type StripeCheckoutInput = {
  packageKey?: string
}

export async function startStripeCheckout(input?: StripeCheckoutInput) {
  const response = await fetch("/api/stripe/create-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(input ?? {}),
  })

  const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null

  if (!response.ok || !data?.url) {
    throw new Error(data?.error || "Não foi possível iniciar o checkout Stripe.")
  }

  window.location.href = data.url
}
