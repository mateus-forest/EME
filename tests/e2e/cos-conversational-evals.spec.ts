import { expect, test } from "@playwright/test"

import {
  listCosRiskCapabilityPolicies,
  runCosSystemEvalSuite,
  validateCosGoldenDataset,
} from "@/lib/cos/evals/conversational-runner"

test.describe("COS — evals conversacionais da Etapa 6", () => {
  test("golden dataset possui 50 conversas multi-turno explícitas e IDs únicos", () => {
    const validation = validateCosGoldenDataset()

    expect(validation.total).toBeGreaterThanOrEqual(50)
    expect(validation.turns).toBeGreaterThanOrEqual(100)
    expect(validation.duplicateIds).toEqual([])
    expect(validation.invalidConversationIds).toEqual([])
  })

  test("suíte sistêmica mede camadas separadamente sem média agregada", async () => {
    const report = await runCosSystemEvalSuite()

    expect(report.dataset.legacySingleTurn).toBeGreaterThanOrEqual(400)
    expect(report.dataset.multiTurnConversations).toBeGreaterThanOrEqual(50)
    expect(report.dataset.executionFixtures).toBeGreaterThanOrEqual(10)
    expect(report.dataset.responseFixtures).toBeGreaterThanOrEqual(12)
    expect(report.metrics.dialogueActAccuracy.evaluated).toBeGreaterThan(0)
    expect(report.metrics.domainAccuracy.evaluated).toBeGreaterThan(0)
    expect(report.metrics.capabilityAccuracy.evaluated).toBeGreaterThan(0)
    expect(report.metrics.referenceResolution.evaluated).toBeGreaterThan(0)
    expect(report.metrics.contextContinuity.evaluated).toBeGreaterThan(0)
    expect(report.metrics.knowledgeRetrieval.evaluated).toBeGreaterThan(0)
    expect(report.metrics.executionCorrectness.evaluated).toBeGreaterThan(0)
    expect(report.metrics.responseCorrectness.evaluated).toBeGreaterThan(0)
    expect(report.metrics.localization.evaluated).toBeGreaterThan(0)
    expect(report.metrics.safetyInvariants.evaluated).toBeGreaterThan(0)
    expect(report.metrics.endToEndConversation.evaluated).toBe(50)
    expect("aggregateAccuracy" in report.metrics).toBe(false)
  })

  test("capabilities de risco mantêm confirmação e documentam a lacuna de seleção", () => {
    const policies = listCosRiskCapabilityPolicies()
    const destructive = policies.filter((policy) =>
      policy.id.includes("delete") || policy.id.includes("cancel") || policy.id.includes("sign") || policy.id.includes("send"),
    )

    expect(destructive.length).toBeGreaterThan(0)
    expect(destructive.every((policy) => policy.requiresConfirmation)).toBe(true)
    expect(destructive.filter((policy) => !policy.requiresSelection).map((policy) => policy.id)).toEqual(["lead.delete"])
  })
})
