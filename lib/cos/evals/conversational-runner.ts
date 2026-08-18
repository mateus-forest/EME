import type { Prisma } from "@prisma/client"

import {
  getCosCapabilityDescriptorById,
  getCosEntityModuleIdByCapabilityId,
  listCosCapabilityCatalog,
} from "@/lib/cos/capability-catalog"
import { resolveCosDialogueDecision } from "@/lib/cos/conversation-decision"
import { executeCosExecutionPlan } from "@/lib/cos/executor"
import type {
  CosConversationEntityReference,
  CosConversationSnapshot,
  CosCapabilityHandler,
  CosExecutionPlan,
  CosExecutionStep,
  CosPendingInput,
  CosRuntimeActionResult,
  CosWorkflow,
} from "@/lib/cos/types"
import { retrieveCosKnowledge } from "@/lib/cos/knowledge/retrieval"
import {
  buildCosConfirmationResponseViewModel,
  buildCosExecutionResponseViewModel,
  buildCosSimpleResponseViewModel,
} from "@/lib/cos/response-view-model"
import { getCosDomainLabel, getCosStatusLabel } from "@/lib/cos/localization"
import { classifyCosPendingReply } from "@/lib/cos/pending-input"
import { cosGoldenConversations } from "@/lib/cos/evals/conversations/golden"
import {
  COS_GOLDEN_V1_METADATA,
  cosGoldenV1Conversations,
} from "@/lib/cos/evals/conversations/golden-v1"
import type {
  CosEvalMetric,
  CosGoldenCaseResult,
  CosGoldenConversation,
  CosGoldenCoverageMetric,
  CosGoldenEvaluationLayer,
  CosGoldenFailure,
  CosGoldenLayerResult,
  CosGoldenStatePatch,
} from "@/lib/cos/evals/golden-types"
import { runCosEvalSuite } from "@/lib/cos/evals/runner"

const NOW = "2026-08-15T12:00:00.000Z"
const FUTURE = "2026-08-15T13:00:00.000Z"
const TECHNICAL_OUTPUT = /\b(?:pending|completed|failed|property|appointment|awaiting_input|needs_confirmation)\b|\b(?:CREATE|UPDATE|DELETE|GET|LIST|PUBLISH|UNPUBLISH|ARCHIVE|STUDIO|CONTRACT|MARK)_[A-Z0-9_]+\b/i
const MOJIBAKE_OUTPUT = new RegExp([
  "\\u00c3\\u0192",
  "\\u00c3\\u00a2",
  "\\u00c3\\u00a3",
  "\\u00c3\\u00a7",
  "\\u00c3\\u00a9",
  "\\u00c3\\u00aa",
  "\\u00c3\\u00ad",
  "\\u00c3\\u00b3",
  "\\u00c3\\u00b4",
  "\\u00c3\\u00ba",
  "\\u00c2",
  "\\u00e2\\u0153",
  "\\u00e2\\u0161",
  "\\u00e2\\u201a",
  "\\u00e2\\u008f",
  "\\u00e2\\u00ac",
].join("|"))

type MutableConversationState = {
  snapshot: CosConversationSnapshot
  activeWorkflow: CosWorkflow | null
  sequence: number
}

type MetricAccumulator = {
  evaluated: number
  passed: number
}

type ExecutionFixtureResult = {
  id: string
  passed: boolean
  expected: string
  actual: string
}

const GOLDEN_V1_LAYERS: CosGoldenEvaluationLayer[] = [
  "dialogue_act",
  "domain",
  "entity_resolution",
  "reference_resolution",
  "working_set",
  "context_continuity",
  "capability_reference",
  "capability_selection",
  "capability_execution",
  "pending_input",
  "confirmation",
  "persistence",
  "partial_success",
  "knowledge_correctness",
  "gap_recognition",
  "failure_classification",
  "entitlement_security",
  "credit_correctness",
  "response_quality",
  "forbidden_behaviors",
]

type MutableGoldenLayerResult = CosGoldenLayerResult

function createLayerResults(scenario: CosGoldenConversation) {
  return new Map<CosGoldenEvaluationLayer, MutableGoldenLayerResult>(
    (scenario.requiredLayers ?? []).map((layer) => [layer, {
      layer,
      status: "not_evaluated",
      turn: null,
      expected: null,
      actual: null,
      reason: "A camada não possui oracle executável no baseline determinístico atual.",
    }]),
  )
}

function recordLayerResult(
  results: Map<CosGoldenEvaluationLayer, MutableGoldenLayerResult>,
  layer: CosGoldenEvaluationLayer,
  passed: boolean,
  turn: number,
  expected: string,
  actual: string,
) {
  if (!results.has(layer)) return
  const current = results.get(layer)
  if (current?.status === "fail") return
  results.set(layer, {
    layer,
    status: passed ? "pass" : "fail",
    turn,
    expected,
    actual,
    reason: null,
  })
}

function finalizeCoverageMetrics(caseResults: CosGoldenCaseResult[]) {
  return Object.fromEntries(GOLDEN_V1_LAYERS.map((layer) => {
    const eligibleResults = caseResults.flatMap((item) => item.layers.filter((result) => result.layer === layer))
    const evaluatedResults = eligibleResults.filter((result) => result.status !== "not_evaluated")
    const passed = evaluatedResults.filter((result) => result.status === "pass").length
    const failed = evaluatedResults.length - passed
    const metric: CosGoldenCoverageMetric = {
      eligible: eligibleResults.length,
      evaluated: evaluatedResults.length,
      passed,
      failed,
      notEvaluated: eligibleResults.length - evaluatedResults.length,
      accuracy: evaluatedResults.length === 0 ? null : Number(((passed / evaluatedResults.length) * 100).toFixed(2)),
      coverage: eligibleResults.length === 0 ? null : Number(((evaluatedResults.length / eligibleResults.length) * 100).toFixed(2)),
    }
    return [layer, metric]
  })) as Record<CosGoldenEvaluationLayer, CosGoldenCoverageMetric>
}

function emptySnapshot(conversationId: string): CosConversationSnapshot {
  return {
    schemaVersion: 1,
    conversationId,
    recentMessages: [],
    activeWorkflow: null,
    pendingInput: null,
    currentTopic: null,
    recentTopics: [],
    activeEntities: {},
    recentEntities: [],
    recentResults: [],
    selectionSets: [],
    lastAction: null,
    lastExecution: null,
    temporalContext: {
      today: "2026-08-15",
      references: {
        today: { from: "2026-08-15T00:00:00.000Z", to: "2026-08-15T23:59:59.999Z" },
        tomorrow: { from: "2026-08-16T00:00:00.000Z", to: "2026-08-16T23:59:59.999Z" },
        yesterday: { from: "2026-08-14T00:00:00.000Z", to: "2026-08-14T23:59:59.999Z" },
      },
    },
    workspace: null,
    updatedAt: NOW,
  }
}

function buildEntity(seed: NonNullable<CosGoldenStatePatch["activate"]>, source: CosConversationEntityReference["source"] = "execution"): CosConversationEntityReference {
  return {
    type: seed.type,
    id: seed.id,
    label: seed.label,
    source,
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "golden_fixture",
  }
}

