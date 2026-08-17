import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import {
  getBillingPlanFromRole,
  getCheckoutPriceIdForPackage,
  getCheckoutPriceIdForPlan,
  getPlanLabel,
  resolveBrokerUpgradeCheckoutPlanKey,
  type BrokerCheckoutPlanKey,
} from "@/lib/billing"
import { getStripeEnv } from "@/lib/env.server"
import { EME_EXTRA_PACKAGES, type EmeExtraPackageKey } from "@/lib/eme-plans"
import { getBrokerPlanSnapshot } from "@/lib/eme-plan-service"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

type CheckoutPayload = {
  packageKey?: string
  plan?: string
}

function parseCheckoutPayload(body: unknown): CheckoutPayload {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {}

  return {
    packageKey: typeof data.packageKey === "string" ? data.packageKey.trim() : undefined,
    plan: typeof data.plan === "string" ? data.plan.trim() : undefined,
  }
}

function isExtraPackageKey(value: string): value is EmeExtraPackageKey {
  return value in EME_EXTRA_PACKAGES
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
    if (payload.packageKey) {
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
