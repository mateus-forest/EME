/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, console, require */

const fs = require("fs")
const path = require("path")
const ts = require("typescript")
const Module = require("module")
const assert = require("assert")

const repoRoot = path.resolve(__dirname, "..")
const originalResolveFilename = Module._resolveFilename

function resolveAliasTarget(request) {
  if (request === "server-only" || request === "client-only") {
    return path.join(__dirname, "runtime-module-stub.cjs")
  }

  if (!request.startsWith("@/")) return null

  const basePath = path.join(repoRoot, request.slice(2))
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? basePath
}

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  const aliasTarget = resolveAliasTarget(request)
  if (aliasTarget) {
    return originalResolveFilename.call(this, aliasTarget, parent, isMain, options)
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}

function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowJs: true,
    },
    fileName: filename,
  })

  module._compile(output.outputText, filename)
}

Module._extensions[".ts"] = transpileTypeScript
Module._extensions[".tsx"] = transpileTypeScript

const { planCosCapability } = require(path.join(repoRoot, "lib/cos/planner.ts"))
const { planCosExecution } = require(path.join(repoRoot, "lib/cos/execution-planner.ts"))
const {
  cancelWorkflow,
  createWorkflowFromExecutionPlan,
  formatWorkflowProgress,
  resumeWorkflowState,
  shouldConfirmWorkflowMessage,
  shouldResumeWorkflow,
  updateWorkflowFromExecutionResult,
} = require(path.join(repoRoot, "lib/cos/workflow-engine.ts"))

const scenarios = [
  {
    message: "Busque apartamentos no centro.",
    surface: "portal",
    expectedAction: "searchProperties",
  },
  {
    message: "Cadastre este cliente.",
    surface: "portal",
    expectedAction: "createLead",
  },
  {
    message: "Crie um contrato de compra e venda.",
    surface: "portal",
    expectedAction: "CREATE_CONTRACT",
  },
  {
    message: "Quais compromissos tenho hoje?",
    surface: "cos_home",
    expectedAction: "LIST_AGENDA_EVENTS",
  },
  {
    message: "Quanto tenho de comissão prevista?",
    surface: "portal",
    expectedAction: "getFinancialSummary",
  },
  {
    message: "Analise meu catálogo.",
    surface: "portal",
    expectedAction: "analyzeCatalog",
  },
  {
    message: "Mostre meus contratos.",
    surface: "portal",
    expectedAction: "LIST_CONTRACTS",
  },
  {
    message: "Melhore a descrição deste imóvel.",
    surface: "portal",
    expectedAction: "improvePropertyDescription",
  },
  {
    message: "Crie um novo.",
    surface: "portal",
    expectedAction: "general",
    expectedSource: "legacy",
  },
  {
    message: "Mostre os pendentes.",
    surface: "portal",
    expectedAction: "general",
    expectedSource: "legacy",
  },
  {
    message: "Atualize isso.",
    surface: "portal",
    expectedAction: "general",
    expectedSource: "legacy",
  },
  {
    message: "Sim.",
    surface: "portal",
    expectedAction: "CREATE_CONTRACT",
    expectedSource: "legacy",
    pendingContext: {
      action: "CREATE_CONTRACT",
      missingField: "lead",
      parsedData: {},
      createdAt: new Date("2026-07-30T10:00:00.000Z"),
    },
  },
  {
    message: "Cancelar.",
    surface: "portal",
    expectedAction: "general",
    expectedSource: "legacy",
  },
  {
    message: "Crie uma proposta.",
    surface: "portal",
    workspace: {
      surface: "portal",
      page: "lead_detail",
      entity: "lead",
      entityId: "lead_123",
      selection: [],
      metadata: {},
    },
    expectedAction: "CREATE_PROPOSAL",
    expectedSource: "catalog",
    expectedContextOrigin: "workspace",
  },
  {
    message: "Marque para amanha as 14h.",
    surface: "portal",
    workspace: {
      surface: "portal",
      page: "agenda",
      entity: "agenda",
      entityId: null,
      selection: [],
      metadata: {},
    },
    expectedAction: "CREATE_AGENDA_EVENT",
    expectedSource: "catalog",
    expectedContextOrigin: "workspace",
  },
  {
    message: "Gere um anuncio.",
    surface: "portal",
    workspace: {
      surface: "portal",
      page: "property_detail",
      entity: "property",
      entityId: "property_123",
      selection: [],
      metadata: {},
    },
    expectedAction: "improvePropertyDescription",
    expectedSource: "catalog",
    expectedContextOrigin: "workspace",
  },
]

