import "server-only"

import Stripe from "stripe"

import type { AdminBillingCharge, AdminChargeType, AdminRevenueReport } from "@/lib/admin-revenue-contract"
import { EME_EXTRA_PACKAGES, type EmeExtraPackageKey } from "@/lib/eme-plans"
import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe-server"

type InternalPurchase = {
  packageKey: string
  packageType: string
  quantity: number
  metadata: unknown
  broker: { user: { name: string; email: string } }
}

function objectId(value: unknown) {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id
  return null
}

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" ? value : null
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

function packageDetails(session: Stripe.Checkout.Session, internal: InternalPurchase | null): { type: AdminChargeType; description: string; quantity: number | null } {
  const packageKey = session.metadata?.packageKey ?? internal?.packageKey ?? ""
  const registered = isExtraPackageKey(packageKey) ? EME_EXTRA_PACKAGES[packageKey] : null
  const packageType = internal?.packageType ?? registered?.type ?? session.metadata?.packageType ?? "extra"
  const quantity = internal?.quantity ?? registered?.quantity ?? null
  const formattedQuantity = quantity == null ? null : new Intl.NumberFormat("pt-BR").format(quantity)
  if (packageType === "credit" && formattedQuantity) return { type: "Créditos IA", description: `+${formattedQuantity} Créditos IA`, quantity }
  if (packageType === "property" && formattedQuantity) return { type: "Expansão da Carteira", description: `+${formattedQuantity} imóveis — Expansão da Carteira`, quantity }
  return { type: "Pacote extra", description: session.metadata?.description || "Pacote extra EME", quantity }
}

async function listInvoices(stripe: Stripe) {
  const invoices: Stripe.Invoice[] = []
  for await (const invoice of stripe.invoices.list({ limit: 100 })) invoices.push(invoice)
  return invoices
}

async function listCheckoutSessions(stripe: Stripe) {
  const sessions: Stripe.Checkout.Session[] = []
  for await (const session of stripe.checkout.sessions.list({ limit: 100, expand: ["data.payment_intent.latest_charge"] })) sessions.push(session)
  return sessions
}

export async function getAdminRevenueReport(): Promise<AdminRevenueReport> {
  const stripe = getStripeClient()
  if (!stripe) throw new Error("STRIPE_NOT_CONFIGURED")

  const [users, internalPurchases, invoices, sessions] = await Promise.all([
    prisma.user.findMany({ where: { stripeCustomerId: { not: null } }, select: { name: true, email: true, stripeCustomerId: true } }),
    prisma.extraPackagePurchase.findMany({
      where: { status: "completed", amountCents: { gt: 0 } },
      select: { packageKey: true, packageType: true, quantity: true, metadata: true, broker: { select: { user: { select: { name: true, email: true } } } } },
    }),
    listInvoices(stripe),
    listCheckoutSessions(stripe),
  ])

  const userByCustomer = new Map(users.flatMap((user) => user.stripeCustomerId ? [[user.stripeCustomerId, user] as const] : []))
  const purchaseBySession = new Map<string, InternalPurchase>()
  const purchaseByPaymentIntent = new Map<string, InternalPurchase>()
  for (const purchase of internalPurchases) {
    const sessionId = metadataString(purchase.metadata, "checkoutSessionId")
    const paymentIntentId = metadataString(purchase.metadata, "stripePaymentIntentId")
    if (sessionId) purchaseBySession.set(sessionId, purchase)
    if (paymentIntentId) purchaseByPaymentIntent.set(paymentIntentId, purchase)
  }

  const invoiceIds = new Set(invoices.map((invoice) => invoice.id))
  const seenPaymentIntents = new Set<string>()
  const charges: AdminBillingCharge[] = invoices
    .filter((invoice) => invoice.amount_due > 0 || invoice.amount_paid > 0)
    .map((invoice) => {
      const customerId = objectId(invoice.customer)
      const owner = customerId ? userByCustomer.get(customerId) : null
      const description = invoice.lines.data[0]?.description?.replace(/^\d+\s*[×x]\s*/i, "").trim() || "Assinatura EME"
      return {
        id: invoice.id,
        userName: owner?.name ?? "Cliente Stripe não associado",
        userEmail: owner?.email ?? "—",
        description: `${description} — mensalidade`,
        type: "Assinatura" as const,
        amountCents: invoice.amount_paid || invoice.amount_due,
        currency: invoice.currency,
        createdAt: new Date(invoice.created * 1000).toISOString(),
        status: invoice.status ?? "unknown",
        stripeReference: invoice.id,
        receiptUrl: invoice.hosted_invoice_url ?? invoice.invoice_pdf ?? null,
        quantity: null,
      }
    })

  for (const session of sessions) {
    if (session.mode !== "payment" || session.payment_status !== "paid" || (session.amount_total ?? 0) <= 0) continue
    const invoiceId = objectId(session.invoice)
    if (invoiceId && invoiceIds.has(invoiceId)) continue
    const paymentIntentId = objectId(session.payment_intent)
    if (paymentIntentId && seenPaymentIntents.has(paymentIntentId)) continue
    if (paymentIntentId) seenPaymentIntents.add(paymentIntentId)

    const internal = purchaseBySession.get(session.id) ?? (paymentIntentId ? purchaseByPaymentIntent.get(paymentIntentId) : null) ?? null
    const customerId = objectId(session.customer)
    const owner = customerId ? userByCustomer.get(customerId) : null
    const details = packageDetails(session, internal)
    charges.push({
      id: session.id,
      userName: owner?.name ?? internal?.broker.user.name ?? "Cliente Stripe não associado",
      userEmail: owner?.email ?? internal?.broker.user.email ?? "—",
      description: details.description,
      type: details.type,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "brl",
      createdAt: new Date(session.created * 1000).toISOString(),
      status: session.payment_status,
      stripeReference: paymentIntentId ?? session.id,
      receiptUrl: checkoutReceiptUrl(session),
      quantity: details.quantity,
    })
  }

  charges.sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const paidThisMonth = charges.filter((charge) => ["paid", "succeeded"].includes(charge.status) && new Date(charge.createdAt) >= monthStart)
  const recurring = paidThisMonth.filter((charge) => charge.type === "Assinatura")
  const oneOff = paidThisMonth.filter((charge) => charge.type !== "Assinatura")
  const monthlyRevenueCents = paidThisMonth.reduce((sum, charge) => sum + charge.amountCents, 0)

  return {
    generatedAt: now.toISOString(),
    overview: {
      monthlyRevenueCents,
      recurringRevenueCents: recurring.reduce((sum, charge) => sum + charge.amountCents, 0),
      oneOffRevenueCents: oneOff.reduce((sum, charge) => sum + charge.amountCents, 0),
      creditsSold: oneOff.filter((charge) => charge.type === "Créditos IA").reduce((sum, charge) => sum + (charge.quantity ?? 0), 0),
      expansionsSold: oneOff.filter((charge) => charge.type === "Expansão da Carteira").length,
      averageTicketCents: paidThisMonth.length ? Math.round(monthlyRevenueCents / paidThisMonth.length) : 0,
    },
    charges,
  }
}
