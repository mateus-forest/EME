export type EmePlanKey = "free" | "pro" | "growth" | "scale"

export type EmeExtraPackageKey =
  | "credit_100"
  | "credit_300"
  | "credit_800"
  | "property_50"
  | "property_200"

export type EmeCreditActionKey =
  | "searchProperties"
  | "createLead"
  | "CREATE_AGENDA_EVENT"
  | "LIST_AGENDA_EVENTS"
  | "createInternalNotification"
  | "createPropertyDraft"
  | "CREATE_PROPOSAL"
  | "CREATE_CONTRACT"
  | "getLeadsSummary"
  | "getAnalyticsSummary"
  | "analyzeCatalog"
  | "getCatalogSummary"
  | "getFinancialSummary"
  | "create_ad"
  | "generate_property_ai"
  | "generate_proposal_pdf"
  | "generate_contract_pdf"
  | "smart_import_image"
  | "smart_import_print"
  | "smart_import_text"

export const EME_PLANS = {
  free: {
    key: "free",
    name: "Plano Free",
    priceCents: 0,
    propertyLimit: 5,
    monthlyAiCredits: 30,
    initialAiCredits: 30,
    features: ["catalog", "leads", "agenda", "documents", "financial", "analytics", "assessor_eme"],
  },
  pro: {
    key: "pro",
    name: "Plano EME Pro",
    priceCents: 12900,
    propertyLimit: 150,
    monthlyAiCredits: 500,
    initialAiCredits: 500,
    features: ["all", "assessor_eme"],
  },
  growth: {
    key: "growth",
    name: "Plano EME Growth",
    priceCents: 19900,
    propertyLimit: 320,
    monthlyAiCredits: 520,
    initialAiCredits: 520,
    features: ["all", "assessor_eme"],
  },
  scale: {
    key: "scale",
    name: "Plano EME Scale",
    priceCents: 38900,
    propertyLimit: 1000,
    monthlyAiCredits: 2000,
    initialAiCredits: 2000,
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
  credit_100: {
    key: "credit_100",
    type: "credit",
    label: "+250 Operacoes Inteligentes",
    quantity: 250,
    priceCents: 2900,
  },
  credit_300: {
    key: "credit_300",
    type: "credit",
    label: "+750 Operacoes Inteligentes",
    quantity: 750,
    priceCents: 6900,
  },
  credit_800: {
    key: "credit_800",
    type: "credit",
    label: "+1.500 Operacoes Inteligentes",
    quantity: 1500,
    priceCents: 11900,
  },
  property_50: {
    key: "property_50",
    type: "property",
    label: "+250 imoveis ativos",
    quantity: 250,
    priceCents: 4900,
  },
  property_200: {
    key: "property_200",
    type: "property",
    label: "+500 imoveis ativos",
    quantity: 500,
    priceCents: 8900,
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
  CREATE_CONTRACT: 2,
  getLeadsSummary: 2,
  getAnalyticsSummary: 2,
  analyzeCatalog: 2,
  getCatalogSummary: 2,
  getFinancialSummary: 2,
  create_ad: 2,
  generate_property_ai: 2,
  generate_proposal_pdf: 1,
  generate_contract_pdf: 1,
  smart_import_image: 5,
  smart_import_print: 5,
  smart_import_text: 4,
} as const satisfies Record<EmeCreditActionKey, number>

export const EME_PROPERTY_LIMIT_MESSAGE =
  "Voce atingiu o limite de imoveis do seu plano. Faca upgrade ou compre um pacote de imoveis extras para continuar publicando."

export const EME_INSUFFICIENT_CREDITS_MESSAGE =
  "Creditos IA insuficientes. Compre um pacote de creditos ou aguarde a renovacao do seu plano."

export function normalizeEmePlanKey(value: unknown): EmePlanKey {
  return value === "pro" || value === "growth" || value === "scale" ? value : "free"
}

export function getEmeCreditCost(actionKey: string) {
  return EME_CREDIT_COSTS[actionKey as EmeCreditActionKey] ?? 1
}
