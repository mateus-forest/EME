import type Stripe from "stripe"
import { NextRequest, NextResponse } from "next/server"

import {
  getStripePlanItem,
  mapStripePriceIdToEmePlanKey,
  syncBillingFromStripeSubscription,
} from "@/lib/billing"
import { getStripeEnv } from "@/lib/env.server"
import {
  isConfirmedStripePayment,
  shouldGrantStripePaidPeriod,
} from "@/lib/billing-lifecycle-policy"
import {
  createBillingNotification,
  formatBillingNotificationCurrency,
  formatBillingNotificationDate,
} from "@/lib/billing-notifications"
import { EME_EXTRA_PACKAGES, type EmeExtraPackageKey } from "@/lib/eme-plans"
import {
  grantBrokerPlanCreditsForPaidPeriod,
  registerExtraPackagePurchase,
} from "@/lib/eme-plan-service"
import { prisma } from "@/lib/prisma"
import { SubscriptionOwnerType } from "@/lib/prisma-enums"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

type BillingEventState = {
  userId: string
  planKey: string | null
  capacityQuantity: number | null
  cancelAtPeriodEnd: boolean
  nextBillingAt: Date | null
}

function planName(planKey: string | null) {
  if (planKey === "scale") return "Scale"
  if (planKey === "pro") return "Pro"
  return "Free"
}

function capacityPriceCents(quantity: number) {
  return Object.values(EME_EXTRA_PACKAGES).find(
    (pack) => pack.type === "property" && pack.quantity === quantity,
  )?.priceCents ?? 0
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = subscription.items.data.reduce<number | null>((latest, item) => {
    if (!item.current_period_end) return latest
    return latest === null ? item.current_period_end : Math.max(latest, item.current_period_end)
  }, null)
  return periodEnd ? new Date(periodEnd * 1_000) : null
}

async function readBillingEventState(subscription: Stripe.Subscription): Promise<BillingEventState | null> {
  const metadataUserId = subscription.metadata.userId?.trim() ?? ""
  const user = await prisma.user.findFirst({
    where: metadataUserId
      ? { OR: [{ id: metadataUserId }, { stripeSubscriptionId: subscription.id }] }
      : { stripeSubscriptionId: subscription.id },
    select: {
      id: true,
      broker: {
        select: {
          id: true,
          planAccount: { select: { planKey: true } },
          propertyCapacityAddon: {
            select: { quantity: true, status: true },
          },
        },
      },
    },
  })
  if (!user) return null

  const localSubscription = user.broker
    ? await prisma.subscription.findUnique({
        where: {
          ownerType_ownerId: {
            ownerType: SubscriptionOwnerType.BROKER,
            ownerId: user.broker.id,
          },
        },
        select: {
          cancelAtPeriodEnd: true,
          nextBillingAt: true,
        },
      })
    : null

  return {
    userId: user.id,
    planKey: user.broker?.planAccount?.planKey ?? null,
    capacityQuantity:
      user.broker?.propertyCapacityAddon?.status === "ACTIVE"
        ? user.broker.propertyCapacityAddon.quantity
        : null,
    cancelAtPeriodEnd: localSubscription?.cancelAtPeriodEnd ?? false,
    nextBillingAt: localSubscription?.nextBillingAt ?? null,
  }
}

async function notifySubscriptionChanges(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  before: BillingEventState | null,
  after: BillingEventState | null,
) {
  if (!after) return

  if (before?.planKey === "pro" && after.planKey === "scale") {
    const renewal = formatBillingNotificationDate(after.nextBillingAt)
    await createBillingNotification({
      userId: after.userId,
      kind: "plan_upgraded",
      sourceId: event.id,
      title: "Upgrade realizado",
      message: renewal
        ? `Seu upgrade para o Plano Scale foi concluído. Próxima renovação em ${renewal}.`
        : "Seu upgrade para o Plano Scale foi concluído.",
    })
  }

  if (!before?.capacityQuantity && after.capacityQuantity) {
    const amount = capacityPriceCents(after.capacityQuantity)
    await createBillingNotification({
      userId: after.userId,
      kind: "capacity_activated",
      sourceId: event.id,
      title: "Capacidade adicional ativada",
      message: `+${after.capacityQuantity} imóveis adicionados ao seu plano por ${formatBillingNotificationCurrency(amount)}/mês.`,
    })
  } else if (
    before?.capacityQuantity &&
    after.capacityQuantity &&
    before.capacityQuantity !== after.capacityQuantity
  ) {
    const amount = capacityPriceCents(after.capacityQuantity)
    await createBillingNotification({
      userId: after.userId,
      kind: "capacity_changed",
      sourceId: event.id,
      title: "Capacidade adicional alterada",
      message: `Sua capacidade mudou de +${before.capacityQuantity} para +${after.capacityQuantity} imóveis (${formatBillingNotificationCurrency(amount)}/mês).`,
    })
  } else if (before?.capacityQuantity && !after.capacityQuantity) {
    await createBillingNotification({
      userId: after.userId,
      kind: "capacity_removed",
      sourceId: event.id,
      title: "Capacidade adicional removida",
      message: `O complemento de +${before.capacityQuantity} imóveis foi removido. Seu limite voltou à capacidade base do plano.`,
    })
  }

  const previousAttributes = event.data.previous_attributes as
    | { cancel_at_period_end?: boolean }
    | undefined
  const wasScheduled = previousAttributes?.cancel_at_period_end ?? before?.cancelAtPeriodEnd ?? false
  const isScheduled = subscription.cancel_at_period_end

  if (!wasScheduled && isScheduled) {
    const finalDate = formatBillingNotificationDate(
      subscription.cancel_at ? new Date(subscription.cancel_at * 1_000) : subscriptionPeriodEnd(subscription),
    )
    await createBillingNotification({
      userId: after.userId,
      kind: "cancellation_scheduled",
      sourceId: event.id,
      title: "Cancelamento agendado",
      message: finalDate
        ? `Seu Plano ${planName(after.planKey)} permanecerá ativo até ${finalDate}.`
        : `O cancelamento do Plano ${planName(after.planKey)} foi agendado.`,
    })
  } else if (wasScheduled && !isScheduled && subscription.status !== "canceled") {
    const renewal = formatBillingNotificationDate(after.nextBillingAt)
    await createBillingNotification({
      userId: after.userId,
      kind: "cancellation_reverted",
      sourceId: event.id,
      title: "Cancelamento revertido",
      message: renewal
        ? `Sua assinatura foi mantida. A próxima renovação será em ${renewal}.`
        : "Sua assinatura foi mantida e voltou ao ciclo normal de renovação.",
    })
  }
}

