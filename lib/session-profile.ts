import type { BillingPlan, BillingUserSubscriptionStatus, UserRole } from "@/lib/prisma-enums"
import type { Agency, Broker, User } from "@/lib/prisma-model-types"

type SessionProfileUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "plan" | "subscriptionStatus" | "stripeCustomerId" | "stripeSubscriptionId" | "phone" | "photoUrl"
> & {
  broker: (Pick<Broker, "id" | "agencyId" | "phone" | "creci" | "cnpj" | "description" | "catalogSlug"> & { agencyId: string | null }) | null
  ownedAgency: Pick<Agency, "id" | "name" | "phone" | "cnpj" | "logoUrl" | "catalogSlug"> | null
}

export type SessionAccountType = "BROKER_INDEPENDENT" | "AGENCY" | "ADMIN"

export type SessionProfile = {
  id: string
  name: string
  email: string
  role: UserRole
  accountType: SessionAccountType
  plan: BillingPlan
  subscriptionStatus: BillingUserSubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  phone: string
  photoUrl: string
  brokerId: string | null
  agencyId: string | null
  broker: {
    id: string
    agencyId: string | null
    phone: string
    creci: string
    cnpj: string
    description: string
    catalogSlug: string
  } | null
  agency: {
    id: string
    name: string
    phone: string
    cnpj: string
    logoUrl: string
    catalogSlug: string
  } | null
}

export function buildSessionProfile(user: SessionProfileUser): SessionProfile {
  const brokerAgencyId = null
  const ownedAgencyId = user.ownedAgency?.id ?? null
  const accountType: SessionAccountType =
    user.role === "BROKER"
      ? "BROKER_INDEPENDENT"
      : user.role === "AGENCY"
        ? "AGENCY"
        : "ADMIN"

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountType,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    phone: user.phone ?? "",
    photoUrl: user.photoUrl ?? "",
    brokerId: user.broker?.id ?? null,
    agencyId: user.role === "AGENCY" ? ownedAgencyId : null,
    broker: user.broker
      ? {
          id: user.broker.id,
          agencyId: null,
          phone: user.broker.phone,
          creci: user.broker.creci ?? "",
          cnpj: user.broker.cnpj ?? "",
          description: user.broker.description ?? "",
          catalogSlug: user.broker.catalogSlug,
        }
      : null,
    agency: user.ownedAgency
      ? {
          id: user.ownedAgency.id,
          name: user.ownedAgency.name,
          phone: user.ownedAgency.phone ?? "",
          cnpj: user.ownedAgency.cnpj ?? "",
          logoUrl: user.ownedAgency.logoUrl ?? "",
          catalogSlug: user.ownedAgency.catalogSlug,
        }
      : null,
  }
}
