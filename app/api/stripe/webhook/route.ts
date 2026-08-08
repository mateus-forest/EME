import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

import { BILLING_PLAN } from "@/lib/billing-types"
import {
  activateBillingForUser,
  mapStripePriceIdToEmePlanKey,
  mapStripePriceIdToPlan,
  mapStripePlan,
  syncBillingFromStripeSubscription,
} from "@/lib/billing"
import { getStripeEnv } from "@/lib/env.server"
import { EME_EXTRA_PACKAGES, type EmeExtraPackageKey } from "@/lib/eme-plans"
import { registerExtraPackagePurchase } from "@/lib/eme-plan-service"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

function isExtraPackageKey(value: string): value is EmeExtraPackageKey {
  return value in EME_EXTRA_PACKAGES
}

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
  const stripeEnv = getStripeEnv()
  if (!stripeEnv.enabled) {
    return NextResponse.json({ error: "Webhook Stripe ainda não está habilitado neste ambiente." }, { status: 503 })
  }

  const stripe = getStripeClient()
  const webhookSecret = stripeEnv.webhookSecret

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
        const checkoutType = metadata.checkoutType
        const userId = metadata.userId
        const mappedPlan = mapStripePlan(metadata.plan)
        const plan = mappedPlan === BILLING_PLAN.NONE ? mapStripePriceIdToPlan(metadata.priceId) : mappedPlan
        const emePlanKey = mapStripePriceIdToEmePlanKey(metadata.priceId)

        if (checkoutType === "package" && typeof metadata.packageKey === "string" && isExtraPackageKey(metadata.packageKey) && userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              broker: {
                select: {
                  id: true,
                },
              },
            },
          })

          if (user?.broker) {
            const existingPurchase = await prisma.extraPackagePurchase.findFirst({
              where: {
                brokerId: user.broker.id,
                packageKey: metadata.packageKey,
                metadata: {
                  path: ["checkoutSessionId"],
                  equals: session.id,
                },
              },
              select: {
                id: true,
              },
            })

            if (!existingPurchase) {
              await registerExtraPackagePurchase({
                brokerId: user.broker.id,
                userId,
                packageKey: metadata.packageKey,
                status: "completed",
                metadata: {
                  checkoutSessionId: session.id,
                  stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
                  stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
                },
              })
            }
          }

          break
        }

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
            emePlanKey,
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