async function syncSubscriptionUpdate(event: Stripe.Event, subscription: Stripe.Subscription) {
  const before = await readBillingEventState(subscription)
  const syncedUser = await syncBillingFromStripeSubscription(subscription)
  const after = syncedUser ? await readBillingEventState(subscription) : null
  await notifySubscriptionChanges(event, subscription, before, after)
  return syncedUser
}

async function syncDeletedSubscription(event: Stripe.Event, subscription: Stripe.Subscription) {
  const before = await readBillingEventState(subscription)
  const syncedUser = await syncBillingFromStripeSubscription(subscription)
  if (!syncedUser) return null

  if (before?.capacityQuantity) {
    await createBillingNotification({
      userId: syncedUser.id,
      kind: "capacity_removed",
      sourceId: event.id,
      title: "Capacidade adicional removida",
      message: `O complemento de +${before.capacityQuantity} imóveis foi encerrado junto com a assinatura.`,
    })
  }

  await createBillingNotification({
    userId: syncedUser.id,
    kind: "subscription_ended",
    sourceId: event.id,
    title: "Assinatura encerrada",
    message: "Sua assinatura foi encerrada e sua conta voltou ao Plano Free. Seus imóveis e históricos foram preservados.",
  })
  return syncedUser
}

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
  if (!options.grantPaidPeriod) {
    return syncedUser
  }

  const subscriptionItem = getStripePlanItem(subscription)
  const priceId = subscriptionItem?.price.id ?? null
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

  if (
    !shouldGrantStripePaidPeriod({
      eventType: "invoice.paid",
      subscriptionStatus: subscription.status,
      planKey,
    })
  ) {
    return syncedUser
  }

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
  if (!isConfirmedStripePayment(session.payment_status)) {
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

  if (EME_EXTRA_PACKAGES[metadata.packageKey].type === "property") {
    console.info("[api][stripe][webhook][capacity] legacy one-time checkout ignored", {
      eventId,
      checkoutSessionId: session.id,
      packageKey: metadata.packageKey,
    })
    return { applied: false, reason: "recurring_capacity_managed_by_subscription" as const }
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
          const syncedUser = await syncBillingFromStripeSubscription(subscription)
          const state = syncedUser ? await readBillingEventState(subscription) : null
          if (
            syncedUser &&
            state &&
            (state.planKey === "pro" || state.planKey === "scale") &&
            isConfirmedStripePayment(session.payment_status)
          ) {
            const renewal = formatBillingNotificationDate(state.nextBillingAt)
            await createBillingNotification({
              userId: syncedUser.id,
              kind: "plan_activated",
              sourceId: session.id,
              title: `Plano ${planName(state.planKey)} ativado`,
              message: renewal
                ? `Sua assinatura ${planName(state.planKey)} está ativa. Próxima renovação em ${renewal}.`
                : `Sua assinatura ${planName(state.planKey)} está ativa.`,
            })
          }
        }
        break
      }

      case "checkout.session.async_payment_failed":
        console.warn("[api][stripe][webhook][package] asynchronous payment failed", { eventId: event.id })
        break

      case "customer.subscription.created":
        await syncBillingFromStripeSubscription(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.updated":
        await syncSubscriptionUpdate(event, event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.deleted":
        await syncDeletedSubscription(event, event.data.object as Stripe.Subscription)
        break

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        const syncedUser = await syncInvoiceSubscription(stripe, invoice, {
          grantPaidPeriod: true,
          eventId: event.id,
        })
        if (syncedUser) {
          await createBillingNotification({
            userId: syncedUser.id,
            kind: "payment_approved",
            sourceId: invoice.id,
            title: "Pagamento aprovado",
            message: invoice.amount_paid > 0
              ? `Pagamento de ${formatBillingNotificationCurrency(invoice.amount_paid)} confirmado.`
              : "O pagamento da sua assinatura foi confirmado.",
          })
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const syncedUser = await syncInvoiceSubscription(stripe, invoice, {
          grantPaidPeriod: false,
          eventId: event.id,
        })
        if (syncedUser) {
          await createBillingNotification({
            userId: syncedUser.id,
            kind: "payment_failed",
            sourceId: `${invoice.id}:${invoice.attempt_count}`,
            title: "Pagamento falhou",
            message: "Não foi possível confirmar o pagamento da sua assinatura. Revise a forma de pagamento no Faturamento.",
          })
        }
        break
      }

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
