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
  // As chaves abaixo são AssessorAction (lib/eme-backend.ts) que podem surgir como resultado de
  // uma confirmação (botão "Confirmar") ou de uma seleção de opção no COS. Antes de serem
  // adicionadas aqui, qualquer uma delas fazia getEmeCreditCost lançar exceção e travar o clique
  // (ver bug do "Confirmar"/seleção travando por custo não configurado).
  | "summarizeLead"
  | "LIST_DOCUMENTS"
  | "GET_DOCUMENT"
  | "LIST_CONTRACTS"
  | "GET_CONTRACT"
  | "CONTRACT_HISTORY"
  | "CONTRACT_PREVIEW"
  | "FIND_LEAD"
  | "LEAD_TIMELINE"
  | "LIST_AGENDA_TODAY"
  | "LIST_AGENDA_WEEK"
  | "LIST_AGENDA_MONTH"
  | "GET_FINANCE_RECEIVABLE"
  | "GET_FINANCE_PAYABLE"
  | "GET_FINANCE_FORECAST"
  | "GET_FINANCE_COMMISSION"
  | "GET_FINANCE_CASHFLOW"
  | "GET_ANALYTICS_PERFORMANCE"
  | "GET_ANALYTICS_SALES"
  | "GET_ANALYTICS_PROPERTIES"
  | "GET_ANALYTICS_LEADS"
  | "CATALOG_STATS"
  | "MARK_AGENDA_DONE"
  | "UPDATE_CONTRACT"
  | "SEND_CONTRACT"
  | "SIGN_CONTRACT"
  | "CANCEL_CONTRACT"
  | "PUBLISH_CATALOG"
  | "UNPUBLISH_CATALOG"
  | "PUBLISH_PROPERTY"
  | "UNPUBLISH_PROPERTY"
  | "UPDATE_PROPERTY_MEDIA"
  | "ARCHIVE_PROPERTY"
  | "UPDATE_LEAD"
  | "DELETE_LEAD"
  | "CONVERT_LEAD"
  | "ATTACH_LEAD_DOCUMENT"
  | "UPDATE_AGENDA_EVENT"
  | "CANCEL_AGENDA_EVENT"
  | "SHARE_CATALOG"
  | "DOWNLOAD_CONTRACT"
  | "improvePropertyDescription"
  | "STUDIO_GENERATE_DESCRIPTION"
  | "STUDIO_IMPROVE_TEXT"
  | "STUDIO_GENERATE_INSTAGRAM"
  | "STUDIO_GENERATE_VIDEO"
  | "STUDIO_REGENERATE"
  | "SUGGEST_PROPERTY_PRICE"

