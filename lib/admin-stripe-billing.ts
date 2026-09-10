import "server-only"

import { prisma } from "@/lib/prisma"
import { adminBillingPlanSelect } from "@/lib/admin-billing"
import { resolveAccountBilling, type BillingResolutionInput } from "@/lib/billing-resolution"
import { readStripeBillingEvidence } from "@/lib/stripe-billing-reader"
import { getStripeBillingReadDependencies } from "@/lib/stripe-billing-read-client"
import { billingComparisonLocal, type AdminStripeBillingReport } from "@/lib/admin-stripe-billing-contract"

export async function getAdminStripeBillingReport(userId: string): Promise<AdminStripeBillingReport | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: {
    id: true, role: true, plan: true, subscriptionStatus: true, stripeCustomerId: true, stripeSubscriptionId: true,
    broker: { select: { id: true, planAccount: { select: adminBillingPlanSelect } } },
    ownedAgency: { select: { id: true } },
  } })
  if (!user) return null
  const owner = user.role === "BROKER" && user.broker ? { ownerType: "BROKER" as const, ownerId: user.broker.id }
    : user.role === "AGENCY" && user.ownedAgency ? { ownerType: "AGENCY" as const, ownerId: user.ownedAgency.id } : null
  const subscription = owner ? await prisma.subscription.findUnique({ where: { ownerType_ownerId: owner } }) : null
  const input: BillingResolutionInput = { user, planAccount: user.broker?.planAccount ?? null, subscription }
  const { client, config } = getStripeBillingReadDependencies()
  const evidence = await readStripeBillingEvidence({ ...input, brokerId: user.broker?.id, agencyId: user.ownedAgency?.id }, client, config)
  // Stripe identifiers are not unique in the current schema. Detect shared ownership without repairing it.
  const customerId = user.stripeCustomerId ?? evidence.customer?.id
  const subscriptionIds = [...new Set([user.stripeSubscriptionId, user.broker?.planAccount?.currentStripeSubscriptionId, evidence.snapshot?.id].filter((id): id is string => Boolean(id)))]
  const duplicateOwner = customerId || subscriptionIds.length ? await prisma.user.findFirst({ where: {
    id: { not: user.id }, OR: [
      ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ...(subscriptionIds.length ? [{ stripeSubscriptionId: { in: subscriptionIds } }, { broker: { planAccount: { currentStripeSubscriptionId: { in: subscriptionIds } } } }] : []),
    ],
  }, select: { id: true } }) : null
  if (duplicateOwner) {
    evidence.issues.push({ code: "STRIPE_SHARED_LOCAL_LINK", message: "Customer ou Subscription também está vinculado a outro usuário local." })
    evidence.status = "incomplete"
    evidence.snapshot = null
  }
  return {
    userId, local: billingComparisonLocal(input), localResolution: resolveAccountBilling(input), evidence,
    resolution: resolveAccountBilling({ ...input, stripe: evidence.snapshot ?? undefined, pricePlans: config.pricePlans,
      stripeCheck: { status: evidence.status, checkedAt: evidence.checkedAt, issues: evidence.issues } }),
  }
}