const results = scenarios.map((scenario) => {
  const plan = planCosCapability({
    message: scenario.message,
    surface: scenario.surface,
    pendingContext: scenario.pendingContext ?? null,
    workspace: scenario.workspace ?? null,
  })

  assert.strictEqual(plan.action, scenario.expectedAction, `Mensagem "${scenario.message}" deveria resolver ${scenario.expectedAction}, mas resolveu ${plan.action}.`)

  if (scenario.expectedSource) {
    assert.strictEqual(
      plan.source,
      scenario.expectedSource,
      `Mensagem "${scenario.message}" deveria usar source=${scenario.expectedSource}, mas usou ${plan.source}.`,
    )
  }

  if (scenario.expectedContextOrigin) {
    assert.strictEqual(
      plan.contextOrigin,
      scenario.expectedContextOrigin,
      `Mensagem "${scenario.message}" deveria usar contextOrigin=${scenario.expectedContextOrigin}, mas usou ${plan.contextOrigin}.`,
    )
  }

  return {
    message: scenario.message,
    action: plan.action,
    capabilityId: plan.capabilityId,
    entity: plan.entity,
    source: plan.source,
    confidence: plan.confidence,
    contextOrigin: plan.contextOrigin,
  }
})

console.table(results)

const executionScenarios = [
  {
    message: "Cadastre este cliente e gere uma proposta.",
    surface: "portal",
    expectedSteps: ["lead.create", "proposal.create"],
    expectedSource: "recipe",
  },
  {
    message: "Crie um contrato e envie para assinatura.",
    surface: "portal",
    expectedSteps: ["contract.create"],
    expectedSource: "recipe",
    expectedUnresolvedGoals: ["contract_signature_dispatch"],
  },
  {
    message: "Analise minha operacao.",
    surface: "portal",
    expectedSteps: ["lead.summary", "finance.summary", "analytics.summary", "operation.summary"],
    expectedSource: "recipe",
  },
  {
    message: "Quero vender este imovel.",
    surface: "portal",
    workspace: {
      surface: "portal",
      page: "property_detail",
      entity: "property",
      entityId: "property_123",
      selection: [],
      metadata: {},
    },
    expectedSteps: ["property.description.improve", "catalog.analyze"],
    expectedSource: "recipe",
  },
  {
    message: "Publique meu catalogo e gere uma campanha.",
    surface: "portal",
    expectedSteps: ["catalog.analyze"],
    expectedSource: "recipe",
    expectedUnresolvedGoals: ["catalog_publish", "studio_campaign"],
  },
]

const executionResults = executionScenarios.map((scenario) => {
  const plan = planCosExecution({
    message: scenario.message,
    surface: scenario.surface,
    workspace: scenario.workspace ?? null,
  })

  assert.deepStrictEqual(
    plan.steps.map((step) => step.capabilityId),
    scenario.expectedSteps,
    `Plano "${scenario.message}" deveria conter ${scenario.expectedSteps.join(", ")}, mas trouxe ${plan.steps.map((step) => step.capabilityId).join(", ")}.`,
  )

  assert.strictEqual(plan.source, scenario.expectedSource, `Plano "${scenario.message}" deveria usar source=${scenario.expectedSource}.`)

  if (scenario.expectedUnresolvedGoals) {
    assert.deepStrictEqual(
      plan.unresolvedGoals.map((goal) => goal.id),
      scenario.expectedUnresolvedGoals,
      `Plano "${scenario.message}" deveria sinalizar gaps ${scenario.expectedUnresolvedGoals.join(", ")}.`,
    )
  }

  return {
    message: scenario.message,
    source: plan.source,
    stepCount: plan.steps.length,
    steps: plan.steps.map((step) => step.capabilityId).join(" -> "),
    unresolvedGoals: plan.unresolvedGoals.map((goal) => goal.id).join(", "),
  }
})

console.table(executionResults)

const workflowPlan = planCosExecution({
  message: "Cadastre este cliente e gere uma proposta.",
  surface: "portal",
})

const pendingWorkflow = createWorkflowFromExecutionPlan({
  conversationId: "conversation_123",
  plan: workflowPlan,
})

