import { UserRole } from "@/lib/prisma-enums"
import {
  NextRequest,
  NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { getBillingPlanFromRole, getCheckoutPriceIdForRole, getPlanLabel } from "@/lib/billing"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const roleError = ensureRole(user.role, [UserRole.BROKER, UserRole.AGENCY])
  if (roleError) return roleError

  const stripe = getStripeClient()
  if (!stripe) {
    return NextResponse.json({ error: "Stripe não configurado no servidor." }, { status: 500 })
  }

  const priceId = getCheckoutPriceIdForRole(user.role)
  if (!priceId) {
    return NextResponse.json({ error: "Price ID do plano não configurado." }, { status: 500 })
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
    const plan = getBillingPlanFromRole(user.role)
    const portalPath = user.role === UserRole.BROKER ? "/corretor/plano" : "/imobiliaria/plano"
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
        plan: planLabel,
        priceId,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          role: user.role,
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
