import { UserRole } from "@/lib/prisma-enums"
import { NextRequest, NextResponse } from "next/server"

import { ensureRole, getAuthenticatedUser } from "@/lib/auth-route"
import { syncBillingFromStripeSubscription } from "@/lib/billing"
import { getStripeClient } from "@/lib/stripe-server"

export const runtime = "nodejs"

const PORTAL_ACTIONS = new Set(["payment_method", "manage", "cancel", "resume"])

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const roleError = ensureRole(user.role, [UserRole.BROKER])
  if (roleError) return roleError

  const payload = (await request.json().catch(() => null)) as { action?: unknown } | null
  if (!payload || typeof payload.action !== "string" || !PORTAL_ACTIONS.has(payload.action)) {
    return NextResponse.json({ error: "Ação de faturamento inválida." }, { status: 400 })
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "Sua conta ainda não possui um cliente Stripe vinculado." }, { status: 409 })
  }

  const stripe = getStripeClient()
  if (!stripe) {
    return NextResponse.json({ error: "O portal de faturamento Stripe não está disponível neste ambiente." }, { status: 503 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin

  try {
    if (payload.action === "resume") {
      if (!user.stripeSubscriptionId) {
        return NextResponse.json({ error: "Nenhuma assinatura Stripe foi encontrada." }, { status: 409 })
      }

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
      const subscriptionCustomerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
      if (subscriptionCustomerId !== user.stripeCustomerId) {
        return NextResponse.json({ error: "A assinatura não pertence à conta autenticada." }, { status: 409 })
      }

      if (!subscription.cancel_at_period_end) {
        await syncBillingFromStripeSubscription(subscription)
        return NextResponse.json({ resumed: true })
      }

      const resumedSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
      })
      await syncBillingFromStripeSubscription(resumedSubscription)
      return NextResponse.json({ resumed: true })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/corretor/conta?tab=faturamento`,
    })

    return NextResponse.json({ url: session.url })
  } catch (caughtError) {
    console.error("[api][stripe][customer-portal] failed", {
      action: payload.action,
      message: caughtError instanceof Error ? caughtError.message : "unknown",
      userId: user.id,
    })
    return NextResponse.json({ error: "Não foi possível abrir o portal de faturamento do Stripe." }, { status: 502 })
  }
}
