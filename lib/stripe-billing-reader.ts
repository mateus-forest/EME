import type Stripe from "stripe"
import type { BillingResolution, BillingResolutionInput } from "./billing-resolution"

/** Capability boundary: consumers cannot create, update or delete Stripe resources. */
export type StripeBillingReadClient = {
  customer: (id: string) => Promise<Stripe.Customer | Stripe.DeletedCustomer>
  subscription: (id: string) => Promise<Stripe.Subscription>
  subscriptions: (customer: string, cursor?: string) => Promise<Stripe.ApiList<Stripe.Subscription>>
  items: (subscription: string, cursor?: string) => Promise<Stripe.ApiList<Stripe.SubscriptionItem>>
  price: (id: string) => Promise<Stripe.Price>
}
export type StripeBillingReadConfig = {
  pricePlans: Readonly<Record<string, "pro" | "scale">>
  addonPriceIds: readonly string[]
  livemode?: boolean
}
type LinkMetadata = Partial<Record<"userId" | "brokerId" | "agencyId" | "role" | "plan" | "planKey" | "priceId" | "checkoutType", string>>
type Snapshot = NonNullable<BillingResolutionInput["stripe"]>
export type StripeBillingEvidence = {
  status: "not_needed" | "verified" | "incomplete" | "unavailable"
  checkedAt: string
  completedAt: string | null
  customer: { id: string; deleted: boolean; livemode: boolean | null; metadata: LinkMetadata } | null
  subscriptions: Array<{ id: string; customerId: string; status: string; livemode: boolean; metadata: LinkMetadata }>
  items: Array<{
    id: string; priceId: string; quantity: number | null; plan: "pro" | "scale" | null
    kind: "plan" | "addon" | "unknown"; periodStart: string | null; periodEnd: string | null
    currency: string; unitAmount: number | null; recurring: boolean; activePrice: boolean
    metadata: LinkMetadata; priceMetadata: LinkMetadata
  }>
  snapshot: Snapshot | null
  issues: BillingResolution["conflicts"]
  limitations: string[]
}

const terminal = (status: string) => status === "canceled" || status === "incomplete_expired"
const resourceId = (value: string | { id: string }) => typeof value === "string" ? value : value.id
const date = (value: number | null | undefined) => value && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null
function linkMetadata(metadata: Stripe.Metadata | null | undefined): LinkMetadata {
  const result: LinkMetadata = {}
  for (const key of ["userId", "brokerId", "agencyId", "role", "plan", "planKey", "priceId", "checkoutType"] as const) {
    if (metadata?.[key]) result[key] = metadata[key].slice(0, 200)
  }
  return result
}

