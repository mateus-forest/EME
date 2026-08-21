import Stripe from "stripe"
import { UserRole } from "@/lib/prisma-enums"
import { NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { getBrokerPlanSnapshot } from "@/lib/eme-plan-service"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readProductName(product: unknown, fallback: string) {
  if (product && typeof product === "object" && "name" in product && typeof product.name === "string") {
    return product.name
  }
  return fallback
}

async function getPaymentMethodSummary(stripe: Stripe, source: unknown) {
  let paymentMethod = source

  if (typeof source === "string") {
    paymentMethod = await stripe.paymentMethods.retrieve(source)
  }

  if (!paymentMethod || typeof paymentMethod !== "object" || !("card" in paymentMethod) || !paymentMethod.card) {
    return null
  }

  return {
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const roleError = ensureRole(user.role, [UserRole.BROKER])
  if (roleError) return roleError
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  const stripe = getStripeClient()
  const planSnapshot = await getBrokerPlanSnapshot(user.broker.id)

  if (!user.stripeCustomerId) {
    return NextResponse.json({
      plan: {
        name: planSnapshot.plan.name,
        status: "inactive",
        amount: planSnapshot.plan.priceCents,
        currency: "brl",
        interval: planSnapshot.plan.priceCents > 0 ? "month" : null,
        intervalCount: 1,
        nextBillingAt: null,
        cancelAtPeriodEnd: false,
      },
      paymentMethod: null,
      invoices: [],
      portalAvailable: false,
      hasSubscription: false,
    })
  }

  if (!stripe) {
    return NextResponse.json({ error: "O faturamento Stripe não está disponível neste ambiente." }, { status: 503 })
  }

  try {
    const [customerResult, subscriptionList, invoiceList] = await Promise.all([
      stripe.customers.retrieve(user.stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"],
      }),
      stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 10,
        expand: ["data.default_payment_method", "data.items.data.price.product"],
      }),
      stripe.invoices.list({ customer: user.stripeCustomerId, limit: 12 }),
    ])

    const subscriptions = subscriptionList.data
    const subscription =
      subscriptions.find((item) => item.id === user.stripeSubscriptionId) ??
      subscriptions.find((item) => ["active", "trialing", "past_due", "unpaid"].includes(item.status)) ??
      subscriptions[0] ??
      null
    const price = subscription?.items.data[0]?.price ?? null
    const quantity = subscription?.items.data[0]?.quantity ?? 1
    const customer = customerResult.deleted ? null : customerResult
    const defaultPaymentMethod = subscription?.default_payment_method ?? customer?.invoice_settings.default_payment_method ?? null
    const paymentMethod = await getPaymentMethodSummary(stripe, defaultPaymentMethod)

    const response = NextResponse.json({
      plan: {
        name: readProductName(price?.product, planSnapshot.plan.name),
        status: subscription?.status ?? "inactive",
        amount: price?.unit_amount ? price.unit_amount * quantity : planSnapshot.plan.priceCents,
        currency: price?.currency ?? "brl",
        interval: price?.recurring?.interval ?? null,
        intervalCount: price?.recurring?.interval_count ?? 1,
        nextBillingAt: subscription?.current_period_end ?? null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      },
      paymentMethod,
      invoices: invoiceList.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        createdAt: invoice.created,
        amount: invoice.amount_paid || invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
        receiptUrl: invoice.hosted_invoice_url ?? invoice.invoice_pdf,
      })),
      portalAvailable: true,
      hasSubscription: Boolean(subscription),
    })

    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][stripe][billing] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
      userId: user.id,
    })
    return NextResponse.json({ error: "Não foi possível consultar seus dados de faturamento no Stripe." }, { status: 502 })
  }
}
