import type { AssessorAction } from "@/lib/eme-backend"

import { evaluateCosDecisionSecurity } from "@/lib/cos/decision-security"
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

function getActiveWorkflowAction(workflow: CosWorkflow | null | undefined) {
  if (!workflow) return null
  return workflow.pendingInput?.action ?? workflow.steps[workflow.currentStep]?.action ?? workflow.steps[0]?.action ?? null
}

function getActionDomain(action: AssessorAction | null | undefined) {
  if (!action) return "general"
  if (action.startsWith("STUDIO_")) return "studio"
  if (action.startsWith("CREATE_CONTRACT") || action.startsWith("SEND_CONTRACT") || action.startsWith("SIGN_CONTRACT") || action.startsWith("CANCEL_CONTRACT") || action.startsWith("DOWNLOAD_CONTRACT")) return "contract"
  if (action.startsWith("CREATE_PROPOSAL")) return "proposal"
  if (action.includes("PROPERTY") || action === "createPropertyDraft" || action === "improvePropertyDescription") return "property"
  if (action.includes("LEAD") || action === "createLead") return "lead"
  if (action.includes("AGENDA")) return "agenda"
  if (action.includes("FINANCE") || action === "GET_FINANCE_COMMISSION") return "finance"
  return "general"
}

function getPendingSelectionLabels(workflow: CosWorkflow | null | undefined) {
  if (!workflow?.pendingInput || workflow.pendingInput.type !== "selection") return []
  const rawOptions = workflow.pendingInput.parsedData?.options
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
  return /^(nao|não|n|cancelar|cancela|parar|pare)$/.test(normalizedMessage)
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
  const inStudioContext = workspaceEntity === "studio_ia" || workspacePage.startsWith("studio_ia") || Boolean(input.memory?.campaignId)
  const inAgendaContext = workspaceEntity === "agenda" || workspacePage.startsWith("agenda")
  const inFinanceContext = workspaceEntity === "finance" || workspacePage.startsWith("finance")

  const mentionsProperty = hasAny(input.normalizedMessage, ["imovel", "imoveis", "apartamento", "casa", "terreno", "sala comercial", "anuncio"])
  const mentionsClient = hasAny(input.normalizedMessage, ["cliente", "clientes", "lead", "leads"])
  const mentionsContract = hasAny(input.normalizedMessage, ["contrato", "contratos", "compra e venda", "locacao", "locação"])
  const mentionsProposal = hasAny(input.normalizedMessage, ["proposta", "propostas"])
  const mentionsCampaign = hasAny(input.normalizedMessage, ["campanha", "campanhas", "post", "story", "stories", "instagram"])
  const mentionsVideo = hasAny(input.normalizedMessage, ["video", "vídeo", "reel", "reels"])
  const mentionsAgenda = hasAny(input.normalizedMessage, ["compromisso", "compromissos", "agenda", "reuniao", "reunião", "visita", "lembrete"])
  const mentionsFinance = hasAny(input.normalizedMessage, ["comissao", "comissão", "financeiro", "recebimento", "pagamento"])
  const mentionsCreate = hasAny(input.normalizedMessage, ["criar", "crie", "cadastre", "cadastrar", "gerar", "gere", "novo", "nova", "registre"])
  const mentionsAttach = hasAny(input.normalizedMessage, ["anexar", "anexe", "vincular", "vincule", "juntar", "junte"])
  const mentionsUpdate = hasAny(input.normalizedMessage, ["atualizar", "atualize", "editar", "edite", "ajustar", "ajuste", "corrigir", "corrija", "melhorar", "melhore"])
  const mentionsCancel = hasAny(input.normalizedMessage, ["cancelar", "cancele", "cancelamento"])
  const mentionsPublish = hasAny(input.normalizedMessage, ["publicar", "publique"]) && !input.normalizedMessage.includes("despublicar")
  const mentionsPause =
    hasAny(input.normalizedMessage, ["pausar", "pause", "despublicar"]) ||
    (input.normalizedMessage.includes("catalogo") && hasAny(input.normalizedMessage, ["tirar", "remover"]))
  const mentionsDelete = hasAny(input.normalizedMessage, ["excluir", "exclua", "remover", "remova", "apagar", "apague"])
  const mentionsDescription = hasAny(input.normalizedMessage, ["descricao", "descrição", "texto", "copy"])
  const mentionsInstagram = hasAny(input.normalizedMessage, ["instagram", "story", "stories", "post"])
  const mentionsComplete = hasAny(input.normalizedMessage, ["concluir", "conclua", "feito", "finalizar", "finalize"])
  const mentionsSend = hasAny(input.normalizedMessage, ["enviar", "envie"])
  const mentionsSign = hasAny(input.normalizedMessage, ["assinar", "assine", "assinado"])
  const mentionsCommission = hasAny(input.normalizedMessage, ["comissao", "comissão"])
  const mentionsHelp = hasAny(input.normalizedMessage, ["como", "ajuda", "me explique", "quero aprender"])
  const shortReply = input.normalizedMessage.split(/\s+/).filter(Boolean).length <= 4
  const shouldPreferPropertyCreation = attachmentSignals.hasImage || attachmentSignals.hasAudio || mentionsCreate || workspacePage === "property_create"

  const candidates: Array<{ action: AssessorAction; score: number; reasons: string[] }> = []
  const pushCandidate = (action: AssessorAction, score: number, reasons: string[]) => {
    if (score <= 0) return
    candidates.push({ action, score, reasons })
  }

  const propertyContextScore = (inPropertyContext ? 14 : 0) + (workspaceEntity === "property" ? 8 : 0) + (activeWorkflowDomain === "property" ? 5 : 0)
  const leadContextScore = (inLeadContext ? 14 : 0) + (workspaceEntity === "lead" ? 8 : 0) + (activeWorkflowDomain === "lead" ? 5 : 0)
  const contractContextScore = (inContractContext ? 14 : 0) + (workspaceEntity === "contract" ? 8 : 0) + (activeWorkflowDomain === "contract" ? 5 : 0)
  const studioContextScore = (inStudioContext ? 14 : 0) + (workspaceEntity === "studio_ia" ? 8 : 0) + (activeWorkflowDomain === "studio" ? 5 : 0)
  const agendaContextScore = (inAgendaContext ? 14 : 0) + (workspaceEntity === "agenda" ? 8 : 0) + (activeWorkflowDomain === "agenda" ? 5 : 0)
  const financeContextScore = (inFinanceContext ? 14 : 0) + (workspaceEntity === "finance" ? 8 : 0) + (activeWorkflowDomain === "finance" ? 5 : 0)

  pushCandidate(
    "createPropertyDraft",
    shouldPreferPropertyCreation
      ? (attachmentSignals.hasImage ? 36 : 0) +
        (attachmentSignals.hasAudio ? 30 : 0) +
        (mentionsCreate ? 18 : 0) +
        (mentionsProperty ? 18 : 0) +
        ((attachmentSignals.hasImage || attachmentSignals.hasAudio) && propertyContextScore > 0 ? 10 : 0) +
        propertyContextScore +
        (workspacePage === "property_create" ? 10 : 0)
      : 0,
    ["cadastro de imovel por anexo/contexto"],
  )

  pushCandidate(
    "UPDATE_PROPERTY_MEDIA",
    (attachmentSignals.hasImage ? 28 : 0) + (mentionsUpdate ? 16 : 0) + propertyContextScore + (input.memory?.selectedProperty?.id ? 8 : 0),
    ["atualizacao de midia do imovel atual"],
  )

  pushCandidate(
    "improvePropertyDescription",
    (mentionsDescription ? 20 : 0) + (mentionsUpdate ? 12 : 0) + (mentionsProperty ? 10 : 0) + propertyContextScore,
    ["melhoria de descricao/copy do imovel"],
  )

  pushCandidate(
    "searchProperties",
    (mentionsProperty ? 16 : 0) + countAny(input.normalizedMessage, ["buscar", "busque", "encontre", "localize", "mostrar", "mostre", "ver"]) * 8 + propertyContextScore,
    ["busca de imovel"],
  )

  pushCandidate("PUBLISH_PROPERTY", (mentionsPublish ? 28 : 0) + propertyContextScore, ["publicacao de imovel"])
  pushCandidate("UNPUBLISH_PROPERTY", (mentionsPause ? 28 : 0) + propertyContextScore, ["pausa de imovel"])
  pushCandidate("ARCHIVE_PROPERTY", (mentionsDelete ? 28 : 0) + propertyContextScore, ["exclusao de imovel"])

  pushCandidate(
    "createLead",
    (mentionsClient ? 18 : 0) + (mentionsCreate ? 18 : 0) + leadContextScore - (mentionsProperty ? 12 : 0) - (mentionsContract ? 10 : 0),
    ["cadastro de cliente"],
  )
  pushCandidate(
    "FIND_LEAD",
    (mentionsClient ? 16 : 0) + countAny(input.normalizedMessage, ["buscar", "busque", "encontre", "localize", "mostrar", "mostre", "ver"]) * 8 + leadContextScore,
    ["busca de cliente"],
  )
  pushCandidate("UPDATE_LEAD", (mentionsClient ? 16 : 0) + (mentionsUpdate ? 16 : 0) + leadContextScore, ["atualizacao de cliente"])
  pushCandidate("DELETE_LEAD", (mentionsClient ? 16 : 0) + (mentionsDelete ? 18 : 0) + leadContextScore, ["exclusao de cliente"])
  pushCandidate(
    "ATTACH_LEAD_DOCUMENT",
    (attachmentSignals.hasDocument ? 30 : 0) + (mentionsAttach ? 18 : 0) + (mentionsClient ? 16 : 0) + leadContextScore - (mentionsContract ? 12 : 0),
    ["anexo de documento ao cliente"],
  )

  pushCandidate(
    "CREATE_PROPOSAL",
    (mentionsProposal ? 24 : 0) + (mentionsCreate ? 16 : 0) + (input.memory?.selectedProperty?.id ? 10 : 0) + (input.memory?.selectedClient?.id ? 10 : 0) + (inPropertyContext || inLeadContext ? 10 : 0),
    ["criacao de proposta"],
  )

  pushCandidate(
    "CREATE_CONTRACT",
    (mentionsContract ? 24 : 0) + (mentionsCreate ? 16 : 0) + (input.memory?.selectedProperty?.id ? 10 : 0) + (input.memory?.selectedClient?.id ? 10 : 0) + contractContextScore,
    ["criacao de contrato"],
  )
  pushCandidate("SEND_CONTRACT", (mentionsContract ? 18 : 0) + (mentionsSend ? 18 : 0) + contractContextScore, ["envio de contrato"])
  pushCandidate("SIGN_CONTRACT", (mentionsContract ? 18 : 0) + (mentionsSign ? 18 : 0) + contractContextScore, ["assinatura de contrato"])
  pushCandidate("CANCEL_CONTRACT", (mentionsContract ? 18 : 0) + (mentionsDelete ? 12 : 0) + (mentionsCancel ? 18 : 0) + contractContextScore, ["cancelamento de contrato"])
  pushCandidate("GET_CONTRACT", (mentionsContract ? 18 : 0) + countAny(input.normalizedMessage, ["abrir", "ver", "mostrar", "mostre"]) * 10 + contractContextScore, ["consulta de contrato"])

  pushCandidate(
    mentionsInstagram ? "STUDIO_GENERATE_INSTAGRAM" : "STUDIO_GENERATE_CAMPAIGN",
    (mentionsCampaign ? 22 : 0) + (mentionsCreate ? 14 : 0) + (input.memory?.selectedProperty?.id ? 10 : 0) + studioContextScore + propertyContextScore,
    [mentionsInstagram ? "campanha de instagram" : "campanha de studio"],
  )
  pushCandidate("STUDIO_GENERATE_VIDEO", (mentionsVideo ? 26 : 0) + (mentionsCreate ? 12 : 0) + studioContextScore + propertyContextScore + (attachmentSignals.hasVideo ? 8 : 0), ["geracao de video"])
  pushCandidate("STUDIO_IMPROVE_TEXT", (mentionsDescription ? 12 : 0) + (mentionsUpdate ? 10 : 0) + studioContextScore + (mentionsCampaign ? 8 : 0), ["melhoria de texto/copy"])

  pushCandidate("CREATE_AGENDA_EVENT", (mentionsAgenda ? 20 : 0) + (mentionsCreate ? 16 : 0) + agendaContextScore + countAny(input.normalizedMessage, ["amanha", "hoje", "segunda", "terca", "terça", "quarta", "quinta", "sexta", "sabado", "sábado", "domingo", "as", "às"]) * 4, ["criacao de compromisso"])
  pushCandidate("MARK_AGENDA_DONE", (mentionsAgenda ? 18 : 0) + (mentionsComplete ? 18 : 0) + agendaContextScore, ["conclusao de compromisso"])
  pushCandidate("UPDATE_AGENDA_EVENT", (mentionsAgenda ? 18 : 0) + (mentionsUpdate ? 16 : 0) + (input.normalizedMessage.includes("reagendar") ? 18 : 0) + agendaContextScore, ["atualizacao de compromisso"])

  pushCandidate("GET_FINANCE_COMMISSION", (mentionsFinance ? 18 : 0) + (mentionsCommission ? 18 : 0) + financeContextScore, ["consulta de comissao"])
  pushCandidate("help_use_cos" as AssessorAction, mentionsHelp && input.normalizedMessage.includes("cos") ? 42 : 0, ["ajuda sobre uso do cos"])
  pushCandidate("help_register_properties" as AssessorAction, mentionsHelp && mentionsProperty ? 42 : 0, ["ajuda sobre cadastro de imoveis"])
  pushCandidate("help_manage_clients" as AssessorAction, mentionsHelp && mentionsClient ? 42 : 0, ["ajuda sobre gestao de clientes"])
  pushCandidate("help_contracts_proposals" as AssessorAction, mentionsHelp && (mentionsContract || mentionsProposal) ? 42 : 0, ["ajuda sobre contratos e propostas"])

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
    : isAffirmativeMessage(input.normalizedMessage) || isCancellationMessage(input.normalizedMessage)
      ? 0.99
      : input.activeWorkflow.pendingInput?.type === "selection" && (/^\d+$/.test(input.normalizedMessage) || getPendingSelectionLabels(input.activeWorkflow).some((label) => label.includes(input.normalizedMessage) || input.normalizedMessage.includes(label)))
        ? 0.96
        : (input.activeWorkflow.pendingInput?.field === "attachments" || input.activeWorkflow.pendingInput?.field === "document" || input.activeWorkflow.pendingInput?.field === "imageUrls") && input.attachments.length > 0
          ? 0.94
          : shortReply
            ? 0.7
            : 0.42

  return {
    candidates: normalizedCandidates,
    continueScore,
    activeWorkflowAction,
    attachmentSignals,
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
    if (sameDomain && decision.continueScore >= 0.62 && topCandidate.confidence < 0.86) {
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
          workspacePage: workspace?.page ?? null,
          workspaceEntity: workspace?.entity ?? null,
          activeWorkflowAction,
          attachments: decision.attachmentSignals.labels,
        },
      }
    }

    if (topCandidate.confidence >= Math.max(0.78, decision.continueScore + 0.12)) {
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
      workspacePage: workspace?.page ?? null,
      workspaceEntity: workspace?.entity ?? null,
      activeWorkflowAction,
      attachments: decision.attachmentSignals.labels,
    },
  }
}
