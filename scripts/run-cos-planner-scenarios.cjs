/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, console, process, require */

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
const { extractClientIdentity, detectNamedClientReference } = require(path.join(repoRoot, "lib/cos/entity-extraction.ts"))
const { parsePropertyDraftData } = require(path.join(repoRoot, "lib/eme-backend.ts"))
const { getAttachmentsFromPayload } = require(path.join(repoRoot, "lib/cos/capabilities/shared.ts"))
const {
  cancelWorkflow,
  createWorkflowFromExecutionPlan,
  formatWorkflowProgress,
  resumeWorkflowState,
  shouldConfirmWorkflowMessage,
  shouldResumeWorkflow,
  updateWorkflowFromExecutionResult,
} = require(path.join(repoRoot, "lib/cos/workflow-engine.ts"))

const capabilityScenarios = [
  { message: "Busque apartamentos no centro.", surface: "portal", expectedAction: "searchProperties" },
  { message: "Cadastre este cliente.", surface: "portal", expectedAction: "createLead" },
  { message: "Crie um contrato de compra e venda.", surface: "portal", expectedAction: "CREATE_CONTRACT" },
  { message: "Quais compromissos tenho hoje?", surface: "cos_home", expectedAction: "LIST_AGENDA_EVENTS" },
  { message: "Quanto tenho de comissão prevista?", surface: "portal", expectedAction: "getFinancialSummary" },
  { message: "Analise meu catálogo.", surface: "portal", expectedAction: "analyzeCatalog" },
  { message: "Mostre meus contratos.", surface: "portal", expectedAction: "LIST_CONTRACTS" },
  { message: "Melhore a descrição deste imóvel.", surface: "portal", expectedAction: "improvePropertyDescription" },
  { message: "Crie um novo.", surface: "portal", expectedAction: "general", expectedSource: "legacy" },
  { message: "Mostre os pendentes.", surface: "portal", expectedAction: "general", expectedSource: "legacy" },
  { message: "Atualize isso.", surface: "portal", expectedAction: "general", expectedSource: "legacy" },
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
  { message: "Cancelar.", surface: "portal", expectedAction: "general", expectedSource: "legacy" },
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

  // Sprint 9 — casos reais de producao
  { message: "Cadastre um cliente chamado lucas.", surface: "portal", expectedAction: "createLead" },
  { message: "Cadastre esse imovel, casa em condominio.", surface: "portal", expectedAction: "createPropertyDraft" },
  {
    // Ate a Sprint 9, isto so garantia de NAO virar createLead (caia no fallback "general").
    // A partir da Sprint 10b existe uma capability real para o pedido, entao o esperado evoluiu.
    message: "Anexe esse documento ao cliente carlos.",
    surface: "portal",
    expectedAction: "ATTACH_LEAD_DOCUMENT",
    expectedSource: "catalog",
  },

  // Sprint 9 — variacoes de linguagem natural por verbo de acao (create)
  { message: "Crie um novo cliente chamado Pedro.", surface: "portal", expectedAction: "createLead" },
  { message: "Adicione um cliente chamado Ana.", surface: "portal", expectedAction: "createLead" },

  // Sprint 9 — variacoes de linguagem natural por verbo de acao (search)
  { message: "Busque apartamentos em Porto Alegre.", surface: "portal", expectedAction: "searchProperties" },
  { message: "Encontre casas com 3 quartos.", surface: "portal", expectedAction: "searchProperties" },
  { message: "Traga opcoes de apartamentos ate 500 mil.", surface: "portal", expectedAction: "searchProperties" },

  // Sprint 9 — variacoes de linguagem natural por verbo de acao (update)
  { message: "Atualize o cliente joao.", surface: "portal", expectedAction: "UPDATE_LEAD" },
  { message: "Edite os dados do cliente marcos.", surface: "portal", expectedAction: "UPDATE_LEAD" },
  { message: "Corrija os dados do cliente paula.", surface: "portal", expectedAction: "UPDATE_LEAD" },

  // Sprint 10b — variacoes de linguagem natural por verbo de acao (attach): resolvem para a capability real
  {
    message: "Vincule este documento ao cliente marina.",
    surface: "portal",
    expectedAction: "ATTACH_LEAD_DOCUMENT",
    expectedSource: "catalog",
  },
  {
    message: "Junte este documento ao cliente roberta.",
    surface: "portal",
    expectedAction: "ATTACH_LEAD_DOCUMENT",
    expectedSource: "catalog",
  },
]

