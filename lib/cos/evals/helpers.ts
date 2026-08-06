import type { AssessorAction } from "@/lib/eme-backend"

import { createCosNormalizedContext } from "../context"
import type {
  CosAttachmentInput,
  CosConversationMemory,
  CosPendingInput,
  CosWorkflow,
  CosWorkspaceContext,
} from "../types"
import type { CosEvalAttachmentSeed, CosEvalScenario, CosEvalScenarioRuntime, CosEvalWorkflowSeed } from "./types"

let attachmentCounter = 0
let workflowCounter = 0

function makeAttachment(seed: CosEvalAttachmentSeed): CosAttachmentInput {
  attachmentCounter += 1
  return {
    id: `eval-attachment-${attachmentCounter}`,
    size: seed.textContent?.length ?? 1024,
    ...seed,
  }
}

function buildWorkspaceContext(input: Partial<CosWorkspaceContext> | null | undefined, surface: CosWorkspaceContext["surface"]): CosWorkspaceContext | null {
  if (!input) return null
  return {
    surface,
    page: input.page ?? "cos_home",
    entity: input.entity ?? "operation",
    entityId: input.entityId ?? null,
    selection: input.selection ?? [],
    pendingEntity: input.pendingEntity ?? null,
    pendingEntityId: input.pendingEntityId ?? null,
    metadata: input.metadata ?? {},
  }
}

function buildMemory(input: Partial<CosConversationMemory> | null | undefined): CosConversationMemory | null {
  if (!input) return null
  return {
    updatedAt: input.updatedAt ?? new Date("2026-08-06T12:00:00.000Z").toISOString(),
    ...input,
  }
}

function buildPendingInput(action: AssessorAction, seed: CosEvalWorkflowSeed["pendingInput"]): CosPendingInput | null {
  if (!seed) return null
  return {
    field: seed.field ?? "selection",
    label: seed.label ?? "Escolha uma opção",
    type: seed.type ?? "selection",
    required: seed.required ?? true,
    entity: seed.entity ?? "general",
    action,
    parsedData: seed.parsedData ?? {},
    options: seed.options,
  }
}

function buildWorkflow(seed: CosEvalWorkflowSeed | null | undefined, workspace: CosWorkspaceContext | null): CosWorkflow | null {
  if (!seed) return null
  workflowCounter += 1
  const pendingInput = buildPendingInput(seed.action, seed.pendingInput ?? null)

  return {
    id: `eval-workflow-${workflowCounter}`,
    conversationId: `eval-conversation-${workflowCounter}`,
    status: seed.status ?? "awaiting_input",
    executionPlan: {
      id: `eval-plan-${workflowCounter}`,
      source: "single",
      reason: "eval workflow seed",
      message: "workflow seeded",
      requestedAction: seed.action,
      surface: workspace?.surface ?? "portal",
      workspace,
      unresolvedGoals: [],
    },
    currentStep: 0,
    steps: [
      {
        id: `eval-workflow-${workflowCounter}:step:1`,
        order: 0,
        entity: pendingInput?.entity ?? "general",
        capabilityId: "general.chat",
        action: seed.action,
        status: pendingInput ? "awaiting_input" : "running",
        dependsOn: [],
        durationMs: null,
        errorMessage: null,
        resultResponse: null,
        resultMetadata: null,
      },
    ],
    pendingInput,
    startedAt: new Date("2026-08-06T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-08-06T12:00:00.000Z").toISOString(),
    completedAt: null,
    pausedAt: pendingInput ? new Date("2026-08-06T12:00:00.000Z").toISOString() : null,
    totalPausedMs: 0,
  }
}

export function createEvalScenarioRuntime(scenario: CosEvalScenario): CosEvalScenarioRuntime {
  const surface = scenario.surface ?? "portal"
  const attachments = (scenario.attachments ?? []).map(makeAttachment)
  const workspace = buildWorkspaceContext(scenario.workspace ?? null, surface)
  const memory = buildMemory(scenario.memory ?? null)
  const activeWorkflow = buildWorkflow(scenario.activeWorkflow ?? null, workspace)
  const normalizedContext = createCosNormalizedContext({
    brokerId: "eval-broker",
    userId: "eval-user",
    surface,
    message: scenario.message,
    workspace,
    workflow: activeWorkflow,
    memory,
    attachments,
  })

  return {
    attachments,
    workspace,
    memory,
    activeWorkflow,
    normalizedContext,
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
}

export function createScenario(input: Omit<CosEvalScenario, "id"> & { id?: string }) {
  return {
    ...input,
    id: input.id ?? `${slugify(input.category)}-${slugify(input.description).slice(0, 64)}`,
  } satisfies CosEvalScenario
}
