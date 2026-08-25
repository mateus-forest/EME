import { UserRole } from "@/lib/prisma-enums"
import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import {
  getCheckoutPriceIdForPackage,
  getStripePlanItem,
  getStripePropertyCapacityItems,
  mapStripePriceIdToEmePlanKey,
  mapStripePriceIdToPropertyCapacity,
} from "@/lib/billing"
import { buildRecurringCapacityItemChanges } from "@/lib/billing-lifecycle-policy"
import { getStripeEnv } from "@/lib/env.server"
import { EME_EXTRA_PACKAGES, EME_PLANS, type EmeExtraPackageKey } from "@/lib/eme-plans"
import { createCapacityChangeToken } from "@/lib/stripe-capacity-preview-token"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CapacityPreviewPayload = {
  action?: "remove"
  packageKey?: string
}

function isPropertyPackageKey(value: unknown): value is EmeExtraPackageKey {
  return (
    typeof value === "string" &&
    value in EME_EXTRA_PACKAGES &&
    EME_EXTRA_PACKAGES[value as EmeExtraPackageKey].type === "property"
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function isProrationLine(line: Stripe.InvoiceLineItem) {
  const lineRecord = asRecord(line)
  if (lineRecord?.proration === true) return true

  const parent = asRecord(lineRecord?.parent)
  const subscriptionDetails = asRecord(parent?.subscription_item_details)
  const invoiceItemDetails = asRecord(parent?.invoice_item_details)

  return subscriptionDetails?.proration === true || invoiceItemDetails?.proration === true
}

function itemMonthlyAmount(item: Stripe.SubscriptionItem | null) {
  if (!item) return 0
  return (item.price.unit_amount ?? 0) * (item.quantity ?? 1)
}

export async function POST(request: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const roleError = ensureRole(user.role, [UserRole.BROKER])
  if (roleError) return roleError
  if (!user.broker) {
    return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
  }

  let payload: CapacityPreviewPayload
  try {
    payload = (await request.json()) as CapacityPreviewPayload
  } catch {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 })
  }

  const isRemoval = payload.action === "remove"
  if (!isRemoval && !isPropertyPackageKey(payload.packageKey)) {
    return NextResponse.json({ error: "Selecione uma capacidade válida." }, { status: 400 })
  }

  const stripeEnv = getStripeEnv()
  const stripe = getStripeClient()
  const signingSecret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeEnv.enabled || !stripe || !signingSecret) {
    return NextResponse.json({ error: "A integração com a Stripe não está configurada." }, { status: 503 })
  }
  if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "A capacidade adicional está disponível para assinaturas Pro e Scale ativas." },
      { status: 409 },
    )
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
    const subscriptionCustomerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
    if (subscriptionCustomerId !== user.stripeCustomerId) {
      return NextResponse.json({ error: "Assinatura inválida para esta conta." }, { status: 403 })
    }
    if (!new Set(["active", "trialing"]).has(subscription.status)) {
      return NextResponse.json(
        { error: "A assinatura precisa estar ativa para alterar a capacidade." },
        { status: 409 },
      )
    }

    const planItem = getStripePlanItem(subscription)
    const planKey = mapStripePriceIdToEmePlanKey(planItem?.price.id)
    if (!planItem || (planKey !== "pro" && planKey !== "scale")) {
      return NextResponse.json(
        { error: "A capacidade adicional está disponível nos planos Pro e Scale." },
        { status: 403 },
      )
    }

    const currentCapacityItems = getStripePropertyCapacityItems(subscription)
    const currentCapacityItem = currentCapacityItems[0] ?? null
    const currentQuantity = mapStripePriceIdToPropertyCapacity(currentCapacityItem?.price.id) ?? 0
    if (isRemoval && !currentCapacityItem) {
      return NextResponse.json({ error: "Não há capacidade adicional ativa para remover." }, { status: 409 })
    }

    const packageKey = isRemoval ? null : (payload.packageKey as EmeExtraPackageKey)
    const targetPriceId = packageKey ? getCheckoutPriceIdForPackage(packageKey) : null
    let targetPrice: Stripe.Price | null = null
    let targetQuantity = 0

    if (targetPriceId) {
      targetPrice = await stripe.prices.retrieve(targetPriceId)
      targetQuantity = mapStripePriceIdToPropertyCapacity(targetPrice.id) ?? 0
      if (
        targetQuantity === 0 ||
        targetPrice.active !== true ||
        targetPrice.type !== "recurring" ||
        targetPrice.recurring?.interval !== "month"
      ) {
        return NextResponse.json({ error: "A capacidade selecionada não está disponível." }, { status: 409 })
      }
      if (currentCapacityItem?.price.id === targetPrice.id) {
        return NextResponse.json({ error: "Esta capacidade já está ativa." }, { status: 409 })
      }
    }

    const prorationDate = Math.floor(Date.now() / 1000)
    const itemChanges = buildRecurringCapacityItemChanges(
      currentCapacityItems.map((item) => ({ id: item.id, priceId: item.price.id })),
      targetPriceId,
    )
    const preview = await stripe.invoices.createPreview({
      customer: user.stripeCustomerId,
      subscription: subscription.id,
      subscription_details: {
        items: itemChanges,
        proration_behavior: "always_invoice",
        proration_date: prorationDate,
      },
    })

    const prorationLines = preview.lines.data.filter(isProrationLine)
    const recurringLines = preview.lines.data.filter((line) => !isProrationLine(line))
    const debitAmount = prorationLines.reduce(
      (sum, line) => sum + (line.amount > 0 ? line.amount : 0),
      0,
    )
    const creditAmount = Math.abs(
      prorationLines.reduce((sum, line) => sum + (line.amount < 0 ? line.amount : 0), 0),
    )
    const netAmount = Math.max(0, debitAmount - creditAmount)
    const netCreditAmount = Math.max(0, creditAmount - debitAmount)
    const planMonthlyAmount = itemMonthlyAmount(planItem)
    const currentCapacityAmount = itemMonthlyAmount(currentCapacityItem)
    const targetCapacityAmount = targetPrice?.unit_amount ?? 0
    const recurringPreviewAmount = recurringLines.reduce((sum, line) => sum + line.amount, 0)
    const nextMonthlyAmount =
      recurringPreviewAmount > 0 ? recurringPreviewAmount : planMonthlyAmount + targetCapacityAmount
    const currency = preview.currency ?? targetPrice?.currency ?? planItem.price.currency
    const periodEnd = planItem.current_period_end
    const operation = isRemoval ? "remove" : currentQuantity > 0 ? "change" : "add"
    const baseLimit = EME_PLANS[planKey].propertyLimit

    const token = createCapacityChangeToken(
      {
        brokerId: user.broker.id,
        operation: isRemoval ? "remove" : "set",
        packageKey,
        prorationDate,
        subscriptionId: subscription.id,
        targetPriceId,
      },
      signingSecret,
    )

    return NextResponse.json(
      {
        operation,
        packageKey,
        token,
        currentLimit: baseLimit + currentQuantity,
        newLimit: baseLimit + targetQuantity,
        currentCapacity: currentQuantity
          ? { amount: currentCapacityAmount, currency, quantity: currentQuantity }
          : null,
        targetCapacity: targetQuantity
          ? { amount: targetCapacityAmount, currency, quantity: targetQuantity }
          : null,
        proration: {
          creditAmount,
          currency,
          debitAmount,
          netAmount,
          netCreditAmount,
          periodEnd,
        },
        plan: {
          amount: planMonthlyAmount,
          currency: planItem.price.currency,
          name: planKey === "scale" ? "Scale" : "Pro",
        },
        nextMonthly: {
          amount: nextMonthlyAmount,
          currency,
          date: periodEnd,
        },
        effective: "immediate",
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (caughtError) {
    console.error("[api][stripe][capacity-preview] failed", {
      brokerId: user.broker.id,
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    return NextResponse.json(
      { error: "Não foi possível consultar os valores da alteração na Stripe." },
      { status: 502 },
    )
  }
}
