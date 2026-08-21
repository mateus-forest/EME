import Stripe from "stripe"
import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"
import { NextResponse } from "next/server"

import { syncBillingFromStripeSubscription } from "@/lib/billing"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { getStripeEnv } from "@/lib/env.server"
import { getBrokerPlanSnapshot } from "@/lib/eme-plan-service"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"])
const MANAGEABLE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
])

type BillingIdentity = {
  id: string
  email: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

type StripeLink = {
  customer: Stripe.Customer
  subscriptions: Stripe.Subscription[]
}

function stripeErrorDetails(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {}
  return {
    type: typeof record.type === "string" ? record.type : error instanceof Error ? error.constructor.name : "unknown",
    code: typeof record.code === "string" ? record.code : null,
    requestId: typeof record.requestId === "string" ? record.requestId : null,
  }
}

function isMissingStripeResource(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "resource_missing",
  )
}

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

function noSubscriptionResponse(plan: { name: string; priceCents: number }) {
  return withNoStore(
    NextResponse.json({
      plan: {
        name: plan.name,
        status: "inactive",
        amount: plan.priceCents,
        currency: "brl",
        interval: plan.priceCents > 0 ? "month" : null,
        intervalCount: 1,
        nextBillingAt: null,
        cancelAtPeriodEnd: false,
      },
      paymentMethod: null,
      invoices: [],
      portalAvailable: false,
      hasSubscription: false,
    }),
  )
}

async function retrieveCustomer(stripe: Stripe, customerId: string) {
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    })
    return customer.deleted ? null : customer
  } catch (error) {
    if (isMissingStripeResource(error)) return null
    throw error
  }
}

async function listSubscriptions(stripe: Stripe, customerId: string) {
  const result = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
    // Expanding data.items.data.price.product exceeds Stripe's maximum depth.
    expand: ["data.default_payment_method"],
  })
  return result.data
}

function selectSubscription(subscriptions: Stripe.Subscription[], preferredId: string | null) {
  return (
    subscriptions.find((subscription) => subscription.id === preferredId) ??
    subscriptions.find((subscription) => MANAGEABLE_STATUSES.has(subscription.status)) ??
    [...subscriptions].sort((first, second) => second.created - first.created)[0] ??
    null
  )
}

function belongsToUser(subscription: Stripe.Subscription, userId: string) {
  const metadataUserId = subscription.metadata.userId
  return !metadataUserId || metadataUserId === userId
}

async function recoverStripeLink(stripe: Stripe, identity: BillingIdentity): Promise<StripeLink | null> {
  const customerList = await stripe.customers.list({ email: identity.email, limit: 100 })
  const candidates: Array<{
    customer: Stripe.Customer
    subscription: Stripe.Subscription
    subscriptions: Stripe.Subscription[]
  }> = []

  for (const customer of customerList.data) {
    const subscriptions = await listSubscriptions(stripe, customer.id)
    const compatible = subscriptions.filter((subscription) => belongsToUser(subscription, identity.id))
    const subscription = identity.stripeSubscriptionId
      ? compatible.find((item) => item.id === identity.stripeSubscriptionId)
      : compatible.find((item) => ACTIVE_STATUSES.has(item.status))

    if (subscription) candidates.push({ customer, subscription, subscriptions })
  }

  if (candidates.length !== 1) {
    console.warn("[api][stripe][billing][link] recovery skipped", {
      userId: identity.id,
      reason: candidates.length === 0 ? "no-compatible-subscription" : "ambiguous-compatible-subscriptions",
      candidateCount: candidates.length,
    })
    return null
  }

  const recovered = candidates[0]

  await prisma.user.update({
    where: { id: identity.id },
    data: {
      stripeCustomerId: recovered.customer.id,
      stripeSubscriptionId: recovered.subscription.id,
    },
  })
  await syncBillingFromStripeSubscription(recovered.subscription)

  console.info("[api][stripe][billing][link] recovered", {
    userId: identity.id,
    customerId: recovered.customer.id,
    subscriptionId: recovered.subscription.id,
  })

  const expandedCustomer = await retrieveCustomer(stripe, recovered.customer.id)
  return expandedCustomer ? { customer: expandedCustomer, subscriptions: recovered.subscriptions } : null
}

async function resolveStripeLink(stripe: Stripe, identity: BillingIdentity): Promise<StripeLink | null> {
  let persistedLink: StripeLink | null = null

  if (identity.stripeCustomerId) {
    const customer = await retrieveCustomer(stripe, identity.stripeCustomerId)

    if (customer) {
      const subscriptions = await listSubscriptions(stripe, customer.id)
      persistedLink = { customer, subscriptions }
      const selected = selectSubscription(subscriptions, identity.stripeSubscriptionId)

      if (
        selected &&
        (selected.id === identity.stripeSubscriptionId || MANAGEABLE_STATUSES.has(selected.status))
      ) {
        return persistedLink
      }
    } else {
      console.warn("[api][stripe][billing][link] persisted customer not found", {
        userId: identity.id,
        customerId: identity.stripeCustomerId,
      })
    }
  }

  return (await recoverStripeLink(stripe, identity)) ?? persistedLink
}

