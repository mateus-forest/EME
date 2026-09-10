/** Read-only billing interpretation. Never use this first-stage projection to grant/revoke access. */
export type ResolvedPlan = "free" | "pro" | "scale"
type DateValue = Date | string | null
export type BillingResolutionInput = {
  user: { id: string; role: string; plan: string; subscriptionStatus: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null }
  planAccount: { planKey: string; currentStripeSubscriptionId: string | null } | null
  subscription: { status: string; createdAt: DateValue; nextBillingAt: DateValue; cancelAtPeriodEnd: boolean; cancelAt: DateValue } | null
  /** Explicit evidence from a trusted server-side Stripe reader; never browser metadata. */
  stripe?: {
    id: string; customerId: string; status: string; priceId: string | null
    startedAt: DateValue; trialStart: DateValue; trialEnd: DateValue
    currentPeriodEnd: DateValue; cancelAtPeriodEnd: boolean; cancelAt: DateValue; canceledAt: DateValue
    observedAt: DateValue; reconciledAt: DateValue
  }
  pricePlans?: Readonly<Record<string, "pro" | "scale">>
  now?: Date
}

export type BillingPresentationStatus = "Free" | "Trial" | "Ativa" | "Cancelando" | "Inadimplente" | "Cancelada" | "Pendente de conciliação"
export type BillingResolution = {
  identity: { userId: string; role: string }
  contractedPlan: ResolvedPlan | null
  effectivePlan: ResolvedPlan | null
  originalStatus: string | null
  originalStatusSource: "stripe" | "subscription" | "none"
  stripeStatus: string | null
  presentationStatus: BillingPresentationStatus
  lifecycleStatus: BillingPresentationStatus
  source: "stripe_price" | "broker_plan_account" | "legacy" | "free_default" | "unknown"
  effectivePlanSource: "broker_plan_account" | "legacy" | "unknown"
  financialStatus: "unknown" | "not_applicable" | "trial" | "delinquent" | "payment_pending"
  startedAt: string | null
  trial: { kind: "local" | "stripe" | null; startedAt: string | null; endsAt: string | null; expired: boolean }
  renewalAt: string | null
  cancellation: { atPeriodEnd: boolean; scheduledAt: string | null; canceledAt: string | null }
  lastReconciledAt: string | null
  stripeObservedAt: string | null
  conflicts: Array<{ code: string; message: string }>
  limitations: string[]
}