function createPendingWorkflow(input: {
  conversationId: string
  sequence: number
  seed: NonNullable<CosGoldenStatePatch["pending"]>
}) {
  const descriptor = getCosCapabilityDescriptorById(input.seed.capabilityId as never)
  if (!descriptor) throw new Error(`Golden pending capability inexistente: ${input.seed.capabilityId}`)
  const pendingInput: CosPendingInput = {
    schemaVersion: 2,
    createdAt: NOW,
    expiresAt: FUTURE,
    source: input.seed.type === "confirmation" ? "confirmation" : "handler",
    reason: "golden_fixture",
    capabilityId: descriptor.id,
    field: input.seed.field,
    label: input.seed.label,
    type: input.seed.type,
    required: true,
    entity: input.seed.entity,
    action: descriptor.action,
    parsedData: input.seed.parsedData ?? {},
    options: input.seed.options,
  }
  const workflow: CosWorkflow = {
    id: `golden-workflow-${input.sequence}`,
    conversationId: input.conversationId,
    status: "awaiting_input",
    executionPlan: {
      id: `golden-plan-${input.sequence}`,
      source: "single",
      reason: "golden_fixture",
      message: "",
      requestedAction: descriptor.action,
      surface: "portal",
      workspace: null,
      unresolvedGoals: [],
    },
    currentStep: 0,
    steps: [{
      id: `golden-step-${input.sequence}`,
      order: 0,
      entity: input.seed.entity,
      capabilityId: descriptor.id,
      action: descriptor.action,
      status: "awaiting_input",
      dependsOn: [],
      durationMs: null,
      errorMessage: null,
      resultResponse: null,
      resultMetadata: null,
    }],
    pendingInput,
    startedAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    pausedAt: NOW,
    totalPausedMs: 0,
  }
  return { workflow, pendingInput }
}

function applyStatePatch(state: MutableConversationState, patch: CosGoldenStatePatch | undefined) {
  if (!patch) return
  state.sequence += 1

  if (Object.prototype.hasOwnProperty.call(patch, "activate")) {
    if (patch.activate) {
      const entity = buildEntity(patch.activate)
      state.snapshot.activeEntities = { ...state.snapshot.activeEntities, [entity.type]: entity }
      state.snapshot.recentEntities = [entity, ...state.snapshot.recentEntities.filter((item) => item.id !== entity.id)].slice(0, 8)
    } else {
      state.snapshot.activeEntities = {}
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "selection")) {
    if (patch.selection) {
      const id = `golden-selection-${state.sequence}`
      state.snapshot.selectionSets = [{
        id,
        type: patch.selection.type,
        items: patch.selection.items.map((item, index) => ({
          index: index + 1,
          entity: buildEntity({ type: patch.selection!.type, id: item.id, label: item.label }, "selection"),
          ...(item.description ? { description: item.description } : {}),
        })),
        query: patch.selection.query,
        topicId: null,
        createdAt: NOW,
        expiresAt: FUTURE,
      }, ...state.snapshot.selectionSets].slice(0, 6)
    } else {
      state.snapshot.selectionSets = []
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "topic")) {
    if (patch.topic) {
      const previous = state.snapshot.currentTopic
      const selectionSetId = patch.topic.useLatestSelection ? state.snapshot.selectionSets[0]?.id ?? null : null
      state.snapshot.currentTopic = {
        id: `golden-topic-${state.sequence}`,
        domain: patch.topic.domain,
        label: patch.topic.label,
        entityType: patch.topic.entityType ?? null,
        selectionSetId,
        startedAt: NOW,
        lastMentionedAt: NOW,
      }
      if (selectionSetId && state.snapshot.selectionSets[0]) {
        state.snapshot.selectionSets[0] = { ...state.snapshot.selectionSets[0], topicId: state.snapshot.currentTopic.id }
      }
      if (previous) {
        state.snapshot.recentTopics = [previous, ...state.snapshot.recentTopics.filter((topic) => topic.id !== previous.id)].slice(0, 4)
      }
    } else {
      state.snapshot.currentTopic = null
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "pending")) {
    if (patch.pending) {
      const pending = createPendingWorkflow({
        conversationId: state.snapshot.conversationId,
        sequence: state.sequence,
        seed: patch.pending,
      })
      state.activeWorkflow = pending.workflow
      state.snapshot.activeWorkflow = pending.workflow
      state.snapshot.pendingInput = pending.pendingInput
    } else {
      state.activeWorkflow = null
      state.snapshot.activeWorkflow = null
      state.snapshot.pendingInput = null
    }
  }
  state.snapshot.updatedAt = NOW
}

function addRecentTurn(state: MutableConversationState, message: string, action: string | null, status: string) {
  state.snapshot.recentMessages = [...state.snapshot.recentMessages, {
    id: `golden-message-${state.sequence}-${state.snapshot.recentMessages.length + 1}`,
    userMessage: message,
    assistantResponse: null,
    action: action as never,
    status,
    leadId: state.snapshot.activeEntities.lead?.id ?? null,
    propertyId: state.snapshot.activeEntities.property?.id ?? null,
    metadata: {},
    createdAt: NOW,
  }].slice(-12)
}

function createAccumulator(): MetricAccumulator {
  return { evaluated: 0, passed: 0 }
}

function recordMetric(accumulator: MetricAccumulator, passed: boolean) {
  accumulator.evaluated += 1
  if (passed) accumulator.passed += 1
}

function finalizeMetric(accumulator: MetricAccumulator): CosEvalMetric {
  const failed = accumulator.evaluated - accumulator.passed
  return {
    evaluated: accumulator.evaluated,
    passed: accumulator.passed,
    failed,
    accuracy: accumulator.evaluated === 0 ? 100 : Number(((accumulator.passed / accumulator.evaluated) * 100).toFixed(2)),
  }
}

function addFailure(input: Omit<CosGoldenFailure, "suite"> & { suite: CosGoldenFailure["suite"] }, failures: CosGoldenFailure[]) {
  failures.push(input)
}

