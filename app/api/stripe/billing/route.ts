import Stripe from "stripe"
import { SubscriptionOwnerType, UserRole } from "@/lib/prisma-enums"
import { NextResponse } from "next/server"

import {
  getStripePlanItem,
  getStripePropertyCapacityItems,
  mapStripePriceIdToEmePlanKey,
  mapStripePriceIdToPropertyCapacity,
  syncBillingFromStripeSubscription,
} from "@/lib/billing"
import { ensureRole, getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { getStripeEnv } from "@/lib/env.server"
import { getBrokerPlanSnapshot } from "@/lib/eme-plan-service"
import { EME_EXTRA_PACKAGES, type EmeExtraPackageKey } from "@/lib/eme-plans"
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

type InternalPackagePurchase = {
  packageKey: string
  packageType: string
  quantity: number
  metadata: unknown
}

type BillingCharge = {
  id: string
  number: string | null
  description: string
  type: "Assinatura" | "Capacidade adicional" | "Créditos IA" | "Pacote extra"
  createdAt: number
  amount: number
  currency: string
  status: string | null
  receiptUrl: string | null
  documentLabel: "Abrir fatura" | "Abrir recibo"
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
        endsAt: null,
      },
      paymentMethod: null,
      capacityAddon: null,
      totalMonthly: {
        amount: plan.priceCents,
        currency: "brl",
      },
      invoices: [],
      portalAvailable: false,
      hasSubscription: false,
    }),
  )
}

async function listAllInvoices(stripe: Stripe, customerId: string) {
  const invoices: Stripe.Invoice[] = []
  for await (const invoice of stripe.invoices.list({ customer: customerId, limit: 100 })) {
    invoices.push(invoice)
  }
  return invoices
}

async function listAllCheckoutSessions(stripe: Stripe, customerId: string) {
  const sessions: Stripe.Checkout.Session[] = []
  for await (const session of stripe.checkout.sessions.list({
    customer: customerId,
    limit: 100,
    expand: ["data.payment_intent.latest_charge"],
  })) {
    sessions.push(session)
  }
  return sessions
}

function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id
  return null
}

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" ? value : null
}

function invoiceLinePriceId(line: Stripe.InvoiceLineItem) {
  const record = line as unknown as Record<string, unknown>
  const legacyPrice = record.price
  if (typeof legacyPrice === "string") return legacyPrice
  if (
    legacyPrice &&
    typeof legacyPrice === "object" &&
    "id" in legacyPrice &&
    typeof legacyPrice.id === "string"
  ) {
    return legacyPrice.id
  }

  const pricing = record.pricing
  if (!pricing || typeof pricing !== "object" || !("price_details" in pricing)) return null
  const priceDetails = pricing.price_details
  if (!priceDetails || typeof priceDetails !== "object" || !("price" in priceDetails)) return null
  const price = priceDetails.price
  if (typeof price === "string") return price
  if (price && typeof price === "object" && "id" in price && typeof price.id === "string") {
    return price.id
  }

  return null
}

function invoicePresentation(invoice: Stripe.Invoice) {
  const priceIds = invoice.lines.data.map(invoiceLinePriceId).filter((priceId): priceId is string => Boolean(priceId))
  const capacityQuantities = priceIds
    .map(mapStripePriceIdToPropertyCapacity)
    .filter(
      (quantity): quantity is NonNullable<ReturnType<typeof mapStripePriceIdToPropertyCapacity>> =>
        quantity !== null,
    )
  const hasPlanItem = priceIds.some((priceId) => mapStripePriceIdToEmePlanKey(priceId) !== null)
  const latestCapacityQuantity = capacityQuantities.at(-1) ?? null

  if (capacityQuantities.length > 0 && !hasPlanItem) {
    return {
      description: latestCapacityQuantity
        ? `Capacidade adicional +${new Intl.NumberFormat("pt-BR").format(latestCapacityQuantity)} imóveis — cobrança/prorrata`
        : "Alteração de capacidade adicional — cobrança/prorrata",
      type: "Capacidade adicional" as const,
    }
  }

  const rawDescription = invoice.lines.data[0]?.description?.trim() ?? "Assinatura EME"
  const planName = rawDescription
    .replace(/^\d+\s*[×x]\s*/i, "")
    .replace(/\s+\(.*\)\s*$/, "")
    .trim()
  const capacitySuffix = latestCapacityQuantity
    ? ` + capacidade adicional +${new Intl.NumberFormat("pt-BR").format(latestCapacityQuantity)} imóveis`
    : ""

  return {
    description: `${planName || "Assinatura EME"}${capacitySuffix} — mensalidade`,
    type: "Assinatura" as const,
  }
}

