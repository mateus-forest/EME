import { resolveCosDialogueDecision } from "@/lib/cos/conversation-decision"
import { evaluateCosDecisionSecurity } from "@/lib/cos/decision-security"

import type {
  CosAttachmentInput,
  CosCapabilitySurface,
  CosConversationMemory,
  CosDialogueDecision,
  CosNormalizedContext,
  CosWorkflow,
  CosWorkspaceContext,
} from "@/lib/cos/types"
import type { AssessorAction } from "@/lib/eme-backend"

type CosIntentAttachment = Pick<CosAttachmentInput, "id" | "name" | "type" | "size" | "category" | "dataUrl" | "textContent">

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
  dialogueDecision: CosDialogueDecision
  signals: {
    operationalIntent: string | null
    workspacePage: string | null
    workspaceEntity: string | null
    activeWorkflowAction: AssessorAction | null
    attachments: string[]
    dialogueAct: string
    primaryDomain: string
  }
}

function getActiveWorkflowAction(workflow: CosWorkflow | null | undefined) {
  if (!workflow) return null
  return workflow.pendingInput?.action ?? workflow.steps[workflow.currentStep]?.action ?? workflow.steps[0]?.action ?? null
}

function getSurface(context: CosNormalizedContext | null, workspace: CosWorkspaceContext | null): CosCapabilitySurface {
  if (context?.surface) return context.surface
  if (workspace?.surface === "cos_home") return "cos_home"
  return "portal"
}

export function resolveCosIntent(input: {
  message: string
  requestedAction?: string | null
  attachments: CosIntentAttachment[]
  workspace: CosWorkspaceContext | null
  activeWorkflow: CosWorkflow | null
  memory: CosConversationMemory | null
  context?: CosNormalizedContext | null
  decision?: CosDialogueDecision | null
  isExplicitAction?: boolean
}): CosIntentResolution {
  const context = input.context ?? null
  const message = context?.message ?? input.message
  const attachments = context?.attachments ?? input.attachments
  const workspace = context?.workspace ?? input.workspace
  const activeWorkflow = context?.workflow ?? input.activeWorkflow
  const memory = context?.memory ?? input.memory
  const suppliedDecision = input.decision ?? context?.decision ?? null
  const decision = input.requestedAction && suppliedDecision?.selectedAction !== input.requestedAction
    ? resolveCosDialogueDecision({
        message,
        requestedAction: input.requestedAction,
        surface: getSurface(context, workspace),
        workspace,
        snapshot: context?.snapshot ?? null,
        activeWorkflow,
        memory,
        attachments,
      })
    : suppliedDecision ?? resolveCosDialogueDecision({
        message,
        requestedAction: input.requestedAction,
        surface: getSurface(context, workspace),
        workspace,
        snapshot: context?.snapshot ?? null,
        activeWorkflow,
        memory,
        attachments,
      })
  const securityAudit = evaluateCosDecisionSecurity({
    message,
    attachments: attachments.map((attachment) => ({
      name: attachment.name,
      textContent: attachment.textContent,
    })),
  })
  const activeWorkflowAction = getActiveWorkflowAction(activeWorkflow)
  const signals = {
    operationalIntent: decision.dialogueAct,
    workspacePage: workspace?.page ?? null,
    workspaceEntity: workspace?.entity ?? null,
    activeWorkflowAction,
    attachments: attachments.map((attachment) => `${attachment.category}:${attachment.name}`),
    dialogueAct: decision.dialogueAct,
    primaryDomain: decision.primaryDomain,
  }

  if (!input.isExplicitAction && securityAudit.flagged) {
    return {
      requestedAction: null,
      workflowDecision: activeWorkflow ? "continue_workflow" : "none",
      confidence: Math.max(0.05, activeWorkflow ? 0.28 : 0.12),
      reason: `security_guard:${securityAudit.reasons.join(",")}`,
      needsConfirmation: false,
      candidates: [],
      dialogueDecision: {
        ...decision,
        selectedCapabilityId: null,
        selectedAction: null,
        needsClarification: true,
        clarificationReason: "security_guard",
      },
      signals,
    }
  }

  const selectedCandidate = decision.candidateCapabilities.find((candidate) => candidate.capabilityId === decision.selectedCapabilityId)
  const confidence = Math.max(
    0.1,
    Math.min(
      decision.dialogueActConfidence,
      selectedCandidate?.confidence ?? decision.dialogueActConfidence,
    ) - securityAudit.scorePenalty,
  )
  const reason = [
    `dialogue_act=${decision.dialogueAct}`,
    `domain=${decision.primaryDomain}`,
    `source=${decision.source}`,
    ...decision.dialogueActEvidence,
    ...(decision.clarificationReason ? [decision.clarificationReason] : []),
  ].join("; ")

  return {
    requestedAction: decision.selectedAction,
    workflowDecision: decision.workflowDecision,
    confidence,
    reason,
    needsConfirmation: decision.needsClarification,
    candidates: decision.candidateCapabilities.map((candidate) => ({
      action: candidate.action,
      confidence: candidate.confidence,
      reason: candidate.evidence.join("; ") || `registry:${candidate.capabilityId}`,
    })),
    dialogueDecision: decision,
    signals,
  }
}