async function runGoldenConversations(conversationFixtures: CosGoldenConversation[] = cosGoldenConversations) {
  const dialogueAct = createAccumulator()
  const domain = createAccumulator()
  const capabilityReference = createAccumulator()
  const capability = createAccumulator()
  const referenceResolution = createAccumulator()
  const contextContinuity = createAccumulator()
  const knowledge = createAccumulator()
  const safety = createAccumulator()
  const conversation = createAccumulator()
  const failures: CosGoldenFailure[] = []
  const caseResults: CosGoldenCaseResult[] = []
  let turns = 0

  for (const scenario of conversationFixtures) {
    const state: MutableConversationState = {
      snapshot: emptySnapshot(scenario.id),
      activeWorkflow: null,
      sequence: 0,
    }
    applyStatePatch(state, scenario.initial)
    let conversationPassed = true
    const layerResults = createLayerResults(scenario)

    for (const [turnIndex, turn] of scenario.turns.entries()) {
      turns += 1
      state.sequence += 1
      const decision = resolveCosDialogueDecision({
        message: turn.message,
        surface: "portal",
        workspace: null,
        snapshot: state.snapshot,
        activeWorkflow: state.activeWorkflow,
        memory: null,
        attachments: [],
      })

      const expectedPrimaryDomain = turn.expected.primaryDomain ?? turn.expected.domain ?? "general"
      const expectedSecondaryDomains = turn.expected.secondaryDomains ?? []
      const actCheck = { label: "dialogue act", expected: turn.expected.act, actual: decision.dialogueAct }
      const primaryDomainPassed = expectedPrimaryDomain === decision.primaryDomain
      const secondaryDomainsPassed = expectedSecondaryDomains.every((item) => decision.secondaryDomains.includes(item as never))
      const domainCheck = {
        label: "domínio",
        expected: [expectedPrimaryDomain, ...expectedSecondaryDomains].join("+") || "general",
        actual: [decision.primaryDomain, ...decision.secondaryDomains].join("+") || "general",
        passed: primaryDomainPassed && secondaryDomainsPassed,
      }
      const basicRoutingChecks = [
        { ...actCheck, passed: actCheck.expected === actCheck.actual, layer: "dialogue_act" as const, accumulator: dialogueAct },
        { ...domainCheck, layer: "domain" as const, accumulator: domain },
      ]
      for (const check of basicRoutingChecks) {
        recordLayerResult(layerResults, check.layer, check.passed, turnIndex + 1, String(check.expected), String(check.actual))
        recordMetric(check.accumulator, check.passed)
        if (!check.passed) {
          conversationPassed = false
          addFailure({ suite: "routing", caseId: scenario.id, turn: turnIndex + 1, message: turn.message, expected: `${check.label}=${check.expected}`, actual: `${check.label}=${check.actual}` }, failures)
        }
      }

      const usesV11CapabilityOracle =
        Object.prototype.hasOwnProperty.call(turn.expected, "referencedCapabilityId") ||
        Object.prototype.hasOwnProperty.call(turn.expected, "referencedProductFunction") ||
        Object.prototype.hasOwnProperty.call(turn.expected, "selectedCapabilityId") ||
        Object.prototype.hasOwnProperty.call(turn.expected, "executedCapabilityId")
      const hasLegacyCapabilityExpectation = Object.prototype.hasOwnProperty.call(turn.expected, "capabilityId")
      const hasReferencedCapabilityExpectation = Object.prototype.hasOwnProperty.call(turn.expected, "referencedCapabilityId")
      const canEvaluateCapabilityReference = hasReferencedCapabilityExpectation && turn.expected.referencedCapabilityId !== null
      const referencedCapabilityCheck = {
        label: "capability referenciada",
        expected: turn.expected.referencedCapabilityId ?? null,
        actual: decision.objective.targetCapabilityId,
      }
      if (canEvaluateCapabilityReference) {
        const passed = referencedCapabilityCheck.expected === referencedCapabilityCheck.actual
        recordLayerResult(layerResults, "capability_reference", passed, turnIndex + 1, String(referencedCapabilityCheck.expected), String(referencedCapabilityCheck.actual))
        recordMetric(capabilityReference, passed)
        if (!passed) {
          conversationPassed = false
          addFailure({ suite: "routing", caseId: scenario.id, turn: turnIndex + 1, message: turn.message, expected: `${referencedCapabilityCheck.label}=${referencedCapabilityCheck.expected}`, actual: `${referencedCapabilityCheck.label}=${referencedCapabilityCheck.actual}` }, failures)
        }
      }

      const hasSelectedCapabilityExpectation = usesV11CapabilityOracle
        ? Object.prototype.hasOwnProperty.call(turn.expected, "selectedCapabilityId")
        : hasLegacyCapabilityExpectation
      const expectedSelectedCapabilityId = usesV11CapabilityOracle
        ? turn.expected.selectedCapabilityId ?? null
        : turn.expected.capabilityId ?? null
      const actualSelectedCapabilityId = usesV11CapabilityOracle && ["respond", "explain", "clarify"].includes(decision.objective.mode)
        ? null
        : decision.selectedCapabilityId
      const capabilityCheck = {
        label: "capability selecionada",
        expected: expectedSelectedCapabilityId,
        actual: actualSelectedCapabilityId,
      }
      const capabilityPassed = !hasSelectedCapabilityExpectation || capabilityCheck.expected === capabilityCheck.actual
      if (hasSelectedCapabilityExpectation) {
        recordLayerResult(layerResults, "capability_selection", capabilityPassed, turnIndex + 1, String(capabilityCheck.expected), String(capabilityCheck.actual))
        recordMetric(capability, capabilityPassed)
        if (!capabilityPassed) {
          conversationPassed = false
          addFailure({ suite: "routing", caseId: scenario.id, turn: turnIndex + 1, message: turn.message, expected: `${capabilityCheck.label}=${capabilityCheck.expected}`, actual: `${capabilityCheck.label}=${capabilityCheck.actual}` }, failures)
        }
      }

      const hasReferenceExpectation = Object.prototype.hasOwnProperty.call(turn.expected, "referenceId")
      const referencePassed = !hasReferenceExpectation || (turn.expected.referenceId ?? null) === decision.reference.id
      if (hasReferenceExpectation) {
        recordLayerResult(
          layerResults,
          "reference_resolution",
          referencePassed,
          turnIndex + 1,
          turn.expected.referenceId ?? "nenhuma",
          decision.reference.id ?? "nenhuma",
        )
        recordLayerResult(
          layerResults,
          "entity_resolution",
          referencePassed,
          turnIndex + 1,
          turn.expected.referenceId ?? "nenhuma",
          decision.reference.id ?? "nenhuma",
        )
        recordMetric(referenceResolution, referencePassed)
        if (!referencePassed) {
          conversationPassed = false
          addFailure({ suite: "context", caseId: scenario.id, turn: turnIndex + 1, message: turn.message, expected: `referência=${turn.expected.referenceId ?? "nenhuma"}`, actual: `referência=${decision.reference.id ?? "nenhuma"}` }, failures)
        }
      }

      if (turnIndex > 0 || scenario.initial) {
        const contextPassed =
          actCheck.expected === actCheck.actual &&
          domainCheck.passed &&
          capabilityPassed &&
          referencePassed
        recordMetric(contextContinuity, contextPassed)
        recordLayerResult(layerResults, "context_continuity", contextPassed, turnIndex + 1, "continuidade preservada", contextPassed ? "preservada" : "divergente")
        if (!contextPassed) conversationPassed = false
      }

      if (turn.expected.knowledgeDocuments || turn.expected.knowledgeTextIncludes || typeof turn.expected.knowledgeMiss === "boolean") {
        const retrieved = await retrieveCosKnowledge({ message: turn.message, decision })
        const actualDocuments = retrieved.selectedDocuments.map((document) => document.id)
        const actualKnowledgeText = retrieved.chunks.map((chunk) => chunk.text).join("\n").toLocaleLowerCase("pt-BR")
        const docsPassed = (turn.expected.knowledgeDocuments ?? []).every((documentId) => actualDocuments.includes(documentId))
        const textPassed = (turn.expected.knowledgeTextIncludes ?? []).every((fragment) =>
          actualKnowledgeText.includes(fragment.toLocaleLowerCase("pt-BR")),
        )
        const missPassed = typeof turn.expected.knowledgeMiss !== "boolean" || retrieved.knowledgeMiss === turn.expected.knowledgeMiss
        recordMetric(knowledge, docsPassed && textPassed && missPassed)
        recordLayerResult(
          layerResults,
          "knowledge_correctness",
          docsPassed && textPassed && missPassed,
          turnIndex + 1,
          `docs=${(turn.expected.knowledgeDocuments ?? []).join(",") || "nenhum"}`,
          `docs=${actualDocuments.join(",") || "nenhum"}`,
        )
        if (!docsPassed || !textPassed || !missPassed) {
          conversationPassed = false
          addFailure({ suite: "knowledge", caseId: scenario.id, turn: turnIndex + 1, message: turn.message, expected: `docs=${(turn.expected.knowledgeDocuments ?? []).join(",") || "nenhum"}; trechos=${(turn.expected.knowledgeTextIncludes ?? []).join(" | ") || "não exigidos"}; miss=${turn.expected.knowledgeMiss ?? "não exigido"}`, actual: `docs=${actualDocuments.join(",") || "nenhum"}; trechos=${textPassed ? "presentes" : "ausentes"}; miss=${retrieved.knowledgeMiss}` }, failures)
        }
      }

      if (typeof turn.expected.shouldMutate === "boolean" || typeof turn.expected.requiresConfirmation === "boolean" || typeof turn.expected.shouldClarify === "boolean") {
        const descriptor = decision.selectedCapabilityId ? getCosCapabilityDescriptorById(decision.selectedCapabilityId) : null
        const operationalAct = ["execute", "correct", "confirm", "provide_input", "select"].includes(decision.dialogueAct)
        const actualMutates = Boolean(descriptor?.mutatesData && operationalAct)
        const checks = [
          ...(typeof turn.expected.shouldMutate === "boolean" ? [{ label: "mutação", expected: turn.expected.shouldMutate, actual: actualMutates }] : []),
          ...(typeof turn.expected.requiresConfirmation === "boolean" ? [{ label: "confirmação", expected: turn.expected.requiresConfirmation, actual: descriptor?.requiresConfirmation ?? false }] : []),
          ...(typeof turn.expected.shouldClarify === "boolean" ? [{ label: "clarificação", expected: turn.expected.shouldClarify, actual: decision.needsClarification }] : []),
        ]
        for (const check of checks) {
          const passed = check.expected === check.actual
          const layer = check.label === "confirmação"
            ? "confirmation"
            : check.label === "clarificação"
              ? "pending_input"
              : null
          if (layer) recordLayerResult(layerResults, layer, passed, turnIndex + 1, String(check.expected), String(check.actual))
          recordMetric(safety, passed)
          if (!passed) {
            conversationPassed = false
            addFailure({ suite: "safety", caseId: scenario.id, turn: turnIndex + 1, message: turn.message, expected: `${check.label}=${check.expected}`, actual: `${check.label}=${check.actual}` }, failures)
          }
        }
      }

      addRecentTurn(state, turn.message, decision.selectedAction, decision.needsClarification ? "needs_clarification" : "success")
      applyStatePatch(state, turn.after)
    }

    recordMetric(conversation, conversationPassed)
    const requiredLayerResults = [...layerResults.values()]
    const status = requiredLayerResults.some((result) => result.status === "fail")
      ? "fail"
      : requiredLayerResults.some((result) => result.status === "not_evaluated")
        ? "incomplete"
        : "pass"
    caseResults.push({
      id: scenario.id,
      baseScenarioId: scenario.baseScenarioId ?? scenario.id,
      sourceNumber: scenario.sourceNumber ?? scenario.id,
      title: scenario.title ?? scenario.description,
      classifications: scenario.classifications ?? [],
      priorities: scenario.priorities ?? [],
      status,
      firstFailureTurn: requiredLayerResults
        .filter((result) => result.status === "fail" && result.turn !== null)
        .map((result) => result.turn as number)
        .sort((left, right) => left - right)[0] ?? null,
      knownGap: scenario.assertions?.knownGap ?? null,
      knownGapLayer: scenario.assertions?.knownGapLayer ?? null,
      forbiddenBehaviors: scenario.assertions?.forbidden ?? [],
      layers: requiredLayerResults,
    })
  }

  return {
    scenarios: conversationFixtures.length,
    turns,
    metrics: {
      dialogueAct: finalizeMetric(dialogueAct),
      domain: finalizeMetric(domain),
      capabilityReference: finalizeMetric(capabilityReference),
      capability: finalizeMetric(capability),
      referenceResolution: finalizeMetric(referenceResolution),
      contextContinuity: finalizeMetric(contextContinuity),
      knowledge: finalizeMetric(knowledge),
      safety: finalizeMetric(safety),
      conversation: finalizeMetric(conversation),
    },
    coverageMetrics: finalizeCoverageMetrics(caseResults),
    caseResults,
    failures,
  }
}

