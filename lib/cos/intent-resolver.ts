import type { AssessorAction } from "@/lib/eme-backend"

import { evaluateCosDecisionSecurity } from "@/lib/cos/decision-security"
import { resolveCosOperationalIntent } from "@/lib/cos/operational-intent"
import type { CosConversationMemory, CosNormalizedContext, CosWorkflow, CosWorkspaceContext } from "@/lib/cos/types"

type CosIntentAttachment = {
  id: string
  name: string
  type: string
  size: number
  category: "image" | "document" | "video" | "files"
  dataUrl?: string
  textContent?: string
}

type CosIntentCandidate = {
  action: AssessorAction
  score: number
  confidence: number
  reason: string
}

export type CosIntentResolution = {
  requestedAction: AssessorAction | null
  workflowDecision: "continue_workflow" | "start_new" | "none"
  confidence: number
  reason: string
  needsConfirmation?: boolean
  candidates?: Array<{
    action: AssessorAction
    confidence: number
    reason: string
  }>
  signals: {
    operationalIntent: string | null
    workspacePage: string | null
    workspaceEntity: string | null
    activeWorkflowAction: AssessorAction | null
    attachments: string[]
  }
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasAny(normalizedMessage: string, tokens: string[]) {
  return tokens.some((token) => normalizedMessage.includes(token))
}

function countAny(normalizedMessage: string, tokens: string[]) {
  return tokens.filter((token) => normalizedMessage.includes(token)).length
}

function hasWord(normalizedMessage: string, token: string) {
  return new RegExp(`\\b${token}\\b`, "u").test(normalizedMessage)
}

function hasCatalogRemovalLanguage(normalizedMessage: string) {
  return /(?:tirar|remover)\s+.+\s+do\s+cat[aá]logo/.test(normalizedMessage)
}

function getActiveWorkflowAction(workflow: CosWorkflow | null | undefined) {
  if (!workflow) return null
  return workflow.pendingInput?.action ?? workflow.steps[workflow.currentStep]?.action ?? workflow.steps[0]?.action ?? null
}

function getActionDomain(action: AssessorAction | null | undefined) {
  if (!action) return "general"
  if (action.startsWith("STUDIO_")) return "studio"
  if (
    action.startsWith("CREATE_CONTRACT") ||
    action.startsWith("SEND_CONTRACT") ||
    action.startsWith("SIGN_CONTRACT") ||
    action.startsWith("CANCEL_CONTRACT") ||
    action.startsWith("DOWNLOAD_CONTRACT") ||
    action === "GET_CONTRACT" ||
    action === "LIST_CONTRACTS" ||
    action === "CONTRACT_HISTORY"
  ) return "contract"
  if (action.startsWith("CREATE_PROPOSAL") || action === "LIST_DOCUMENTS") return "proposal"
  if (
    action.includes("PROPERTY") ||
    action === "createPropertyDraft" ||
    action === "improvePropertyDescription" ||
    action === "PUBLISH_CATALOG" ||
    action === "UNPUBLISH_CATALOG"
  ) return "property"
  if (action.includes("LEAD") || action === "createLead" || action === "getLeadsSummary" || action === "summarizeLead") return "lead"
  if (action.includes("AGENDA")) return "agenda"
  if (action.includes("FINANCE") || action === "GET_FINANCE_COMMISSION" || action === "getFinancialSummary") return "finance"
  if (action.includes("ANALYTICS") || action === "getAnalyticsSummary") return "analytics"
  if (action.includes("CATALOG") || action === "getCatalogSummary" || action === "analyzeCatalog") return "catalog"
  return "general"
}

function getPendingSelectionLabels(workflow: CosWorkflow | null | undefined) {
  if (!workflow?.pendingInput || workflow.pendingInput.type !== "selection") return []
  const rawOptions = Array.isArray(workflow.pendingInput.options)
    ? workflow.pendingInput.options
    : workflow.pendingInput.parsedData?.options
  if (!Array.isArray(rawOptions)) return []

  return rawOptions
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => (typeof item.label === "string" ? normalizeText(item.label) : ""))
    .filter(Boolean)
}

function isAffirmativeMessage(normalizedMessage: string) {
  return /^(sim|s|ok|pode|confirmar|confirma|seguir|prosseguir|pode seguir)$/.test(normalizedMessage)
}

function isCancellationMessage(normalizedMessage: string) {
  return /^(nao|n|cancelar|cancela|parar|pare)$/.test(normalizedMessage)
}

