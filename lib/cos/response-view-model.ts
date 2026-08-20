import type {
  CosDialogueDecision,
  CosExecutionPlan,
  CosExecutionPlanResult,
  CosPendingInput,
} from "@/lib/cos/types"

export type CosResponseKind =
  | "success"
  | "error"
  | "awaiting_input"
  | "confirmation_required"
  | "query_result"
  | "explanation"
  | "selection"
  | "partial_result"
  | "warning"
  | "cancelled"

export type CosResponseInteractionType =
  | "confirmation"
  | "selection"
  | "navigation"
  | "wizard"
  | "preview"
  | "summary"
  | "result"

export type CosResponseViewModel = {
  schemaVersion: 1
  kind: CosResponseKind
  text: string
  interactionType: CosResponseInteractionType
  title?: string
  details?: string[]
  completedSteps?: Array<{
    capabilityId: string
    label: string
  }>
  pending?: {
    field: string
    label: string
    type: CosPendingInput["type"]
    options: Array<{ id: string; label: string; description?: string }>
  }
  confirmation?: {
    prompt: string
    confirmLabel: string
    cancelLabel: string
  }
  error?: {
    code: string | null
    recoverable: boolean
  }
}

const RESPONSE_KINDS = new Set<CosResponseKind>([
  "success",
  "error",
  "awaiting_input",
  "confirmation_required",
  "query_result",
  "explanation",
  "selection",
  "partial_result",
  "warning",
  "cancelled",
])

const INTERACTION_TYPES = new Set<CosResponseInteractionType>([
  "confirmation",
  "selection",
  "navigation",
  "wizard",
  "preview",
  "summary",
  "result",
])

function interactionTypeForKind(kind: CosResponseKind): CosResponseInteractionType {
  if (kind === "confirmation_required") return "confirmation"
  if (kind === "selection") return "selection"
  if (kind === "awaiting_input") return "wizard"
  if (kind === "explanation") return "summary"
  return "result"
}

const INTERNAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "pendente",
  PROCESSING: "em andamento",
  RUNNING: "em andamento",
  COMPLETED: "concluído",
  FAILED: "não concluído",
  CANCELLED: "cancelado",
  CANCELED: "cancelado",
  PAUSED: "pausado",
  NEW: "novo",
  CONTACTED: "contatado",
  NEGOTIATING: "em negociação",
  WON: "ganho",
  LOST: "perdido",
  ARCHIVED: "arquivado",
  DRAFT: "rascunho",
  PUBLISHED: "publicado",
  SOLD: "vendido",
  RENTED: "alugado",
  ACTIVE: "ativo",
  INACTIVE: "inativo",
  OPEN: "aberto",
  CLOSED: "encerrado",
  SIGNED: "assinado",
  SENT: "enviado",
  EXPIRED: "expirado",
}

export function sanitizeCosResponseText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(new RegExp(`\\b(?:${Object.keys(INTERNAL_STATUS_LABELS).join("|")})\\b`, "g"), (status) => INTERNAL_STATUS_LABELS[status] ?? "")
    .replace(/\b(?:CREATE|UPDATE|DELETE|GET|LIST|PUBLISH|UNPUBLISH|ARCHIVE|STUDIO|CONTRACT|MARK|SEND|SHARE|FIND|LEAD|PROPERTY|AGENDA)_[A-Z0-9_]+\b/g, "")
    .replace(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, "")
    .replace(/\bProperty\b/gi, "imóvel")
    .replace(/\bLead\b/gi, "cliente")
    .replace(/\bAgendaEvent\b/gi, "compromisso")
    .replace(/\bBrokerDocument\b/gi, "documento")
    .replace(/\bcapabilities\b/gi, "recursos")
    .replace(/\bcapability\b/gi, "recurso")
    .replace(/\bworkflows?\b/gi, "fluxo")
    .replace(/\bintents?\b/gi, "pedido")
    .replace(/\bactions?\b/gi, "ações")
    .replace(/\bgeneral\b/gi, "orientação")
    .replace(/\bRegistry\b/gi, "EME")
    .replace(/\bhandlers?\b/gi, "recursos")
    .replace(/\bdescriptors?\b/gi, "regras")
    .replace(/\bpayload\b/gi, "dados")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim()
}

function cleanResponseText(value: string | null | undefined) {
  return sanitizeCosResponseText(value)
}

function isSafeFailureText(value: string) {
  if (!value) return false
  if (/\b(?:CREATE|UPDATE|DELETE|GET|LIST|PUBLISH|UNPUBLISH|STUDIO)_[A-Z_]+\b/.test(value)) return false
  if (/\b(?:Prisma|TypeError|ReferenceError|stack trace|ECONN|PGRST\d*)\b/i.test(value)) return false
  const trimmed = value.trim()
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return false
  return true
}

function completedStepRefs(result: CosExecutionPlanResult) {
  return result.completedSteps.map((step) => ({
    capabilityId: step.capabilityId,
    label: step.plan.capability.title,
  }))
}

function completedStepFacts(result: CosExecutionPlanResult) {
  return result.completedSteps
    .map((step) => cleanResponseText(step.result?.response).replace(/[.!?]+$/g, ""))
    .filter(Boolean)
}

function pendingFromResult(result: CosExecutionPlanResult) {
  const interrupted = result.interruptedStep?.result
  if (interrupted?.status !== "awaiting_input") return null

  return interrupted.pendingInput
}

function buildPendingView(pending: CosPendingInput | null) {
  if (!pending) return undefined
  return {
    field: pending.field,
    label: pending.label,
    type: pending.type,
    options: (pending.options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
    })),
  }
}