async function paymentMethodSummary(stripe: Stripe, source: unknown, userId: string) {
  let paymentMethod = source

  try {
    if (typeof source === "string") paymentMethod = await stripe.paymentMethods.retrieve(source)
  } catch (error) {
    if (!isMissingStripeResource(error)) throw error
    console.warn("[api][stripe][billing][payment-method] not found", { userId })
    return null
  }

  if (
    !paymentMethod ||
    typeof paymentMethod !== "object" ||
    !("card" in paymentMethod) ||
    !(paymentMethod as Stripe.PaymentMethod).card
  ) {
    return null
  }

  const card = (paymentMethod as Stripe.PaymentMethod).card!
  return { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year }
}

async function productName(stripe: Stripe, product: unknown, fallback: string, userId: string) {
  if (product && typeof product === "object" && "name" in product && typeof product.name === "string") {
    return product.name
  }
  if (typeof product !== "string") return fallback

  try {
    const resolved = await stripe.products.retrieve(product)
    return "name" in resolved && typeof resolved.name === "string" ? resolved.name : fallback
  } catch (error) {
    console.warn("[api][stripe][billing][product] lookup failed; using local plan name", {
      userId,
      ...stripeErrorDetails(error),
    })
    return fallback
  }
}

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    console.warn("[api][stripe][billing][auth] authentication failed", { status: error?.status ?? 401 })
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const roleError = ensureRole(user.role, [UserRole.BROKER])
  if (roleError) {
    console.warn("[api][stripe][billing][auth] role denied", { userId: user.id, role: user.role })
    return roleError
  }
  if (!user.broker) return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })

  let planSnapshot: Awaited<ReturnType<typeof getBrokerPlanSnapshot>>
  let localSubscription: { status: string; nextBillingAt: Date | null } | null

  try {
    const localData = await Promise.all([
      getBrokerPlanSnapshot(user.broker.id),
      prisma.subscription.findUnique({
        where: {
          ownerType_ownerId: {
            ownerType: SubscriptionOwnerType.BROKER,
            ownerId: user.broker.id,
          },
        },
        select: { status: true, nextBillingAt: true },
      }),
    ])
    planSnapshot = localData[0]
    localSubscription = localData[1]
  } catch (error) {
    console.error("[api][stripe][billing][database] read failed", {
      userId: user.id,
      unavailable: isPrismaUnavailable(error),
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(
      { error: "Não foi possível consultar sua assinatura no banco de dados." },
      { status: isPrismaUnavailable(error) ? 503 : 500 },
    )
  }

  const stripeEnv = getStripeEnv()
  const stripe = getStripeClient()

  if (!stripe) {
    console.error("[api][stripe][billing][config] Stripe unavailable", {
      userId: user.id,
      enabled: stripeEnv.enabled,
      hasSecretKey: Boolean(stripeEnv.secretKey),
      hasPersistedCustomer: Boolean(user.stripeCustomerId),
      localSubscriptionStatus: localSubscription?.status ?? null,
    })

    if (!user.stripeCustomerId && user.subscriptionStatus !== "ACTIVE") {
      return noSubscriptionResponse(planSnapshot.plan)
    }
    return NextResponse.json({ error: "O faturamento Stripe não está disponível neste ambiente." }, { status: 503 })
  }

  try {
    const link = await resolveStripeLink(stripe, {
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
    })

    if (!link) {
      console.info("[api][stripe][billing][link] no active Stripe subscription", {
        userId: user.id,
        hasPersistedCustomer: Boolean(user.stripeCustomerId),
        hasPersistedSubscription: Boolean(user.stripeSubscriptionId),
        localSubscriptionStatus: localSubscription?.status ?? null,
      })
      return noSubscriptionResponse(planSnapshot.plan)
    }

    const subscription = selectSubscription(link.subscriptions, user.stripeSubscriptionId)
    const item = subscription?.items.data[0] ?? null
    const price = item?.price ?? null
    const quantity = item?.quantity ?? 1
    const invoiceList = await stripe.invoices.list({ customer: link.customer.id, limit: 12 })
    const paymentMethod = await paymentMethodSummary(
      stripe,
      subscription?.default_payment_method ?? link.customer.invoice_settings.default_payment_method,
      user.id,
    )
    const resolvedPlanName = await productName(stripe, price?.product, planSnapshot.plan.name, user.id)

    return withNoStore(
      NextResponse.json({
        plan: {
          name: resolvedPlanName,
          status: subscription?.status ?? "inactive",
          amount:
            typeof price?.unit_amount === "number" ? price.unit_amount * quantity : planSnapshot.plan.priceCents,
          currency: price?.currency ?? "brl",
          interval: price?.recurring?.interval ?? null,
          intervalCount: price?.recurring?.interval_count ?? 1,
          nextBillingAt: item?.current_period_end ?? null,
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
        hasSubscription: Boolean(subscription && MANAGEABLE_STATUSES.has(subscription.status)),
      }),
    )
  } catch (error) {
    const databaseUnavailable = isPrismaUnavailable(error)
    console.error(
      databaseUnavailable
        ? "[api][stripe][billing][database] reconciliation failed"
        : "[api][stripe][billing][stripe] API failed",
      {
        userId: user.id,
        customerId: user.stripeCustomerId,
        subscriptionId: user.stripeSubscriptionId,
        message: error instanceof Error ? error.message : "unknown",
        ...stripeErrorDetails(error),
      },
    )

    return NextResponse.json(
      {
        error: databaseUnavailable
          ? "Não foi possível atualizar o vínculo da sua assinatura no banco de dados."
          : "Não foi possível consultar seus dados de faturamento no Stripe.",
      },
      { status: databaseUnavailable ? 503 : 502 },
    )
  }
}
