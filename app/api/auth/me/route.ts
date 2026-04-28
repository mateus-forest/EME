import { NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"

export async function GET() {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      phone: user.phone ?? "",
      photoUrl: user.photoUrl ?? "",
      brokerId: user.broker?.id ?? null,
      agencyId: user.ownedAgency?.id ?? user.broker?.agencyId ?? null,
      broker: user.broker
        ? {
            id: user.broker.id,
            phone: user.broker.phone,
            creci: user.broker.creci ?? "",
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
    },
  })
}
