import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import {
  getBillingPlanFromRole,
  getCheckoutPriceIdForPackage,
  getCheckoutPriceIdForPlan,
  getPlanLabel,
  getStripePlanItem,
  getStripePropertyCapacityItems,
  mapStripePriceIdToPropertyCapacity,
  resolveBrokerUpgradeCheckoutPlanKey,
  syncBillingFromStripeSubscription,
  type BrokerCheckoutPlanKey,
} from "@/lib/billing"
import { getStripeEnv } from "@/lib/env.server"
import {
  buildRecurringCapacityItemChanges,
  resolveSubscriptionChangeMode,
} from "@/lib/billing-lifecycle-policy"
import { EME_EXTRA_PACKAGES, type EmeExtraPackageKey } from "@/lib/eme-plans"
import { getBrokerPlanSnapshot } from "@/lib/eme-plan-service"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

type CheckoutPayload = {
  capacityAction?: "remove"
  packageKey?: string
  plan?: string
}

function parseCheckoutPayload(body: unknown): CheckoutPayload {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}

  return {
    capacityAction: data.capacityAction === "remove" ? "remove" : undefined,
    packageKey: typeof data.packageKey === "string" ? data.packageKey.trim() : undefined,
    plan: typeof data.plan === "string" ? data.plan.trim() : undefined,
  }
}

function isExtraPackageKey(value: string): value is EmeExtraPackageKey {
  return value in EME_EXTRA_PACKAGES
}

function getStripeHostedChangeUrl(subscription: Stripe.Subscription, fallbackUrl: string) {
  const invoice = subscription.latest_invoice
  if (
    invoice &&
    typeof invoice !== "string" &&
    "hosted_invoice_url" in invoice &&
    typeof invoice.hosted_invoice_url === "string"
  ) {
    return invoice.hosted_invoice_url
  }

  return fallbackUrl
}

