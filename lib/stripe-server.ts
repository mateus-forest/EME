import Stripe from "stripe"

import { getStripeEnv } from "@/lib/env.server"

let stripeClient: Stripe | null = null

export function getStripeClient() {
  const { enabled, secretKey } = getStripeEnv()

  if (!enabled || !secretKey) {
    return null
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }

  return stripeClient
}