function getAttachmentSignals(attachments: CosIntentAttachment[]) {
  const hasImage = attachments.some((attachment) => attachment.category === "image")
  const hasDocument = attachments.some((attachment) => attachment.category === "document")
  const hasVideo = attachments.some((attachment) => attachment.category === "video")
  const hasAudio = attachments.some((attachment) => attachment.type.toLowerCase().startsWith("audio/"))

  return {
    hasImage,
    hasDocument,
    hasVideo,
    hasAudio,
    labels: attachments.map((attachment) => `${attachment.category}:${attachment.name}`),
  }
}

function buildIntentCandidates(input: {
  normalizedMessage: string
  workspace: CosWorkspaceContext | null
  memory: CosConversationMemory | null
  attachments: CosIntentAttachment[]
  activeWorkflow: CosWorkflow | null
}) {
  const attachmentSignals = getAttachmentSignals(input.attachments)
  const operationalIntent = resolveCosOperationalIntent({
    normalizedMessage: input.normalizedMessage,
    workspace: input.workspace,
  })
  const workspacePage = input.workspace?.page ?? ""
  const workspaceEntity = input.workspace?.entity ?? null
  const activeWorkflowAction = getActiveWorkflowAction(input.activeWorkflow)
  const activeWorkflowDomain = getActionDomain(activeWorkflowAction)

  const inPropertyContext =
    workspaceEntity === "property" ||
    workspacePage.startsWith("property_") ||
    Boolean(input.memory?.selectedProperty?.id) ||
    Boolean(input.memory?.propertyId)
  const inLeadContext =
    workspaceEntity === "lead" ||
    workspacePage.startsWith("lead_") ||
    Boolean(input.memory?.selectedClient?.id) ||
    Boolean(input.memory?.leadId)
  const inContractContext = workspaceEntity === "contract" || workspacePage === "contracts" || Boolean(input.memory?.selectedContract?.id)
  const inProposalContext = workspaceEntity === "document" || Boolean(input.memory?.selectedProposal?.id) || Boolean(input.memory?.proposalId)
  const inCatalogContext = workspaceEntity === "catalog" || workspacePage.startsWith("catalog")
  const inStudioContext = workspaceEntity === "studio_ia" || workspacePage.startsWith("studio_ia") || Boolean(input.memory?.campaignId)
  const inAgendaContext = workspaceEntity === "agenda" || workspacePage.startsWith("agenda")
  const inFinanceContext = workspaceEntity === "finance" || workspacePage.startsWith("finance")
  const inAnalyticsContext = workspaceEntity === "analytics" || workspacePage.startsWith("analytics")

  const mentionsProperty = hasAny(input.normalizedMessage, ["imovel", "imoveis", "apartamento", "casa", "terreno", "sala comercial", "anuncio"])
  const mentionsClient = hasAny(input.normalizedMessage, ["cliente", "clientes", "lead", "leads"])
  const mentionsContract = hasAny(input.normalizedMessage, ["contrato", "contratos", "compra e venda", "locacao"])
  const mentionsProposal = hasAny(input.normalizedMessage, ["proposta", "propostas"])
  const mentionsCatalog = hasAny(input.normalizedMessage, ["catalogo"])
  const mentionsCampaign = hasAny(input.normalizedMessage, ["campanha", "campanhas", "instagram"]) || hasWord(input.normalizedMessage, "post") || hasWord(input.normalizedMessage, "story") || hasWord(input.normalizedMessage, "stories")
  const mentionsVideo = hasAny(input.normalizedMessage, ["video", "reel", "reels"])
  const mentionsAgenda = hasAny(input.normalizedMessage, ["compromisso", "compromissos", "agenda", "reuniao", "visita", "lembrete", "horario"])
  const mentionsFinance = hasAny(input.normalizedMessage, ["comissao", "financeiro", "recebimento", "pagamento", "vendi"])
  const mentionsCreate = hasAny(input.normalizedMessage, ["criar", "crie", "cadastre", "cadastrar", "gerar", "gere", "novo", "nova", "registre", "registrar", "montar", "monte"])
  const mentionsAttach = hasAny(input.normalizedMessage, ["anexar", "anexe", "vincular", "vincule", "juntar", "junte"])
  const mentionsUpdate = hasAny(input.normalizedMessage, ["atualizar", "atualize", "editar", "edite", "ajustar", "ajuste", "corrigir", "corrija", "melhorar", "melhore"])
  const mentionsCancel = hasAny(input.normalizedMessage, ["cancelar", "cancele", "cancelamento"])
  const mentionsPublish = hasAny(input.normalizedMessage, ["publicar", "publique", "anunciar", "anuncie", "coloque"]) && !input.normalizedMessage.includes("despublicar")
  const mentionsPause =
    hasAny(input.normalizedMessage, ["pausar", "pause", "despublicar", "tirar do catalogo", "remover do catalogo"]) ||
    hasCatalogRemovalLanguage(input.normalizedMessage)
  const mentionsDelete = hasAny(input.normalizedMessage, ["excluir", "exclua", "remover", "remova", "apagar", "apague", "deletar"])
  const mentionsDescription = hasAny(input.normalizedMessage, ["descricao", "texto", "copy"])
  const mentionsInstagram = hasAny(input.normalizedMessage, ["instagram"]) || hasWord(input.normalizedMessage, "story") || hasWord(input.normalizedMessage, "stories") || hasWord(input.normalizedMessage, "post")
  const mentionsComplete = hasAny(input.normalizedMessage, ["concluir", "conclua", "feito", "finalizar", "finalize"])
  const mentionsSend = hasAny(input.normalizedMessage, ["enviar", "envie"])
  const mentionsSign = hasAny(input.normalizedMessage, ["assinar", "assine", "assinado"])
  const mentionsCommission = hasAny(input.normalizedMessage, ["comissao"])
  const mentionsHelp = hasAny(input.normalizedMessage, ["como", "ajuda", "me explique", "quero aprender"])
  const mentionsPending = hasAny(input.normalizedMessage, ["pendente", "pendentes", "rascunho", "rascunhos", "aberto", "abertos"])
  const shortReply = input.normalizedMessage.split(/\s+/).filter(Boolean).length <= 4
  const shouldPreferPropertyCreation = attachmentSignals.hasImage || attachmentSignals.hasAudio || mentionsCreate || workspacePage === "property_create"
  const mentionsPropertySearchVerb = hasAny(input.normalizedMessage, ["buscar", "busque", "encontre", "localize", "mostrar", "mostre", "ver", "quero ver", "procurar"])
  const mentionsSwitch = hasAny(input.normalizedMessage, ["mudar para", "trocar para", "agora", "quero criar"])
  const mentionsContractFollowup = mentionsSend || mentionsSign || mentionsCancel || input.normalizedMessage.includes("abrir contrato")
  const mentionsAgendaUpdate = hasAny(input.normalizedMessage, ["alterar horario", "alterar compromisso", "reagendar", "mudar horario"])

  const isStatisticsIntent = operationalIntent.id === "statistics"
  const isConsultIntent = operationalIntent.id === "consult"
  const isCreateIntent = operationalIntent.id === "create"
  const isEditIntent = operationalIntent.id === "edit"
  const isDeleteIntent = operationalIntent.id === "delete"
  const isShareIntent = operationalIntent.id === "share"
  const isPublishIntent = operationalIntent.id === "publish"
  const isUnpublishIntent = operationalIntent.id === "unpublish"
  const isSearchIntent = operationalIntent.id === "search"
  const isHelpIntent = operationalIntent.id === "help"
  const isAnalysisIntent = operationalIntent.id === "analysis"

  const candidates: Array<{ action: AssessorAction; score: number; reasons: string[] }> = []
  const pushCandidate = (action: AssessorAction, score: number, reasons: string[]) => {
    if (score <= 0) return
    candidates.push({ action, score, reasons })
  }

  const propertyContextScore = (inPropertyContext ? 14 : 0) + (workspaceEntity === "property" ? 8 : 0) + (activeWorkflowDomain === "property" ? 5 : 0)
  const leadContextScore = (inLeadContext ? 14 : 0) + (workspaceEntity === "lead" ? 8 : 0) + (activeWorkflowDomain === "lead" ? 5 : 0)
  const contractContextScore = (inContractContext ? 14 : 0) + (workspaceEntity === "contract" ? 8 : 0) + (activeWorkflowDomain === "contract" ? 5 : 0)
  const proposalContextScore = (inProposalContext ? 12 : 0) + (activeWorkflowDomain === "proposal" ? 5 : 0)
  const catalogContextScore = (inCatalogContext ? 12 : 0) + (activeWorkflowDomain === "catalog" ? 5 : 0)
  const studioContextScore = (inStudioContext ? 14 : 0) + (workspaceEntity === "studio_ia" ? 8 : 0) + (activeWorkflowDomain === "studio" ? 5 : 0)
  const agendaContextScore = (inAgendaContext ? 14 : 0) + (workspaceEntity === "agenda" ? 8 : 0) + (activeWorkflowDomain === "agenda" ? 5 : 0)
  const financeContextScore = (inFinanceContext ? 14 : 0) + (workspaceEntity === "finance" ? 8 : 0) + (activeWorkflowDomain === "finance" ? 5 : 0)
  const analyticsContextScore = (inAnalyticsContext ? 14 : 0) + (workspaceEntity === "analytics" ? 8 : 0) + (activeWorkflowDomain === "analytics" ? 5 : 0)

  pushCandidate(
    "createPropertyDraft",
    shouldPreferPropertyCreation && !mentionsPropertySearchVerb && !isStatisticsIntent && !isShareIntent
      ? (attachmentSignals.hasImage ? 36 : 0) +
        (attachmentSignals.hasAudio ? 30 : 0) +
        ((mentionsCreate || isCreateIntent) ? 18 : 0) +
        (mentionsProperty ? 18 : 0) +
        ((attachmentSignals.hasImage || attachmentSignals.hasAudio) && propertyContextScore > 0 ? 10 : 0) +
        propertyContextScore +
        (workspacePage === "property_create" ? 10 : 0)
      : 0,
    ["cadastro de imovel por anexo/contexto"],
  )

  pushCandidate(
    "UPDATE_PROPERTY_MEDIA",
    (attachmentSignals.hasImage ? 28 : 0) + ((mentionsUpdate || isEditIntent) ? 16 : 0) + propertyContextScore + (input.memory?.selectedProperty?.id ? 8 : 0) - (isStatisticsIntent ? 24 : 0),
    ["atualizacao de midia do imovel atual"],
  )

  pushCandidate(
    "improvePropertyDescription",
    (mentionsDescription ? 20 : 0) + ((mentionsUpdate || isEditIntent) ? 12 : 0) + (mentionsProperty ? 10 : 0) + propertyContextScore - (isStatisticsIntent ? 20 : 0),
    ["melhoria de descricao/copy do imovel"],
  )

  pushCandidate(
    "searchProperties",
    ((mentionsProperty ? 16 : 0) +
      countAny(input.normalizedMessage, ["buscar", "busque", "encontre", "localize", "mostrar", "mostre", "ver", "quero ver", "procurar"]) * 8 +
      (input.normalizedMessage.includes("disponiveis") || input.normalizedMessage.includes("publicadas") ? 8 : 0) +
      propertyContextScore) -
      (isStatisticsIntent ? 30 : 0) -
      (isShareIntent ? 26 : 0) -
      (isPublishIntent ? 24 : 0) -
      (isDeleteIntent ? 24 : 0) -
      (isEditIntent ? 18 : 0) +
      (isSearchIntent ? 12 : 0),
    ["busca de imovel"],
  )

  pushCandidate("PUBLISH_PROPERTY", ((mentionsPublish || isPublishIntent) ? 28 : 0) + (mentionsProperty ? 10 : 0) + propertyContextScore, ["publicacao de imovel"])
  pushCandidate("UNPUBLISH_PROPERTY", ((mentionsPause || isUnpublishIntent) ? 28 : 0) + propertyContextScore, ["pausa de imovel"])
  pushCandidate("ARCHIVE_PROPERTY", ((mentionsDelete || isDeleteIntent) ? 28 : 0) + propertyContextScore, ["exclusao de imovel"])
  // Mesma classe de bug do CONTRACT_HISTORY: o bônus de intent estatistica/analise só pode contar
  // quando a mensagem realmente fala de imóvel (por palavra-chave ou contexto de tela).
  const hasPropertyAnalyticsSignal = mentionsProperty || propertyContextScore > 0 || analyticsContextScore > 0
  pushCandidate(
    "GET_ANALYTICS_PROPERTIES",
    hasPropertyAnalyticsSignal
      ? ((isStatisticsIntent || isAnalysisIntent) ? 30 : 0) +
        (mentionsProperty ? 22 : 0) +
        (mentionsPending ? 8 : 0) +
        propertyContextScore +
        analyticsContextScore -
        (mentionsContract ? 28 : 0) -
        (mentionsProposal ? 28 : 0) -
        (mentionsClient ? 18 : 0)
      : 0,
    ["consulta estatistica de imoveis"],
  )
  pushCandidate(
    "PUBLISH_CATALOG",
    (isShareIntent ? 26 : 0) + (mentionsProperty ? 18 : 0) + propertyContextScore - (input.memory?.selectedProperty?.id ? 12 : 0) - ((mentionsPause || isUnpublishIntent) ? 32 : 0),
    ["compartilhamento de imovel via catalogo"],
  )
  pushCandidate(
    "SHARE_CATALOG",
    (isShareIntent ? 28 : 0) + (mentionsCatalog ? 18 : 0) + catalogContextScore + (input.memory?.selectedProperty?.id ? 14 : 0) + (mentionsProperty ? 8 : 0) - ((mentionsPause || isUnpublishIntent) ? 32 : 0),
    ["compartilhamento do catalogo"],
  )

  pushCandidate(
    "createLead",
    (mentionsClient ? 18 : 0) + ((mentionsCreate || isCreateIntent) ? 18 : 0) + leadContextScore - (mentionsProperty ? 12 : 0) - (mentionsContract ? 10 : 0),
    ["cadastro de cliente"],
  )
  pushCandidate(
    "FIND_LEAD",
    (mentionsClient ? 16 : 0) + countAny(input.normalizedMessage, ["buscar", "busque", "encontre", "localize", "mostrar", "mostre", "ver"]) * 8 + leadContextScore - (isStatisticsIntent ? 26 : 0) + (isSearchIntent ? 10 : 0),
    ["busca de cliente"],
  )
  pushCandidate("UPDATE_LEAD", (mentionsClient ? 16 : 0) + ((mentionsUpdate || isEditIntent) ? 16 : 0) + leadContextScore - (isStatisticsIntent ? 20 : 0), ["atualizacao de cliente"])
  pushCandidate("DELETE_LEAD", (mentionsClient ? 16 : 0) + ((mentionsDelete || isDeleteIntent) ? 18 : 0) + leadContextScore, ["exclusao de cliente"])
  pushCandidate(
    "ATTACH_LEAD_DOCUMENT",
    (attachmentSignals.hasDocument ? 30 : 0) + (mentionsAttach ? 18 : 0) + (mentionsClient ? 16 : 0) + leadContextScore - (mentionsContract ? 12 : 0),
    ["anexo de documento ao cliente"],
  )
  // Mesma classe de bug do CONTRACT_HISTORY: exige sinal real de cliente antes do bônus de intent.
  const hasClientAnalyticsSignal = mentionsClient || leadContextScore > 0
  pushCandidate(
    "getLeadsSummary",
    hasClientAnalyticsSignal
      ? ((isStatisticsIntent || isAnalysisIntent) ? 30 : 0) + (mentionsClient ? 22 : 0) + (mentionsPending ? 6 : 0) + leadContextScore - (mentionsContract ? 16 : 0) - (mentionsProposal ? 16 : 0)
      : 0,
    ["consulta estatistica de clientes"],
  )

  pushCandidate(
    "CREATE_PROPOSAL",
    (mentionsProposal ? 24 : 0) + ((mentionsCreate || isCreateIntent) ? 16 : 0) + (input.memory?.selectedProperty?.id ? 10 : 0) + (input.memory?.selectedClient?.id ? 10 : 0) + (inPropertyContext || inLeadContext ? 10 : 0) - (isStatisticsIntent ? 28 : 0),
    ["criacao de proposta"],
  )
  // Mesma classe de bug do CONTRACT_HISTORY: exige sinal real de proposta antes do bônus de intent.
  const hasProposalSignal = mentionsProposal || proposalContextScore > 0
  pushCandidate(
    "LIST_DOCUMENTS",
    hasProposalSignal
      ? ((isStatisticsIntent || isConsultIntent || isAnalysisIntent) ? 30 : 0) + (mentionsProposal ? 32 : 0) + (mentionsPending ? 8 : 0) + proposalContextScore - (mentionsCampaign ? 20 : 0)
      : 0,
    ["consulta estatistica de propostas"],
  )

  pushCandidate(
    "CREATE_CONTRACT",
    (mentionsContract ? 24 : 0) +
      ((mentionsCreate || isCreateIntent) ? 16 : 0) +
      (input.memory?.selectedProperty?.id ? 10 : 0) +
      (input.memory?.selectedClient?.id ? 10 : 0) +
      (mentionsSwitch && mentionsContract ? 18 : 0) +
      contractContextScore -
      (isStatisticsIntent ? 26 : 0) -
      (mentionsContractFollowup ? 18 : 0),
    ["criacao de contrato"],
  )
  pushCandidate("SEND_CONTRACT", (mentionsContract ? 18 : 0) + (mentionsSend ? 24 : 0) + contractContextScore + ((input.memory?.selectedProperty?.id || input.memory?.selectedClient?.id) ? 8 : 0), ["envio de contrato"])
  pushCandidate("SIGN_CONTRACT", (mentionsContract ? 18 : 0) + (mentionsSign ? 24 : 0) + contractContextScore + ((input.memory?.selectedProperty?.id || input.memory?.selectedClient?.id) ? 8 : 0), ["assinatura de contrato"])
  pushCandidate("CANCEL_CONTRACT", (mentionsContract ? 18 : 0) + ((mentionsDelete || isDeleteIntent) ? 12 : 0) + (mentionsCancel ? 24 : 0) + contractContextScore + ((input.memory?.selectedProperty?.id || input.memory?.selectedClient?.id) ? 8 : 0), ["cancelamento de contrato"])
  pushCandidate("GET_CONTRACT", (mentionsContract ? 18 : 0) + countAny(input.normalizedMessage, ["abrir", "ver", "mostrar", "mostre"]) * 18 + contractContextScore + ((input.memory?.selectedProperty?.id || input.memory?.selectedClient?.id) ? 14 : 0) - (isStatisticsIntent ? 22 : 0), ["consulta de contrato"])
  // CONTRACT_HISTORY só deve pontuar quando a mensagem tem sinal real de contrato (palavra-chave
  // ou contexto de tela/workflow em contrato) — o bônus de "parece pergunta estatistica/consulta"
  // não pode, sozinho, colocar este candidato em jogo, senão qualquer pergunta analítica genérica
  // (sobre imóveis, clientes, ou até uma saudação) pode vencer por essa pontuação-base incondicional.
  const hasContractSignal = mentionsContract || contractContextScore > 0
  pushCandidate(
    "CONTRACT_HISTORY",
    hasContractSignal
      ? ((isStatisticsIntent || isConsultIntent || isAnalysisIntent) ? 32 : 0) + (mentionsContract ? 30 : 0) + (mentionsPending ? 8 : 0) + contractContextScore
      : 0,
    ["consulta estatistica de contratos"],
  )
  // Mesma classe de bug do CONTRACT_HISTORY: "quais"/"mostre" sozinhos (sem falar de contrato) não
  // podem pontuar aqui — "quais" é comum demais em português para servir de sinal isolado.
  pushCandidate(
    "LIST_CONTRACTS",
    mentionsContract
      ? (isConsultIntent ? 20 : 0) + 22 + countAny(input.normalizedMessage, ["listar", "lista", "mostrar", "mostre", "quais"]) * 8
      : 0,
    ["listagem de contratos"],
  )

  pushCandidate(
    mentionsInstagram && !input.normalizedMessage.includes("campanha") ? "STUDIO_GENERATE_INSTAGRAM" : "STUDIO_GENERATE_CAMPAIGN",
    (mentionsCampaign ? 22 : 0) + ((mentionsCreate || isCreateIntent) ? 14 : 0) + (input.memory?.selectedProperty?.id ? 10 : 0) + studioContextScore + propertyContextScore,
    [mentionsInstagram && !input.normalizedMessage.includes("campanha") ? "campanha de instagram" : "campanha de studio"],
  )
  pushCandidate("STUDIO_GENERATE_VIDEO", (mentionsVideo ? 32 : 0) + ((mentionsCreate || isCreateIntent) ? 12 : 0) + studioContextScore + propertyContextScore + (attachmentSignals.hasVideo ? 8 : 0) + (mentionsInstagram && mentionsVideo ? 8 : 0), ["geracao de video"])
  pushCandidate("STUDIO_IMPROVE_TEXT", (mentionsDescription ? 12 : 0) + ((mentionsUpdate || isEditIntent) ? 10 : 0) + studioContextScore + (mentionsCampaign ? 8 : 0), ["melhoria de texto/copy"])

  pushCandidate("CREATE_AGENDA_EVENT", (mentionsAgenda ? 20 : 0) + ((mentionsCreate || isCreateIntent) ? 16 : 0) + agendaContextScore + countAny(input.normalizedMessage, ["amanha", "hoje", "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo", "as"]) * 4, ["criacao de compromisso"])
  pushCandidate("MARK_AGENDA_DONE", (mentionsAgenda ? 18 : 0) + (mentionsComplete ? 18 : 0) + agendaContextScore, ["conclusao de compromisso"])
  pushCandidate("UPDATE_AGENDA_EVENT", (mentionsAgenda ? 18 : 0) + ((mentionsUpdate || isEditIntent || mentionsAgendaUpdate) ? 16 : 0) + (input.normalizedMessage.includes("reagendar") ? 18 : 0) + agendaContextScore, ["atualizacao de compromisso"])

  // Mesma classe de bug do CONTRACT_HISTORY: o bônus de "parece pergunta estatistica" só conta
  // combinado com um sinal real de financeiro/comissão.
  pushCandidate(
    "GET_FINANCE_COMMISSION",
    (mentionsFinance || mentionsCommission || financeContextScore > 0
      ? (mentionsFinance ? 18 : 0) + (mentionsCommission ? 24 : 0) + financeContextScore + (mentionsProperty && mentionsCommission ? 10 : 0) + (isStatisticsIntent ? 10 : 0)
      : 0),
    ["consulta de comissao"],
  )
  pushCandidate("help_use_cos" as AssessorAction, isHelpIntent && input.normalizedMessage.includes("cos") ? 42 : 0, ["ajuda sobre uso do cos"])
  pushCandidate("help_register_properties" as AssessorAction, isHelpIntent && mentionsProperty ? 42 : 0, ["ajuda sobre cadastro de imoveis"])
  pushCandidate("help_manage_clients" as AssessorAction, isHelpIntent && mentionsClient ? 42 : 0, ["ajuda sobre gestao de clientes"])
  pushCandidate("help_contracts_proposals" as AssessorAction, ((isHelpIntent && (mentionsContract || mentionsProposal)) || ((mentionsContract && mentionsProposal) && !mentionsCreate && !mentionsSend && !mentionsSign)) ? 42 : 0, ["ajuda sobre contratos e propostas"])

  const unique = new Map<AssessorAction, { action: AssessorAction; score: number; reasons: string[] }>()
  for (const candidate of candidates) {
    const current = unique.get(candidate.action)
    if (!current || candidate.score > current.score) {
      unique.set(candidate.action, candidate)
    }
  }

  const ranked = Array.from(unique.values())
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)

  const top = ranked[0]
  const runnerUp = ranked[1]

  const normalizedCandidates: CosIntentCandidate[] = ranked.slice(0, 4).map((candidate) => {
    const margin = candidate.score - (runnerUp?.score ?? 0)
    const confidence = Math.max(
      0.35,
      Math.min(
        0.98,
        Number((0.34 + candidate.score / 100 + (margin > 8 ? 0.14 : margin > 4 ? 0.08 : 0)).toFixed(2)),
      ),
    )
    return {
      action: candidate.action,
      score: candidate.score,
      confidence,
      reason: candidate.reasons.join("; "),
    }
  })

  const continueScore = !input.activeWorkflow
    ? 0
    : mentionsSwitch
      ? 0.18
      : isAffirmativeMessage(input.normalizedMessage) || isCancellationMessage(input.normalizedMessage)
        ? 0.99
        : input.activeWorkflow.pendingInput?.type === "selection" &&
            (/^\d+$/.test(input.normalizedMessage) ||
              getPendingSelectionLabels(input.activeWorkflow).some((label) => label.includes(input.normalizedMessage) || input.normalizedMessage.includes(label)))
          ? 0.96
          : (input.activeWorkflow.pendingInput?.field === "attachments" ||
              input.activeWorkflow.pendingInput?.field === "document" ||
              input.activeWorkflow.pendingInput?.field === "imageUrls") &&
              input.attachments.length > 0
            ? 0.94
            : shortReply
              ? 0.7
              : 0.42

  return {
    candidates: normalizedCandidates,
    continueScore,
    activeWorkflowAction,
    attachmentSignals,
    operationalIntent,
  }
}

