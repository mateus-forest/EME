import type { AssessorAction } from "@/lib/eme-backend"

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

export type CosIntentResolution = {
  requestedAction: AssessorAction | null
  workflowDecision: "continue_workflow" | "start_new" | "none"
  confidence: number
  reason: string
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

function getActiveWorkflowAction(workflow: CosWorkflow | null | undefined) {
  if (!workflow) return null
  return workflow.pendingInput?.action ?? workflow.steps[workflow.currentStep]?.action ?? workflow.steps[0]?.action ?? null
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
  return /^(sim|s|ok|pode|confirmar|confirma|seguir|prosseguir)$/.test(normalizedMessage)
}

function isCancellationMessage(normalizedMessage: string) {
  return /^(nao|não|n|cancelar|cancela|parar|pare)$/.test(normalizedMessage)
}

function shouldContinueActiveWorkflow(input: {
  normalizedMessage: string
  workflow: CosWorkflow | null
  attachments: CosIntentAttachment[]
}) {
  const workflow = input.workflow
  if (!workflow) return false

  if (isAffirmativeMessage(input.normalizedMessage) || isCancellationMessage(input.normalizedMessage)) {
    return true
  }

  if (workflow.pendingInput?.type === "selection") {
    if (/^\d+$/.test(input.normalizedMessage)) return true
    const labels = getPendingSelectionLabels(workflow)
    if (labels.some((label) => label.includes(input.normalizedMessage) || input.normalizedMessage.includes(label))) {
      return true
    }
  }

  if (workflow.pendingInput?.field === "attachments" || workflow.pendingInput?.field === "document" || workflow.pendingInput?.field === "imageUrls") {
    if (input.attachments.length > 0) return true
  }

  if (input.normalizedMessage.split(/\s+/).filter(Boolean).length <= 3) {
    return true
  }

  return false
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

function resolveRequestedAction(input: {
  normalizedMessage: string
  workspace: CosWorkspaceContext | null
  memory: CosConversationMemory | null
  attachments: CosIntentAttachment[]
}) {
  const workspacePage = input.workspace?.page ?? ""
  const workspaceEntity = input.workspace?.entity ?? null
  const attachmentSignals = getAttachmentSignals(input.attachments)

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
  const inStudioContext =
    workspaceEntity === "studio_ia" ||
    workspacePage.startsWith("studio_ia") ||
    Boolean(input.memory?.campaignId)

  const mentionsProperty = hasAny(input.normalizedMessage, ["imovel", "imoveis", "apartamento", "casa", "terreno", "sala comercial", "anuncio"])
  const mentionsClient = hasAny(input.normalizedMessage, ["cliente", "clientes", "lead", "leads"])
  const mentionsContract = hasAny(input.normalizedMessage, ["contrato", "contratos", "compra e venda", "locacao", "locacao"])
  const mentionsProposal = hasAny(input.normalizedMessage, ["proposta", "propostas"])
  const mentionsCampaign = hasAny(input.normalizedMessage, ["campanha", "anuncio", "post", "story", "instagram"])
  const mentionsVideo = hasAny(input.normalizedMessage, ["video", "reel", "reels"])
  const mentionsCreate = hasAny(input.normalizedMessage, ["criar", "crie", "cadastre", "cadastrar", "gerar", "gere", "novo", "nova"])
  const mentionsAttach = hasAny(input.normalizedMessage, ["anexar", "anexe", "vincular", "vincule", "juntar", "junte"])
  const mentionsUpdate = hasAny(input.normalizedMessage, ["atualizar", "atualize", "editar", "edite", "ajustar", "ajuste", "corrigir", "corrija"])
  const mentionsPublish = hasAny(input.normalizedMessage, ["publicar", "publique"])
  const mentionsPause = hasAny(input.normalizedMessage, ["pausar", "pause", "despublicar"])
  const mentionsDelete = hasAny(input.normalizedMessage, ["excluir", "exclua", "remover", "remova", "apagar", "apague"])
  const mentionsDescription = hasAny(input.normalizedMessage, ["descricao", "descricao", "texto", "copy"])
  const mentionsInstagram = hasAny(input.normalizedMessage, ["instagram", "story", "stories", "post"])

  if (attachmentSignals.hasImage && inPropertyContext && (mentionsCreate || mentionsProperty || workspacePage === "property_create")) {
    return {
      requestedAction: "createPropertyDraft" as AssessorAction,
      confidence: 0.97,
      reason: "imagem anexada em contexto de imovel com pedido de cadastro",
    }
  }

  if (attachmentSignals.hasAudio && inPropertyContext && (mentionsCreate || mentionsProperty)) {
    return {
      requestedAction: "createPropertyDraft" as AssessorAction,
      confidence: 0.9,
      reason: "audio recebido em contexto de imovel com pedido de cadastro",
    }
  }

  if (attachmentSignals.hasDocument && (mentionsAttach || inLeadContext) && mentionsClient && !mentionsContract) {
    return {
      requestedAction: "ATTACH_LEAD_DOCUMENT" as AssessorAction,
      confidence: 0.96,
      reason: "documento anexado com pedido de vinculo ao cliente",
    }
  }

  if (inPropertyContext && attachmentSignals.hasImage && mentionsUpdate) {
    return {
      requestedAction: "UPDATE_PROPERTY_MEDIA" as AssessorAction,
      confidence: 0.86,
      reason: "imagem anexada com pedido de atualizar midias do imovel atual",
    }
  }

  if (inPropertyContext && mentionsDescription && (mentionsUpdate || mentionsCampaign || mentionsProperty)) {
    return {
      requestedAction: "improvePropertyDescription" as AssessorAction,
      confidence: 0.82,
      reason: "pedido de ajuste de descricao no contexto do imovel atual",
    }
  }

  if ((mentionsProposal || input.normalizedMessage.startsWith("proposta")) && (mentionsCreate || Boolean(input.memory?.selectedProperty?.id) || Boolean(input.memory?.selectedClient?.id))) {
    return {
      requestedAction: "CREATE_PROPOSAL" as AssessorAction,
      confidence: 0.84,
      reason: "pedido de criacao de proposta",
    }
  }

  if (mentionsContract && (mentionsCreate || inContractContext || Boolean(input.memory?.selectedProperty?.id) || Boolean(input.memory?.selectedClient?.id))) {
    return {
      requestedAction: "CREATE_CONTRACT" as AssessorAction,
      confidence: 0.84,
      reason: "pedido de criacao de contrato",
    }
  }

  if (mentionsVideo && (inStudioContext || inPropertyContext || mentionsCreate)) {
    return {
      requestedAction: "STUDIO_GENERATE_VIDEO" as AssessorAction,
      confidence: 0.84,
      reason: "pedido de geracao de video",
    }
  }

  if (mentionsCampaign && (inStudioContext || inPropertyContext || mentionsCreate)) {
    return {
      requestedAction: (mentionsInstagram ? "STUDIO_GENERATE_INSTAGRAM" : "STUDIO_GENERATE_CAMPAIGN") as AssessorAction,
      confidence: 0.84,
      reason: mentionsInstagram ? "pedido de campanha para instagram" : "pedido de geracao de campanha",
    }
  }

  if (inPropertyContext && mentionsPublish) {
    return {
      requestedAction: "PUBLISH_PROPERTY" as AssessorAction,
      confidence: 0.81,
      reason: "pedido de publicar imovel no contexto atual",
    }
  }

  if (inPropertyContext && mentionsPause) {
    return {
      requestedAction: "UNPUBLISH_PROPERTY" as AssessorAction,
      confidence: 0.81,
      reason: "pedido de pausar imovel no contexto atual",
    }
  }

  if (inPropertyContext && mentionsDelete) {
    return {
      requestedAction: "ARCHIVE_PROPERTY" as AssessorAction,
      confidence: 0.81,
      reason: "pedido de excluir imovel no contexto atual",
    }
  }

  if (mentionsClient && mentionsCreate && !mentionsProperty && !mentionsContract && !mentionsProposal) {
    return {
      requestedAction: "createLead" as AssessorAction,
      confidence: 0.78,
      reason: "pedido de cadastro de cliente",
    }
  }

  return null
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
  const activeWorkflowAction = getActiveWorkflowAction(activeWorkflow)
  const attachmentSignals = getAttachmentSignals(attachments)

  if (input.requestedAction && input.requestedAction !== "workflow_details") {
    const explicitAction = input.requestedAction as AssessorAction
    return {
      requestedAction: explicitAction,
      workflowDecision: activeWorkflowAction && activeWorkflowAction !== explicitAction ? "start_new" : "continue_workflow",
      confidence: 1,
      reason: "requestedAction recebida explicitamente pela interface",
      signals: {
        workspacePage: workspace?.page ?? null,
        workspaceEntity: workspace?.entity ?? null,
        activeWorkflowAction,
        attachments: attachmentSignals.labels,
      },
    }
  }

  const resolvedAction = resolveRequestedAction({
    normalizedMessage,
    workspace,
    memory,
    attachments,
  })

  if (activeWorkflow) {
    const shouldContinue = shouldContinueActiveWorkflow({
      normalizedMessage,
      workflow: activeWorkflow,
      attachments,
    })

    if (resolvedAction && activeWorkflowAction && resolvedAction.requestedAction !== activeWorkflowAction) {
      return {
        requestedAction: resolvedAction.requestedAction,
        workflowDecision: "start_new",
        confidence: resolvedAction.confidence,
        reason: `${resolvedAction.reason}; nova intencao incompatível com workflow ativo`,
        signals: {
          workspacePage: workspace?.page ?? null,
          workspaceEntity: workspace?.entity ?? null,
          activeWorkflowAction,
          attachments: attachmentSignals.labels,
        },
      }
    }

    if (shouldContinue) {
      return {
        requestedAction: activeWorkflowAction,
        workflowDecision: "continue_workflow",
        confidence: 0.74,
        reason: "mensagem parece responder ao workflow ativo",
        signals: {
          workspacePage: workspace?.page ?? null,
          workspaceEntity: workspace?.entity ?? null,
          activeWorkflowAction,
          attachments: attachmentSignals.labels,
        },
      }
    }
  }

  if (resolvedAction) {
    return {
      requestedAction: resolvedAction.requestedAction,
      workflowDecision: "start_new",
      confidence: resolvedAction.confidence,
      reason: resolvedAction.reason,
      signals: {
        workspacePage: workspace?.page ?? null,
        workspaceEntity: workspace?.entity ?? null,
        activeWorkflowAction,
        attachments: attachmentSignals.labels,
      },
    }
  }

  return {
    requestedAction: null,
    workflowDecision: activeWorkflow ? "continue_workflow" : "none",
    confidence: 0,
    reason: activeWorkflow ? "sem sinal forte para trocar o workflow ativo" : "sem override de intencao",
    signals: {
      workspacePage: workspace?.page ?? null,
      workspaceEntity: workspace?.entity ?? null,
      activeWorkflowAction,
      attachments: attachmentSignals.labels,
    },
  }
}
