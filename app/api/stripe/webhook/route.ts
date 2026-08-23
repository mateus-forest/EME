import type Stripe from "stripe"
import { NextRequest, NextResponse } from "next/server"

import {
  mapStripePriceIdToEmePlanKey,
  syncBillingFromStripeSubscription,
} from "@/lib/billing"
import { getStripeEnv } from "@/lib/env.server"
import { EME_EXTRA_PACKAGES, type EmeExtraPackageKey } from "@/lib/eme-plans"
import {
  grantBrokerPlanCreditsForPaidPeriod,
  registerExtraPackagePurchase,
} from "@/lib/eme-plan-service"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

function isExtraPackageKey(value: unknown): value is EmeExtraPackageKey {
  return typeof value === "string" && value in EME_EXTRA_PACKAGES
}

function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id
  return null
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const legacySubscription = (invoice as Stripe.Invoice & { subscription?: unknown }).subscription
  if (legacySubscription) return stripeObjectId(legacySubscription)

  const invoiceWithParent = invoice as Stripe.Invoice & {
    parent?: {
      subscription_details?: {
        subscription?: string | Stripe.Subscription | null
      } | null
    } | null
  }
  return stripeObjectId(
    invoiceWithParent.parent?.subscription_details?.subscription,
  )
}

async function syncInvoiceSubscription(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  options: { grantPaidPeriod: boolean; eventId: string },
) {
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId) return null

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const syncedUser = await syncBillingFromStripeSubscription(subscription)
  if (!options.grantPaidPeriod || subscription.status !== "active") {
    return syncedUser
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null
  const planKey = mapStripePriceIdToEmePlanKey(priceId)
  if (planKey !== "pro" && planKey !== "scale") {
    console.error("[api][stripe][webhook][invoice] unmapped paid Price ID", {
      eventId: options.eventId,
      invoiceId: invoice.id,
      subscriptionId,
      priceId,
    })
    return syncedUser
  }

  const subscriptionItem = subscription.items.data[0]
  if (!subscriptionItem?.current_period_start || !subscriptionItem.current_period_end) {
    throw new Error("STRIPE_SUBSCRIPTION_PERIOD_MISSING")
  }

  const metadataUserId =
    typeof subscription.metadata.userId === "string"
      ? subscription.metadata.userId
      : ""
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        ...(metadataUserId ? [{ id: metadataUserId }] : []),
      ],
    },
    select: { broker: { select: { id: true } } },
  })
  if (!user?.broker) return syncedUser

  await grantBrokerPlanCreditsForPaidPeriod({
    brokerId: user.broker.id,
    subscriptionId,
    planKey,
    periodStart: new Date(subscriptionItem.current_period_start * 1000),
    periodEnd: new Date(subscriptionItem.current_period_end * 1000),
    stripeInvoiceId: invoice.id,
    stripeEventId: options.eventId,
  })

  return syncedUser
}

async function fulfillPackageCheckout(eventId: string, session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    console.info("[api][stripe][webhook][package] awaiting confirmed payment", {
      eventId,
      checkoutSessionId: session.id,
      paymentStatus: session.payment_status,
    })
    return { applied: false, reason: "payment_not_confirmed" as const }
  }

  const metadata = session.metadata ?? {}
  if (metadata.checkoutType !== "package" || !isExtraPackageKey(metadata.packageKey) || !metadata.userId) {
    throw new Error("INVALID_PACKAGE_CHECKOUT_METADATA")
  }

  const user = await prisma.user.findUnique({
    where: { id: metadata.userId },
    select: { broker: { select: { id: true } } },
  })
  if (!user?.broker) throw new Error("PACKAGE_BROKER_NOT_FOUND")

  const result = await registerExtraPackagePurchase({
    brokerId: user.broker.id,
    userId: metadata.userId,
    packageKey: metadata.packageKey,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: stripeObjectId(session.payment_intent),
    stripeFulfilledEventId: eventId,
    amountCents: session.amount_total,
    status: "completed",
    metadata: {
      checkoutSessionId: session.id,
      stripeCustomerId: stripeObjectId(session.customer),
      stripePaymentIntentId: stripeObjectId(session.payment_intent),
      stripeEventId: eventId,
    },
  })

  console.info("[api][stripe][webhook][package] fulfillment processed", {
    eventId,
    checkoutSessionId: session.id,
    packageKey: metadata.packageKey,
    applied: result.applied,
  })
  return result
}

export async function POST(request: NextRequest) {
  const stripeEnv = getStripeEnv()
  if (!stripeEnv.enabled) {
    return NextResponse.json({ error: "Webhook Stripe ainda não está habilitado neste ambiente." }, { status: 503 })
  }

  const stripe = getStripeClient()
  if (!stripe || !stripeEnv.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook não configurado." }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Assinatura do webhook ausente." }, { status: 400 })

  const body = await request.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeEnv.webhookSecret)
  } catch (error) {
    console.warn("[api][stripe][webhook] signature validation failed", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.checkoutType === "package") {
          await fulfillPackageCheckout(event.id, session)
          break
        }

        const subscriptionId = stripeObjectId(session.subscription)
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await syncBillingFromStripeSubscription(subscription)
        }
        break
      }

      case "checkout.session.async_payment_failed":
        console.warn("[api][stripe][webhook][package] asynchronous payment failed", { eventId: event.id })
        break

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncBillingFromStripeSubscription(event.data.object as Stripe.Subscription)
        break

      case "invoice.paid":
      case "invoice.payment_succeeded":
        await syncInvoiceSubscription(stripe, event.data.object as Stripe.Invoice, {
          grantPaidPeriod: true,
          eventId: event.id,
        })
        break

      case "invoice.payment_failed":
        await syncInvoiceSubscription(stripe, event.data.object as Stripe.Invoice, {
          grantPaidPeriod: false,
          eventId: event.id,
        })
        break

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[api][stripe][webhook] processing failed", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json({ error: "Falha interna ao processar o webhook Stripe." }, { status: 500 })
  }
}