function fixtureResult(status: "success" | "awaiting_input" | "error", response: string, metadata: Prisma.InputJsonObject = {}): CosRuntimeActionResult {
  if (status === "success") return { status, response, metadata }
  if (status === "error") return { status, response, metadata, errorCode: "COS_EVAL_FIXTURE_ERROR" }
  const pendingInput: CosPendingInput = {
    schemaVersion: 2,
    createdAt: NOW,
    expiresAt: FUTURE,
    source: "handler",
    reason: "golden_fixture",
    capabilityId: "lead.create",
    field: "phone",
    label: "Telefone",
    type: "phone",
    required: true,
    entity: "lead",
    action: "createLead",
    parsedData: { extractedName: "Marina" },
  }
  return { status, response, metadata: { pendingInput: pendingInput as unknown as Prisma.InputJsonObject }, pendingInput }
}

function buildFixtureStep(input: {
  planId: string
  order: number
  capabilityId: string
  dependsOn?: string[]
  handler: CosCapabilityHandler
}): CosExecutionStep {
  const descriptor = getCosCapabilityDescriptorById(input.capabilityId as never)
  if (!descriptor) throw new Error(`Capability de fixture inexistente: ${input.capabilityId}`)
  const entity = getCosEntityModuleIdByCapabilityId(descriptor.id) ?? "general"
  const id = `${input.planId}:step:${input.order + 1}`
  return {
    id,
    order: input.order,
    entity,
    capabilityId: descriptor.id,
    action: descriptor.action,
    status: "pending",
    dependsOn: input.dependsOn ?? [],
    durationMs: null,
    result: null,
    errorMessage: null,
    plan: {
      action: descriptor.action,
      payload: {},
      pendingInput: null,
      context: null,
      workspace: null,
      capability: { ...descriptor, handler: input.handler },
      capabilityId: descriptor.id,
      entity,
      confidence: 1,
      source: "catalog",
      reason: "golden_execution_fixture",
      contextOrigin: "catalog",
      telemetry: {
        capabilityId: descriptor.id,
        entity,
        confidence: 1,
        source: "catalog",
        reason: "golden_execution_fixture",
        fallbackUsed: false,
        pendingInputUsed: false,
        surface: "portal",
        resolutionMs: 0,
        requestedAction: descriptor.action,
        contextOrigin: "catalog",
        workspaceReceived: false,
        workspacePage: null,
        workspaceEntity: null,
        workspaceEntityId: null,
        workspaceEntityUsed: null,
        workspaceEntityIdUsed: null,
      },
    },
  }
}

function fixturePlan(planId: string, steps: CosExecutionStep[]): CosExecutionPlan {
  return {
    id: planId,
    source: steps.length > 1 ? "recipe" : "single",
    reason: "golden_execution_fixture",
    status: "pending",
    message: "fixture de execução",
    surface: "portal",
    workspace: null,
    pendingInput: null,
    context: null,
    primaryStep: steps[0],
    steps,
    unresolvedGoals: [],
    requiresConfirmation: false,
    confirmationMessage: null,
    telemetry: {
      planId,
      source: steps.length > 1 ? "recipe" : "single",
      planner: "deterministic",
      reason: "golden_execution_fixture",
      surface: "portal",
      stepCount: steps.length,
      steps: steps.map((step) => ({
        id: step.id,
        capabilityId: step.capabilityId,
        action: step.action,
        entity: step.entity,
        source: "catalog",
        mutatesData: step.plan.capability.mutatesData,
        requiresConfirmation: step.plan.capability.requiresConfirmation,
      })),
      unresolvedGoals: [],
      requestedAction: null,
      messageLength: 20,
      workspaceReceived: false,
      workspaceEntity: null,
      workspaceEntityId: null,
      contextOrigin: "catalog",
      resolutionMs: 0,
      orchestrator: null,
    },
  }
}

