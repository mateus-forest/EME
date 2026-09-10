import "server-only"

import { resolveAccountBilling, type BillingResolutionInput } from "@/lib/billing-resolution"
import { prisma } from "@/lib/prisma"

export const adminBillingPlanSelect = { planKey: true, currentStripeSubscriptionId: true } as const

type BillingUser = BillingResolutionInput["user"] & {
  broker: { id: string; planAccount: BillingResolutionInput["planAccount"] } | null
  ownedAgency: { id: string } | null
}

function ownerOf(user: BillingUser) {
  if (user.role === "BROKER" && user.broker) return { ownerType: "BROKER" as const, ownerId: user.broker.id }
  if (user.role === "AGENCY" && user.ownedAgency) return { ownerType: "AGENCY" as const, ownerId: user.ownedAgency.id }
  return null
}

/** One read for the whole list. No ensure/upsert helpers, Stripe requests or reconciliation writes. */
export async function loadAdminUserBillings(users: readonly BillingUser[]) {
  const owners = users.flatMap((user) => { const owner = ownerOf(user); return owner ? [owner] : [] })
  const subscriptions = owners.length ? await prisma.subscription.findMany({ where: { OR: owners } }) : []
  const byOwner = new Map(subscriptions.map((subscription) => [`${subscription.ownerType}:${subscription.ownerId}`, subscription]))
  return new Map(users.map((user) => {
    const owner = ownerOf(user)
    return [user.id, resolveAccountBilling({
      user,
      planAccount: user.broker?.planAccount ?? null,
      subscription: owner ? byOwner.get(`${owner.ownerType}:${owner.ownerId}`) ?? null : null,
    })]
  }))
}
