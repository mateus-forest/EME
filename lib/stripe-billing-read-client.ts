import "server-only"

import { getStripeClient } from "@/lib/stripe-server"
import { getStripeEnv } from "@/lib/env.server"
import type { StripeBillingReadClient, StripeBillingReadConfig } from "@/lib/stripe-billing-reader"

export function getStripeBillingReadDependencies(): { client: StripeBillingReadClient | null; config: StripeBillingReadConfig } {
  const env = getStripeEnv()
  const pricePlans: Record<string, "pro" | "scale"> = {}
  if (env.proPriceId) pricePlans[env.proPriceId] = "pro"
  if (env.scalePriceId) pricePlans[env.scalePriceId] = "scale"
  const config: StripeBillingReadConfig = {
    pricePlans,
    addonPriceIds: [env.property50PriceId, env.property100PriceId, env.property200PriceId].filter(Boolean),
    livemode: /^(sk|rk)_live_/.test(env.secretKey) ? true : /^(sk|rk)_test_/.test(env.secretKey) ? false : undefined,
  }
  const stripe = getStripeClient()
  if (!stripe || (env.proPriceId && env.proPriceId === env.scalePriceId) || config.addonPriceIds.some((id) => id in pricePlans)) return { client: null, config }
  const options = { timeout: 5000, maxNetworkRetries: 0 }
  return { config, client: {
    customer: (id) => stripe.customers.retrieve(id, {}, options),
    subscription: (id) => stripe.subscriptions.retrieve(id, {}, options),
    subscriptions: (customer, cursor) => stripe.subscriptions.list({ customer, status: "all", limit: 100, starting_after: cursor }, options),
    items: (subscription, cursor) => stripe.subscriptionItems.list({ subscription, limit: 100, starting_after: cursor }, options),
    price: (id) => stripe.prices.retrieve(id, {}, options),
  } }
}