export function resolveCosIntent(input: {
  message: string
  requestedAction?: string | null
  attachments: CosIntentAttachment[]
  workspace: CosWorkspaceContext | null
  activeWorkflow: CosWorkflow | null
  memory: CosConversationMemory | null
  context?: CosNormalizedContext | null
}): CosIntentResolution {
  const context = input.context ?? null
  const message = context?.message ?? input.message
  const attachments = context?.attachments ?? input.attachments
  const workspace = context?.workspace ?? input.workspace
  const activeWorkflow = context?.workflow ?? input.activeWorkflow
  const memory = context?.memory ?? input.memory
  const normalizedMessage = normalizeText(message)
  const indicatesWorkflowSwitch = hasAny(normalizedMessage, ["mudar para", "trocar para", "agora", "quero criar"])
  const securityAudit = evaluateCosDecisionSecurity({
    message,
    attachments: attachments.map((attachment) => ({
      name: attachment.name,
      textContent: attachment.textContent,
    })),
  })

  if (!input.requestedAction && securityAudit.flagged) {
    return {
      requestedAction: null,
      workflowDecision: activeWorkflow ? "continue_workflow" : "none",
      confidence: Math.max(0.05, activeWorkflow ? 0.28 : 0.12),
      reason: `security_guard:${securityAudit.reasons.join(",")}`,
      needsConfirmation: false,
      candidates: [],
      signals: {
        operationalIntent: null,
        workspacePage: workspace?.page ?? null,
        workspaceEntity: workspace?.entity ?? null,
        activeWorkflowAction: getActiveWorkflowAction(activeWorkflow),
        attachments: getAttachmentSignals(attachments).labels,
      },
    }
  }

  if (input.requestedAction && input.requestedAction !== "workflow_details") {
    const explicitAction = input.requestedAction as AssessorAction
    const activeWorkflowAction = getActiveWorkflowAction(activeWorkflow)
    return {
      requestedAction: explicitAction,
      workflowDecision: activeWorkflowAction === explicitAction ? "continue_workflow" : "start_new",
      confidence: 1,
      reason: "requestedAction recebida explicitamente pela interface",
      needsConfirmation: false,
      candidates: [{ action: explicitAction, confidence: 1, reason: "acao explicita da interface" }],
      signals: {
        operationalIntent: null,
        workspacePage: workspace?.page ?? null,
        workspaceEntity: workspace?.entity ?? null,
        activeWorkflowAction,
        attachments: getAttachmentSignals(attachments).labels,
      },
    }
  }

  const decision = buildIntentCandidates({
    normalizedMessage,
    workspace,
    memory,
    attachments,
    activeWorkflow,
  })
  const topCandidate = decision.candidates[0] ?? null
  const activeWorkflowAction = decision.activeWorkflowAction

  if (activeWorkflow && topCandidate && activeWorkflowAction && topCandidate.action !== activeWorkflowAction) {
    const sameDomain = getActionDomain(topCandidate.action) === getActionDomain(activeWorkflowAction)
    if (!indicatesWorkflowSwitch && sameDomain && decision.continueScore >= 0.62 && topCandidate.confidence < 0.86) {
      return {
        requestedAction: activeWorkflowAction,
        workflowDecision: "continue_workflow",
        confidence: decision.continueScore,
        reason: "mensagem permanece aderente ao workflow ativo",
        needsConfirmation: false,
        candidates: decision.candidates.map((candidate) => ({
          action: candidate.action,
          confidence: candidate.confidence,
          reason: candidate.reason,
        })),
        signals: {
          operationalIntent: decision.operationalIntent.id,
          workspacePage: workspace?.page ?? null,
          workspaceEntity: workspace?.entity ?? null,
          activeWorkflowAction,
          attachments: decision.attachmentSignals.labels,
        },
      }
    }

    if (topCandidate.confidence >= Math.max(indicatesWorkflowSwitch ? 0.72 : 0.78, decision.continueScore + 0.12)) {
      return {
        requestedAction: topCandidate.action,
        workflowDecision: "start_new",
        confidence: topCandidate.confidence,
        reason: `${topCandidate.reason}; nova intencao mais forte que a continuidade`,
        needsConfirmation: topCandidate.confidence < 0.76,
        candidates: decision.candidates.map((candidate) => ({
          action: candidate.action,
          confidence: candidate.confidence,
          reason: candidate.reason,
        })),
        signals: {
          operationalIntent: decision.operationalIntent.id,
          workspacePage: workspace?.page ?? null,
          workspaceEntity: workspace?.entity ?? null,
          activeWorkflowAction,
          attachments: decision.attachmentSignals.labels,
        },
      }
    }
  }

  if (activeWorkflow && decision.continueScore >= 0.68) {
    return {
      requestedAction: activeWorkflowAction,
      workflowDecision: "continue_workflow",
      confidence: decision.continueScore,
      reason: "mensagem parece responder ao workflow ativo",
      needsConfirmation: false,
      candidates: decision.candidates.map((candidate) => ({
        action: candidate.action,
        confidence: candidate.confidence,
        reason: candidate.reason,
      })),
      signals: {
        operationalIntent: decision.operationalIntent.id,
        workspacePage: workspace?.page ?? null,
        workspaceEntity: workspace?.entity ?? null,
        activeWorkflowAction,
        attachments: decision.attachmentSignals.labels,
      },
    }
  }

  if (topCandidate) {
    const guardedConfidence = Math.max(0.1, topCandidate.confidence - securityAudit.scorePenalty)
    return {
      requestedAction: topCandidate.action,
      workflowDecision: "start_new",
      confidence: guardedConfidence,
      reason: securityAudit.flagged ? `${topCandidate.reason}; security_guard` : topCandidate.reason,
      needsConfirmation: guardedConfidence < 0.76,
      candidates: decision.candidates.map((candidate) => ({
        action: candidate.action,
        confidence: Math.max(0.1, candidate.confidence - securityAudit.scorePenalty),
        reason: securityAudit.flagged ? `${candidate.reason}; security_guard` : candidate.reason,
      })),
      signals: {
        operationalIntent: decision.operationalIntent.id,
        workspacePage: workspace?.page ?? null,
        workspaceEntity: workspace?.entity ?? null,
        activeWorkflowAction,
        attachments: decision.attachmentSignals.labels,
      },
    }
  }

  return {
    requestedAction: activeWorkflow ? activeWorkflowAction : null,
    workflowDecision: activeWorkflow ? "continue_workflow" : "none",
    confidence: activeWorkflow ? decision.continueScore : 0,
    reason: activeWorkflow ? "sem sinal forte para trocar o workflow ativo" : "sem intencao forte identificada",
    needsConfirmation: false,
    candidates: [],
    signals: {
      operationalIntent: decision.operationalIntent.id,
      workspacePage: workspace?.page ?? null,
      workspaceEntity: workspace?.entity ?? null,
      activeWorkflowAction,
      attachments: decision.attachmentSignals.labels,
    },
  }
}
