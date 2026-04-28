import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

import {
  activateBillingForUser,
  mapStripePlan,
  syncBillingFromStripeSubscription,
} from "@/lib/billing"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

async function syncInvoiceSubscription(stripe: Stripe, invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }
  const subscriptionId = invoiceWithSubscription.subscription

  if (typeof subscriptionId !== "string") return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await syncBillingFromStripeSubscription(subscription)
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook não configurado." }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Assinatura do webhook ausente." }, { status: 400 })
  }

  try {
    const body = await request.text()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata ?? {}
        const userId = metadata.userId
        const plan = mapStripePlan(metadata.plan)

        if (typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription)
          await syncBillingFromStripeSubscription(subscription)
          break
        }

        if (userId) {
          await activateBillingForUser({
            userId,
            plan,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
            stripeSubscriptionId: null,
            nextBillingAt: null,
          })
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await syncBillingFromStripeSubscription(subscription)
        break
      }

      case "invoice.payment_failed":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        await syncInvoiceSubscription(stripe, invoice)
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (caughtError) {
    console.error("[api][stripe][webhook] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    return NextResponse.json({ error: "Webhook inválido." }, { status: 400 })
  }
}