function getCapacityMutationIdempotencyKey(
  subscription: Stripe.Subscription,
  targetPriceId: string | null,
) {
  const latestInvoice = subscription.latest_invoice
  const latestInvoiceId =
    typeof latestInvoice === "string" ? latestInvoice : latestInvoice?.id ?? "none"
  const currentItems = getStripePropertyCapacityItems(subscription)
    .map((item) => `${item.id}:${item.price.id}`)
    .sort()
    .join(",") || "none"

  return [
    "eme-capacity",
    subscription.id,
    latestInvoiceId,
    currentItems,
    targetPriceId ?? "remove",
  ].join(":").slice(0, 255)
}

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const roleError = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (roleError) return roleError

  const stripeEnv = getStripeEnv()
  if (!stripeEnv.enabled) {
    return NextResponse.json({ error: "Checkout Stripe ainda não está habilitado neste ambiente." }, { status: 503 })
  }

  const stripe = getStripeClient()
  if (!stripe) {
    return NextResponse.json({ error: "Stripe habilitado, mas sem chave secreta configurada no servidor." }, { status: 500 })
  }

  const payload = parseCheckoutPayload(await request.json().catch(() => null))
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const portalPath = user.role === UserRole.BROKER ? "/corretor/plano" : "/imobiliaria/plano"

  try {
    if (payload.capacityAction === "remove") {
      if (user.role !== UserRole.BROKER || !user.broker) {
        return NextResponse.json({ error: "Ação disponível apenas para contas de corretor." }, { status: 403 })
      }
      if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
        return NextResponse.json({ error: "Nenhuma assinatura Stripe ativa foi encontrada." }, { status: 409 })
      }

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
      const subscriptionCustomerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
      if (subscriptionCustomerId !== user.stripeCustomerId) {
        return NextResponse.json(
          { error: "A assinatura atual não pertence ao Customer Stripe vinculado à conta." },
          { status: 409 },
        )
      }

      const capacityItems = getStripePropertyCapacityItems(subscription)
      if (capacityItems.length === 0) {
        await syncBillingFromStripeSubscription(subscription)
        return NextResponse.json({ url: `${origin}${portalPath}?checkout=success` })
      }

      const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        items: buildRecurringCapacityItemChanges(
          capacityItems.map((item) => ({ id: item.id, priceId: item.price.id })),
          null,
        ),
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
        expand: ["latest_invoice"],
      }, {
        idempotencyKey: getCapacityMutationIdempotencyKey(subscription, null),
      })

      return NextResponse.json({
        url: getStripeHostedChangeUrl(
          updatedSubscription,
          `${origin}${portalPath}?checkout=success`,
        ),
      })
    }

    if (payload.packageKey) {
      if (user.role !== UserRole.BROKER || !user.broker) {
        return NextResponse.json(
          { error: "Pacotes extras estão disponíveis apenas para contas de corretor elegíveis." },
          { status: 403 },
        )
      }

      if (!isExtraPackageKey(payload.packageKey)) {
        return NextResponse.json({ error: "Pacote inválido para checkout." }, { status: 400 })
      }

      const pack = EME_EXTRA_PACKAGES[payload.packageKey]
      const priceId = getCheckoutPriceIdForPackage(payload.packageKey)

      if (!priceId) {
        const variableName =
          payload.packageKey === "credit_250"
            ? "STRIPE_PRICE_CREDITS_250"
            : payload.packageKey === "credit_750"
              ? "STRIPE_PRICE_CREDITS_750"
              : payload.packageKey === "credit_1500"
                ? "STRIPE_PRICE_CREDITS_1500"
                : payload.packageKey === "credit_3000"
                  ? "STRIPE_PRICE_CREDITS_3000"
                  : payload.packageKey === "property_250"
                    ? "STRIPE_PRICE_PROPERTIES_50"
                    : payload.packageKey === "property_500"
                      ? "STRIPE_PRICE_PROPERTIES_100"
                      : "STRIPE_PRICE_PROPERTIES_200"

        return NextResponse.json(
          { error: `Price ID do pacote não configurado (${variableName}).` },
          { status: 500 },
        )
      }

      if (pack.type === "property") {
        const currentPlan = await getBrokerPlanSnapshot(user.broker.id)
        if (currentPlan.planKey === "free") {
          return NextResponse.json(
            { error: "A capacidade adicional está disponível nos planos Pro e Scale. Faça upgrade para continuar." },
            { status: 403 },
          )
        }

        if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
          return NextResponse.json(
            { error: "Sua assinatura paga precisa ser reconciliada com o Stripe antes de adicionar capacidade." },
            { status: 409 },
          )
        }

        const [subscription, capacityPrice] = await Promise.all([
          stripe.subscriptions.retrieve(user.stripeSubscriptionId),
          stripe.prices.retrieve(priceId),
        ])
        const subscriptionCustomerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id

        if (subscriptionCustomerId !== user.stripeCustomerId) {
          return NextResponse.json(
            { error: "A assinatura atual não pertence ao Customer Stripe vinculado à conta." },
            { status: 409 },
          )
        }

        if (!new Set(["active", "trialing"]).has(subscription.status)) {
          return NextResponse.json(
            { error: "A assinatura atual não está ativa para receber capacidade adicional." },
            { status: 409 },
          )
        }

        const desiredCapacity = mapStripePriceIdToPropertyCapacity(priceId)
        if (
          !desiredCapacity ||
          capacityPrice.type !== "recurring" ||
          capacityPrice.recurring?.interval !== "month"
        ) {
          return NextResponse.json(
            { error: "O Price configurado para capacidade adicional não é mensal ou não está mapeado." },
            { status: 500 },
          )
        }

        const currentCapacityItems = getStripePropertyCapacityItems(subscription)
        if (currentCapacityItems.length === 1 && currentCapacityItems[0]?.price.id === priceId) {
          await syncBillingFromStripeSubscription(subscription)
          return NextResponse.json({ url: `${origin}${portalPath}?checkout=success` })
        }

        const items = buildRecurringCapacityItemChanges(
          currentCapacityItems.map((item) => ({ id: item.id, priceId: item.price.id })),
          priceId,
        )

        const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
          items,
          payment_behavior: "pending_if_incomplete",
          proration_behavior: "always_invoice",
          expand: ["latest_invoice"],
        }, {
          idempotencyKey: getCapacityMutationIdempotencyKey(subscription, priceId),
        })

        return NextResponse.json({
          url: getStripeHostedChangeUrl(
            updatedSubscription,
            `${origin}${portalPath}?checkout=success`,
          ),
        })
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${origin}${portalPath}?checkout=success`,
        cancel_url: `${origin}${portalPath}?checkout=cancel`,
        line_items: [{ price: priceId, quantity: 1 }],
        customer: user.stripeCustomerId ?? undefined,
        customer_email: user.stripeCustomerId ? undefined : user.email,
        metadata: {
          userId: user.id,
          role: user.role,
          checkoutType: "package",
          packageKey: payload.packageKey,
          packageType: pack.type,
          priceId,
        },
      })

      return NextResponse.json({ url: session.url })
    }

    // Contas AGENCY continuam fixas em "scale" (não mudado aqui, fora do escopo).
    // Contas BROKER progridem conforme o plano persistido (Free -> Pro -> Scale).
    // Um plano explicitamente selecionado também precisa ser superior ao atual.
    let planKey: BrokerCheckoutPlanKey = "scale"

    if (user.role === UserRole.BROKER) {
      if (!user.broker) {
        return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 })
      }

      const currentPlan = await getBrokerPlanSnapshot(user.broker.id)
      const upgradePlan = resolveBrokerUpgradeCheckoutPlanKey(currentPlan.planKey, payload.plan)

      if (!upgradePlan) {
        return NextResponse.json(
          {
            error:
              currentPlan.planKey === "scale"
                ? "Plano máximo ativo. Use os pacotes extras para ampliar sua operação."
                : "O plano escolhido não é um upgrade válido para sua conta.",
          },
          { status: 409 },
        )
      }

      planKey = upgradePlan
    }

    const priceId = getCheckoutPriceIdForPlan(planKey)
    if (!priceId) {
      const variableName = planKey === "scale" ? "STRIPE_PRICE_SCALE" : "STRIPE_PRICE_PRO"

      return NextResponse.json(
        { error: `Price ID principal do plano não configurado (${variableName}).` },
        { status: 500 },
      )
    }

    if (user.role === UserRole.BROKER) {
      const currentPlan = await getBrokerPlanSnapshot(user.broker!.id)
      const changeMode = resolveSubscriptionChangeMode(
        currentPlan.planKey,
        planKey,
      )

      if (changeMode === "invalid") {
        return NextResponse.json(
          { error: "A alteração de plano solicitada não é válida." },
          { status: 409 },
        )
      }

      if (changeMode === "update_existing") {
        if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
          return NextResponse.json(
            { error: "Sua assinatura paga precisa ser reconciliada com o Stripe antes do upgrade." },
            { status: 409 },
          )
        }

        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
        if (!new Set(["active", "trialing"]).has(subscription.status)) {
          return NextResponse.json(
            { error: "A assinatura atual não está ativa para receber upgrade." },
            { status: 409 },
          )
        }

        const subscriptionCustomerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
        if (subscriptionCustomerId !== user.stripeCustomerId) {
          return NextResponse.json(
            { error: "A assinatura atual não pertence ao Customer Stripe vinculado à conta." },
            { status: 409 },
          )
        }

        const item = getStripePlanItem(subscription)
        if (!item || item.price.id === priceId) {
          return NextResponse.json({ error: "O plano selecionado já está ativo." }, { status: 409 })
        }

        const returnUrl = `${origin}/corretor/conta?tab=faturamento&checkout=success`
        const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
          items: [{ id: item.id, price: priceId, quantity: item.quantity ?? 1 }],
          payment_behavior: "pending_if_incomplete",
          proration_behavior: "create_prorations",
        })

        await syncBillingFromStripeSubscription(updatedSubscription)

        return NextResponse.json({ url: returnUrl })
      }
    }

    // planLabel identifica o ROLE da conta para o sync legado (User.plan), não o
    // tier — mantido exatamente como antes por compatibilidade (ver lib/billing.ts
    // mapStripePlan). O tier real (pro/scale) é resolvido no webhook a partir do
    // priceId enviado abaixo, via mapStripePriceIdToEmePlanKey.
    const plan = getBillingPlanFromRole(user.role)
    const planLabel = getPlanLabel(plan)

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${origin}${portalPath}?checkout=success`,
      cancel_url: `${origin}${portalPath}?checkout=cancel`,
      line_items: [{ price: priceId, quantity: 1 }],
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      metadata: {
        userId: user.id,
        role: user.role,
        checkoutType: "subscription",
        plan: planLabel,
        priceId,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          role: user.role,
          checkoutType: "subscription",
          plan: planLabel,
          priceId,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (caughtError) {
    console.error("[api][stripe][create-checkout] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    return NextResponse.json({ error: "Não foi possível iniciar o checkout." }, { status: 500 })
  }
}