function successfulKind(decision: CosDialogueDecision | null | undefined): CosResponseKind {
  if (["explain", "capability_question", "context"].includes(decision?.dialogueAct ?? "")) {
    return "explanation"
  }
  if (decision?.dialogueAct === "query" || decision?.dialogueAct === "select" || decision?.dialogueAct === "return_topic") {
    return "query_result"
  }
  return "success"
}

export function buildCosSimpleResponseViewModel(input: {
  kind: CosResponseKind
  text: string
  title?: string
  interactionType?: CosResponseInteractionType
  details?: string[]
}): CosResponseViewModel {
  return {
    schemaVersion: 1,
    kind: input.kind,
    text: cleanResponseText(input.text) || (input.kind === "error" ? "Não consegui concluir agora." : "Concluído."),
    interactionType: input.interactionType ?? interactionTypeForKind(input.kind),
    ...(input.title ? { title: input.title } : {}),
    ...(input.details?.length ? { details: input.details.map(cleanResponseText).filter(Boolean) } : {}),
  }
}

export function buildCosConfirmationResponseViewModel(input: {
  prompt: string
  capabilityTitle?: string | null
  action?: string | null
  confirmLabel?: string
  cancelLabel?: string
}): CosResponseViewModel {
  const capability = cleanResponseText(input.capabilityTitle) || "esta ação"
  const prompt = cleanResponseText(input.prompt) || `Confirme antes de executar ${capability.toLowerCase()}.`
  return {
    schemaVersion: 1,
    kind: "confirmation_required",
    text: prompt,
    interactionType: "confirmation",
    title: "Confirmação necessária",
    confirmation: {
      prompt,
      confirmLabel: cleanResponseText(input.confirmLabel) || `Confirmar ${capability.toLowerCase()}`,
      cancelLabel: cleanResponseText(input.cancelLabel) || "Cancelar",
    },
  }
}

export function buildCosExecutionResponseViewModel(input: {
  message: string
  plan: CosExecutionPlan
  result: CosExecutionPlanResult
  decision?: CosDialogueDecision | null
}): CosResponseViewModel {
  const completedSteps = completedStepRefs(input.result)
  const interruptedStep = input.result.interruptedStep

  if (input.result.status === "awaiting_input") {
    const pending = pendingFromResult(input.result) ?? input.plan.pendingInput
    const question = cleanResponseText(interruptedStep?.result?.response) ||
      (pending ? `${pending.label}: informe esse dado para eu continuar.` : "Preciso de mais uma informação para continuar.")
    const completedFacts = completedStepFacts(input.result)
    const prefix = completedSteps.length > 0
      ? `${completedFacts.length > 0 ? completedFacts.join(". ") : `Concluí: ${completedSteps.map((step) => step.label).join(", ")}`}.\n\n`
      : ""
    const kind: CosResponseKind = completedSteps.length > 0
      ? "partial_result"
      : pending?.type === "selection"
        ? "selection"
        : "awaiting_input"

    return {
      schemaVersion: 1,
      kind,
      text: `${prefix}${question}`,
      interactionType: pending?.type === "selection" ? "selection" : interactionTypeForKind(kind),
      title: pending?.type === "selection" ? "Escolha uma opção" : "Preciso de uma informação",
      ...(completedSteps.length ? { completedSteps } : {}),
      ...(pending ? { pending: buildPendingView(pending) } : {}),
    }
  }

  if (input.result.status === "failed") {
    const rawFailure = interruptedStep?.result?.status === "error"
      ? cleanResponseText(interruptedStep.result.response)
      : ""
    const operationLabel = interruptedStep?.plan.capability.title.toLowerCase() || "a operação"
    const safeFailure = isSafeFailureText(rawFailure)
      ? rawFailure
      : `Não consegui concluir ${operationLabel} agora.`
    const partial = completedSteps.length > 0
    const text = partial
      ? `Concluí: ${completedSteps.map((step) => step.label).join(", ")}.\n\n${safeFailure}`
      : safeFailure

    return {
      schemaVersion: 1,
      kind: partial ? "partial_result" : "error",
      text,
      interactionType: "result",
      title: partial ? "Concluído parcialmente" : "Não foi possível concluir",
      ...(completedSteps.length ? { completedSteps } : {}),
      error: {
        code: interruptedStep?.result?.status === "error" ? interruptedStep.result.errorCode : null,
        recoverable: Boolean(interruptedStep && !interruptedStep.plan.capability.mutatesData),
      },
    }
  }

  const executedResponses = input.result.executedSteps
    .map((step) => cleanResponseText(step.result?.response).replace(/[.!?]+$/g, ""))
    .filter(Boolean)
  const kind = successfulKind(input.decision ?? input.plan.context?.decision)
  const lastFact = executedResponses.at(-1) ?? ""
  const text = completedSteps.length > 1
    ? `${executedResponses.join(". ")}.`
    : lastFact
      ? `${lastFact}.`
      : "Concluído."

  return {
    schemaVersion: 1,
    kind,
    text,
    interactionType: interactionTypeForKind(kind),
    title: kind === "explanation" ? "Explicação" : kind === "query_result" ? "Resultado da consulta" : "Concluído",
    ...(completedSteps.length > 1 ? { completedSteps } : {}),
  }
}

export function parseCosResponseViewModel(value: unknown): CosResponseViewModel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== 1 || typeof candidate.kind !== "string" || !RESPONSE_KINDS.has(candidate.kind as CosResponseKind)) {
    return null
  }
  if (typeof candidate.text !== "string" || !candidate.text.trim()) return null
  if (typeof candidate.interactionType !== "string" || !INTERACTION_TYPES.has(candidate.interactionType as CosResponseInteractionType)) {
    return null
  }

  return candidate as CosResponseViewModel
}