assert.strictEqual(pendingWorkflow.status, "awaiting_input", "Workflow inicial deveria aguardar confirmacao para plano mutativo.")
assert.strictEqual(pendingWorkflow.pendingInput?.field, "confirmation", "Workflow inicial deveria pedir confirmacao.")
assert.strictEqual(formatWorkflowProgress(pendingWorkflow), "Etapa 1 de 2\nAguardando: Confirmação.", "Progresso inicial inesperado.")
assert.strictEqual(shouldResumeWorkflow(pendingWorkflow), true, "Workflow aguardando input deveria ser retomavel.")
assert.strictEqual(shouldConfirmWorkflowMessage("sim", false), true, "Mensagem afirmativa deveria confirmar workflow.")

const resumedWorkflow = resumeWorkflowState({
  ...pendingWorkflow,
  pausedAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z",
})

assert.strictEqual(resumedWorkflow.status, "running", "Workflow retomado deveria voltar para running.")
assert.strictEqual(resumedWorkflow.pausedAt, null, "Workflow retomado nao deveria manter pausedAt.")

const awaitingInputWorkflow = updateWorkflowFromExecutionResult({
  workflow: resumedWorkflow,
  result: {
    planId: resumedWorkflow.id,
    status: "awaiting_input",
    primaryAction: "createLead",
    primaryCapabilityId: "lead.create",
    steps: [
      {
        id: `${resumedWorkflow.id}:step:1`,
        order: 0,
        entity: "lead",
        capabilityId: "lead.create",
        action: "createLead",
        status: "awaiting_input",
        dependsOn: [],
        durationMs: 42,
        errorMessage: null,
        plan: workflowPlan.steps[0].plan,
        result: {
          response: "Qual o telefone dele?",
          metadata: {
            required: ["phone"],
            extractedName: "Mateus",
            parsedData: { extractedName: "Mateus" },
          },
        },
      },
      workflowPlan.steps[1],
    ],
    completedSteps: [],
    executedSteps: [],
    interruptedStep: {
      id: `${resumedWorkflow.id}:step:1`,
      order: 0,
      entity: "lead",
      capabilityId: "lead.create",
      action: "createLead",
      status: "awaiting_input",
      dependsOn: [],
      durationMs: 42,
      errorMessage: null,
      plan: workflowPlan.steps[0].plan,
      result: {
        response: "Qual o telefone dele?",
        metadata: {
          required: ["phone"],
          extractedName: "Mateus",
          parsedData: { extractedName: "Mateus" },
        },
      },
    },
    interruptedReason: "awaiting_input",
    unresolvedGoals: [],
    metadata: {},
    totalDurationMs: 42,
  },
})

assert.strictEqual(awaitingInputWorkflow.status, "awaiting_input", "Workflow deveria entrar em awaiting_input.")
assert.strictEqual(awaitingInputWorkflow.pendingInput?.field, "phone", "Workflow deveria mapear phone como pending input.")
assert.strictEqual(awaitingInputWorkflow.pendingInput?.parsedData?.extractedName, "Mateus", "Workflow deveria preservar parsedData.")

const completedWorkflow = updateWorkflowFromExecutionResult({
  workflow: awaitingInputWorkflow,
  result: {
    planId: awaitingInputWorkflow.id,
    status: "completed",
    primaryAction: "createLead",
    primaryCapabilityId: "lead.create",
    steps: workflowPlan.steps.map((step, index) => ({
      ...step,
      status: "completed",
      durationMs: 100 + index,
      result: { response: "ok", metadata: {} },
    })),
    completedSteps: workflowPlan.steps.map((step, index) => ({
      ...step,
      status: "completed",
      durationMs: 100 + index,
      result: { response: "ok", metadata: {} },
    })),
    executedSteps: workflowPlan.steps.map((step, index) => ({
      ...step,
      status: "completed",
      durationMs: 100 + index,
      result: { response: "ok", metadata: {} },
    })),
    interruptedStep: null,
    interruptedReason: null,
    unresolvedGoals: [],
    metadata: {},
    totalDurationMs: 201,
  },
})

assert.strictEqual(completedWorkflow.status, "completed", "Workflow deveria concluir.")
assert.strictEqual(formatWorkflowProgress(completedWorkflow), "Workflow concluido.\n2 etapas executadas.", "Resumo final do workflow inesperado.")

const cancelledWorkflow = cancelWorkflow(awaitingInputWorkflow)
assert.strictEqual(cancelledWorkflow.status, "cancelled", "Workflow cancelado deveria receber status cancelled.")
assert.strictEqual(cancelledWorkflow.pendingInput, null, "Workflow cancelado nao deveria manter pendingInput.")

console.log(
  `Validated ${results.length} capability scenarios, ${executionResults.length} execution-plan scenarios and workflow lifecycle scenarios successfully.`,
)