const deterministicExecutionScenarios = [
  {
    message: "Cadastre este cliente e gere uma proposta.",
    surface: "portal",
    expectedSteps: ["lead.create", "proposal.create"],
    expectedSource: "recipe",
  },
  {
    message: "Crie um contrato e envie para assinatura.",
    surface: "portal",
    expectedSteps: ["contract.create", "contract.send", "contract.sign"],
    expectedSource: "recipe",
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
    expectedSteps: ["property.description.improve", "catalog.publish", "studio.generateCampaign"],
    expectedSource: "recipe",
  },
  {
    message: "Publique meu catalogo e gere uma campanha.",
    surface: "portal",
    expectedSteps: ["catalog.publish", "studio.generateCampaign"],
    expectedSource: "recipe",
  },
]

async function main() {
  const capabilityResults = capabilityScenarios.map((scenario) => {
    const plan = planCosCapability({
      message: scenario.message,
      surface: scenario.surface,
      pendingContext: scenario.pendingContext ?? null,
      workspace: scenario.workspace ?? null,
    })

    assert.strictEqual(plan.action, scenario.expectedAction, `Mensagem "${scenario.message}" deveria resolver ${scenario.expectedAction}, mas resolveu ${plan.action}.`)

    if (scenario.expectedSource) {
      assert.strictEqual(plan.source, scenario.expectedSource, `Mensagem "${scenario.message}" deveria usar source=${scenario.expectedSource}, mas usou ${plan.source}.`)
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

  console.table(capabilityResults)

  const entityExtractionScenarios = [
    {
      label: "case1: nome apos marcador 'chamado'",
      run: () => extractClientIdentity("Cadastre um cliente chamado lucas.").name,
      expected: "Lucas",
    },
    {
      label: "case1-b: nome apos marcador 'chamada'",
      run: () => extractClientIdentity("Cadastre uma cliente chamada Fernanda.").name,
      expected: "Fernanda",
    },
    {
      label: "sem marcador nem nome confiavel deve ficar vazio",
      run: () => extractClientIdentity("Cadastre este cliente.").name,
      expected: "",
    },
    {
      label: "case4: nome nunca deve ser a frase de comando",
      run: () => extractClientIdentity("Anexe esse documento ao cliente carlos.").name,
      expected: "",
    },
    {
      label: "case4: deteccao de referencia a cliente existente",
      run: () => detectNamedClientReference("Anexe esse documento ao cliente carlos."),
      expected: "Carlos",
    },
    {
      label: "verbo de create nao deve disparar deteccao de referencia existente",
      run: () => detectNamedClientReference("Cadastre um cliente chamado lucas."),
      expected: null,
    },

    // Sprint 10b — resolucao de entidade para anexar documento a cliente existente
    {
      label: "sprint10b: 'vincule' reconhece cliente referenciado",
      run: () => detectNamedClientReference("Vincule este documento ao cliente marina."),
      expected: "Marina",
    },
    {
      label: "sprint10b: 'junte' reconhece cliente referenciado mesmo com 'arquivo' em vez de 'documento'",
      run: () => detectNamedClientReference("Junte este arquivo ao cliente roberta."),
      expected: "Roberta",
    },
  ]

  for (const scenario of entityExtractionScenarios) {
    const actual = scenario.run()
    assert.strictEqual(actual, scenario.expected, `Extracao "${scenario.label}" deveria retornar ${JSON.stringify(scenario.expected)}, mas retornou ${JSON.stringify(actual)}.`)
  }

  const case2Draft = parsePropertyDraftData("Cadastre esse imovel, casa em condominio.")
  const case2RawMessage = "Cadastre esse imovel, casa em condominio."
  for (const field of ["title", "city", "neighborhood", "description"]) {
    assert.notStrictEqual(
      case2Draft[field],
      case2RawMessage,
      `Campo "${field}" do rascunho de imovel nao pode conter a frase de comando bruta.`,
    )
  }

  const attachmentPayloadScenarios = [
    {
      label: "payload sem attachments retorna lista vazia",
      run: () => getAttachmentsFromPayload({}),
      expected: [],
    },
    {
      label: "attachment com dataUrl preserva o dataUrl",
      run: () =>
        getAttachmentsFromPayload({
          attachments: [{ id: "a1", name: "contrato.pdf", type: "application/pdf", category: "document", dataUrl: "data:application/pdf;base64,AAA=" }],
        }),
      expected: [{ id: "a1", name: "contrato.pdf", type: "application/pdf", category: "document", dataUrl: "data:application/pdf;base64,AAA=" }],
    },
    {
      label: "attachment sem dataUrl (ex.: doc nao suportado) fica sem dataUrl, nao quebra",
      run: () => getAttachmentsFromPayload({ attachments: [{ id: "a2", name: "planta.docx", type: "application/msword", category: "document" }] }),
      expected: [{ id: "a2", name: "planta.docx", type: "application/msword", category: "document", dataUrl: undefined }],
    },
  ]

  for (const scenario of attachmentPayloadScenarios) {
    const actual = scenario.run()
    assert.deepStrictEqual(actual, scenario.expected, `Payload "${scenario.label}" deveria retornar ${JSON.stringify(scenario.expected)}, mas retornou ${JSON.stringify(actual)}.`)
  }

  console.log(
    `Validated ${entityExtractionScenarios.length} entity-extraction scenarios, property draft field isolation, and ${attachmentPayloadScenarios.length} attachment-payload scenarios successfully.`,
  )

  const executionResults = []
  for (const scenario of deterministicExecutionScenarios) {
    const plan = await planCosExecution({
      message: scenario.message,
      surface: scenario.surface,
      workspace: scenario.workspace ?? null,
      allowAiOrchestrator: false,
    })

    assert.deepStrictEqual(
      plan.steps.map((step) => step.capabilityId),
      scenario.expectedSteps,
      `Plano "${scenario.message}" deveria conter ${scenario.expectedSteps.join(", ")}, mas trouxe ${plan.steps.map((step) => step.capabilityId).join(", ")}.`,
    )
    assert.strictEqual(plan.source, scenario.expectedSource, `Plano "${scenario.message}" deveria usar source=${scenario.expectedSource}.`)

    executionResults.push({
      message: scenario.message,
      source: plan.source,
      planner: plan.telemetry.planner,
      stepCount: plan.steps.length,
      steps: plan.steps.map((step) => step.capabilityId).join(" -> "),
      unresolvedGoals: plan.unresolvedGoals.map((goal) => goal.id).join(", "),
    })
  }

  console.table(executionResults)

  const aiPlan = await planCosExecution({
    message: "Analise toda minha operação e sugira prioridades.",
    surface: "portal",
    aiOrchestratorOverride: {
      output_parsed: {
        goal: "priorizar_operacao",
        confidence: 0.94,
        reason: "pedido composto sem receita deterministica direta",
        steps: [
          { id: "step_1", capability: "lead.summary", dependsOn: [] },
          { id: "step_2", capability: "finance.summary", dependsOn: ["step_1"] },
          { id: "step_3", capability: "analytics.summary", dependsOn: ["step_2"] },
          { id: "step_4", capability: "operation.summary", dependsOn: ["step_3"] },
        ],
      },
      usage: { input_tokens: 900, output_tokens: 180, total_tokens: 1080 },
      finish_reason: "completed",
    },
  })

  assert.strictEqual(aiPlan.source, "ai", "Plano do orquestrador deveria usar source=ai.")
  assert.strictEqual(aiPlan.telemetry.planner, "ai", "Plano do orquestrador deveria registrar planner=ai.")
  assert.deepStrictEqual(
    aiPlan.steps.map((step) => step.capabilityId),
    ["lead.summary", "finance.summary", "analytics.summary", "operation.summary"],
    "Plano do orquestrador deveria refletir o structured output validado.",
  )

  const invalidAiFallback = await planCosExecution({
    message: "Monte uma campanha para este imóvel considerando o público ideal.",
    surface: "portal",
    workspace: {
      surface: "portal",
      page: "property_detail",
      entity: "property",
      entityId: "property_123",
      selection: [],
      metadata: {},
    },
    aiOrchestratorOverride: {
      output_parsed: {
        goal: "campanha_invalida",
        confidence: 0.91,
        reason: "capability inexistente",
        steps: [{ id: "step_1", capability: "studio.capabilityInexistente", dependsOn: [] }],
      },
      finish_reason: "completed",
    },
  })

  assert.notStrictEqual(invalidAiFallback.source, "ai", "Plano invalido da IA deveria voltar ao planner deterministico.")
  assert.strictEqual(invalidAiFallback.telemetry.planner, "deterministic", "Fallback deveria preservar planner final deterministico.")
  assert.strictEqual(invalidAiFallback.telemetry.orchestrator?.planner, "ai", "Fallback deveria registrar a tentativa da IA.")

  const workflowPlan = await planCosExecution({
    message: "Cadastre este cliente e gere uma proposta.",
    surface: "portal",
    allowAiOrchestrator: false,
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
    `Validated ${capabilityResults.length} capability scenarios, ${executionResults.length} deterministic execution-plan scenarios, AI orchestrator scenarios and workflow lifecycle scenarios successfully.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