async function runExecutionFixtures() {
  const results: ExecutionFixtureResult[] = []
  const run = async (input: {
    id: string
    steps: CosExecutionStep[]
    expectedStatus: "completed" | "awaiting_input" | "failed"
    verify?: (result: Awaited<ReturnType<typeof executeCosExecutionPlan>>) => boolean
  }) => {
    const result = await executeCosExecutionPlan({
      plan: fixturePlan(input.id, input.steps),
      brokerId: "golden-broker",
      userId: "golden-user",
      message: "fixture de execução",
      confirm: true,
      payload: {},
    })
    const passed = result.status === input.expectedStatus && (input.verify?.(result) ?? true)
    results.push({ id: input.id, passed, expected: input.expectedStatus, actual: result.status })
    return result
  }

  const successHandler: CosCapabilityHandler = async () => ({
    ...fixtureResult("success", "Cliente cadastrado."),
    leadId: "lead-fixture",
  })
  const queryHandler = async () => fixtureResult("success", "Encontrei 3 clientes.", { total: 3 })
  const updateHandler = async () => fixtureResult("success", "Cliente atualizado.", { updated: true })
  const awaitingHandler = async () => fixtureResult("awaiting_input", "Qual é o telefone da Marina?")
  const errorHandler = async () => fixtureResult("error", "Não consegui salvar a alteração.")

  await run({ id: "execution-create", steps: [buildFixtureStep({ planId: "execution-create", order: 0, capabilityId: "lead.create", handler: successHandler })], expectedStatus: "completed", verify: (result) => result.completedSteps.length === 1 })
  await run({ id: "execution-query", steps: [buildFixtureStep({ planId: "execution-query", order: 0, capabilityId: "lead.summary", handler: queryHandler })], expectedStatus: "completed", verify: (result) => result.metadata.steps !== undefined })
  await run({ id: "execution-update", steps: [buildFixtureStep({ planId: "execution-update", order: 0, capabilityId: "lead.update", handler: updateHandler })], expectedStatus: "completed" })

  let confirmationObserved = false
  const confirmationHandler: CosCapabilityHandler = async (input) => {
    confirmationObserved = input.confirm === true
    return fixtureResult("success", "Imóvel publicado.")
  }
  await run({
    id: "execution-confirmation",
    steps: [buildFixtureStep({ planId: "execution-confirmation", order: 0, capabilityId: "property.publish", handler: confirmationHandler })],
    expectedStatus: "completed",
    verify: () => confirmationObserved,
  })

  const cancellationKind = classifyCosPendingReply("cancelar")
  results.push({
    id: "execution-cancellation",
    passed: cancellationKind === "cancel",
    expected: "cancel",
    actual: cancellationKind,
  })

  await run({ id: "execution-awaiting", steps: [buildFixtureStep({ planId: "execution-awaiting", order: 0, capabilityId: "lead.create", handler: awaitingHandler })], expectedStatus: "awaiting_input", verify: (result) => result.interruptedStep?.result?.status === "awaiting_input" })
  await run({ id: "execution-error", steps: [buildFixtureStep({ planId: "execution-error", order: 0, capabilityId: "lead.update", handler: errorHandler })], expectedStatus: "failed", verify: (result) => result.interruptedStep?.result?.status === "error" })

  let dependentReceivedLead = false
  const first = buildFixtureStep({ planId: "execution-dependency", order: 0, capabilityId: "lead.create", handler: successHandler })
  const second = buildFixtureStep({
    planId: "execution-dependency",
    order: 1,
    capabilityId: "proposal.create",
    dependsOn: [first.id],
    handler: async (input) => {
      dependentReceivedLead = input.payload?.leadId === "lead-fixture"
      return fixtureResult("success", "Proposta criada.", { documentId: "proposal-fixture" })
    },
  })
  await run({ id: "execution-dependency", steps: [first, second], expectedStatus: "completed", verify: (result) => dependentReceivedLead && result.completedSteps.length === 2 })

  let blockedCalls = 0
  const failing = buildFixtureStep({ planId: "execution-block", order: 0, capabilityId: "lead.create", handler: errorHandler })
  const blocked = buildFixtureStep({
    planId: "execution-block",
    order: 1,
    capabilityId: "proposal.create",
    dependsOn: [failing.id],
    handler: async () => {
      blockedCalls += 1
      return fixtureResult("success", "Não deveria executar.")
    },
  })
  await run({ id: "execution-block", steps: [failing, blocked], expectedStatus: "failed", verify: () => blockedCalls === 0 })

  const thrown = buildFixtureStep({
    planId: "execution-throw",
    order: 0,
    capabilityId: "lead.update",
    handler: async () => { throw new Error("provider secret detail") },
  })
  await run({ id: "execution-throw", steps: [thrown], expectedStatus: "failed", verify: (result) => result.completedSteps.length === 0 })

  return results
}

