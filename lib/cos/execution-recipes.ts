import type { CosCapabilityId, CosConversationDomain, CosDialogueAct, CosDialogueDecision, CosWorkspaceContext } from "@/lib/cos/types"

export type CosExecutionRecipe = {
  id: string
  match: (input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) => boolean
  stepIds: CosCapabilityId[]
  dialogueActs: CosDialogueAct[]
  primaryDomains: CosConversationDomain[]
  reason: (input: { normalizedMessage: string; workspace: CosWorkspaceContext | null }) => string
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasAny(message: string, tokens: string[]) {
  return tokens.some((token) => message.includes(token))
}

function isPropertyWorkspace(workspace: CosWorkspaceContext | null) {
  return workspace?.entity === "property" && Boolean(workspace.entityId || workspace.selection[0]?.entityId)
}

export const cosExecutionRecipes: CosExecutionRecipe[] = [
  {
    id: "lead_proposal_agenda",
    match: ({ normalizedMessage }) =>
      hasAny(normalizedMessage, ["cadastre", "cadastrar", "novo cliente", "novo lead", "crie cliente", "criar cliente"]) &&
      normalizedMessage.includes("proposta") &&
      hasAny(normalizedMessage, ["lembre", "lembrar", "agenda", "agende", "compromisso"]),
    stepIds: ["lead.create", "proposal.create", "agenda.create"],
    dialogueActs: ["execute"],
    primaryDomains: ["lead", "proposal", "agenda"],
    reason: () => "pedido combinou cadastro de cliente, proposta e compromisso em etapas dependentes",
  },
  {
    id: "lead_create_then_proposal",
    match: ({ normalizedMessage }) =>
      hasAny(normalizedMessage, ["cadastre", "cadastrar", "novo cliente", "novo lead", "crie cliente", "criar cliente"]) &&
      normalizedMessage.includes("proposta"),
    stepIds: ["lead.create", "proposal.create"],
    dialogueActs: ["execute"],
    primaryDomains: ["lead", "proposal"],
    reason: () => "pedido combinou cadastro de cliente com geração de proposta",
  },
  {
    id: "proposal_then_agenda",
    match: ({ normalizedMessage }) =>
      normalizedMessage.includes("proposta") &&
      hasAny(normalizedMessage, ["lembre", "lembrar", "agenda", "agende", "compromisso"]),
    stepIds: ["proposal.create", "agenda.create"],
    dialogueActs: ["execute"],
    primaryDomains: ["proposal", "agenda"],
    reason: () => "pedido combinou proposta e compromisso em etapas dependentes",
  },
  {
    id: "contract_create_then_send",
    match: ({ normalizedMessage }) =>
      normalizedMessage.includes("contrato") &&
      hasAny(normalizedMessage, ["crie", "criar", "novo contrato", "gerar contrato", "monte"]) &&
      hasAny(normalizedMessage, ["envie", "enviar"]),
    stepIds: ["contract.create", "contract.send"],
    dialogueActs: ["execute"],
    primaryDomains: ["contract"],
    reason: () => "pedido combinou criação e envio do contrato sem registrar assinatura automaticamente",
  },
  {
    id: "operation_analysis",
    match: ({ normalizedMessage }) =>
      hasAny(normalizedMessage, ["analise minha operacao", "analisar minha operacao", "analise minha carteira", "analisar minha carteira"]),
    stepIds: ["lead.summary", "finance.summary", "analytics.summary", "operation.summary"],
    dialogueActs: ["query"],
    primaryDomains: ["analytics", "lead", "finance"],
    reason: () => "pedido exige consolidação operacional em múltiplas leituras do Registry",
  },
  {
    id: "property_sale_preparation",
    match: ({ normalizedMessage, workspace }) =>
      isPropertyWorkspace(workspace) &&
      !hasAny(normalizedMessage, ["despublicar", "pausar", "tirar do catalogo", "remover do catalogo"]) &&
      hasAny(normalizedMessage, ["quero vender", "vender este imovel", "gere um anuncio", "criar anuncio", "publicar este imovel"]),
    stepIds: ["property.description.improve", "catalog.publish", "studio.generateCampaign"],
    dialogueActs: ["execute"],
    primaryDomains: ["property"],
    reason: () => "pedido usou um imóvel do workspace para preparar a venda com descrição, publicação e campanha",
  },
  {
    id: "catalog_publish_then_campaign",
    match: ({ normalizedMessage }) => normalizedMessage.includes("catalogo") && hasAny(normalizedMessage, ["publique", "publicar", "campanha"]),
    stepIds: ["catalog.publish", "studio.generateCampaign"],
    dialogueActs: ["execute"],
    primaryDomains: ["catalog", "studio"],
    reason: () => "pedido combinou publicação em catálogo com geração de campanha no Studio IA",
  },
]

export function findCosExecutionRecipe(input: {
  message: string
  workspace: CosWorkspaceContext | null
  isExplicitAction?: boolean
  decision?: CosDialogueDecision | null
}) {
  if (input.isExplicitAction) return null
  const normalizedMessage = normalizeText(input.message)
  const recipe = cosExecutionRecipes.find((candidate) => candidate.match({ normalizedMessage, workspace: input.workspace })) ?? null
  if (!recipe || !input.decision) return recipe
  if (!recipe.dialogueActs.includes(input.decision.dialogueAct)) return null
  const objectiveMatches =
    recipe.primaryDomains.includes(input.decision.primaryDomain) ||
    Boolean(input.decision.selectedCapabilityId && recipe.stepIds.includes(input.decision.selectedCapabilityId))
  return objectiveMatches ? recipe : null
}
