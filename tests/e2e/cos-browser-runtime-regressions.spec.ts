import { expect, test } from "@playwright/test"

import { resolveCosDialogueDecision } from "@/lib/cos/conversation-decision"
import { resolveCosConversationReference } from "@/lib/cos/conversation-snapshot"
import { extractClientIdentity } from "@/lib/cos/entity-extraction"
import type { CosConversationEntityReference, CosConversationSnapshot } from "@/lib/cos/types"

const NOW = "2026-08-22T12:00:00.000Z"

function entity(id: string, label: string): CosConversationEntityReference {
  return {
    type: "property",
    id,
    label,
    source: "execution",
    lastMentionedAt: NOW,
    confidence: 1,
    evidence: "browser-regression",
  }
}

function snapshot(overrides: Partial<CosConversationSnapshot> = {}): CosConversationSnapshot {
  return {
    schemaVersion: 1,
    conversationId: "browser-regression",
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
    temporalContext: { today: "2026-08-22", references: {} },
    workspace: null,
    updatedAt: NOW,
    ...overrides,
  }
}

function decide(message: string, requestedAction?: string) {
  return resolveCosDialogueDecision({
    message,
    requestedAction,
    surface: "cos_home",
    workspace: null,
    snapshot: snapshot(),
    activeWorkflow: null,
    memory: null,
    attachments: [],
  })
}

test("free help question resolves to client guidance", () => {
  const result = decide("Como gerenciar clientes?")

  expect(result.dialogueAct).toBe("explain")
  expect(result.selectedCapabilityId).toBe("help.manage_clients")
  expect(result.selectedAction).toBe("help_manage_clients")
  expect(result.needsClarification).toBe(false)
})

test("latest properties quick action does not demand a location", () => {
  const result = decide("Mostre meus últimos imóveis cadastrados.", "searchProperties")

  expect(result.selectedCapabilityId).toBe("property.search")
  expect(result.needsClarification).toBe(false)
})

test("previous property resolves from recency without a selection set", () => {
  const current = entity("property-current", "Apartamento")
  const previous = entity("property-previous", "Sala Comercial")
  const currentSnapshot = snapshot({
    currentTopic: {
      id: "topic-property",
      domain: "property",
      label: "Imóveis",
      entityType: "property",
      selectionSetId: null,
      startedAt: NOW,
      lastMentionedAt: NOW,
    },
    activeEntities: { property: current },
    recentEntities: [current, previous],
  })

  const result = resolveCosConversationReference("E qual era o valor do anterior?", currentSnapshot)

  expect(result.entity?.id).toBe(previous.id)
  expect(result.reason).toBe("previous_recent_ordinal")
})

test("client details in one answer preserve name and phone", () => {
  const result = extractClientIdentity("Cliente Teste COS 2208, telefone (54) 99999-1122")

  expect(result.name).toBe("Teste Cos 2208")
  expect(result.phone).toBe("54999991122")
  expect(result.confident).toBe(true)
})
