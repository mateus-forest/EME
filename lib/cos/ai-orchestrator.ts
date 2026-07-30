import "server-only"

import { randomUUID } from "crypto"

import { zodTextFormat } from "openai/helpers/zod"
import { z } from "zod"

import { listCosCapabilityCatalog } from "@/lib/cos/capability-catalog"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"

import type { PendingAssessorContext } from "@/lib/eme-backend"
import type { CosCapabilityDescriptor, CosCapabilityId, CosCapabilitySurface, CosExecutionPlanGap, CosPlannerKind, CosWorkspaceContext } from "@/lib/cos/types"

const aiPlanStepSchema = z.object({
  id: z.string().trim().min(1).max(40),
  capability: z.string().trim().min(1).max(120),
  dependsOn: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
})

const aiPlanSchema = z.object({
  goal: z.string().trim().min(1).max(120),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(400),
  steps: z.array(aiPlanStepSchema).min(1).max(6),
})

type AiPlanOutput = z.infer<typeof aiPlanSchema>

type AiOrchestratorStatus =
  | "accepted"
  | "invalid"
  | "invalid_capability"
  | "invalid_schema"
  | "unavailable"
  | "not_needed"
  | "disabled"
  | "error"

export type CosAiOrchestratorAudit = {
  planner: CosPlannerKind
  status: AiOrchestratorStatus
  triggerReason: string | null
  model: string | null
  requestedAt: string
  resolutionMs: number
  confidence: number | null
  reason: string | null
  estimatedCostUsd: number | null
  tokens: {
    input: number | null
    output: number | null
    total: number | null
  }
  finishReason: string | null
  prompt: string | null
  structuredResponse: Record<string, unknown> | null
  validationErrors: string[]
  suggestedCapabilities: string[]
  executedCapabilities: string[]
  fallbackUsed: boolean
  fallbackReason: string | null
}

export type CosAiOrchestratorResult =
  | {
      accepted: true
      data: AiPlanOutput
      audit: CosAiOrchestratorAudit
    }
  | {
      accepted: false
      audit: CosAiOrchestratorAudit
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

function summarizeCapabilities(surface: CosCapabilitySurface) {
  return listCosCapabilityCatalog()
    .filter((capability) => capability.surfaces.includes(surface))
    .map((capability) => ({
      id: capability.id,
      title: capability.title,
      description: capability.description,
      domain: capability.domain,
      entity: capability.entity,
      aliases: capability.aliases.slice(0, 4),
      mutatesData: capability.mutatesData,
      requiresConfirmation: capability.requiresConfirmation,
      requiresSelection: capability.requiresSelection,
    }))
}

function buildWorkspaceSummary(workspace: CosWorkspaceContext | null) {
  if (!workspace) return null
  return {
    surface: workspace.surface,
    page: workspace.page,
    entity: workspace.entity,
    entityId: workspace.entityId ?? null,
    selection: workspace.selection.slice(0, 5),
    pendingEntity: workspace.pendingEntity ?? null,
    pendingEntityId: workspace.pendingEntityId ?? null,
    metadata: workspace.metadata,
  }
}

function buildPendingSummary(pendingContext: PendingAssessorContext | null | undefined) {
  if (!pendingContext) return null
  return {
    action: pendingContext.action,
    missingField: pendingContext.missingField,
    parsedData: pendingContext.parsedData,
    createdAt: pendingContext.createdAt.toISOString(),
  }
}

function buildPlannerPrompt(input: {
  message: string
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  pendingContext: PendingAssessorContext | null
  activeWorkflowSummary?: Record<string, unknown> | null
  capabilities: ReturnType<typeof summarizeCapabilities>
}) {
  return [
    "Planeje um Execution Plan para o COS.",
    "Voce e apenas um planejador. Nunca execute, nunca responda ao usuario, nunca invente capabilities.",
    "Use somente capabilities existentes na lista enviada.",
    "Prefira o menor plano valido que complete o objetivo.",
    "Se houver mais de uma estrategia plausivel, escolha a mais pragmatica e segura para um corretor operar agora.",
    "As dependencias devem apontar apenas para ids de steps anteriores.",
    "",
    `Mensagem do usuario: ${input.message}`,
    `Surface atual: ${input.surface}`,
    `Workspace Context: ${JSON.stringify(buildWorkspaceSummary(input.workspace))}`,
    `Pending Context: ${JSON.stringify(buildPendingSummary(input.pendingContext))}`,
    `Workflow ativo: ${JSON.stringify(input.activeWorkflowSummary ?? null)}`,
    "",
    "Capabilities disponiveis:",
    JSON.stringify(input.capabilities),
    "",
    "Regras finais:",
    "- Retorne apenas o JSON do schema solicitado.",
    "- goal deve ser curto e objetivo.",
    "- confidence deve ficar entre 0 e 1.",
    "- steps deve conter apenas capabilities reais da lista.",
    "- Nao crie campos extras.",
  ].join("\n")
}

function parseOutput(response: {
  output_text?: string
  output_parsed?: unknown
}) {
  if (response.output_parsed && typeof response.output_parsed === "object") {
    return response.output_parsed
  }

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return JSON.parse(response.output_text)
  }

  return null
}