async function runResponseFixtures() {
  const results: ExecutionFixtureResult[] = []
  const push = (id: string, passed: boolean, expected: string, actual: string) => results.push({ id, passed, expected, actual })

  const confirmation = buildCosConfirmationResponseViewModel({
    action: "DELETE_LEAD",
    capabilityTitle: "Excluir cliente",
    prompt: "Posso excluir o cliente João? Essa ação não pode ser desfeita.",
  })
  push("response-confirmation", confirmation.kind === "confirmation_required" && !TECHNICAL_OUTPUT.test(confirmation.text), "confirmação natural", confirmation.text)

  const cancelled = buildCosSimpleResponseViewModel({ kind: "cancelled", text: "Tudo bem. Não executei a alteração." })
  push("response-cancelled", cancelled.kind === "cancelled", "cancelled", cancelled.kind)

  const warning = buildCosSimpleResponseViewModel({ kind: "warning", text: "Não encontrei informação suficiente para responder com segurança." })
  push("response-warning", warning.kind === "warning", "warning", warning.kind)

  const explain = buildCosSimpleResponseViewModel({ kind: "explanation", text: "O Catálogo é individual; o Marketplace reúne imóveis e corretores do EME." })
  push("response-explanation", explain.kind === "explanation" && explain.text.includes("Marketplace"), "explanation", explain.kind)

  const capabilityQuestion = buildCosSimpleResponseViewModel({
    kind: "explanation",
    text: "Consigo cadastrar clientes. Se quiser, me informe o nome para começarmos.",
  })
  push(
    "response-capability-question",
    capabilityQuestion.kind === "explanation" && !TECHNICAL_OUTPUT.test(capabilityQuestion.text),
    "capacidade explicada sem executar",
    capabilityQuestion.text,
  )

  const query = buildCosSimpleResponseViewModel({ kind: "query_result", text: "Encontrei três imóveis em Gramado." })
  push("response-query", query.kind === "query_result", "query_result", query.kind)

  const error = buildCosSimpleResponseViewModel({ kind: "error", text: "Não consegui salvar a alteração. Quer tentar novamente?" })
  push("response-error", error.kind === "error" && !TECHNICAL_OUTPUT.test(error.text), "erro seguro", error.text)

  const selection = buildCosSimpleResponseViewModel({ kind: "selection", text: "Encontrei dois clientes chamados João. Qual deles?" })
  push("response-selection", selection.kind === "selection", "selection", selection.kind)

  const localeSamples = [
    getCosDomainLabel("property"),
    getCosDomainLabel("agenda"),
    getCosStatusLabel("workflow", "completed"),
    getCosStatusLabel("workflow", "failed"),
    getCosStatusLabel("contract", "awaiting_signature"),
  ]
  for (const [index, text] of localeSamples.entries()) {
    push(`localization-${index + 1}`, !TECHNICAL_OUTPUT.test(text) && !MOJIBAKE_OUTPUT.test(text), "pt-BR sem enum/mojibake", text)
  }

  const successStep = buildFixtureStep({ planId: "response-success", order: 0, capabilityId: "lead.create", handler: async () => fixtureResult("success", "Cliente Ana cadastrado.") })
  const successPlan = fixturePlan("response-success", [successStep])
  const successResult = await executeCosExecutionPlan({ plan: successPlan, brokerId: "golden-broker", userId: "golden-user", message: "Cadastre Ana", confirm: true })
  const successView = buildCosExecutionResponseViewModel({ message: "Cadastre Ana", plan: successPlan, result: successResult })
  push("response-execution-success", successView.kind === "success" && successView.text.includes("Ana"), "success com fato", successView.text)

  const pendingStep = buildFixtureStep({ planId: "response-pending", order: 0, capabilityId: "lead.create", handler: async () => fixtureResult("awaiting_input", "Qual é o telefone da Marina?") })
  const pendingPlan = fixturePlan("response-pending", [pendingStep])
  const pendingResult = await executeCosExecutionPlan({ plan: pendingPlan, brokerId: "golden-broker", userId: "golden-user", message: "Cadastre Marina", confirm: true })
  const pendingView = buildCosExecutionResponseViewModel({ message: "Cadastre Marina", plan: pendingPlan, result: pendingResult })
  push("response-pending", pendingView.kind === "awaiting_input" && pendingView.pending?.field === "phone", "pending estruturado", pendingView.kind)

  const failureStep = buildFixtureStep({ planId: "response-failure", order: 0, capabilityId: "lead.update", handler: async () => fixtureResult("error", "Prisma P2025 stack trace") })
  const failurePlan = fixturePlan("response-failure", [failureStep])
  const failureResult = await executeCosExecutionPlan({ plan: failurePlan, brokerId: "golden-broker", userId: "golden-user", message: "Atualize", confirm: true })
  const failureView = buildCosExecutionResponseViewModel({ message: "Atualize", plan: failurePlan, result: failureResult })
  push("response-failure-redaction", failureView.kind === "error" && !failureView.text.includes("Prisma") && !failureView.text.includes("P2025"), "erro sem detalhe técnico", failureView.text)

  const multiFirst = buildFixtureStep({
    planId: "response-multi-step",
    order: 0,
    capabilityId: "lead.create",
    handler: async () => ({ ...fixtureResult("success", "Cadastrei a Ana."), leadId: "lead-ana" }),
  })
  const multiSecond = buildFixtureStep({
    planId: "response-multi-step",
    order: 1,
    capabilityId: "proposal.create",
    dependsOn: [multiFirst.id],
    handler: async () => fixtureResult("success", "Criei a proposta para o imóvel da Rua X."),
  })
  const multiPlan = fixturePlan("response-multi-step", [multiFirst, multiSecond])
  const multiResult = await executeCosExecutionPlan({
    plan: multiPlan,
    brokerId: "golden-broker",
    userId: "golden-user",
    message: "Cadastre a Ana e crie a proposta.",
    confirm: true,
  })
  const multiView = buildCosExecutionResponseViewModel({
    message: "Cadastre a Ana e crie a proposta.",
    plan: multiPlan,
    result: multiResult,
  })
  push(
    "response-multi-step",
    multiView.kind === "success" && multiView.completedSteps?.length === 2 && !TECHNICAL_OUTPUT.test(multiView.text),
    "resumo factual dos dois passos",
    multiView.text,
  )

  return results
}

function metricFromFixtureResults(results: ExecutionFixtureResult[]) {
  return finalizeMetric({
    evaluated: results.length,
    passed: results.filter((result) => result.passed).length,
  })
}

