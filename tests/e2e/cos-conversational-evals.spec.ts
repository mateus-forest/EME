import { expect, test } from "@playwright/test"

import {
  listCosRiskCapabilityPolicies,
  runCosSystemEvalSuite,
  validateCosGoldenDataset,
  validateCosGoldenV1Dataset,
} from "@/lib/cos/evals/conversational-runner"
import {
  COS_GOLDEN_V1_METADATA,
  cosGoldenV1Conversations,
} from "@/lib/cos/evals/conversations/golden-v1"

test.describe("COS — evals conversacionais e Golden V1", () => {
  test("golden legado preserva 50 conversas multi-turno explícitas e IDs únicos", () => {
    const validation = validateCosGoldenDataset()

    expect(validation.total).toBeGreaterThanOrEqual(50)
    expect(validation.turns).toBeGreaterThanOrEqual(100)
    expect(validation.duplicateIds).toEqual([])
    expect(validation.invalidConversationIds).toEqual([])
  })

  test("Golden V1 preserva 104 cenários-base e 106 cases executáveis válidos", () => {
    const validation = validateCosGoldenV1Dataset()

    expect(validation.baseScenarios).toBe(104)
    expect(validation.executableCases).toBe(106)
    expect(validation.turns).toBeGreaterThanOrEqual(140)
    expect(validation.duplicateIds).toEqual([])
    expect(validation.invalidConversationIds).toEqual([])
    expect(validation.invalidCapabilityRefs).toEqual([])
    expect(validation.unresolvedPlaceholders).toEqual([])
    expect(validation.unsafeKnowledgeCases).toEqual([])
    expect(validation.unsafeProductGapCases).toEqual([])
    expect(validation.conflatedCapabilityOracle).toEqual([])
    expect(validation.p0WithoutStateOrTrace).toEqual([])
    expect(validation.invalidOracleAuditCaseIds).toEqual([])
  })

  test("oracle V1.1 separa capability referenciada, selecionada e executada", () => {
    const knowledgeCases = cosGoldenV1Conversations.filter((scenario) =>
      scenario.classifications?.includes("KNOWLEDGE_ONLY"),
    )
    const productGapCases = cosGoldenV1Conversations.filter((scenario) =>
      scenario.classifications?.includes("PRODUCT_EXISTS_COS_GAP"),
    )
    const clientQuestion = cosGoldenV1Conversations
      .find((scenario) => scenario.id === "CLIENT_008")
      ?.turns[0]?.expected

    expect(COS_GOLDEN_V1_METADATA.schemaVersion).toBe("1.1.0")
    expect(COS_GOLDEN_V1_METADATA.frozen).toBe(true)
    expect(COS_GOLDEN_V1_METADATA.oracleAudit.auditedExecutableCases).toBe(106)
    expect(COS_GOLDEN_V1_METADATA.oracleAudit.capabilitySchemaAmbiguityCases).toBe(106)
    expect(COS_GOLDEN_V1_METADATA.oracleAudit.semanticCorrectionCases).toBe(82)
    expect(cosGoldenV1Conversations.flatMap((scenario) => scenario.turns).every((turn) =>
      turn.expected.primaryDomain !== undefined &&
      turn.expected.domain === undefined &&
      turn.expected.capabilityId === undefined &&
      Object.prototype.hasOwnProperty.call(turn.expected, "referencedCapabilityId") &&
      Object.prototype.hasOwnProperty.call(turn.expected, "selectedCapabilityId") &&
      Object.prototype.hasOwnProperty.call(turn.expected, "executedCapabilityId"),
    )).toBe(true)
    expect(knowledgeCases.flatMap((scenario) => scenario.turns).every((turn) =>
      turn.expected.selectedCapabilityId === null && turn.expected.executedCapabilityId === null,
    )).toBe(true)
    expect(productGapCases.flatMap((scenario) => scenario.turns).every((turn) =>
      turn.expected.selectedCapabilityId === null && turn.expected.executedCapabilityId === null,
    )).toBe(true)
    expect(clientQuestion).toMatchObject({
      act: "capability_question",
      primaryDomain: "lead",
      referencedCapabilityId: "lead.create",
      selectedCapabilityId: null,
      executedCapabilityId: null,
      shouldMutate: false,
    })
  })

  test("oracle aplica contexto anterior e domínios secundários sem isolar seleções", () => {
    const clientSelection = cosGoldenV1Conversations.find((scenario) => scenario.id === "CLIENT_002")
    const catalogSelection = cosGoldenV1Conversations.find((scenario) => scenario.id === "PROPERTY_021")
    const accountDiagnosis = cosGoldenV1Conversations.find((scenario) => scenario.id === "ACCOUNT_080")

    expect(clientSelection?.turns[0]?.after?.pending?.capabilityId).toBe("property.search")
    expect(clientSelection?.turns[1]?.expected).toMatchObject({
      primaryDomain: "property",
      secondaryDomains: ["lead"],
      selectedCapabilityId: "property.search",
    })
    expect(catalogSelection?.turns[0]?.after?.pending?.capabilityId).toBe("catalog.analyze")
    expect(catalogSelection?.turns[1]?.expected.selectedCapabilityId).toBe("catalog.analyze")
    expect(accountDiagnosis?.turns[0]?.expected).toMatchObject({
      primaryDomain: "catalog",
      secondaryDomains: ["property", "account"],
    })
  })

  test("suíte sistêmica mede camadas separadamente sem média agregada", async () => {
    const report = await runCosSystemEvalSuite()

    expect(report.dataset.legacySingleTurn).toBeGreaterThanOrEqual(400)
    expect(report.dataset.legacyMultiTurnConversations).toBeGreaterThanOrEqual(50)
    expect(report.dataset.baseScenarios).toBe(104)
    expect(report.dataset.executableCases).toBe(106)
    expect(report.dataset.executionFixtures).toBeGreaterThanOrEqual(10)
    expect(report.dataset.responseFixtures).toBeGreaterThanOrEqual(12)
    expect(report.metrics.dialogueActAccuracy.evaluated).toBeGreaterThan(0)
    expect(report.metrics.domainAccuracy.evaluated).toBeGreaterThan(0)
    expect(report.metrics.capabilityReferenceAccuracy.evaluated).toBeGreaterThan(0)
    expect(report.metrics.capabilityAccuracy.evaluated).toBeGreaterThan(0)
    expect(report.metrics.referenceResolution.evaluated).toBeGreaterThan(0)
    expect(report.metrics.contextContinuity.evaluated).toBeGreaterThan(0)
    expect(report.metrics.knowledgeRetrieval.evaluated).toBeGreaterThan(0)
    expect(report.metrics.executionCorrectness.evaluated).toBeGreaterThan(0)
    expect(report.metrics.responseCorrectness.evaluated).toBeGreaterThan(0)
    expect(report.metrics.localization.evaluated).toBeGreaterThan(0)
    expect(report.metrics.safetyInvariants.evaluated).toBeGreaterThan(0)
    expect(report.metrics.deterministicConversationChecks.evaluated).toBe(106)
    expect(report.goldenV1.layerMetrics.response_quality.evaluated).toBe(0)
    expect(report.goldenV1.layerMetrics.response_quality.accuracy).toBeNull()
    expect(report.goldenV1.layerMetrics.response_quality.notEvaluated).toBe(106)
    expect(report.goldenV1.layerMetrics.capability_execution.evaluated).toBe(0)
    expect(report.goldenV1.layerMetrics.capability_execution.notEvaluated).toBe(106)
    expect(report.goldenV1.layerMetrics.persistence.eligible).toBeGreaterThan(0)
    expect(report.goldenV1.layerMetrics.persistence.evaluated).toBe(0)
    expect(report.goldenV1.statusBreakdown.pass + report.goldenV1.statusBreakdown.fail + report.goldenV1.statusBreakdown.incomplete).toBe(106)
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
