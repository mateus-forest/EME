export type EmePlanKey = "free" | "pro" | "scale"
export type EmeStoredPlanKey = EmePlanKey | "growth"

export type EmeExtraPackageKey =
  | "credit_250"
  | "credit_750"
  | "credit_1500"
  | "credit_3000"
  | "property_250"
  | "property_500"
  | "property_1000"

export type EmeCreditActionKey =
  | "qualifyLead"
  | "general"
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
  | "analyzeFinancialSummary"
  | "analyzeOperationalHealth"
  | "create_ad"
  | "generate_property_ai"
  | "improve_description"
  | "generate_proposal_pdf"
  | "generate_contract_pdf"
  | "smart_import_image"
  | "smart_import_print"
  | "smart_import_text"
  | "smart_import_url"
  | "smart_import_xml"
  | "studio_caption"
  | "studio_instagram_campaign"
  | "studio_buyers_campaign"
  | "studio_owners_campaign"
  | "studio_sell_property_campaign"
  | "studio_construction_image"
  | "studio_ia_video_generation"
  | "studio_ia_video_preview_generation"
  | "studio_ia_video_preview_regeneration"
  | "studio_ia_video_final_generation"
  | "help_first_steps"
  | "help_use_cos"
  | "help_register_properties"
  | "help_manage_clients"
  | "help_contracts_proposals"
  | "help_marketing_studio"
  | "help_general_question"
  | "reply_client"
  | "match_properties"
  | "lead_ideas"