export async function runCosSystemEvalSuite() {
  const goldenV1Validation = validateCosGoldenV1Dataset()
  const invalidDatasetEntries = [
    ...goldenV1Validation.duplicateIds,
    ...goldenV1Validation.invalidConversationIds,
    ...goldenV1Validation.invalidCapabilityRefs,
    ...goldenV1Validation.unresolvedPlaceholders,
    ...goldenV1Validation.unsafeKnowledgeCases,
    ...goldenV1Validation.unsafeProductGapCases,
    ...goldenV1Validation.conflatedCapabilityOracle,
    ...goldenV1Validation.p0WithoutStateOrTrace,
    ...goldenV1Validation.invalidOracleAuditCaseIds,
  ]
  if (
    goldenV1Validation.baseScenarios !== goldenV1Validation.expectedBaseScenarios ||
    goldenV1Validation.executableCases !== goldenV1Validation.expectedExecutableCases ||
    invalidDatasetEntries.length > 0
  ) {
    throw new Error(`Golden V1 inválido: ${invalidDatasetEntries.join(", ") || "contagens divergentes"}`)
  }

  const [legacyRouting, legacyConversations, goldenV1, execution, response] = await Promise.all([
    runCosEvalSuite(),
    runGoldenConversations(),
    runGoldenConversations(cosGoldenV1Conversations),
    runExecutionFixtures(),
    runResponseFixtures(),
  ])
  const responseOnly = response.filter((item) => !item.id.startsWith("localization-"))
  const localizationOnly = response.filter((item) => item.id.startsWith("localization-"))
  const executionFailures: CosGoldenFailure[] = execution.filter((item) => !item.passed).map((item) => ({
    suite: "execution",
    caseId: item.id,
    turn: null,
    message: item.id,
    expected: item.expected,
    actual: item.actual,
  }))
  const responseFailures: CosGoldenFailure[] = responseOnly.filter((item) => !item.passed).map((item) => ({
    suite: "response",
    caseId: item.id,
    turn: null,
    message: item.id,
    expected: item.expected,
    actual: item.actual,
  }))
  const localizationFailures: CosGoldenFailure[] = localizationOnly.filter((item) => !item.passed).map((item) => ({
    suite: "localization",
    caseId: item.id,
    turn: null,
    message: item.id,
    expected: item.expected,
    actual: item.actual,
  }))
  const allFailures = [...goldenV1.failures, ...executionFailures, ...responseFailures, ...localizationFailures]
  const classificationBreakdown = Object.fromEntries(
    ["SUPPORTED_NOW", "SUPPORTED_WITH_KNOWN_GAP", "PRODUCT_EXISTS_COS_GAP", "KNOWLEDGE_ONLY", "NOT_SUPPORTED"].map((classification) => [
      classification,
      goldenV1.caseResults.filter((item) => item.classifications.includes(classification as never)).length,
    ]),
  )
  const statusBreakdown = {
    pass: goldenV1.caseResults.filter((item) => item.status === "pass").length,
    fail: goldenV1.caseResults.filter((item) => item.status === "fail").length,
    incomplete: goldenV1.caseResults.filter((item) => item.status === "incomplete").length,
  }
  const failedLayerCounts = Object.fromEntries(GOLDEN_V1_LAYERS.map((layer) => [
    layer,
    goldenV1.caseResults.filter((item) => item.layers.some((result) => result.layer === layer && result.status === "fail")).length,
  ]))
  const knownGapFailures = goldenV1.caseResults.filter((item) => item.status === "fail" && item.knownGap)
  const newGapFailures = goldenV1.caseResults.filter((item) => item.status === "fail" && !item.knownGap)

  return {
    generatedAt: new Date().toISOString(),
    dataset: {
      legacySingleTurn: legacyRouting.totals.scenarios,
      legacyMultiTurnConversations: legacyConversations.scenarios,
      legacyMultiTurnTurns: legacyConversations.turns,
      baseScenarios: COS_GOLDEN_V1_METADATA.baseScenarioCount,
      executableCases: goldenV1.scenarios,
      goldenV1Turns: goldenV1.turns,
      executionFixtures: execution.length,
      responseFixtures: responseOnly.length,
      localizationFixtures: localizationOnly.length,
    },
    metrics: {
      dialogueActAccuracy: goldenV1.metrics.dialogueAct,
      domainAccuracy: goldenV1.metrics.domain,
      capabilityReferenceAccuracy: goldenV1.metrics.capabilityReference,
      capabilityAccuracy: goldenV1.metrics.capability,
      referenceResolution: goldenV1.metrics.referenceResolution,
      contextContinuity: goldenV1.metrics.contextContinuity,
      knowledgeRetrieval: goldenV1.metrics.knowledge,
      executionCorrectness: metricFromFixtureResults(execution),
      responseCorrectness: metricFromFixtureResults(responseOnly),
      localization: metricFromFixtureResults(localizationOnly),
      safetyInvariants: goldenV1.metrics.safety,
      deterministicConversationChecks: goldenV1.metrics.conversation,
      legacyRouting: {
        evaluated: legacyRouting.totals.scenarios,
        passed: legacyRouting.totals.passed,
        failed: legacyRouting.totals.failed,
        accuracy: legacyRouting.totals.successRate,
      },
    },
    failures: allFailures,
    topFailures: allFailures.slice(0, 50),
    goldenV1: {
      metadata: COS_GOLDEN_V1_METADATA,
      statusBreakdown,
      classificationBreakdown,
      layerMetrics: goldenV1.coverageMetrics,
      failedLayerCounts,
      knownGapFailureCases: knownGapFailures.map((item) => item.id),
      newGapFailureCases: newGapFailures.map((item) => item.id),
      sourceIssues: COS_GOLDEN_V1_METADATA.sourceIssues,
      cases: goldenV1.caseResults,
    },
    legacyConversational: {
      conversations: legacyConversations.scenarios,
      turns: legacyConversations.turns,
      metrics: legacyConversations.metrics,
      failures: legacyConversations.failures,
    },
    legacyRouting: {
      totals: legacyRouting.totals,
      metrics: legacyRouting.metrics,
      categoryBreakdown: legacyRouting.categoryBreakdown,
      topFailures: legacyRouting.topFailures,
    },
    fixtures: {
      execution,
      response,
    },
  }
}

export function buildCosSystemEvalMarkdownReport(report: Awaited<ReturnType<typeof runCosSystemEvalSuite>>) {
  const metricRows = Object.entries(report.metrics).map(([name, metric]) =>
    `| ${name} | ${metric.passed}/${metric.evaluated} | ${metric.accuracy}% | ${metric.failed} |`,
  )
  const layerRows = Object.entries(report.goldenV1.layerMetrics).map(([name, metric]) =>
    `| ${name} | ${metric.passed}/${metric.evaluated} | ${metric.accuracy === null ? "N/A" : `${metric.accuracy}%`} | ${metric.coverage === null ? "N/A" : `${metric.coverage}%`} | ${metric.notEvaluated} |`,
  )
  const oracleCategoryRows = Object.entries(report.goldenV1.metadata.oracleAudit.categories)
    .map(([category, count]) => `- \`${category}\`: ${count} cases.`)
  const structuralCauses = Object.entries(report.goldenV1.failedLayerCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([layer, count]) => `- \`${layer}\`: ${count} cases com falha.`)
  const failures = report.topFailures.length === 0
    ? ["- Nenhuma falha no conjunto atual."]
    : report.topFailures.flatMap((failure) => [
        `- **${failure.suite}/${failure.caseId}${failure.turn ? ` turno ${failure.turn}` : ""}** — ${failure.message}`,
        `  - esperado: ${failure.expected}`,
        `  - observado: ${failure.actual}`,
      ])

  return [
    "# COS — Baseline do Golden Conversation Scenarios V1",
    "",
    `Gerado em: ${report.generatedAt}`,
    "",
    "## Dataset",
    "",
    `- Routing legado single-turn: ${report.dataset.legacySingleTurn} casos.`,
    `- Golden V1: ${report.dataset.baseScenarios} cenários-base / ${report.dataset.executableCases} cases executáveis / ${report.dataset.goldenV1Turns} turnos.`,
    `- Golden anterior preservado: ${report.dataset.legacyMultiTurnConversations} conversas / ${report.dataset.legacyMultiTurnTurns} turnos.`,
    `- Execution fixtures no executor real: ${report.dataset.executionFixtures}.`,
    `- Response fixtures: ${report.dataset.responseFixtures}.`,
    `- Localization fixtures: ${report.dataset.localizationFixtures}.`,
    "",
    "## Auditoria do oracle V1.1",
    "",
    `- Cases auditados contra a fonte humana: ${report.goldenV1.metadata.oracleAudit.auditedExecutableCases}.`,
    `- Cases afetados pela ambiguidade estrutural do campo único de capability: ${report.goldenV1.metadata.oracleAudit.capabilitySchemaAmbiguityCases}.`,
    `- Cases com correção semântica além da separação mecânica do schema: ${report.goldenV1.metadata.oracleAudit.semanticCorrectionCases}.`,
    `- Oracle congelado: \`${report.goldenV1.metadata.frozen}\` em ${report.goldenV1.metadata.frozenAt}; versão \`${report.goldenV1.metadata.oracleVersion}\`.`,
    "",
    "Categorias afetadas (podem se sobrepor):",
    "",
    ...oracleCategoryRows,
    "",
    "## Resultado dos cases oficiais",
    "",
    `- Passaram integralmente: ${report.goldenV1.statusBreakdown.pass}.`,
    `- Falharam em ao menos uma camada avaliada: ${report.goldenV1.statusBreakdown.fail}.`,
    `- Incompletos por camada obrigatória não avaliada: ${report.goldenV1.statusBreakdown.incomplete}.`,
    `- Falhas associadas a gaps conhecidos: ${report.goldenV1.knownGapFailureCases.length}.`,
    `- Falhas fora dos gaps previamente anotados: ${report.goldenV1.newGapFailureCases.length}.`,
    `- Forbidden behaviors com observação executável: ${report.goldenV1.layerMetrics.forbidden_behaviors.evaluated}; não avaliados: ${report.goldenV1.layerMetrics.forbidden_behaviors.notEvaluated}.`,
    "",
    "Um case só passa integralmente quando todas as camadas obrigatórias são avaliadas e aprovadas. Camada sem oracle executável produz `incomplete`, nunca aprovação implícita.",
    "",
    "### Causas estruturais mais frequentes",
    "",
    ...structuralCauses,
    "",
    "## Cobertura e acurácia por camada do Golden V1",
    "",
    "| Camada | Aprovados/avaliados | Acurácia | Cobertura | Não avaliados |",
    "|---|---:|---:|---:|---:|",
    ...layerRows,
    "",
    "## Métricas determinísticas auxiliares",
    "",
    "| Métrica | Aprovados | Acurácia | Falhas |",
    "|---|---:|---:|---:|",
    ...metricRows,
    "",
    "Não existe média agregada: coverage e accuracy são separadas para impedir que uma camada não executada apareça como 100%.",
    "",
    "## Primeiras falhas observadas por turno/camada",
    "",
    ...failures,
    "",
    "## Inconsistências preservadas da fonte",
    "",
    ...report.goldenV1.sourceIssues.map((issue) => `- ${issue}`),
    "",
    "## Limitações metodológicas",
    "",
    "- O baseline determinístico não chama banco remoto nem provedores pagos.",
    "- Routing, referência, continuidade, retrieval e policies declarativas são avaliados contra componentes reais e puros.",
    "- Persistência Prisma, ledger de créditos, entitlement real, artefatos de provider e forbidden behaviors dependentes de side effect ficam `not_evaluated` até existir ambiente isolado e adapters seguros.",
    "- O estado `turn.after` organiza a conversa-fixture; ele não é aceito como prova de persistência.",
    "- Execution eval usa o executor real com handlers-fixture tipados e sem banco; não substitui validação transacional.",
    "- O relatório registra divergências; o runner não altera o expected para obter aprovação.",
    "",
  ].join("\n")
}