function checkoutReceiptUrl(session: Stripe.Checkout.Session) {
  const paymentIntent = session.payment_intent
  if (!paymentIntent || typeof paymentIntent === "string") return null
  const charge = paymentIntent.latest_charge
  if (!charge || typeof charge === "string") return null
  return charge.receipt_url
}

function isExtraPackageKey(value: string): value is EmeExtraPackageKey {
  return value in EME_EXTRA_PACKAGES
}

function packagePresentation(session: Stripe.Checkout.Session, internalPurchase: InternalPackagePurchase | null) {
  const packageKey = session.metadata?.packageKey ?? internalPurchase?.packageKey ?? ""
  const registeredPackage = isExtraPackageKey(packageKey) ? EME_EXTRA_PACKAGES[packageKey] : null
  const packageType = internalPurchase?.packageType ?? registeredPackage?.type ?? session.metadata?.packageType ?? "extra"
  const quantity = internalPurchase?.quantity ?? registeredPackage?.quantity ?? null
  const formattedQuantity = quantity === null ? null : new Intl.NumberFormat("pt-BR").format(quantity)

  if (packageType === "credit" && formattedQuantity) {
    return { description: `+${formattedQuantity} Créditos IA`, type: "Créditos IA" as const }
  }
  if (packageType === "property" && formattedQuantity) {
    return {
      description: `+${formattedQuantity} imóveis — Capacidade adicional`,
      type: "Capacidade adicional" as const,
    }
  }
  return { description: "Pacote extra EME", type: "Pacote extra" as const }
}