function iso(value: DateValue | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function accountPlan(value: string | undefined): ResolvedPlan | null {
  if (value === "growth") return "scale"
  return value === "free" || value === "pro" || value === "scale" ? value : null
}

function legacyPlan(value: string): ResolvedPlan | null {
  return value === "BROKER" ? "pro" : value === "AGENCY" ? "scale" : value === "NONE" ? "free" : null
}

export function billingPlanLabel(plan: ResolvedPlan | null): string {
  return plan === "pro" ? "Pro" : plan === "scale" ? "Scale" : plan === "free" ? "Free" : "Pendente de conciliação"
}

export function resolveAccountBilling(input: BillingResolutionInput): BillingResolution {
  const { user, planAccount, subscription, stripe } = input
  const conflicts: BillingResolution["conflicts"] = []
  const limitations: string[] = []
  const conflict = (code: string, message: string) => { conflicts.push({ code, message }) }
  const account = accountPlan(planAccount?.planKey)
  const legacy = legacyPlan(user.plan)
  const status = stripe?.status ?? subscription?.status ?? null
  const normalizedStatus = status?.toLowerCase()
  const canceled = normalizedStatus === "canceled" || normalizedStatus === "incomplete_expired"
  const linkedSubscription = user.stripeSubscriptionId ?? planAccount?.currentStripeSubscriptionId
  const hasLink = Boolean(user.stripeCustomerId || linkedSubscription || stripe)
  const localTrial = !stripe && !hasLink && subscription?.status === "TRIALING"
  const paidSignal = (account !== null && account !== "free") || (legacy !== null && legacy !== "free") || user.subscriptionStatus === "ACTIVE" || subscription?.status === "ACTIVE" || subscription?.status === "PAST_DUE"

  if (planAccount && account === null) conflict("UNKNOWN_ACCOUNT_PLAN", "Plano de BrokerPlanAccount não reconhecido.")
  if (legacy === null) conflict("UNKNOWN_LEGACY_PLAN", "Plano legado não reconhecido.")
  if (user.subscriptionStatus !== "ACTIVE" && user.subscriptionStatus !== "INACTIVE") conflict("UNKNOWN_USER_STATUS", "Status legado não reconhecido.")

  let contractedPlan: ResolvedPlan | null = null
  let source: BillingResolution["source"] = "unknown"
  if (stripe) {
    const mappedPlan = stripe.priceId && Object.prototype.hasOwnProperty.call(input.pricePlans ?? {}, stripe.priceId)
      ? input.pricePlans?.[stripe.priceId] : null
    contractedPlan = mappedPlan === "pro" || mappedPlan === "scale" ? mappedPlan : null
    if (contractedPlan) source = "stripe_price"
    else conflict("UNKNOWN_STRIPE_PRICE", "Price Stripe ausente ou não mapeado; plano contratado não confirmado.")
    if (stripe.id !== linkedSubscription || stripe.customerId !== user.stripeCustomerId) {
      conflict("STRIPE_LINK_MISMATCH", "Evidência Stripe diverge dos vínculos locais.")
      contractedPlan = null
      source = "unknown"
    }
  } else if (account && account !== "free") {
    contractedPlan = account
    source = "broker_plan_account"
  } else if (legacy && legacy !== "free" && (subscription || user.subscriptionStatus === "ACTIVE" || linkedSubscription)) {
    contractedPlan = legacy
    source = "legacy"
    limitations.push("Plano contratado inferido do legado; requer confirmação do Price.")
  } else if (!paidSignal && !hasLink && (!planAccount || account === "free") && legacy === "free") {
    contractedPlan = "free"
    source = planAccount ? "broker_plan_account" : "free_default"
  }

  // Describe the persisted access tier, including inconsistencies. Do not apply a new access policy.
  const effectivePlan = planAccount ? account : user.subscriptionStatus === "ACTIVE" ? legacy : "free"
  const effectivePlanSource = planAccount ? "broker_plan_account" : "legacy"
  if (!planAccount) limitations.push("Plano efetivo estimado pelo fallback legado; nenhuma permissão foi alterada.")
  if (!stripe) limitations.push("Status original Stripe, Price e datas financeiras não foram consultados; status local pode agrupar estados distintos.")
  if (hasLink && !stripe) limitations.push("Vínculo Stripe ainda não verificado nesta leitura local.")

  if ((paidSignal || hasLink) && (!user.stripeCustomerId || !linkedSubscription)) conflict("MISSING_STRIPE_LINK", "Faltam vínculos de Customer/Subscription para confirmar a assinatura.")
  if (planAccount?.currentStripeSubscriptionId && user.stripeSubscriptionId && planAccount.currentStripeSubscriptionId !== user.stripeSubscriptionId) conflict("LOCAL_STRIPE_LINK_MISMATCH", "User e BrokerPlanAccount apontam para assinaturas diferentes.")
  if (!subscription && (paidSignal || hasLink)) conflict("MISSING_LOCAL_SUBSCRIPTION", "Há sinais de assinatura sem Subscription interna.")
  if (contractedPlan === null) conflict("UNRESOLVED_PLAN", "Não há evidência suficiente para resolver o plano contratado.")
  if (!canceled && account !== null && contractedPlan !== null && account !== contractedPlan) conflict("ACCOUNT_PLAN_MISMATCH", "Plano contratado diverge do plano efetivo em BrokerPlanAccount.")
  if (!canceled && legacy !== null && contractedPlan !== null && legacy !== contractedPlan) conflict("LEGACY_PLAN_MISMATCH", "User.plan diverge do plano contratado.")
  if (canceled && effectivePlan !== null && effectivePlan !== "free") conflict("CANCELED_WITH_PAID_ACCESS", "Assinatura encerrada mantém plano efetivo pago nos dados locais.")
  if (contractedPlan === "free" && paidSignal) conflict("FREE_WITH_PAID_STATE", "Plano Free possui sinais locais de assinatura paga.")

  if (subscription) {
    const expectedUserStatus = subscription.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
    if (user.subscriptionStatus !== expectedUserStatus) conflict("USER_SUBSCRIPTION_STATUS_MISMATCH", "Status de User diverge de Subscription.")
    if (stripe) {
      // Match the existing lossy mirror without claiming that ACTIVE proves payment or excludes trial.
      const expectedLocal = ["active", "trialing"].includes(stripe.status) ? "ACTIVE" : ["past_due", "unpaid", "incomplete"].includes(stripe.status) ? "PAST_DUE" : "CANCELED"
      if (subscription.status !== expectedLocal) conflict("STRIPE_STATUS_MISMATCH", "Lifecycle Stripe diverge do espelho interno.")
      if (subscription.cancelAtPeriodEnd !== stripe.cancelAtPeriodEnd) conflict("CANCELLATION_MISMATCH", "Cancelamento programado diverge entre Stripe e Subscription.")
    }
  }

  const atPeriodEnd = stripe?.cancelAtPeriodEnd ?? subscription?.cancelAtPeriodEnd ?? false
  const scheduledAt = iso(stripe ? stripe.cancelAt ?? (atPeriodEnd ? stripe.currentPeriodEnd : null) : subscription?.cancelAt)
  const trialKind = stripe?.status === "trialing" ? "stripe" : localTrial ? "local" : null
  const trialEnd = iso(trialKind === "stripe" ? stripe?.trialEnd : trialKind === "local" ? subscription?.nextBillingAt : null)
  const expired = Boolean(trialKind && trialEnd && new Date(trialEnd).getTime() <= (input.now ?? new Date()).getTime())
  if (expired) conflict("EXPIRED_TRIAL", "Trial terminou, mas os registros ainda indicam período de teste.")
  if (!stripe && hasLink && normalizedStatus === "trialing") conflict("UNVERIFIED_STRIPE_TRIAL", "Trial interno com vínculo Stripe precisa de confirmação do lifecycle original.")

  let lifecycleStatus: BillingPresentationStatus = "Pendente de conciliação"
  if (canceled) lifecycleStatus = "Cancelada"
  else if (normalizedStatus === "past_due" || normalizedStatus === "unpaid") lifecycleStatus = "Inadimplente"
  else if (normalizedStatus === "incomplete") lifecycleStatus = "Pendente de conciliação"
  else if (atPeriodEnd || scheduledAt) lifecycleStatus = "Cancelando"
  else if (trialKind) lifecycleStatus = "Trial"
  else if (normalizedStatus === "active") lifecycleStatus = "Ativa"
  else if (!status && contractedPlan === "free" && !hasLink) lifecycleStatus = "Free"
  if (status && !["active", "trialing", "past_due", "unpaid", "incomplete", "canceled", "incomplete_expired"].includes(normalizedStatus!)) conflict("UNSUPPORTED_SUBSCRIPTION_STATUS", "Status preservado, mas exige conciliação antes da classificação.")

  return {
    identity: { userId: user.id, role: user.role }, contractedPlan, effectivePlan,
    originalStatus: status, originalStatusSource: stripe ? "stripe" : subscription ? "subscription" : "none",
    stripeStatus: stripe?.status ?? null,
    presentationStatus: conflicts.length ? "Pendente de conciliação" : lifecycleStatus,
    lifecycleStatus, source, effectivePlanSource,
    financialStatus: normalizedStatus === "incomplete" ? "payment_pending" : ["past_due", "unpaid"].includes(normalizedStatus ?? "") ? "delinquent" : trialKind ? "trial" : contractedPlan === "free" && !hasLink && !paidSignal ? "not_applicable" : "unknown",
    startedAt: iso(stripe?.startedAt),
    trial: { kind: trialKind, startedAt: iso(trialKind === "stripe" ? stripe?.trialStart : trialKind === "local" ? subscription?.createdAt : null), endsAt: trialEnd, expired },
    renewalAt: canceled || atPeriodEnd || scheduledAt || trialKind === "local" ? null : iso(stripe ? stripe.currentPeriodEnd : subscription?.nextBillingAt),
    cancellation: { atPeriodEnd, scheduledAt, canceledAt: iso(stripe?.canceledAt) },
    lastReconciledAt: iso(stripe?.reconciledAt), stripeObservedAt: iso(stripe?.observedAt), conflicts, limitations,
  }
}