function estimateCostUsd(inputTokens: number | null, outputTokens: number | null) {
  if (inputTokens === null && outputTokens === null) return null
  return Number((((inputTokens ?? 0) / 1_000_000) * 0.25 + ((outputTokens ?? 0) / 1_000_000) * 2).toFixed(6))
}

function getUsageMetrics(response: {
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
}) {
  const input = response.usage?.input_tokens ?? null
  const output = response.usage?.output_tokens ?? null
  const total = response.usage?.total_tokens ?? (input !== null || output !== null ? (input ?? 0) + (output ?? 0) : null)
  return { input, output, total }
}

function validatePlan(input: {
  parsed: AiPlanOutput
  capabilities: CosCapabilityDescriptor[]
  surface: CosCapabilitySurface
}) {
  const validationErrors: string[] = []
  const capabilityMap = new Map(input.capabilities.map((capability) => [capability.id, capability]))
  const seenIds = new Set<string>()
  const priorIds = new Set<string>()

  input.parsed.steps.forEach((step, index) => {
    if (seenIds.has(step.id)) {
      validationErrors.push(`Step id duplicado: ${step.id}`)
    }
    seenIds.add(step.id)

    if (!capabilityMap.has(step.capability as CosCapabilityId)) {
      validationErrors.push(`Capability inexistente: ${step.capability}`)
    }

    const descriptor = capabilityMap.get(step.capability as CosCapabilityId)
    if (descriptor && !descriptor.surfaces.includes(input.surface)) {
      validationErrors.push(`Capability indisponivel na surface ${input.surface}: ${step.capability}`)
    }

    step.dependsOn.forEach((dependency) => {
      if (!priorIds.has(dependency)) {
        validationErrors.push(`Dependencia invalida no step ${index + 1}: ${dependency}`)
      }
    })

    priorIds.add(step.id)
  })

  return validationErrors
}

function shouldTryAiOrchestrator(input: {
  message: string
  surface: CosCapabilitySurface
  requestedAction?: string
  workspace: CosWorkspaceContext | null
  pendingContext: PendingAssessorContext | null
  primaryCapabilityId: CosCapabilityId
  primarySource: "catalog" | "legacy" | "ai"
  primaryConfidence: number
  recipeMatched: boolean
}) {
  if (input.pendingContext) return { shouldTry: false, triggerReason: null }
  if (input.recipeMatched) return { shouldTry: false, triggerReason: null }
  if (input.requestedAction) return { shouldTry: false, triggerReason: null }

  const normalized = normalizeText(input.message)
  const strategySignals = [
    "prepare tudo",
    "prepare",
    "prioridades",
    "publico ideal",
    "considere",
    "estrategia",
    "planeje",
    "sugira",
    "analise toda minha operacao",
    "vender este imovel",
    "quero vender este imovel",
  ]

  if (input.primarySource === "legacy" || input.primaryCapabilityId === "general.chat") {
    return { shouldTry: true, triggerReason: "deterministic_fallback" }
  }

  if (input.primaryConfidence < 0.65) {
    return { shouldTry: true, triggerReason: "low_confidence" }
  }

  if (strategySignals.some((signal) => normalized.includes(signal))) {
    return { shouldTry: true, triggerReason: "multi_strategy_request" }
  }

  return { shouldTry: false, triggerReason: null }
}