function consolidateCharges({
  invoices,
  sessions,
  internalPurchases,
}: {
  invoices: Stripe.Invoice[]
  sessions: Stripe.Checkout.Session[]
  internalPurchases: InternalPackagePurchase[]
}) {
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id))
  const internalBySession = new Map<string, InternalPackagePurchase>()
  const internalByPaymentIntent = new Map<string, InternalPackagePurchase>()

  for (const purchase of internalPurchases) {
    const checkoutSessionId = metadataString(purchase.metadata, "checkoutSessionId")
    const paymentIntentId = metadataString(purchase.metadata, "stripePaymentIntentId")
    if (checkoutSessionId) internalBySession.set(checkoutSessionId, purchase)
    if (paymentIntentId) internalByPaymentIntent.set(paymentIntentId, purchase)
  }

  const charges: BillingCharge[] = invoices
    .filter((invoice) => invoice.amount_due > 0 || invoice.amount_paid > 0)
    .map((invoice) => {
      const presentation = invoicePresentation(invoice)
      return {
        id: invoice.id,
        number: invoice.number,
        description: presentation.description,
        type: presentation.type,
        createdAt: invoice.created,
        amount: invoice.amount_paid || invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
        receiptUrl: invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
        documentLabel: "Abrir fatura" as const,
      }
    })
  const seenPaymentIntents = new Set<string>()

  for (const session of sessions) {
    if (session.mode !== "payment" || session.payment_status !== "paid" || (session.amount_total ?? 0) <= 0) continue

    const invoiceId = stripeObjectId(session.invoice)
    if (invoiceId && invoiceIds.has(invoiceId)) continue

    const paymentIntentId = stripeObjectId(session.payment_intent)
    if (paymentIntentId && seenPaymentIntents.has(paymentIntentId)) continue

    const internalPurchase =
      internalBySession.get(session.id) ??
      (paymentIntentId ? internalByPaymentIntent.get(paymentIntentId) : null) ??
      null
    const isPackagePayment = session.metadata?.checkoutType === "package" || Boolean(internalPurchase)
    if (!isPackagePayment) continue

    if (paymentIntentId) seenPaymentIntents.add(paymentIntentId)
    const presentation = packagePresentation(session, internalPurchase)
    charges.push({
      id: session.id,
      number: null,
      description: presentation.description,
      type: presentation.type,
      createdAt: session.created,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? "brl",
      status: "paid",
      receiptUrl: checkoutReceiptUrl(session),
      documentLabel: "Abrir recibo",
    })
  }

  return charges.sort((first, second) => second.createdAt - first.createdAt)
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
  const localSubscriptionStatus = localSubscription?.status.toLowerCase() ?? ""
  const localStateRequiresStripe =
    planSnapshot.plan.key !== "free" ||
    MANAGEABLE_STATUSES.has(localSubscriptionStatus as Stripe.Subscription.Status)

  if (!stripe) {
    console.error("[api][stripe][billing][config] Stripe unavailable", {
      userId: user.id,
      enabled: stripeEnv.enabled,
      hasSecretKey: Boolean(stripeEnv.secretKey),
      hasPersistedCustomer: Boolean(user.stripeCustomerId),
      localSubscriptionStatus: localSubscription?.status ?? null,
    })

    if (!localStateRequiresStripe) {
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
    const hasManageableSubscription = Boolean(subscription && MANAGEABLE_STATUSES.has(subscription.status))
    const item = subscription ? getStripePlanItem(subscription) : null
    const price = item?.price ?? null
    const quantity = item?.quantity ?? 1
    const capacityItem = subscription ? (getStripePropertyCapacityItems(subscription)[0] ?? null) : null
    const capacityQuantity = mapStripePriceIdToPropertyCapacity(capacityItem?.price.id)
    const planMonthlyAmount =
      typeof price?.unit_amount === "number" ? price.unit_amount * quantity : planSnapshot.plan.priceCents
    const capacityMonthlyAmount = capacityItem?.price.unit_amount ?? 0
    const [stripeInvoices, checkoutSessions, internalPurchases, paymentMethod, resolvedPlanName] = await Promise.all([
      listAllInvoices(stripe, link.customer.id),
      listAllCheckoutSessions(stripe, link.customer.id),
      prisma.extraPackagePurchase.findMany({
        where: {
          brokerId: user.broker.id,
          status: "completed",
          amountCents: { gt: 0 },
        },
        select: {
          packageKey: true,
          packageType: true,
          quantity: true,
          metadata: true,
        },
      }),
      hasManageableSubscription
        ? paymentMethodSummary(
            stripe,
            subscription?.default_payment_method ?? link.customer.invoice_settings.default_payment_method,
            user.id,
          )
        : Promise.resolve(null),
      hasManageableSubscription
        ? productName(stripe, price?.product, planSnapshot.plan.name, user.id)
        : Promise.resolve(planSnapshot.plan.name),
    ])
    const billingCharges = consolidateCharges({
      invoices: stripeInvoices,
      sessions: checkoutSessions,
      internalPurchases,
    })

    return withNoStore(
      NextResponse.json({
        plan: {
          name: resolvedPlanName,
          status: subscription?.status ?? "inactive",
          amount: planMonthlyAmount,
          currency: price?.currency ?? "brl",
          interval: price?.recurring?.interval ?? null,
          intervalCount: price?.recurring?.interval_count ?? 1,
          nextBillingAt: subscription?.cancel_at_period_end
            ? null
            : (item?.current_period_end ?? null),
          cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
          endsAt: subscription?.cancel_at_period_end
            ? (subscription.cancel_at ?? item?.current_period_end ?? null)
            : null,
        },
        paymentMethod,
        capacityAddon:
          capacityItem && capacityQuantity
            ? {
                quantity: capacityQuantity,
                status: subscription?.status ?? "inactive",
                amount: capacityItem.price.unit_amount ?? 0,
                currency: capacityItem.price.currency,
                interval: capacityItem.price.recurring?.interval ?? "month",
                intervalCount: capacityItem.price.recurring?.interval_count ?? 1,
                nextBillingAt: capacityItem.current_period_end ?? null,
              }
            : null,
        totalMonthly: {
          amount: planMonthlyAmount + capacityMonthlyAmount,
          currency: price?.currency ?? capacityItem?.price.currency ?? "brl",
        },
        invoices: billingCharges,
        portalAvailable: hasManageableSubscription,
        hasSubscription: hasManageableSubscription,
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
