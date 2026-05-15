export async function startStripeCheckout() {
  const response = await fetch("/api/stripe/create-checkout", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  })

  const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null

  if (!response.ok || !data?.url) {
    throw new Error(data?.error || "Não foi possível iniciar o checkout Stripe.")
  }

  window.location.href = data.url
}