export const EME_PLANS = {
  free: {
    key: "free",
    name: "Plano Free",
    priceCents: 0,
    propertyLimit: 5,
    monthlyAiCredits: 30,
    initialAiCredits: 30,
    features: ["all", "assessor_eme"],
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
  scale: {
    key: "scale",
    name: "Plano EME Scale",
    priceCents: 38900,
    propertyLimit: 1000,
    monthlyAiCredits: 2000,
    initialAiCredits: 2000,
    features: ["all", "assessor_eme"],
  },
} as const satisfies Record<
  EmePlanKey,
  {
    key: EmePlanKey
    name: string
    priceCents: number
    propertyLimit: number
    monthlyAiCredits: number
    initialAiCredits: number
    features: readonly string[]
  }
>

export const EME_EXTRA_PACKAGES = {
  credit_250: {
    key: "credit_250",
    type: "credit",
    label: "+250 Creditos IA",
    quantity: 250,
    priceCents: 2900,
  },
  credit_750: {
    key: "credit_750",
    type: "credit",
    label: "+750 Creditos IA",
    quantity: 750,
    priceCents: 7900,
  },
  credit_1500: {
    key: "credit_1500",
    type: "credit",
    label: "+1.500 Creditos IA",
    quantity: 1500,
    priceCents: 13900,
  },
  credit_3000: {
    key: "credit_3000",
    type: "credit",
    label: "+3.000 Creditos IA",
    quantity: 3000,
    priceCents: 24900,
  },
  property_250: {
    key: "property_250",
    type: "property",
    // Mantemos a chave por compatibilidade com a camada de checkout legada.
    label: "+50 imoveis ativos",
    quantity: 50,
    priceCents: 4900,
  },
  property_500: {
    key: "property_500",
    type: "property",
    // Mantemos a chave por compatibilidade com a camada de checkout legada.
    label: "+100 imoveis ativos",
    quantity: 100,
    priceCents: 8900,
  },
  property_1000: {
    key: "property_1000",
    type: "property",
    // Mantemos a chave por compatibilidade com a camada de checkout legada.
    label: "+200 imoveis ativos",
    quantity: 200,
    priceCents: 15900,
  },
} as const satisfies Record<
  EmeExtraPackageKey,
  {
    key: EmeExtraPackageKey
    type: "credit" | "property"
    label: string
    quantity: number
    priceCents: number
  }
>

export const EME_CREDIT_COSTS = {
  qualifyLead: 1,
  general: 1,
  searchProperties: 1,
  createLead: 1,
  CREATE_AGENDA_EVENT: 1,
  LIST_AGENDA_EVENTS: 1,
  createInternalNotification: 1,
  createPropertyDraft: 3,
  CREATE_PROPOSAL: 2,
  CREATE_CONTRACT: 2,
  getLeadsSummary: 2,
  getAnalyticsSummary: 2,
  analyzeCatalog: 2,
  getCatalogSummary: 2,
  getFinancialSummary: 2,
  analyzeFinancialSummary: 3,
  analyzeOperationalHealth: 3,
  create_ad: 3,
  generate_property_ai: 3,
  improve_description: 2,
  generate_proposal_pdf: 0,
  generate_contract_pdf: 0,
  smart_import_image: 5,
  smart_import_print: 5,
  smart_import_text: 4,
  smart_import_url: 4,
  smart_import_xml: 0,
  studio_caption: 2,
  studio_instagram_campaign: 10,
  studio_buyers_campaign: 3,
  studio_owners_campaign: 3,
  studio_sell_property_campaign: 3,
  studio_construction_image: 40,
  studio_ia_video_generation: 38,
  studio_ia_video_preview_generation: 12,
  studio_ia_video_preview_regeneration: 12,
  studio_ia_video_final_generation: 38,
  help_first_steps: 0,
  help_use_cos: 0,
  help_register_properties: 0,
  help_manage_clients: 0,
  help_contracts_proposals: 0,
  help_marketing_studio: 0,
  help_general_question: 0,
  reply_client: 1,
  match_properties: 1,
  lead_ideas: 1,
} as const satisfies Record<EmeCreditActionKey, number>

export const EME_PROPERTY_LIMIT_MESSAGE =
  "Voce atingiu o limite de imoveis do seu plano. Faca upgrade ou compre um pacote de imoveis extras para continuar publicando."

export const EME_INSUFFICIENT_CREDITS_MESSAGE =
  "Creditos IA insuficientes. Compre um pacote de creditos ou aguarde a renovacao do seu plano."

export const EME_FREE_COS_ACTIONS = new Set<EmeCreditActionKey>([
  "help_first_steps",
  "help_use_cos",
  "help_register_properties",
  "help_manage_clients",
  "help_contracts_proposals",
  "help_marketing_studio",
  "help_general_question",
])

export const EME_COS_CONTEXT_ACTIONS = new Set<EmeCreditActionKey>([
  "getLeadsSummary",
  "getAnalyticsSummary",
  "analyzeCatalog",
  "getCatalogSummary",
  "getFinancialSummary",
  "analyzeFinancialSummary",
  "analyzeOperationalHealth",
])

export const EME_COS_SIMPLE_QUERY_ACTIONS = new Set<EmeCreditActionKey>([
  "general",
  "searchProperties",
  "createLead",
  "CREATE_AGENDA_EVENT",
  "LIST_AGENDA_EVENTS",
  "reply_client",
  "match_properties",
  "lead_ideas",
  "qualifyLead",
])

export const EME_ACTIVE_PROPERTY_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED"] as const
export const EME_ACTIVE_PROPERTY_LABELS = ["Rascunho", "Publicado", "Pausado"] as const

export function isEmeActivePropertyStatus(value: unknown): value is (typeof EME_ACTIVE_PROPERTY_STATUSES)[number] {
  return EME_ACTIVE_PROPERTY_STATUSES.includes(value as (typeof EME_ACTIVE_PROPERTY_STATUSES)[number])
}

export function isEmeActivePropertyLabel(value: unknown): value is (typeof EME_ACTIVE_PROPERTY_LABELS)[number] {
  return EME_ACTIVE_PROPERTY_LABELS.includes(value as (typeof EME_ACTIVE_PROPERTY_LABELS)[number])
}

export function normalizeEmePlanKey(value: unknown): EmePlanKey {
  if (value === "scale" || value === "growth") return "scale"
  return value === "pro" ? "pro" : "free"
}

export function getEmeCreditCost(actionKey: string) {
  const amount = EME_CREDIT_COSTS[actionKey as EmeCreditActionKey]

  if (typeof amount === "number") {
    return amount
  }

  const message = `EME credit cost not configured for action "${actionKey}".`
  if (process.env.NODE_ENV !== "production") {
    throw new Error(message)
  }

  console.warn(message)
  return 0
}