/** Bounded, on-demand observation. No email recovery, persistence, synchronization or access decisions. */
export async function readStripeBillingEvidence(
  input: BillingResolutionInput & { brokerId?: string | null; agencyId?: string | null },
  client: StripeBillingReadClient | null,
  config: StripeBillingReadConfig,
): Promise<StripeBillingEvidence> {
  const evidence: StripeBillingEvidence = {
    status: "incomplete", checkedAt: new Date().toISOString(), completedAt: null,
    customer: null, subscriptions: [], items: [], snapshot: null, issues: [], limitations: [],
  }
  const issue = (code: string, message: string) => {
    if (!evidence.issues.some((item) => item.code === code && item.message === message)) evidence.issues.push({ code, message })
  }
  const ids = [...new Set([input.user.stripeSubscriptionId, input.planAccount?.currentStripeSubscriptionId].filter((id): id is string => Boolean(id)))]
  const paid = input.user.plan !== "NONE" || input.user.subscriptionStatus === "ACTIVE" ||
    (input.planAccount && input.planAccount.planKey !== "free") || ["ACTIVE", "PAST_DUE"].includes(input.subscription?.status ?? "")
  if (!input.user.stripeCustomerId && !ids.length && !paid) {
    evidence.status = "not_needed"
    evidence.completedAt = evidence.checkedAt
    evidence.limitations.push("Sem vínculos Stripe locais; não foi feita busca global ou por email.")
    return evidence
  }
  if (!client) {
    issue("STRIPE_UNAVAILABLE", "Leitor Stripe indisponível ou não configurado.")
    evidence.status = "unavailable"
    return evidence
  }
  let calls = 0
  const deadline = Date.now() + 20_000
  async function read<T>(operation: () => Promise<T>): Promise<T> {
    if (++calls > 24 || Date.now() >= deadline) throw new Error("READ_BUDGET_EXCEEDED")
    return operation()
  }
  async function pages<T extends { id: string }>(operation: (cursor?: string) => Promise<Stripe.ApiList<T>>): Promise<T[]> {
    const result: T[] = []
    let cursor: string | undefined
    for (let page = 0; page < 3; page++) {
      const response = await read(() => operation(cursor))
      result.push(...response.data)
      if (!response.has_more) return result
      const next = response.data.at(-1)?.id
      if (!next || next === cursor) break
      cursor = next
    }
    issue("STRIPE_RESULTS_TRUNCATED", "Histórico ou itens excedem o limite da verificação; resultado parcial.")
    return result
  }
  function checkMetadata(metadata: Stripe.Metadata | null | undefined) {
    const expected = { userId: input.user.id, brokerId: input.brokerId, agencyId: input.agencyId }
    for (const key of ["userId", "brokerId", "agencyId"] as const) {
      if (metadata?.[key] && metadata[key] !== expected[key]) issue("STRIPE_METADATA_MISMATCH", `Metadata ${key} diverge do proprietário local.`)
    }
  }
  function checkMode(mode: boolean) {
    if (config.livemode !== undefined && mode !== config.livemode) issue("STRIPE_MODE_MISMATCH", "Objeto Stripe pertence a outro ambiente.")
    if (evidence.customer?.livemode != null && evidence.customer.livemode !== mode) issue("STRIPE_MODE_MISMATCH", "Customer e assinatura/Price pertencem a ambientes diferentes.")
  }
  async function existing<T>(operation: () => Promise<T>, code: string, message: string): Promise<T | null> {
    try { return await read(operation) } catch (error) {
      if ((error as { code?: string }).code !== "resource_missing") throw error
      issue(code, message)
      return null
    }
  }
  try {
    const linked: Stripe.Subscription[] = []
    for (const id of ids) {
      const subscription = await existing(() => client.subscription(id), "STRIPE_SUBSCRIPTION_NOT_FOUND", `Subscription vinculada ${id} não encontrada no Stripe.`)
      if (subscription) linked.push(subscription)
    }
    if (!input.user.stripeCustomerId) issue("STRIPE_CUSTOMER_UNLINKED", "User não possui vínculo de Customer; nenhum vínculo será recuperado automaticamente.")
    const customerId = input.user.stripeCustomerId ?? (linked.length === 1 ? resourceId(linked[0].customer) : null)
    if (customerId) {
      const customer = await existing(() => client.customer(customerId), "STRIPE_CUSTOMER_NOT_FOUND", "Customer vinculado não encontrado no Stripe.")
      if (customer) {
        evidence.customer = { id: customer.id, deleted: Boolean(customer.deleted), livemode: customer.deleted ? null : customer.livemode, metadata: customer.deleted ? {} : linkMetadata(customer.metadata) }
        if (customer.deleted) issue("STRIPE_CUSTOMER_DELETED", "Customer foi excluído no Stripe.")
        else { checkMetadata(customer.metadata); checkMode(customer.livemode) }
      }
    }
    const history = evidence.customer && !evidence.customer.deleted
      ? await pages((cursor) => client.subscriptions(evidence.customer!.id, cursor)) : []
    const all = new Map(history.map((subscription) => [subscription.id, subscription]))
    for (const subscription of linked) all.set(subscription.id, subscription)
    evidence.subscriptions = [...all.values()].map((subscription) => ({
      id: subscription.id, customerId: resourceId(subscription.customer), status: subscription.status,
      livemode: subscription.livemode, metadata: linkMetadata(subscription.metadata),
    }))
    const live = [...all.values()].filter((subscription) => !terminal(subscription.status))
    if (live.length > 1) issue("STRIPE_MULTIPLE_SUBSCRIPTIONS", "Customer possui múltiplas assinaturas não encerradas; seleção manual necessária.")
    if (!ids.length) issue("STRIPE_SUBSCRIPTION_UNLINKED", "Nenhuma Subscription está vinculada nos registros locais.")
    if (!all.size) issue("STRIPE_SUBSCRIPTION_NOT_FOUND", "Não foi encontrada assinatura correspondente no Stripe.")
    const selected = linked.find((subscription) => subscription.id === input.user.stripeSubscriptionId)
      ?? (linked.length === 1 ? linked[0] : !ids.length && all.size === 1 ? [...all.values()][0] : null)
    if (!selected) {
      issue("STRIPE_SUBSCRIPTION_UNRESOLVED", "Não foi possível selecionar uma Subscription correspondente sem alterar vínculos.")
    } else {
      checkMetadata(selected.metadata)
      checkMode(selected.livemode)
      if (resourceId(selected.customer) !== input.user.stripeCustomerId) issue("STRIPE_CUSTOMER_MISMATCH", "Customer da Subscription diverge do vínculo em User.")
      if (live.some((subscription) => subscription.id !== selected.id)) issue("STRIPE_OTHER_CURRENT_SUBSCRIPTION", "Existe outra assinatura não encerrada além da Subscription vinculada.")
      if (selected.pause_collection) issue("STRIPE_COLLECTION_PAUSED", "Cobrança pausada no Stripe; exige revisão da situação financeira.")
      const items = await pages((cursor) => client.items(selected.id, cursor))
      const priceCache = new Map<string, Stripe.Price>()
      for (const item of items) {
        if (item.subscription !== selected.id) issue("STRIPE_ITEM_MISMATCH", "Item retornado não corresponde à Subscription selecionada.")
        const priceId = item.price.id
        let price = priceCache.get(priceId)
        if (!price) {
          price = await read(() => client.price(priceId))
          priceCache.set(priceId, price)
        }
        if (price.id !== priceId) issue("STRIPE_ITEM_MISMATCH", "Price retornado diverge do item da assinatura.")
        checkMode(price.livemode)
        checkMetadata(item.metadata)
        const mapped = Object.hasOwn(config.pricePlans, price.id) ? config.pricePlans[price.id] : null
        const plan = mapped === "pro" || mapped === "scale" ? mapped : null
        const kind = plan ? "plan" : config.addonPriceIds.includes(price.id) ? "addon" : "unknown"
        if (kind === "unknown") issue("UNKNOWN_STRIPE_PRICE", `Price ${price.id} não mapeado como plano ou adicional.`)
        if (!price.recurring || (plan && item.quantity !== 1)) issue("STRIPE_ITEM_CONFIGURATION", "Recorrência ou quantidade do item de plano exige revisão.")
        evidence.items.push({
          id: item.id, priceId: price.id, quantity: item.quantity ?? null, plan, kind,
          periodStart: date(item.current_period_start), periodEnd: date(item.current_period_end),
          currency: price.currency, unitAmount: price.unit_amount, recurring: Boolean(price.recurring), activePrice: price.active,
          metadata: linkMetadata(item.metadata), priceMetadata: linkMetadata(price.metadata),
        })
      }
      const baseItems = evidence.items.filter((item) => item.kind === "plan")
      if (baseItems.length !== 1) issue("STRIPE_BASE_ITEM_UNRESOLVED", "É necessário exatamente um item reconhecido de plano base.")
      const base = baseItems.length === 1 ? baseItems[0] : null
      if (base && !terminal(selected.status) && (!base.periodStart || !base.periodEnd)) issue("STRIPE_PERIOD_UNAVAILABLE", "Período do item de plano não foi disponibilizado pelo Stripe.")
      if (base && selected.metadata.priceId && selected.metadata.priceId !== base.priceId) issue("STRIPE_PRICE_METADATA_MISMATCH", "Price em metadata diverge do item de plano atual.")
      const metadataPlan = (selected.metadata.planKey ?? selected.metadata.plan)?.toLowerCase()
      if (base && metadataPlan && metadataPlan !== base.plan) issue("STRIPE_PLAN_METADATA_MISMATCH", "Plano em metadata diverge do Price atual.")
      const unsafe = evidence.issues.some((item) => ["STRIPE_CUSTOMER_NOT_FOUND", "STRIPE_CUSTOMER_DELETED", "STRIPE_CUSTOMER_MISMATCH", "STRIPE_METADATA_MISMATCH", "STRIPE_MODE_MISMATCH", "STRIPE_MULTIPLE_SUBSCRIPTIONS", "STRIPE_OTHER_CURRENT_SUBSCRIPTION", "STRIPE_RESULTS_TRUNCATED", "STRIPE_ITEM_MISMATCH"].includes(item.code))
      if (!unsafe) evidence.snapshot = {
        id: selected.id, customerId: resourceId(selected.customer), status: selected.status,
        priceId: base?.priceId ?? null, startedAt: date(selected.start_date),
        currentPeriodStart: base?.periodStart ?? null, currentPeriodEnd: base?.periodEnd ?? null,
        trialStart: date(selected.trial_start), trialEnd: date(selected.trial_end),
        cancelAtPeriodEnd: selected.cancel_at_period_end, cancelAt: date(selected.cancel_at), canceledAt: date(selected.canceled_at),
        observedAt: new Date().toISOString(), reconciledAt: null,
      }
    }
    evidence.completedAt = new Date().toISOString()
    evidence.status = evidence.issues.length ? "incomplete" : "verified"
  } catch (error) {
    evidence.status = "unavailable"
    evidence.snapshot = null
    const code = (error as { code?: string }).code
    issue("STRIPE_READ_FAILED", code === "rate_limit" ? "Stripe limitou as consultas; tente novamente mais tarde." : "Não foi possível concluir a leitura Stripe (falha, timeout ou limite de consulta).")
  }
  return evidence
}
