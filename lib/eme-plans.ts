export type EmePlanKey = "free" | "pro" | "growth"

export type EmeExtraPackageKey =
  | "credit_50"
  | "credit_150"
  | "credit_300"
  | "property_30"
  | "property_90"

export type EmeCreditActionKey =
  | "searchProperties"
  | "createLead"
  | "CREATE_AGENDA_EVENT"
  | "LIST_AGENDA_EVENTS"
  | "createInternalNotification"
  | "createPropertyDraft"
  | "CREATE_PROPOSAL"
  | "getLeadsSummary"
  | "getAnalyticsSummary"
  | "analyzeCatalog"
  | "getCatalogSummary"
  | "getFinancialSummary"
  | "create_ad"
  | "generate_property_ai"
  | "generate_proposal_pdf"
  | "smart_import_image"
  | "smart_import_print"
  | "smart_import_text"

export const EME_PLANS = {
  free: {
    key: "free",
    name: "Plano Free",
    priceCents: 0,
    propertyLimit: 3,
    monthlyAiCredits: 20,
    initialAiCredits: 20,
    features: ["catalog", "leads", "agenda", "documents", "financial", "analytics", "assessor_eme"],
  },
  pro: {
    key: "pro",
    name: "Plano EME Pro",
    priceCents: 8990,
    propertyLimit: 50,
    monthlyAiCredits: 50,
    initialAiCredits: 50,
    features: ["all", "assessor_eme"],
  },
  growth: {
    key: "growth",
    name: "Plano EME Growth",
    priceCents: 14990,
    propertyLimit: 150,
    monthlyAiCredits: 150,
    initialAiCredits: 150,
    features: ["all", "assessor_eme"],
  },
} as const satisfies Record<EmePlanKey, {
  key: EmePlanKey
  name: string
  priceCents: number
  propertyLimit: number
  monthlyAiCredits: number
  initialAiCredits: number
  features: readonly string[]
}>

export const EME_EXTRA_PACKAGES = {
  credit_50: {
    key: "credit_50",
    type: "credit",
    label: "+50 créditos IA",
    quantity: 50,
    priceCents: 2990,
  },
  credit_150: {
    key: "credit_150",
    type: "credit",
    label: "+150 créditos IA",
    quantity: 150,
    priceCents: 6990,
  },
  credit_300: {
    key: "credit_300",
    type: "credit",
    label: "+300 créditos IA",
    quantity: 300,
    priceCents: 11990,
  },
  property_30: {
    key: "property_30",
    type: "property",
    label: "+30 imóveis",
    quantity: 30,
    priceCents: 4990,
  },
  property_90: {
    key: "property_90",
    type: "property",
    label: "+90 imóveis",
    quantity: 90,
    priceCents: 11990,
  },
} as const satisfies Record<EmeExtraPackageKey, {
  key: EmeExtraPackageKey
  type: "credit" | "property"
  label: string
  quantity: number
  priceCents: number
}>

export const EME_CREDIT_COSTS = {
  searchProperties: 1,
  createLead: 1,
  CREATE_AGENDA_EVENT: 1,
  LIST_AGENDA_EVENTS: 1,
  createInternalNotification: 1,
  createPropertyDraft: 2,
  CREATE_PROPOSAL: 2,
  getLeadsSummary: 2,
  getAnalyticsSummary: 2,
  analyzeCatalog: 2,
  getCatalogSummary: 2,
  getFinancialSummary: 2,
  create_ad: 3,
  generate_property_ai: 3,
  generate_proposal_pdf: 3,
  smart_import_image: 3,
  smart_import_print: 3,
  smart_import_text: 3,
} as const satisfies Record<EmeCreditActionKey, number>

export const EME_PROPERTY_LIMIT_MESSAGE =
  "Você atingiu o limite de imóveis do seu plano. Faça upgrade ou compre um pacote de imóveis extras para continuar publicando."

export const EME_INSUFFICIENT_CREDITS_MESSAGE =
  "Créditos IA insuficientes. Compre um pacote de créditos ou aguarde a renovação do seu plano."

export function normalizeEmePlanKey(value: unknown): EmePlanKey {
  return value === "pro" || value === "growth" ? value : "free"
}

export function getEmeCreditCost(actionKey: string) {
  return EME_CREDIT_COSTS[actionKey as EmeCreditActionKey] ?? 1
}