export async function generateCosAiExecutionPlan(input: {
  message: string
  surface: CosCapabilitySurface
  workspace: CosWorkspaceContext | null
  pendingContext: PendingAssessorContext | null
  activeWorkflowSummary?: Record<string, unknown> | null
  triggerReason: string
  responseOverride?: unknown
}) : Promise<CosAiOrchestratorResult> {
  const startedAt = Date.now()
  const { enabled, model } = getOpenAIEnv()
  const capabilities = summarizeCapabilities(input.surface)
  const prompt = buildPlannerPrompt({
    message: input.message,
    surface: input.surface,
    workspace: input.workspace,
    pendingContext: input.pendingContext,
    activeWorkflowSummary: input.activeWorkflowSummary,
    capabilities,
  })

  const buildAudit = (overrides: Partial<CosAiOrchestratorAudit>): CosAiOrchestratorAudit => ({
    planner: "ai",
    status: "error",
    triggerReason: input.triggerReason,
    model: enabled ? model : null,
    requestedAt: new Date(startedAt).toISOString(),
    resolutionMs: Date.now() - startedAt,
    confidence: null,
    reason: null,
    estimatedCostUsd: null,
    tokens: { input: null, output: null, total: null },
    finishReason: null,
    prompt,
    structuredResponse: null,
    validationErrors: [],
    suggestedCapabilities: [],
    executedCapabilities: [],
    fallbackUsed: true,
    fallbackReason: "ai_orchestrator_unavailable",
    ...overrides,
  })

  if (!input.responseOverride && (!enabled || !getOpenAIClient())) {
    return {
      accepted: false,
      audit: buildAudit({
        status: enabled ? "unavailable" : "disabled",
        model: enabled ? model : null,
        fallbackReason: enabled ? "openai_client_unavailable" : "openai_disabled",
      }),
    }
  }

  try {
    const client = getOpenAIClient()
    const response =
      input.responseOverride ??
      (await client!.responses.create({
        model,
        max_output_tokens: 1200,
        reasoning: {
          effort: "minimal",
        },
        instructions:
          "Voce planeja fluxos do COS. Sua unica tarefa e devolver um plano estruturado usando apenas capabilities existentes. Nao escreva texto livre.",
        input: prompt,
        text: {
          verbosity: "low",
          format: zodTextFormat(aiPlanSchema, "cos_ai_execution_plan"),
        },
      }))

    const parsedRaw = parseOutput(response as { output_text?: string; output_parsed?: unknown })
    if (!parsedRaw || typeof parsedRaw !== "object") {
      return {
        accepted: false,
        audit: buildAudit({
          status: "invalid_schema",
          finishReason: typeof (response as { finish_reason?: string }).finish_reason === "string" ? (response as { finish_reason?: string }).finish_reason! : null,
          structuredResponse: null,
          fallbackReason: "empty_structured_output",
        }),
      }
    }

    const parsed = aiPlanSchema.parse(parsedRaw)
    const validationErrors = validatePlan({
      parsed,
      capabilities: listCosCapabilityCatalog().filter((capability) => capability.surfaces.includes(input.surface)),
      surface: input.surface,
    })
    const usage = getUsageMetrics(response as { usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } })
    const auditBase = buildAudit({
      status: validationErrors.length === 0 ? "accepted" : "invalid",
      confidence: parsed.confidence,
      reason: parsed.reason,
      finishReason: typeof (response as { finish_reason?: string }).finish_reason === "string" ? (response as { finish_reason?: string }).finish_reason! : null,
      structuredResponse: parsed as unknown as Record<string, unknown>,
      validationErrors,
      suggestedCapabilities: parsed.steps.map((step) => step.capability),
      tokens: usage,
      estimatedCostUsd: estimateCostUsd(usage.input, usage.output),
      fallbackUsed: validationErrors.length > 0,
      fallbackReason: validationErrors.length > 0 ? "plan_validation_failed" : null,
    })

    if (validationErrors.length > 0) {
      return {
        accepted: false,
        audit: auditBase,
      }
    }

    return {
      accepted: true,
      data: parsed,
      audit: auditBase,
    }
  } catch (caughtError) {
    return {
      accepted: false,
      audit: buildAudit({
        status: "error",
        validationErrors: [caughtError instanceof Error ? caughtError.message : "ai_orchestrator_unknown_error"],
        fallbackReason: "ai_orchestrator_exception",
      }),
    }
  }
}

export function buildRejectedAiPlanGoal(input: {
  audit: CosAiOrchestratorAudit
}): CosExecutionPlanGap[] {
  return input.audit.validationErrors.map((error) => ({
    id: `ai_orchestrator:${randomUUID().slice(0, 8)}`,
    title: "Plano de IA rejeitado",
    reason: error,
  }))
}

export function evaluateAiOrchestratorTrigger(input: Parameters<typeof shouldTryAiOrchestrator>[0]) {
  return shouldTryAiOrchestrator(input)
}