export function validateCosGoldenDataset(conversations: CosGoldenConversation[] = cosGoldenConversations) {
  const ids = conversations.map((conversation) => conversation.id)
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
  const invalid = conversations.filter((conversation) => conversation.turns.length < 2 && !conversation.tags.includes("single-context"))
  return {
    total: conversations.length,
    turns: conversations.reduce((sum, conversation) => sum + conversation.turns.length, 0),
    duplicateIds: [...new Set(duplicateIds)],
    invalidConversationIds: invalid.map((conversation) => conversation.id),
  }
}

export function validateCosGoldenV1Dataset(conversations: CosGoldenConversation[] = cosGoldenV1Conversations) {
  const ids = conversations.map((conversation) => conversation.id)
  const baseIds = conversations.map((conversation) => conversation.baseScenarioId ?? conversation.id)
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
  const invalidConversationIds = conversations
    .filter((conversation) =>
      conversation.turns.length === 0 ||
      !conversation.baseScenarioId ||
      !conversation.sourceNumber ||
      !conversation.title ||
      !conversation.classifications?.length ||
      !conversation.priorities?.length ||
      !conversation.domains?.length ||
      !conversation.requiredLayers?.length ||
      conversation.turns.some((turn) => !turn.expected.primaryDomain),
    )
    .map((conversation) => conversation.id)
  const invalidCapabilityRefs = conversations.flatMap((conversation) =>
    conversation.turns.flatMap((item, index) => {
      const capabilityIds = [
        item.expected.referencedCapabilityId,
        item.expected.selectedCapabilityId,
        item.expected.executedCapabilityId,
      ].filter((capabilityId): capabilityId is string => typeof capabilityId === "string")
      return capabilityIds.flatMap((capabilityId) => getCosCapabilityDescriptorById(capabilityId as never)
        ? []
        : [`${conversation.id}:turn-${index + 1}:${capabilityId}`])
    }),
  )
  const unresolvedPlaceholders = conversations.flatMap((conversation) =>
    conversation.turns.flatMap((item, index) => /\[\.\.\.\]|\[(?:dados|motivo|eventos) reais\]/i.test(item.message)
      ? [`${conversation.id}:turn-${index + 1}`]
      : []),
  )
  const unsafeKnowledgeCases = conversations
    .filter((conversation) => conversation.classifications?.includes("KNOWLEDGE_ONLY"))
    .filter((conversation) => conversation.turns.some((item) =>
      item.expected.shouldMutate === true ||
      item.expected.requiresConfirmation === true ||
      item.expected.selectedCapabilityId !== null ||
      item.expected.executedCapabilityId !== null,
    ))
    .map((conversation) => conversation.id)
  const unsafeProductGapCases = conversations
    .filter((conversation) => conversation.classifications?.includes("PRODUCT_EXISTS_COS_GAP"))
    .filter((conversation) => conversation.turns.some((item) =>
      item.expected.selectedCapabilityId !== null ||
      item.expected.executedCapabilityId !== null,
    ))
    .map((conversation) => conversation.id)
  const conflatedCapabilityOracle = conversations.flatMap((conversation) =>
    conversation.turns.flatMap((item, index) => Object.prototype.hasOwnProperty.call(item.expected, "capabilityId")
      ? [`${conversation.id}:turn-${index + 1}`]
      : []),
  )
  const p0WithoutStateOrTrace = conversations
    .filter((conversation) => conversation.priorities?.includes("P0"))
    .filter((conversation) => {
      const assertions = conversation.assertions
      return !assertions?.stateAfter && !assertions?.persistence && !assertions?.expectedTrace && !assertions?.forbidden
    })
    .map((conversation) => conversation.id)
  const correctionCaseIds = [...COS_GOLDEN_V1_METADATA.oracleAudit.semanticCorrectionCaseIds]
  const invalidOracleAuditCaseIds = [
    ...correctionCaseIds.filter((id, index) => correctionCaseIds.indexOf(id) !== index),
    ...correctionCaseIds.filter((id) => !ids.includes(id)),
    ...(correctionCaseIds.length !== COS_GOLDEN_V1_METADATA.oracleAudit.semanticCorrectionCases
      ? ["semanticCorrectionCases:count_mismatch"]
      : []),
    ...(COS_GOLDEN_V1_METADATA.oracleAudit.auditedExecutableCases !== conversations.length
      ? ["auditedExecutableCases:count_mismatch"]
      : []),
  ]

  return {
    expectedBaseScenarios: COS_GOLDEN_V1_METADATA.baseScenarioCount,
    expectedExecutableCases: COS_GOLDEN_V1_METADATA.executableCaseCount,
    baseScenarios: new Set(baseIds).size,
    executableCases: conversations.length,
    turns: conversations.reduce((sum, conversation) => sum + conversation.turns.length, 0),
    duplicateIds,
    invalidConversationIds,
    invalidCapabilityRefs,
    unresolvedPlaceholders,
    unsafeKnowledgeCases,
    unsafeProductGapCases,
    conflatedCapabilityOracle,
    p0WithoutStateOrTrace,
    invalidOracleAuditCaseIds: [...new Set(invalidOracleAuditCaseIds)],
  }
}

export function listCosRiskCapabilityPolicies() {
  return listCosCapabilityCatalog()
    .filter((descriptor) => descriptor.mutatesData && (descriptor.id.includes("delete") || descriptor.id.includes("cancel") || descriptor.id.includes("send") || descriptor.id.includes("sign") || descriptor.id.includes("publish")))
    .map((descriptor) => ({
      id: descriptor.id,
      mutatesData: descriptor.mutatesData,
      requiresSelection: descriptor.requiresSelection,
      requiresConfirmation: descriptor.requiresConfirmation,
    }))
}