export const EME_PLANS = {
  free: {
    key: "free",
    name: "Plano Free",
    priceCents: 0,
    propertyLimit: 5,
    monthlyAiCredits: 30,
    initialAiCredits: 30,
    features: ["core_modules", "assessor_eme"],
  },
  pro: {
    key: "pro",
    name: "Plano EME Pro",
    priceCents: 12900,
    propertyLimit: 150,
    monthlyAiCredits: 500,
    initialAiCredits: 500,
    features: ["core_modules", "assessor_eme", "marketplace"],
  },
  scale: {
    key: "scale",
    name: "Plano EME Scale",
    priceCents: 38900,
    propertyLimit: 1000,
    monthlyAiCredits: 2000,
    initialAiCredits: 2000,
    features: ["core_modules", "assessor_eme", "marketplace"],
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
    label: "+250 Créditos IA",
    quantity: 250,
    priceCents: 2900,
  },
  credit_750: {
    key: "credit_750",
    type: "credit",
    label: "+750 Créditos IA",
    quantity: 750,
    priceCents: 7900,
  },
  credit_1500: {
    key: "credit_1500",
    type: "credit",
    label: "+1.500 Créditos IA",
    quantity: 1500,
    priceCents: 13900,
  },
  credit_3000: {
    key: "credit_3000",
    type: "credit",
    label: "+3.000 Créditos IA",
    quantity: 3000,
    priceCents: 24900,
  },
  property_250: {
    key: "property_250",
    type: "property",
    // Mantemos a chave por compatibilidade com a camada de checkout legada.
    label: "+100 imóveis",
    quantity: 100,
    priceCents: 5900,
  },
  property_500: {
    key: "property_500",
    type: "property",
    // Mantemos a chave por compatibilidade com a camada de checkout legada.
    label: "+250 imóveis",
    quantity: 250,
    priceCents: 11900,
  },
  property_1000: {
    key: "property_1000",
    type: "property",
    // Mantemos a chave por compatibilidade com a camada de checkout legada.
    label: "+500 imóveis",
    quantity: 500,
    priceCents: 19900,
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

  // Consultas simples (uma entidade ou lista curta) — mesmo tier de searchProperties/createLead.
  summarizeLead: 1,
  LIST_DOCUMENTS: 1,
  GET_DOCUMENT: 1,
  LIST_CONTRACTS: 1,
  GET_CONTRACT: 1,
  CONTRACT_HISTORY: 1,
  CONTRACT_PREVIEW: 1,
  FIND_LEAD: 1,
  LEAD_TIMELINE: 1,
  LIST_AGENDA_TODAY: 1,
  LIST_AGENDA_WEEK: 1,
  LIST_AGENDA_MONTH: 1,

  // Consultas agregadas/resumo — mesmo tier de getLeadsSummary/getAnalyticsSummary/getCatalogSummary.
  GET_FINANCE_RECEIVABLE: 2,
  GET_FINANCE_PAYABLE: 2,
  GET_FINANCE_FORECAST: 2,
  GET_FINANCE_COMMISSION: 2,
  GET_FINANCE_CASHFLOW: 2,
  GET_ANALYTICS_PERFORMANCE: 2,
  GET_ANALYTICS_SALES: 2,
  GET_ANALYTICS_PROPERTIES: 2,
  GET_ANALYTICS_LEADS: 2,
  CATALOG_STATS: 2,

  // Mutações simples de status/dados (sem IA) — mesmo tier de CREATE_AGENDA_EVENT/createLead.
  MARK_AGENDA_DONE: 1,
  UPDATE_CONTRACT: 1,
  SEND_CONTRACT: 1,
  SIGN_CONTRACT: 1,
  CANCEL_CONTRACT: 1,
  PUBLISH_CATALOG: 1,
  UNPUBLISH_CATALOG: 1,
  PUBLISH_PROPERTY: 1,
  UNPUBLISH_PROPERTY: 1,
  UPDATE_PROPERTY_MEDIA: 1,
  ARCHIVE_PROPERTY: 1,
  UPDATE_LEAD: 1,
  DELETE_LEAD: 1,
  CONVERT_LEAD: 1,
  ATTACH_LEAD_DOCUMENT: 1,
  UPDATE_AGENDA_EVENT: 1,
  CANCEL_AGENDA_EVENT: 1,

  // Só produzem um link/documento a partir de dados já existentes, sem IA — mesmo tier de
  // generate_proposal_pdf/generate_contract_pdf.
  SHARE_CATALOG: 0,
  DOWNLOAD_CONTRACT: 0,

  // Refinamento de texto — mesmo tier de improve_description/studio_caption (o par CamelCase de
  // improve_description, ambos existiam em paralelo apontando para a mesma funcionalidade).
  improvePropertyDescription: 2,
  STUDIO_GENERATE_DESCRIPTION: 2,
  STUDIO_IMPROVE_TEXT: 2,

  // Mesmo tier do studio_instagram_campaign já cadastrado.
  STUDIO_GENERATE_INSTAGRAM: 10,

  // Fallback não-autoritativo: o custo real de vídeo é decidido por studioVideoCreditPolicy em
  // lib/studio-ia-video-shared.ts (previa=10, regeneracao=10, economico=20, final=30), não por
  // esta tabela. Usa o tier "final" (30) só para esta chave nunca ficar indefinida.
  STUDIO_GENERATE_VIDEO: 30,

  // Regenerar custa menos que gerar do zero; sugestão de preço é uma análise simples.
  STUDIO_REGENERATE: 2,
  SUGGEST_PROPERTY_PRICE: 2,

  // STUDIO_GENERATE_CAMPAIGN, STUDIO_GENERATE_FACEBOOK e STUDIO_GENERATE_STORY ficam
  // deliberadamente FORA desta tabela por enquanto — pricing pendente de decisão dedicada (existem
  // dois tiers vizinhos conflitantes: studio_instagram_campaign=10 vs. studio_buyers/owners/
  // sell_property_campaign=3). getEmeCreditCost cai no fallback seguro para essas três.
} as const satisfies Record<EmeCreditActionKey, number>

export const EME_PROPERTY_LIMIT_MESSAGE =
  "Você atingiu o limite de imóveis do seu plano. Faça upgrade ou adicione capacidade para continuar cadastrando."

export const EME_INSUFFICIENT_CREDITS_MESSAGE =
  "Créditos IA insuficientes. Compre um pacote de créditos ou aguarde a renovação do seu plano."

export const EME_FREE_COS_ACTIONS = new Set<EmeCreditActionKey>([
  "general",
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

const EME_PLAN_RANK: Record<EmePlanKey, number> = {
  free: 0,
  pro: 1,
  scale: 2,
}

export function getNextEmePlanKey(value: unknown): Extract<EmePlanKey, "pro" | "scale"> | null {
  const currentPlan = normalizeEmePlanKey(value)
  if (currentPlan === "free") return "pro"
  if (currentPlan === "pro") return "scale"
  return null
}

export function isEmePlanUpgrade(currentValue: unknown, targetValue: unknown) {
  const currentPlan = normalizeEmePlanKey(currentValue)
  const targetPlan = normalizeEmePlanKey(targetValue)
  return EME_PLAN_RANK[targetPlan] > EME_PLAN_RANK[currentPlan]
}

export function resolveEmePlanUpgradeTarget(
  currentValue: unknown,
  requestedValue?: unknown,
): Extract<EmePlanKey, "pro" | "scale"> | null {
  const nextPlan = getNextEmePlanKey(currentValue)
  if (!nextPlan) return null
  if (requestedValue === undefined || requestedValue === null || requestedValue === "") return nextPlan
  if (requestedValue !== "pro" && requestedValue !== "scale") return null
  return isEmePlanUpgrade(currentValue, requestedValue) ? requestedValue : null
}

// Nunca deve lançar: uma action esquecida na tabela não pode derrubar o fluxo inteiro do COS
// (era exatamente isso que travava "Confirmar"/seleção de opção para qualquer action fora daqui).
// Custo desconhecido cai num fallback conservador + warning, não em 0 silencioso nem em exceção —
// actions já cadastradas acima sempre retornam seu valor real, isso só afeta as ainda não mapeadas.
const EME_CREDIT_COST_FALLBACK = 1

export function getEmeCreditCost(actionKey: string) {
  const amount = EME_CREDIT_COSTS[actionKey as EmeCreditActionKey]

  if (typeof amount === "number") {
    return amount
  }

  console.warn(
    `EME credit cost not configured for action "${actionKey}". Usando fallback conservador de ${EME_CREDIT_COST_FALLBACK} crédito(s) — adicione essa action em EME_CREDIT_COSTS para definir o custo real.`,
  )
  return EME_CREDIT_COST_FALLBACK
}
