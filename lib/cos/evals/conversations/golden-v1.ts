import type {
  CosGoldenBehaviorAssertions,
  CosGoldenClassification,
  CosGoldenConversation,
  CosGoldenConversationTurn,
  CosGoldenDomain,
  CosGoldenEvaluationLayer,
  CosGoldenPriority,
  CosGoldenStatePatch,
  CosGoldenTurnExpectation,
} from "@/lib/cos/evals/golden-types"
import type { CosDialogueAct } from "@/lib/cos/types"

type GoldenCaseOptions = {
  initial?: CosGoldenStatePatch
  assertions?: CosGoldenBehaviorAssertions
  tags?: string[]
}

const CATEGORY_LABELS: Record<string, string> = {
  CLIENT: "clientes-busca-contexto",
  PROPERTY: "imoveis-publicacao",
  PROPOSAL: "propostas-operacao-comercial",
  AGENDA: "compromissos",
  CONTRACT: "contratos-documentos",
  STUDIO: "studio",
  ANALYTICS: "desempenho-saude",
  KNOWLEDGE: "conhecimento-eme",
  CONTEXT: "continuidade-complexa",
  PLAN: "plano-creditos-entitlement",
  ACCOUNT: "creci-conta",
  EMPTY: "empty-states-contagem",
  SECURITY: "isolamento-seguranca",
  ATTACHMENT: "arquivos-anexos",
  TEMPORAL: "datas-correcoes-temporais",
  PARTIAL: "multi-step-parcial",
  KNOWLEDGE_STATE: "knowledge-estado-real",
  HISTORY: "historico",
  AMBIGUITY: "ambiguidade-semantica",
  INTEGRITY: "integridade-adicional",
}

const BASE_REQUIRED_LAYERS: CosGoldenEvaluationLayer[] = [
  "dialogue_act",
  "domain",
  "capability_reference",
  "capability_selection",
  "capability_execution",
  "response_quality",
  "forbidden_behaviors",
]

function expectedLayers(
  turns: CosGoldenConversationTurn[],
  classifications: CosGoldenClassification[],
  assertions: CosGoldenBehaviorAssertions | undefined,
): CosGoldenEvaluationLayer[] {
  const layers = new Set<CosGoldenEvaluationLayer>(BASE_REQUIRED_LAYERS)
  if (turns.length > 1) layers.add("context_continuity")
  if (turns.some((turn) => Object.prototype.hasOwnProperty.call(turn.expected, "referenceId"))) {
    layers.add("entity_resolution")
    layers.add("reference_resolution")
  }
  if (turns.some((turn) => turn.expected.shouldClarify !== undefined)) layers.add("pending_input")
  if (turns.some((turn) => turn.expected.requiresConfirmation !== undefined)) layers.add("confirmation")
  if (assertions?.workingSet) layers.add("working_set")
  if (assertions?.persistence || assertions?.stateAfter) layers.add("persistence")
  if (assertions?.partialSuccess) layers.add("partial_success")
  if (assertions?.failureClass) layers.add("failure_classification")
  if (assertions?.entitlement) layers.add("entitlement_security")
  if (assertions?.creditCharge !== undefined) layers.add("credit_correctness")
  if (classifications.includes("KNOWLEDGE_ONLY") || assertions?.requiredFacts) layers.add("knowledge_correctness")
  if (classifications.includes("PRODUCT_EXISTS_COS_GAP") || assertions?.knownGap) layers.add("gap_recognition")
  return [...layers]
}

function turn(
  message: string,
  act: CosDialogueAct,
  primaryDomain: CosGoldenDomain,
  capability: string | null | {
    referencedCapabilityId: string | null
    referencedProductFunction?: string | null
    selectedCapabilityId: string | null
    executedCapabilityId: string | null
  },
  extra: Omit<
    CosGoldenTurnExpectation,
    | "act"
    | "domain"
    | "primaryDomain"
    | "capabilityId"
    | "referencedCapabilityId"
    | "referencedProductFunction"
    | "selectedCapabilityId"
    | "executedCapabilityId"
  > = {},
  after?: CosGoldenStatePatch,
): CosGoldenConversationTurn {
  const capabilityExpectation = typeof capability === "string"
    ? {
        referencedCapabilityId: capability,
        selectedCapabilityId: capability,
        executedCapabilityId: capability,
      }
    : capability === null
      ? {
          referencedCapabilityId: null,
          selectedCapabilityId: null,
          executedCapabilityId: null,
        }
      : capability

  return {
    message,
    expected: { act, primaryDomain, ...capabilityExpectation, ...extra },
    ...(after ? { after } : {}),
  }
}

const referencedOnly = (
  referencedCapabilityId: string | null,
  referencedProductFunction?: string,
) => ({
  referencedCapabilityId,
  ...(referencedProductFunction ? { referencedProductFunction } : {}),
  selectedCapabilityId: null,
  executedCapabilityId: null,
})

const selectedWithoutExecution = (capabilityId: string) => ({
  referencedCapabilityId: capabilityId,
  selectedCapabilityId: capabilityId,
  executedCapabilityId: null,
})

const knowledgeTopic = (topic: string) => referencedOnly(null, `knowledge.${topic}`)

function goldenCase(
  categoryCode: keyof typeof CATEGORY_LABELS,
  sourceNumber: string,
  title: string,
  classificationsInput: CosGoldenClassification | CosGoldenClassification[],
  prioritiesInput: CosGoldenPriority | CosGoldenPriority[],
  domains: CosGoldenDomain[],
  turns: CosGoldenConversationTurn[],
  options: GoldenCaseOptions = {},
): CosGoldenConversation {
  const classifications = Array.isArray(classificationsInput) ? classificationsInput : [classificationsInput]
  const priorities = Array.isArray(prioritiesInput) ? prioritiesInput : [prioritiesInput]
  const numericPart = sourceNumber.replace(/[A-Z]/g, "").padStart(3, "0")
  const variant = sourceNumber.match(/[A-Z]+$/)?.[0] ?? ""
  const baseScenarioId = `${categoryCode}_${numericPart}`
  return {
    id: `${baseScenarioId}${variant}`,
    baseScenarioId,
    sourceNumber,
    title,
    category: CATEGORY_LABELS[categoryCode],
    description: title,
    classifications,
    priorities,
    domains,
    tags: [categoryCode.toLowerCase(), ...classifications.map((item) => item.toLowerCase()), ...priorities.map((item) => item.toLowerCase()), ...(options.tags ?? [])],
    assertions: options.assertions,
    requiredLayers: expectedLayers(turns, classifications, options.assertions),
    initial: options.initial,
    turns,
  }
}

const active = (type: "lead" | "property" | "proposal" | "contract" | "agenda", id: string, label: string): CosGoldenStatePatch => ({
  activate: { type, id, label },
})

const cases: CosGoldenConversation[] = [
  goldenCase("CLIENT", "1", "Quantidade e continuidade", "SUPPORTED_NOW", "P1", ["lead"], [
    turn("Quantos clientes eu tenho?", "query", "lead", "lead.summary", { shouldMutate: false }),
    turn("E quantos estão negociando?", "query", "lead", "lead.summary", { shouldMutate: false }),
    turn("Quem são?", "query", "lead", "lead.summary", { shouldMutate: false }),
  ], { assertions: { fixture: ["42 clientes; 7 em NEGOTIATING"], workingSet: { metric: "clientes em negociação" }, requiredFacts: ["total=42", "negotiating=7"], forbidden: ["generic_menu", "ask_intent_again", "list_all_clients"] } }),
  goldenCase("CLIENT", "2", "Buscar imóvel — cliente semelhante", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["lead", "property"], [
    turn("Procura alguma coisa pro Carlos.", "query", "property", selectedWithoutExecution("property.search"), { secondaryDomains: ["lead"], shouldMutate: false, shouldClarify: true }, { selection: { type: "lead", query: "Carlos", items: [{ id: "lead-carlos-mendes", label: "Carlos Mendes" }, { id: "lead-carlos-mendonca", label: "Carlos Mendonça" }] }, topic: { domain: "property", label: "Busca de imóveis para Carlos", entityType: "lead", useLatestSelection: true }, pending: { capabilityId: "property.search", entity: "property", field: "leadChoice", label: "Cliente", type: "selection", options: [{ id: "lead-carlos-mendes", label: "Carlos Mendes" }, { id: "lead-carlos-mendonca", label: "Carlos Mendonça" }] } }),
    turn("Mendes.", "select", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-carlos-mendes", shouldMutate: false }, { pending: null, activate: { type: "lead", id: "lead-carlos-mendes", label: "Carlos Mendes" }, topic: { domain: "property", label: "Busca de imóveis para Carlos Mendes", entityType: "lead" } }),
  ], { assertions: { fixture: ["Carlos Mendes: comercial em Porto Alegre até R$ 900 mil", "Carlos Mendonça: residencial em Caxias do Sul até R$ 600 mil", "3 imóveis compatíveis com Carlos Mendes"], workingSet: { active_client: "lead-carlos-mendes" }, knownGap: "Busca por perfil e continuidade entre Lead e Property não têm paridade completa.", knownGapLayer: "working_set", forbidden: ["silent_entity_choice"] } }),
  goldenCase("CLIENT", "3", "Melhor imóvel para cliente", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["lead", "property"], [
    turn("Tem alguma coisa boa pra Fernanda?", "query", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-fernanda", shouldMutate: false }, { selection: { type: "property", query: "perfil Fernanda", items: [{ id: "property-a", label: "Imóvel A" }, { id: "property-b", label: "Imóvel B" }] }, topic: { domain: "property", label: "Imóveis para Fernanda", entityType: "property", useLatestSelection: true } }),
    turn("E o outro?", "query", "property", "property.get", { secondaryDomains: ["lead"], referenceId: "property-b", shouldMutate: false }),
  ], { initial: active("lead", "lead-fernanda", "Fernanda Alves"), assertions: { fixture: ["Fernanda: Porto Alegre, residencial, até R$ 700 mil, 2 dormitórios", "Imóvel A: Porto Alegre, R$ 650 mil, 2 dormitórios", "Imóvel B: Caxias do Sul, R$ 590 mil"], workingSet: { active_client: "lead-fernanda", best_property: "property-a", alternative_property: "property-b" }, requiredFacts: ["A vence por cidade, preço e dormitórios", "B diverge na cidade"], knownGap: "Ranking conversacional por perfil não está plenamente representado pelos handlers atuais.", knownGapLayer: "entity_resolution", forbidden: ["unsupported_recommendation_fact"] } }),
  goldenCase("CLIENT", "4", "Refinamento progressivo", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["lead", "property"], [
    turn("Procura apartamento pro João.", "query", "property", selectedWithoutExecution("property.search"), { secondaryDomains: ["lead"], shouldClarify: true }, { selection: { type: "lead", query: "João", items: [{ id: "lead-joao-pereira", label: "João Pereira" }, { id: "lead-joao-silva", label: "João da Silva" }] }, topic: { domain: "property", label: "Busca de apartamento para João", entityType: "lead", useLatestSelection: true }, pending: { capabilityId: "property.search", entity: "property", field: "leadChoice", label: "Cliente", type: "selection", options: [{ id: "lead-joao-pereira", label: "João Pereira" }, { id: "lead-joao-silva", label: "João da Silva" }] } }),
    turn("Pereira.", "select", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-joao-pereira" }, { pending: null, activate: { type: "lead", id: "lead-joao-pereira", label: "João Pereira" }, topic: { domain: "property", label: "Busca de apartamento para João Pereira", entityType: "lead" } }),
    turn("Só até 700.", "query", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-joao-pereira" }),
    turn("E com duas vagas?", "query", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-joao-pereira" }, active("property", "property-vista-norte", "Vista Norte")),
  ], { assertions: { fixture: ["4 opções iniciais; 2 até R$ 700 mil; Vista Norte com 2 vagas por R$ 690 mil"], workingSet: { active_client: "lead-joao-pereira", max_price: "700000", parking_spaces: "2" }, knownGap: "Filtros progressivos não são preservados integralmente no working set atual.", knownGapLayer: "working_set", forbidden: ["restart_search", "forget_previous_filter"] } }),
  goldenCase("CLIENT", "5", "Cliente sem perfil suficiente", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["lead", "property"], [
    turn("Procura um imóvel pra Mariana.", "query", "property", selectedWithoutExecution("property.search"), { secondaryDomains: ["lead"], referenceId: "lead-mariana", shouldClarify: true }, { pending: { capabilityId: "property.search", entity: "property", field: "criteria", label: "Critérios da busca", type: "text", parsedData: { leadId: "lead-mariana" } } }),
    turn("Apartamento em Porto Alegre até 900 mil.", "provide_input", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-mariana" }, { pending: null }),
  ], { initial: active("lead", "lead-mariana", "Mariana Costa"), assertions: { fixture: ["Mariana sem cidade, tipo e faixa; 3 imóveis após critérios"], workingSet: { active_client: "lead-mariana", city: "Porto Alegre", property_type: "Apartamento", max_price: "900000" }, knownGap: "O handler não persiste/refina todo o perfil de busca em turnos sucessivos.", knownGapLayer: "working_set", forbidden: ["invent_client_preferences"] } }),
  goldenCase("CLIENT", "6", "Cadastro completo em uma frase", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["lead", "property"], [
    turn("Cadastra o Rafael Gomes, 54999998888. Procura apartamento em Caxias até 750 mil.", "execute", "lead", "lead.create", { secondaryDomains: ["property"], shouldMutate: true }, active("lead", "lead-rafael", "Rafael Gomes")),
  ], { assertions: { persistence: ["Lead Rafael Gomes criado", "phone=54999998888", "interesse: apartamento em Caxias do Sul até 750000"], expectedTrace: ["lead.create", "property.search ou persistência de interesse"], knownGap: "O cadastro e o interesse composto não têm persistência completa garantida no handler atual.", knownGapLayer: "persistence", forbidden: ["ask_known_name", "ask_known_phone", "ask_known_interest"] } }),
  goldenCase("CLIENT", "7", "Cadastro mínimo", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["lead"], [
    turn("Cadastra o Marcos Silva.", "execute", "lead", "lead.create", { shouldMutate: true }, active("lead", "lead-marcos", "Marcos Silva")),
  ], { assertions: { persistence: ["Lead Marcos Silva criado apenas com nome"], knownGap: "O handler atual pode pedir telefone apesar de o produto aceitar nome como dado mínimo.", knownGapLayer: "pending_input", forbidden: ["require_optional_phone"] } }),
  goldenCase("CLIENT", "8", "Pergunta sobre cadastro", "KNOWLEDGE_ONLY", "P1", ["lead"], [
    turn("Dá para cadastrar cliente sem telefone?", "capability_question", "lead", referencedOnly("lead.create"), { shouldMutate: false, knowledgeDocuments: ["clientes"] }),
  ], { assertions: { requiredFacts: ["cadastro pode iniciar com nome", "telefone e e-mail podem ser completados depois"], creditCharge: 0, forbidden: ["create_lead", "operational_workflow", "confirmation"] } }),
  goldenCase("CLIENT", "9", "Atualização contextual", "SUPPORTED_NOW", "P1", ["lead"], [
    turn("Abre a Fernanda Alves.", "query", "lead", "lead.find", { shouldMutate: false }, active("lead", "lead-fernanda", "Fernanda Alves")),
    turn("O telefone dela está errado.", "correct", "lead", selectedWithoutExecution("lead.update"), { referenceId: "lead-fernanda", shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "lead.update", entity: "lead", field: "phone", label: "Telefone", type: "phone", parsedData: { leadId: "lead-fernanda" } } }),
    turn("51988887777.", "provide_input", "lead", "lead.update", { referenceId: "lead-fernanda", shouldMutate: true }, { pending: null }),
  ], { assertions: { workingSet: { active_client: "lead-fernanda" }, persistence: ["lead-fernanda.phone=51988887777"], forbidden: ["ask_active_client_again", "update_other_lead"] } }),
  goldenCase("CLIENT", "10A", "Correção antes de persistir", "SUPPORTED_NOW", "P1", ["lead"], [
    turn("Cadastra Paula Souza, telefone 54999991234.", "execute", "lead", "lead.create", { shouldMutate: true }, { pending: { capabilityId: "lead.create", entity: "lead", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { name: "Paula Souza", phone: "54999991234" } } }),
    turn("Não, o sobrenome é Santos.", "correct", "lead", "lead.create", { shouldMutate: true }, { pending: null }),
  ], { assertions: { workingSet: { pending_client: "Paula Santos" }, persistence: ["uma criação, somente após correção, com nome Paula Santos"], sourceIssues: ["A entrada é idêntica à variante 10B, mas o material não define a precondição que torna esta tentativa pendente."], forbidden: ["persist_paula_souza", "duplicate_lead"] } }),
  goldenCase("CLIENT", "10B", "Correção depois de persistir", "SUPPORTED_NOW", "P0", ["lead"], [
    turn("Cadastra Paula Souza, telefone 54999991234.", "execute", "lead", "lead.create", { shouldMutate: true }, active("lead", "lead-paula", "Paula Souza")),
    turn("Na verdade, o sobrenome é Santos.", "correct", "lead", "lead.update", { referenceId: "lead-paula", shouldMutate: true }, active("lead", "lead-paula", "Paula Santos")),
  ], { assertions: { stateBefore: ["primeiro turno já persistiu lead-paula"], persistence: ["lead-paula.name=Paula Santos", "uma criação e uma atualização"], sourceIssues: ["A entrada é idêntica à variante 10A, mas o material não define a precondição que torna esta tentativa já persistida."], forbidden: ["pretend_creation_pending", "duplicate_lead"] } }),
  goldenCase("CLIENT", "11", "Exclusão", "SUPPORTED_NOW", "P0", ["lead"], [
    turn("Exclui Roberto Lima.", "execute", "lead", selectedWithoutExecution("lead.delete"), { referenceId: "lead-roberto", shouldMutate: true, requiresConfirmation: true }, { pending: { capabilityId: "lead.delete", entity: "lead", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { leadId: "lead-roberto" } } }),
    turn("Sim.", "confirm", "lead", "lead.delete", { referenceId: "lead-roberto", shouldMutate: true }, { pending: null }),
  ], { initial: active("lead", "lead-roberto", "Roberto Lima"), assertions: { persistence: ["lead-roberto deixa de existir"], expectedTrace: ["lead.delete após confirmação"], forbidden: ["delete_before_confirmation"] } }),
  goldenCase("CLIENT", "12", "Exclusão cancelada", "SUPPORTED_NOW", "P0", ["lead"], [
    turn("Exclui Roberto Lima.", "execute", "lead", selectedWithoutExecution("lead.delete"), { referenceId: "lead-roberto", shouldMutate: true, requiresConfirmation: true }, { pending: { capabilityId: "lead.delete", entity: "lead", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { leadId: "lead-roberto" } } }),
    turn("Não, deixa.", "reject", "lead", selectedWithoutExecution("lead.delete"), { referenceId: "lead-roberto", shouldMutate: false }, { pending: null }),
  ], { initial: active("lead", "lead-roberto", "Roberto Lima"), assertions: { persistence: ["lead-roberto permanece sem alteração"], forbidden: ["delete_lead", "ghost_confirmation"] } }),
  goldenCase("CLIENT", "13", "Timeline", "SUPPORTED_NOW", "P1", ["lead"], [
    turn("O que aconteceu com o Carlos ultimamente?", "query", "lead", "lead.timeline", { referenceId: "lead-carlos", shouldMutate: false }),
    turn("E antes disso?", "query", "lead", "lead.timeline", { referenceId: "lead-carlos", shouldMutate: false }),
  ], { initial: active("lead", "lead-carlos", "Carlos Mendes"), assertions: { fixture: ["timeline ordenada de Carlos Mendes com ao menos dois eventos"], workingSet: { active_client: "lead-carlos", timeline_cursor: "previous" }, forbidden: ["generic_clients_summary"] } }),

  goldenCase("PROPERTY", "14", "Busca natural", "SUPPORTED_NOW", "P1", ["property"], [
    turn("Procura apartamento em Gramado até 1 milhão.", "query", "property", "property.search", { shouldMutate: false }, { selection: { type: "property", query: "apartamento Gramado até 1000000", items: [{ id: "property-serra", label: "Residencial Serra" }, { id: "property-2", label: "Residencial 2" }, { id: "property-3", label: "Residencial 3" }, { id: "property-4", label: "Residencial 4" }] } }),
    turn("O mais barato.", "select", "property", "property.get", { referenceId: "property-serra", shouldMutate: false }, active("property", "property-serra", "Residencial Serra")),
    turn("Me fala mais dele.", "query", "property", "property.get", { referenceId: "property-serra", shouldMutate: false }),
  ], { assertions: { fixture: ["4 resultados; Residencial Serra é o menor preço, R$ 780 mil"], workingSet: { active_property: "property-serra", sort: "price_asc" }, forbidden: ["lose_selected_property"] } }),
  goldenCase("PROPERTY", "15", "Imóveis semelhantes", "SUPPORTED_NOW", "P0", ["property"], [
    turn("Abre o Solar.", "query", "property", selectedWithoutExecution("property.get"), { shouldMutate: false, shouldClarify: true }, { selection: { type: "property", query: "Solar", items: [{ id: "property-solar-residence", label: "Solar Residence" }, { id: "property-solar-comercial", label: "Solar Comercial" }, { id: "property-solar-norte", label: "Solar Norte" }] } }),
    turn("O comercial.", "select", "property", "property.get", { referenceId: "property-solar-comercial", shouldMutate: false }, active("property", "property-solar-comercial", "Solar Comercial")),
  ], { assertions: { workingSet: { active_property: "property-solar-comercial" }, forbidden: ["silent_entity_choice"] } }),
  goldenCase("PROPERTY", "16", "Estado de publicação", "SUPPORTED_NOW", "P1", ["property", "catalog", "marketplace"], [
    turn("Esse imóvel está publicado?", "query", "property", "property.get", { secondaryDomains: ["catalog", "marketplace"], referenceId: "property-solar-comercial", shouldMutate: false }),
  ], { initial: active("property", "property-solar-comercial", "Solar Comercial"), assertions: { fixture: ["published=true", "marketplacePublished=false"], requiredFacts: ["Catálogo publicado", "Marketplace não publicado"], forbidden: ["merge_publication_channels"] } }),
  goldenCase("PROPERTY", "17", "Publicação Catálogo válida", "SUPPORTED_NOW", "P0", ["property", "catalog"], [
    turn("Publica ele no Catálogo.", "execute", "catalog", selectedWithoutExecution("catalog.publish"), { secondaryDomains: ["property"], referenceId: "property-solar-comercial", shouldMutate: true, requiresConfirmation: true }, { pending: { capabilityId: "catalog.publish", entity: "property", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { propertyId: "property-solar-comercial" } } }),
    turn("Pode.", "confirm", "catalog", "catalog.publish", { secondaryDomains: ["property"], referenceId: "property-solar-comercial", shouldMutate: true }, { pending: null }),
  ], { initial: active("property", "property-solar-comercial", "Solar Comercial"), assertions: { stateBefore: ["property-solar-comercial.published=false", "readiness válido", "CRECI VERIFIED"], persistence: ["property-solar-comercial.published=true"], forbidden: ["success_without_persistence"] } }),
  goldenCase("PROPERTY", "18", "Catálogo com dados pendentes", "SUPPORTED_NOW", "P0", ["property", "catalog"], [
    turn("Publica esse imóvel no Catálogo.", "execute", "catalog", selectedWithoutExecution("catalog.publish"), { secondaryDomains: ["property"], referenceId: "property-catalog-incomplete", shouldMutate: true }),
  ], { initial: active("property", "property-catalog-incomplete", "Imóvel incompleto"), assertions: { stateBefore: ["preço ausente", "bairro ausente"], stateAfter: ["published=false"], responseIncludes: ["preço", "bairro"], sourceIssues: ["O readiness atual do Catálogo exige título, preço, cidade e CRECI verificado; bairro não é requisito no código."], forbidden: ["bypass_readiness", "claim_published", "generic_missing_data"] } }),
  goldenCase("PROPERTY", "19", "Marketplace com dados pendentes", "PRODUCT_EXISTS_COS_GAP", "P0", ["property", "marketplace"], [
    turn("Coloca esse imóvel no Marketplace.", "execute", "marketplace", referencedOnly(null, "marketplace.property.publish"), { secondaryDomains: ["property"], referenceId: "property-marketplace-incomplete", shouldMutate: false }),
    turn("Quantas imagens precisa?", "explain", "marketplace", knowledgeTopic("marketplace.image_requirements"), { secondaryDomains: ["property"], referenceId: "property-marketplace-incomplete", shouldMutate: false, knowledgeDocuments: ["marketplace"] }),
  ], { initial: active("property", "property-marketplace-incomplete", "Imóvel Marketplace incompleto"), assertions: { stateBefore: ["área ausente", "descrição incompleta", "3 imagens válidas"], stateAfter: ["marketplacePublished=false"], requiredFacts: ["4 a 6 imagens válidas"], knownGap: "Não existe capability de publicação no Marketplace.", knownGapLayer: "capability_selection", gracefulDegradation: ["reconhecer publicação Marketplace", "explicar pendências", "não simular execução"], futureContract: ["validar entitlement e readiness", "publicar pelo endpoint real"], forbidden: ["fake_marketplace_publish"] } }),
  goldenCase("PROPERTY", "20", "Pergunta sobre requisitos", "KNOWLEDGE_ONLY", "P1", ["marketplace"], [
    turn("O que precisa para publicar no Marketplace?", "explain", "marketplace", knowledgeTopic("marketplace.publication_requirements"), { shouldMutate: false, knowledgeDocuments: ["marketplace"] }),
  ], { assertions: { requiredFacts: ["bairro", "área positiva", "descrição mínima", "4 a 6 imagens válidas", "requisitos por tipo"], creditCharge: 0, forbidden: ["start_publication", "ask_property_without_need", "operational_workflow"] } }),
  goldenCase("PROPERTY", "21", "Diagnóstico concreto", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["property", "catalog"], [
    turn("Por que meu imóvel não aparece no catálogo?", "query", "catalog", selectedWithoutExecution("catalog.analyze"), { secondaryDomains: ["property"], shouldMutate: false, shouldClarify: true }, { selection: { type: "property", query: "imóvel fora do catálogo", items: [{ id: "property-solar-norte", label: "Solar Norte" }] }, topic: { domain: "catalog", label: "Diagnóstico de publicação", entityType: "property", useLatestSelection: true }, pending: { capabilityId: "catalog.analyze", entity: "property", field: "propertyChoice", label: "Imóvel", type: "selection", options: [{ id: "property-solar-norte", label: "Solar Norte" }] } }),
    turn("Solar Norte.", "select", "catalog", "catalog.analyze", { secondaryDomains: ["property"], referenceId: "property-solar-norte", shouldMutate: false }, { pending: null, activate: { type: "property", id: "property-solar-norte", label: "Solar Norte" }, topic: { domain: "catalog", label: "Diagnóstico do Solar Norte", entityType: "property" } }),
  ], { assertions: { fixture: ["uma causa concreta entre CRECI, published=false ou readiness"], requiredFacts: ["responder somente a causa persistida"], knownGap: "A análise atual não diagnostica todas as causas com a mesma regra da UI.", knownGapLayer: "knowledge_correctness", forbidden: ["generic_cause_list"] } }),
  goldenCase("PROPERTY", "22", "Catálogo × Marketplace", "KNOWLEDGE_ONLY", "P1", ["catalog", "marketplace"], [
    turn("Qual a diferença entre Catálogo e Marketplace?", "explain", "catalog", knowledgeTopic("catalog_marketplace.compare"), { secondaryDomains: ["marketplace"], shouldMutate: false, knowledgeDocuments: ["catalogo", "marketplace"] }),
    turn("Posso estar nos dois?", "explain", "catalog", knowledgeTopic("catalog_marketplace.concurrent_publication"), { secondaryDomains: ["marketplace"], shouldMutate: false, knowledgeDocuments: ["catalogo", "marketplace"] }),
  ], { assertions: { requiredFacts: ["Catálogo é vitrine individual", "Marketplace é ambiente agregado", "publicações independentes"], creditCharge: 0, forbidden: ["publish_any_channel"] } }),
  goldenCase("PROPERTY", "23", "Melhorar descrição", "SUPPORTED_NOW", "P1", ["property"], [
    turn("Essa descrição está fraca. Melhora.", "execute", "property", "property.description.improve", { referenceId: "property-description", shouldMutate: false }),
  ], { initial: active("property", "property-description", "Apartamento Centro"), assertions: { expectedArtifacts: ["texto de descrição, não persistido automaticamente"], requiredFacts: ["usar somente atributos do imóvel"], forbidden: ["invent_view", "invent_location_quality", "invent_luxury", "invent_pool", "invent_nearby_place"] } }),
  goldenCase("PROPERTY", "24", "Pergunta sobre efeito", "KNOWLEDGE_ONLY", "P2", ["property"], [
    turn("Se eu mandar melhorar a descrição, muda direto no imóvel?", "capability_question", "property", referencedOnly("property.description.improve"), { shouldMutate: false, knowledgeDocuments: ["imoveis"] }),
  ], { assertions: { requiredFacts: ["explicar se o texto é somente sugerido ou persistido pelo fluxo real"], creditCharge: 0, forbidden: ["improve_description", "operational_workflow"] } }),
  goldenCase("PROPERTY", "25", "Sugestão de preço", "SUPPORTED_NOW", "P2", ["property"], [
    turn("Quanto você acha que eu deveria pedir?", "query", "property", "property.price.suggest", { referenceId: "property-price", shouldMutate: false }),
  ], { initial: active("property", "property-price", "Imóvel para precificação"), assertions: { responseIncludes: ["referência operacional"], responseExcludes: ["laudo", "avaliação formal"], forbidden: ["claim_formal_appraisal"] } }),
  goldenCase("PROPERTY", "26", "Pergunta lateral sem perder fluxo", "SUPPORTED_NOW", "P1", ["property", "catalog"], [
    turn("Publica o Solar.", "execute", "catalog", selectedWithoutExecution("catalog.publish"), { secondaryDomains: ["property"], shouldMutate: true, shouldClarify: true }, { selection: { type: "property", query: "Solar", items: [{ id: "property-solar-comercial", label: "Solar Comercial" }, { id: "property-solar-norte", label: "Solar Norte" }] }, pending: { capabilityId: "catalog.publish", entity: "property", field: "propertyChoice", label: "Imóvel", type: "selection", options: [{ id: "property-solar-comercial", label: "Solar Comercial" }, { id: "property-solar-norte", label: "Solar Norte" }] } }),
    turn("Antes, qual deles está mais completo?", "query", "catalog", "catalog.analyze", { secondaryDomains: ["property"], shouldMutate: false }),
    turn("Então o Comercial.", "select", "catalog", selectedWithoutExecution("catalog.publish"), { secondaryDomains: ["property"], referenceId: "property-solar-comercial", shouldMutate: true, requiresConfirmation: true }, { pending: null, activate: { type: "property", id: "property-solar-comercial", label: "Solar Comercial" } }),
  ], { assertions: { workingSet: { pending_action: "catalog.publish", selected_property: "property-solar-comercial" }, forbidden: ["lose_pending_publish", "choose_wrong_solar"] } }),
  goldenCase("PROPERTY", "27", "Abandono", "SUPPORTED_NOW", "P1", ["property", "catalog", "lead"], [
    turn("Publica o Solar.", "execute", "catalog", selectedWithoutExecution("catalog.publish"), { secondaryDomains: ["property"], shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "catalog.publish", entity: "property", field: "propertyChoice", label: "Imóvel", type: "selection", options: [{ id: "property-solar-comercial", label: "Solar Comercial" }, { id: "property-solar-norte", label: "Solar Norte" }] } }),
    turn("Esquece. Me mostra meus clientes novos.", "switch_topic", "lead", "lead.summary", { shouldMutate: false }, { pending: null, topic: { domain: "lead", label: "Clientes novos", entityType: "lead" } }),
  ], { assertions: { workingSet: { active_topic: "clientes novos", abandoned_action: "catalog.publish" }, persistence: ["nenhum imóvel publicado"], forbidden: ["ghost_publish_workflow"] } }),

  goldenCase("PROPOSAL", "28", "Proposta com cliente ambíguo", "SUPPORTED_NOW", "P0", ["lead", "property", "proposal"], [
    turn("Faz uma proposta pro Carlos no Solar Comercial.", "execute", "proposal", selectedWithoutExecution("proposal.create"), { secondaryDomains: ["lead", "property"], referenceId: "property-solar-comercial", shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "proposal.create", entity: "proposal", field: "lead", label: "Cliente", type: "selection", parsedData: { propertyId: "property-solar-comercial" }, options: [{ id: "lead-carlos-mendes", label: "Carlos Mendes" }, { id: "lead-carlos-mendonca", label: "Carlos Mendonça" }] } }),
  ], { initial: active("property", "property-solar-comercial", "Solar Comercial"), assertions: { fixture: ["dois clientes Carlos"], persistence: ["nenhuma proposta antes da seleção"], forbidden: ["silent_client_choice", "mutate_before_selection"] } }),
  goldenCase("PROPOSAL", "29", "Proposta completa", "SUPPORTED_NOW", "P1", ["lead", "property", "proposal"], [
    turn("Cria uma proposta de 800 mil do Solar Comercial para Carlos Mendes.", "execute", "proposal", "proposal.create", { secondaryDomains: ["property", "lead"], shouldMutate: true }),
  ], { assertions: { stateAfter: ["proposta ligada a lead-carlos-mendes e property-solar-comercial", "valor=800000"], persistence: ["BrokerDocument proposal criado"], forbidden: ["invent_down_payment", "invent_installments", "invent_validity", "invent_payment_method", "invent_conditions"] } }),
  goldenCase("PROPOSAL", "30", "Correção de valor pendente", "SUPPORTED_NOW", "P1", ["proposal"], [
    turn("Faz de 800 mil.", "provide_input", "proposal", "proposal.create", { shouldMutate: true }),
    turn("Não, 780.", "correct", "proposal", "proposal.create", { shouldMutate: true }),
  ], { initial: { pending: { capabilityId: "proposal.create", entity: "proposal", field: "price", label: "Valor", type: "currency", parsedData: { leadId: "lead-carlos-mendes", propertyId: "property-solar-comercial" } } }, assertions: { workingSet: { active_client: "lead-carlos-mendes", active_property: "property-solar-comercial", proposal_price: "780000" }, persistence: ["no máximo uma proposta, valor 780000"], forbidden: ["lose_client", "lose_property", "persist_800000"] } }),
  goldenCase("PROPOSAL", "31", "Pergunta sobre proposta", "KNOWLEDGE_ONLY", "P1", ["proposal"], [
    turn("Dá para criar proposta sem cliente cadastrado?", "capability_question", "proposal", referencedOnly("proposal.create"), { shouldMutate: false, knowledgeDocuments: ["propostas"] }),
  ], { assertions: { requiredFacts: ["UI aceita dados manuais", "COS atual exige cliente e imóvel selecionados"], creditCharge: 0, forbidden: ["create_proposal", "create_lead"] } }),
  goldenCase("PROPOSAL", "32", "Proposta → compromisso", "SUPPORTED_NOW", "P1", ["proposal", "agenda", "lead"], [
    turn("Marca pra eu falar com ele amanhã.", "execute", "agenda", selectedWithoutExecution("agenda.create"), { secondaryDomains: ["lead", "proposal"], referenceId: "lead-carlos-mendes", shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "agenda.create", entity: "agenda", field: "time", label: "Horário", type: "time", parsedData: { leadId: "lead-carlos-mendes", date: "tomorrow" } } }),
    turn("14h.", "provide_input", "agenda", "agenda.create", { secondaryDomains: ["lead"], referenceId: "lead-carlos-mendes", shouldMutate: true }, { pending: null }),
  ], { initial: active("lead", "lead-carlos-mendes", "Carlos Mendes"), assertions: { workingSet: { active_client: "lead-carlos-mendes", prior_object: "proposal" }, persistence: ["AgendaEvent com Carlos Mendes amanhã às 14h"], forbidden: ["ask_client_again"] } }),

  goldenCase("AGENDA", "33", "Hoje → amanhã", "SUPPORTED_NOW", "P1", ["agenda"], [
    turn("O que tenho hoje?", "query", "agenda", "agenda.today", { shouldMutate: false }),
    turn("E amanhã?", "query", "agenda", "agenda.list", { shouldMutate: false }, { selection: { type: "agenda", query: "amanhã", items: [{ id: "agenda-tomorrow-1", label: "Visita com Carlos" }, { id: "agenda-tomorrow-2", label: "Retorno com Fernanda" }] } }),
    turn("O primeiro é com quem?", "query", "agenda", "agenda.list", { referenceId: "agenda-tomorrow-1", shouldMutate: false }),
  ], { assertions: { workingSet: { active_period: "tomorrow", selected_event: "agenda-tomorrow-1" }, forbidden: ["reference_today_list"] } }),
  goldenCase("AGENDA", "34", "Criar visita", "SUPPORTED_NOW", "P1", ["agenda", "lead", "property"], [
    turn("Marca visita no Solar com Carlos amanhã às 15.", "execute", "agenda", selectedWithoutExecution("agenda.create"), { secondaryDomains: ["property", "lead"], referenceId: "property-solar-comercial", shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "agenda.create", entity: "agenda", field: "lead", label: "Cliente", type: "selection", parsedData: { propertyId: "property-solar-comercial", date: "tomorrow", time: "15:00" }, options: [{ id: "lead-carlos-mendes", label: "Carlos Mendes" }, { id: "lead-carlos-mendonca", label: "Carlos Mendonça" }] } }),
  ], { initial: active("property", "property-solar-comercial", "Solar Comercial"), assertions: { persistence: ["nenhum AgendaEvent antes da seleção inequívoca"], forbidden: ["mutate_before_client_selection", "silent_client_choice"] } }),
  goldenCase("AGENDA", "35", "Remarcar data", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["agenda"], [
    turn("Passa a visita de amanhã para sexta.", "execute", "agenda", "agenda.update", { referenceId: "agenda-visit", shouldMutate: true }),
  ], { initial: active("agenda", "agenda-visit", "Visita de amanhã"), assertions: { stateBefore: ["agenda-visit.date=tomorrow"], persistence: ["agenda-visit.date=next_friday"], knownGap: "O descriptor aceita data, mas o handler atual não persiste a data.", knownGapLayer: "persistence", forbidden: ["claim_updated_without_date_change"] } }),
  goldenCase("AGENDA", "36", "Cancelamento", "SUPPORTED_NOW", "P0", ["agenda"], [
    turn("Cancela minha visita das 15.", "execute", "agenda", selectedWithoutExecution("agenda.cancel"), { referenceId: "agenda-15", shouldMutate: true, requiresConfirmation: true }),
  ], { initial: active("agenda", "agenda-15", "Visita das 15h"), assertions: { fixture: ["uma visita às 15h; variação com duas deve exigir seleção"], persistence: ["somente após confirmação: status=cancelled"], forbidden: ["cancel_without_confirmation", "silent_event_choice"] } }),

  goldenCase("CONTRACT", "37", "O que o EME faz", "KNOWLEDGE_ONLY", "P1", ["contract"], [
    turn("O que o EME faz com contratos?", "explain", "contract", knowledgeTopic("contract.product_scope"), { shouldMutate: false, knowledgeDocuments: ["contratos"] }),
  ], { assertions: { requiredFacts: ["preparar, completar e organizar contratos", "relacionar cliente e imóvel", "sem assinatura digital nativa"], creditCharge: 0, forbidden: ["claim_native_esign", "start_contract_workflow"] } }),
  goldenCase("CONTRACT", "38", "Assinatura no EME", "KNOWLEDGE_ONLY", "P0", ["contract"], [
    turn("O cliente consegue assinar contrato pelo EME?", "explain", "contract", knowledgeTopic("contract.native_signature"), { shouldMutate: false, knowledgeDocuments: ["contratos"] }),
  ], { assertions: { requiredFacts: ["não há assinatura digital nativa", "assinatura ocorre fora da plataforma"], creditCharge: 0, forbidden: ["start_contract", "claim_native_esign"] } }),
  goldenCase("CONTRACT", "39", "Pedido de assinatura", "NOT_SUPPORTED", "P0", ["contract"], [
    turn("Assina esse contrato pra mim.", "execute", "contract", referencedOnly(null, "contract.native_signature"), { referenceId: "contract-active", shouldMutate: false }),
  ], { initial: active("contract", "contract-active", "Contrato ativo"), assertions: { gracefulDegradation: ["explicar ausência de assinatura digital", "oferecer preparação, revisão operacional ou organização"], responseExcludes: ["assinado com sucesso"], forbidden: ["contract.sign", "treat_mark_signed_as_esign"] } }),
  goldenCase("CONTRACT", "40", "Contrato moderno", "PRODUCT_EXISTS_COS_GAP", "P0", ["contract"], [
    turn("Usa o modelo de contrato que importei ontem e monta um para o João.", "execute", "contract", referencedOnly(null, "contract.template_instance.create"), { shouldMutate: false }),
  ], { assertions: { fixture: ["ContractTemplate importado ontem, versão READY, João inequívoco"], stateAfter: ["nenhuma ContractTemplateInstance e nenhum contrato legado criado"], knownGap: "O COS opera BrokerDocument legado, não Template → Version → Instance.", knownGapLayer: "capability_selection", gracefulDegradation: ["reconhecer template moderno", "orientar para Contratos"], futureContract: ["selecionar template/version", "criar ContractTemplateInstance"], forbidden: ["create_legacy_contract_as_template_instance"] } }),
  goldenCase("CONTRACT", "41", "Análise documental moderna", "PRODUCT_EXISTS_COS_GAP", "P0", ["contract"], [
    turn("Tem alguma coisa errada nesse contrato?", "query", "contract", referencedOnly(null, "contract.template_instance.review"), { referenceId: "contract-modern", shouldMutate: false }),
  ], { initial: active("contract", "contract-modern", "Contrato moderno"), assertions: { knownGap: "A análise/readiness da engine moderna não está exposta ao COS.", knownGapLayer: "capability_selection", gracefulDegradation: ["delimitar revisão operacional", "não emitir parecer jurídico"], futureContract: ["consultar campos faltantes e inconsistências da instância"], sourceIssues: ["O texto não define se o comportamento atual é só orientação ou uma análise operacional reduzida."], forbidden: ["claim_legally_correct"] } }),
  goldenCase("CONTRACT", "42", "Pergunta sobre ponto analisado", "PRODUCT_EXISTS_COS_GAP", "P1", ["contract"], [
    turn("Analisa esse contrato.", "query", "contract", referencedOnly(null, "contract.template_instance.review"), { referenceId: "contract-modern", shouldMutate: false }),
    turn("O que significa esse ponto que você marcou?", "explain", "contract", referencedOnly(null, "contract.template_instance.finding.explain"), { referenceId: "contract-modern", shouldMutate: false }),
  ], { initial: active("contract", "contract-modern", "Contrato moderno"), assertions: { workingSet: { active_contract: "contract-modern", active_finding: "fixture-finding-1" }, knownGap: "Não há capability de análise moderna nem resultado estruturado para referência.", knownGapLayer: "working_set", gracefulDegradation: ["não simular análise inexistente"], futureContract: ["explicar finding anterior específico"], sourceIssues: ["O segundo turno pressupõe um resultado anterior que o contrato atual do gap não produz; a fixture precisa preseedar o finding."], forbidden: ["generic_contract_menu", "claim_unperformed_analysis"] } }),
  goldenCase("CONTRACT", "43", "Mudança de referente", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["contract", "lead"], [
    turn("Esse contrato é de quem?", "query", "contract", "contract.get", { secondaryDomains: ["lead"], referenceId: "contract-carlos", shouldMutate: false }, active("lead", "lead-carlos-mendes", "Carlos Mendes")),
    turn("Tem mais documento dele?", "query", "lead", "document.list", { secondaryDomains: ["contract"], referenceId: "lead-carlos-mendes", shouldMutate: false }),
  ], { initial: active("contract", "contract-carlos", "Contrato de Carlos Mendes"), assertions: { fixture: ["contrato ligado a Carlos Mendes; outros documentos ligados ao mesmo lead"], workingSet: { active_contract: "contract-carlos", active_client: "lead-carlos-mendes" }, knownGap: "A mudança de referente contrato → cliente → documentos não tem paridade completa.", knownGapLayer: "reference_resolution", forbidden: ["resolve_dele_as_contract"] } }),

  goldenCase("STUDIO", "44", "Campanha genérica", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["studio", "property"], [
    turn("Quero criar uma campanha para esse imóvel.", "execute", "studio", selectedWithoutExecution("studio.generateCampaign"), { secondaryDomains: ["property"], referenceId: "property-studio", shouldMutate: true, shouldClarify: true }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { knownGap: "A capability genérica não tem paridade com todos os fluxos reais do Studio.", knownGapLayer: "persistence", requiredFacts: ["pedir somente tipo/objetivo realmente necessário"], forbidden: ["generic_menu_without_legitimate_choice"] } }),
  goldenCase("STUDIO", "45", "Campanha Instagram", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["studio", "property"], [
    turn("Cria uma campanha para Instagram desse imóvel.", "execute", "studio", "studio.generateInstagram", { secondaryDomains: ["property"], referenceId: "property-studio", shouldMutate: true }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { expectedTrace: ["studio.generateInstagram", "provider somente se o handler real o suportar"], persistence: ["campaign/assets realmente produzidos"], expectedArtifacts: ["copy ou campanha conforme artefato persistido"], creditCharge: 10, knownGap: "O handler do COS pode persistir apenas copy simplificada, sem pipeline completo.", knownGapLayer: "persistence", forbidden: ["claim_full_campaign_when_copy_only", "charge_wrong_cost"] } }),
  goldenCase("STUDIO", "46", "Vídeo", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["studio", "property"], [
    turn("Faz um vídeo desse imóvel.", "execute", "studio", "studio.generateVideo", { secondaryDomains: ["property"], referenceId: "property-studio", shouldMutate: true }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { expectedArtifacts: ["roteiro quando só roteiro existir; asset de vídeo quando vídeo real existir"], creditCharge: 38, knownGap: "A capability do COS prepara roteiro, não necessariamente vídeo renderizado.", knownGapLayer: "persistence", sourceIssues: ["O caso é condicional e precisa de variantes separadas para roteiro e asset real."], forbidden: ["call_script_video", "claim_video_without_video_asset"] } }),
  goldenCase("STUDIO", "47", "Pergunta sobre custo", "KNOWLEDGE_ONLY", "P1", ["studio"], [
    turn("Quanto custa gerar esse vídeo?", "capability_question", "studio", referencedOnly("studio.generateVideo"), { referenceId: "property-studio", shouldMutate: false, knowledgeDocuments: ["studio"] }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { requiredFacts: ["custo do fluxo de vídeo aplicável"], creditCharge: 0, forbidden: ["start_video_generation"] } }),
  goldenCase("STUDIO", "48", "Pergunta no meio da geração", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["studio"], [
    turn("Cria a campanha.", "execute", "studio", selectedWithoutExecution("studio.generateCampaign"), { referenceId: "property-studio", shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "studio.generateCampaign", entity: "property", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { propertyId: "property-studio" } } }),
    turn("Antes, isso custa quantos créditos?", "capability_question", "studio", referencedOnly("studio.generateCampaign"), { referenceId: "property-studio", shouldMutate: false, knowledgeDocuments: ["studio"] }),
    turn("Tá, pode fazer.", "confirm", "studio", "studio.generateCampaign", { referenceId: "property-studio", shouldMutate: true }, { pending: null }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { workingSet: { pending_action: "studio.generateCampaign", active_property: "property-studio" }, knownGap: "Interrupção por custo e retorno ao workflow do Studio não têm cobertura integral.", knownGapLayer: "working_set", forbidden: ["lose_generation_workflow", "charge_help_turn"] } }),
  goldenCase("STUDIO", "49", "Créditos insuficientes", "SUPPORTED_NOW", "P0", ["studio"], [
    turn("Faz um vídeo desse imóvel.", "execute", "studio", selectedWithoutExecution("studio.generateVideo"), { referenceId: "property-studio", shouldMutate: true }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { stateBefore: ["saldo=5", "custo=38"], stateAfter: ["saldo=5", "nenhuma campaign/job/asset"], expectedTrace: ["provider não chamado"], creditCharge: 0, failureClass: "insufficient_credit", entitlement: "saldo abaixo do custo", forbidden: ["partial_hidden_charge", "automatic_credit_purchase", "claim_success"] } }),
  goldenCase("STUDIO", "50", "Por que existem créditos?", "KNOWLEDGE_ONLY", "P2", ["general", "studio"], [
    turn("Por que o COS usa créditos?", "explain", "general", knowledgeTopic("ai_credits.purpose"), { secondaryDomains: ["studio"], shouldMutate: false, knowledgeDocuments: ["planos-conta"] }),
  ], { assertions: { requiredFacts: ["operações de IA podem consumir", "ajuda e algumas consultas podem ser gratuitas", "custo depende da operação"], creditCharge: 0, forbidden: ["open_checkout", "open_plan", "operational_workflow"] } }),

  goldenCase("ANALYTICS", "51", "Mais visto no período", "SUPPORTED_NOW", "P2", ["analytics", "property"], [
    turn("Qual imóvel teve mais visualizações nos últimos 30 dias?", "query", "analytics", "analytics.properties", { secondaryDomains: ["property"], shouldMutate: false }, active("property", "property-most-viewed", "Imóvel mais visto")),
    turn("E contatos?", "query", "analytics", "analytics.performance", { secondaryDomains: ["property"], referenceId: "property-most-viewed", shouldMutate: false }),
  ], { assertions: { fixture: ["eventos determinísticos nos últimos 30 dias"], workingSet: { period: "30d", active_property: "property-most-viewed", metric: "contacts" }, forbidden: ["reset_period"] } }),
  goldenCase("ANALYTICS", "52", "Comparação", "SUPPORTED_NOW", "P2", ["analytics", "property"], [
    turn("Solar ou Atlântico teve mais procura?", "query", "analytics", selectedWithoutExecution("analytics.performance"), { secondaryDomains: ["property"], shouldMutate: false, shouldClarify: true }),
  ], { assertions: { fixture: ["vencedores distintos para views, leads e contatos"], requiredFacts: ["pedir a métrica quando procura é ambígua"], sourceIssues: ["O material também prevê variante com contexto que define procura; ela precisa de case separado."], forbidden: ["choose_arbitrary_metric"] } }),
  goldenCase("ANALYTICS", "53", "O que estão procurando?", "SUPPORTED_NOW", "P2", ["analytics"], [
    turn("O que as pessoas estão procurando?", "query", "analytics", "analytics.performance", { shouldMutate: false }),
    turn("Tem muita gente buscando casa?", "query", "analytics", "analytics.performance", { shouldMutate: false }),
  ], { assertions: { fixture: ["SearchEvent e CatalogEvent reais"], requiredFacts: ["responder a partir de buscas/eventos"], forbidden: ["offer_register_house_without_request"] } }),
  goldenCase("ANALYTICS", "54", "Saúde operacional", "SUPPORTED_NOW", "P1", ["analytics"], [
    turn("Por que minha operação está em 62%?", "query", "analytics", "operation.summary", { shouldMutate: false }),
    turn("O que resolvo primeiro?", "query", "analytics", "operation.summary", { shouldMutate: false }),
  ], { assertions: { fixture: ["fatores da fórmula que resultam exatamente em 62%"], workingSet: { health_score: "62", active_factors: "fixture-health-factors" }, requiredFacts: ["explicar e priorizar os mesmos fatores"], forbidden: ["invent_health_factor"] } }),

  goldenCase("KNOWLEDGE", "55", "O que o COS faz?", "KNOWLEDGE_ONLY", "P1", ["general"], [
    turn("O que você consegue fazer?", "explain", "general", referencedOnly("help.use_cos"), { shouldMutate: false, knowledgeDocuments: ["cos", "capacidades-cos"] }),
  ], { assertions: { requiredFacts: ["resumo natural por grandes capacidades"], creditCharge: 0, forbidden: ["dump_74_actions", "operational_workflow"] } }),
  goldenCase("KNOWLEDGE", "56", "“E com clientes?”", "KNOWLEDGE_ONLY", "P2", ["lead"], [
    turn("O que você consegue fazer?", "explain", "general", referencedOnly("help.use_cos"), { shouldMutate: false }),
    turn("E com clientes?", "explain", "lead", referencedOnly("help.manage_clients"), { shouldMutate: false, knowledgeDocuments: ["clientes"] }),
  ], { assertions: { workingSet: { capability_topic: "lead" }, requiredFacts: ["resposta restrita a Clientes"], creditCharge: 0, forbidden: ["repeat_all_capabilities"] } }),
  goldenCase("KNOWLEDGE", "57", "Mudar senha", "PRODUCT_EXISTS_COS_GAP", "P1", ["account"], [
    turn("Dá pra mudar minha senha por aqui?", "capability_question", "account", referencedOnly(null, "account.password.change"), { shouldMutate: false }),
  ], { assertions: { knownGap: "Conta e segurança não têm capability no COS.", knownGapLayer: "domain", gracefulDegradation: ["reconhecer alteração de senha", "orientar Conta e segurança"], futureContract: ["preservar reautenticação e política existente"], forbidden: ["claim_unknown", "change_password"] } }),
  goldenCase("KNOWLEDGE", "58", "Responder Marketplace", "PRODUCT_EXISTS_COS_GAP", "P1", ["marketplace"], [
    turn("Responde aquele cliente do Marketplace dizendo que o imóvel ainda está disponível.", "execute", "marketplace", referencedOnly(null, "marketplace.conversation.reply"), { shouldMutate: false }),
  ], { assertions: { fixture: ["conversa Marketplace identificável"], knownGap: "Não há capability de mensagens Marketplace.", knownGapLayer: "capability_selection", gracefulDegradation: ["reconhecer conteúdo e conversa", "orientar para Marketplace"], futureContract: ["selecionar conversa", "enviar mensagem real"], forbidden: ["fake_message_sent", "generic_fallback"] } }),
  goldenCase("KNOWLEDGE", "59", "Aprovar arte", "PRODUCT_EXISTS_COS_GAP", "P1", ["library", "studio"], [
    turn("Aprova a última arte que fiz.", "execute", "library", referencedOnly(null, "library.asset.approve"), { secondaryDomains: ["studio"], shouldMutate: false }),
  ], { assertions: { fixture: ["último StudioCampaignAsset identificável"], knownGap: "Biblioteca não tem capabilities no COS.", knownGapLayer: "domain", gracefulDegradation: ["reconhecer aprovação", "orientar para Biblioteca"], futureContract: ["selecionar asset", "aprovar com regra de status"], forbidden: ["fake_asset_approval"] } }),
  goldenCase("KNOWLEDGE", "60", "Onde ficam as artes?", "KNOWLEDGE_ONLY", "P2", ["library", "studio"], [
    turn("Onde ficam as artes que eu gero?", "explain", "library", referencedOnly("help.marketing_studio"), { secondaryDomains: ["studio"], shouldMutate: false, knowledgeDocuments: ["studio"] }),
  ], { assertions: { requiredFacts: ["materiais ficam na Biblioteca do Studio"], creditCharge: 0, forbidden: ["start_studio_generation"] } }),

  goldenCase("CONTEXT", "61", "Referência informal", "SUPPORTED_NOW", "P1", ["lead"], [
    turn("Aquele cara que queria apartamento em Caxias, quem era?", "query", "lead", "lead.find", { shouldMutate: false }),
  ], { assertions: { fixture: ["um candidato inequívoco; variante com dois candidatos"], requiredFacts: ["responder o candidato único ou desambiguar"], sourceIssues: ["O cenário condicional exige ao menos duas variantes determinísticas."], forbidden: ["fabricate_certainty"] } }),
  goldenCase("CONTEXT", "62", "Referência distante", "SUPPORTED_NOW", "P0", ["lead", "property"], [
    turn("Abre o Carlos Mendes.", "query", "lead", "lead.find", { shouldMutate: false }, active("lead", "lead-carlos-mendes", "Carlos Mendes")),
    turn("Quantos imóveis tenho publicados?", "switch_topic", "property", "analytics.properties", { shouldMutate: false }),
    turn("E aquele cliente, em que etapa está?", "return_topic", "lead", "lead.find", { referenceId: "lead-carlos-mendes", shouldMutate: false }),
  ], { assertions: { workingSet: { distant_client: "lead-carlos-mendes" }, forbidden: ["lose_distant_reference"] } }),
  goldenCase("CONTEXT", "63", "Alternância ele/ela", "SUPPORTED_NOW", "P0", ["property", "lead", "proposal"], [
    turn("Me mostra o Solar Comercial.", "query", "property", "property.get", { referenceId: "property-solar-comercial", shouldMutate: false }, active("property", "property-solar-comercial", "Solar Comercial")),
    turn("Tem cliente pra ele?", "query", "lead", "lead.summary", { secondaryDomains: ["property"], referenceId: "property-solar-comercial", shouldMutate: false }),
    turn("A Fernanda serve?", "query", "lead", "lead.find", { secondaryDomains: ["property"], referenceId: "lead-fernanda", shouldMutate: false }, active("lead", "lead-fernanda", "Fernanda Alves")),
    turn("E ela já recebeu proposta?", "query", "proposal", "proposal.summary", { secondaryDomains: ["lead"], referenceId: "lead-fernanda", shouldMutate: false }),
  ], { assertions: { workingSet: { active_property: "property-solar-comercial", active_client: "lead-fernanda" }, forbidden: ["resolve_ele_as_lead", "resolve_ela_as_property"] } }),
  goldenCase("CONTEXT", "64", "Multi-step", "SUPPORTED_NOW", "P1", ["lead", "property"], [
    turn("Cadastra Pedro, ele procura casa até 900 mil em Porto Alegre, depois vê se tenho alguma coisa.", "execute", "lead", "lead.create", { secondaryDomains: ["property"], shouldMutate: true }, active("lead", "lead-pedro", "Pedro")),
  ], { assertions: { expectedTrace: ["lead.create", "property.search"], workingSet: { active_client: "lead-pedro", property_type: "Casa", city: "Porto Alegre", max_price: "900000" }, persistence: ["Pedro criado uma vez"], partialSuccess: ["resultado deve discriminar criação e busca"], forbidden: ["reselect_new_lead"] } }),
  goldenCase("CONTEXT", "65", "Multi-step com dado faltante", "SUPPORTED_NOW", "P1", ["lead", "property"], [
    turn("Cadastra Ana Martins, procura apartamento até 600 mil e vê o que tenho.", "execute", "lead", "lead.create", { secondaryDomains: ["property"], shouldMutate: true, shouldClarify: true }, { activate: { type: "lead", id: "lead-ana-martins", label: "Ana Martins" }, pending: { capabilityId: "property.search", entity: "property", field: "city", label: "Cidade ou região", type: "text", parsedData: { leadId: "lead-ana-martins", type: "Apartamento", maxPrice: 600000 } } }),
  ], { assertions: { workingSet: { active_client: "lead-ana-martins", property_type: "Apartamento", max_price: "600000", pending_field: "city" }, persistence: ["Ana Martins criada"], partialSuccess: ["cadastro concluído; busca aguardando somente cidade/região"], forbidden: ["ask_known_name", "ask_known_type", "ask_known_price"] } }),
  goldenCase("CONTEXT", "66", "Sucesso parcial por falta de informação", "SUPPORTED_NOW", "P0", ["lead", "proposal"], [
    turn("Cadastra Lucas e cria uma proposta pra ele.", "execute", "lead", "lead.create", { secondaryDomains: ["proposal"], shouldMutate: true, shouldClarify: true }, { activate: { type: "lead", id: "lead-lucas", label: "Lucas" }, pending: { capabilityId: "proposal.create", entity: "proposal", field: "property", label: "Imóvel", type: "selection", parsedData: { leadId: "lead-lucas" } } }),
  ], { assertions: { persistence: ["Lead Lucas criado", "nenhuma proposta criada"], partialSuccess: ["step 1 success", "step 2 awaiting property"], forbidden: ["claim_total_failure", "claim_proposal_created"] } }),
  goldenCase("CONTEXT", "67", "Falha técnica", "SUPPORTED_NOW", "P0", ["property", "catalog"], [
    turn("Publica o Solar Comercial no Catálogo.", "execute", "catalog", selectedWithoutExecution("catalog.publish"), { secondaryDomains: ["property"], referenceId: "property-solar-comercial", shouldMutate: true, requiresConfirmation: true }, { pending: { capabilityId: "catalog.publish", entity: "property", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { propertyId: "property-solar-comercial" } } }),
    turn("Pode.", "confirm", "catalog", "catalog.publish", { secondaryDomains: ["property"], referenceId: "property-solar-comercial", shouldMutate: true }, { pending: null }),
  ], { initial: active("property", "property-solar-comercial", "Solar Comercial"), assertions: { fixture: ["readiness e créditos válidos; API de persistência falha após confirmação"], stateAfter: ["published=false"], failureClass: "technical_error", responseIncludes: ["erro do sistema", "continua sem alteração"], forbidden: ["classify_missing_data", "classify_insufficient_credit", "classify_not_found"] } }),
  goldenCase("CONTEXT", "68", "Idempotência", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["proposal"], [
    turn("Cria proposta de 800 mil pro Carlos.", "execute", "proposal", "proposal.create", { referenceId: "lead-carlos-mendes", shouldMutate: true }),
    turn("Foi?", "query", "proposal", "proposal.summary", { referenceId: "proposal-timeout", shouldMutate: false }),
  ], { initial: active("lead", "lead-carlos-mendes", "Carlos Mendes"), assertions: { fixture: ["imóvel ativo e idempotency key; commit ocorre antes do timeout"], persistence: ["exatamente uma proposta de 800000"], knownGap: "Não há verificação idempotente completa antes de repetir a criação.", knownGapLayer: "persistence", sourceIssues: ["O texto não fornece imóvel/working set e contém duas saídas condicionais; esta case fixa a variante commit-before-timeout."], forbidden: ["duplicate_proposal"] } }),
  goldenCase("CONTEXT", "69", "Confirmação informal", "SUPPORTED_NOW", "P1", ["lead"], [
    turn("Manda bala.", "confirm", "lead", "lead.delete", { referenceId: "lead-roberto", shouldMutate: true }),
  ], { initial: { activate: { type: "lead", id: "lead-roberto", label: "Roberto Lima" }, pending: { capabilityId: "lead.delete", entity: "lead", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { leadId: "lead-roberto" } } }, assertions: { fixture: ["pending inequívoco de exclusão; expressões adicionais devem ser parametrizadas"], persistence: ["lead-roberto excluído após confirmação informal"], sourceIssues: ["O texto lista várias expressões e risco variável; uma fixture única não cobre a matriz."], forbidden: ["treat_clear_confirmation_as_unknown"] } }),
  goldenCase("CONTEXT", "70", "Recusa + nova intenção", "SUPPORTED_NOW", "P1", ["lead"], [
    turn("Não, só queria ver o cadastro.", "reject", "lead", "lead.find", { referenceId: "lead-roberto", shouldMutate: false }, { pending: null }),
  ], { initial: { activate: { type: "lead", id: "lead-roberto", label: "Roberto Lima" }, pending: { capabilityId: "lead.delete", entity: "lead", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { leadId: "lead-roberto" } } }, assertions: { persistence: ["lead-roberto permanece"], partialSuccess: ["rejeitar exclusão e executar consulta"], forbidden: ["respond_only_cancelled", "delete_lead"] } }),
  goldenCase("CONTEXT", "71", "Dúvida no meio de ação", "SUPPORTED_NOW", "P1", ["property", "catalog", "lead"], [
    turn("Publica esse imóvel no Catálogo.", "execute", "catalog", "catalog.publish", { secondaryDomains: ["property"], referenceId: "property-incomplete", shouldMutate: true }),
    turn("Por que precisa disso?", "explain", "catalog", referencedOnly("help.general_question"), { secondaryDomains: ["property"], referenceId: "property-incomplete", shouldMutate: false }),
    turn("Tá, depois eu completo. Agora procura algo pro Carlos.", "switch_topic", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-carlos-mendes", shouldMutate: false }, { pending: null, activate: { type: "lead", id: "lead-carlos-mendes", label: "Carlos Mendes" } }),
  ], { initial: active("property", "property-incomplete", "Imóvel incompleto"), assertions: { workingSet: { active_client: "lead-carlos-mendes", abandoned_action: "catalog.publish" }, persistence: ["property-incomplete permanece não publicado"], forbidden: ["keep_publish_as_active_workflow"] } }),
  goldenCase("CONTEXT", "72", "Verbo operacional dentro de pergunta", "KNOWLEDGE_ONLY", "P0", ["general"], [
    turn("Como excluo?", "explain", "general", referencedOnly("help.general_question"), { shouldMutate: false }),
    turn("O que acontece se eu publicar?", "explain", "general", referencedOnly("help.general_question"), { shouldMutate: false }),
    turn("Dá pra criar contrato?", "capability_question", "contract", referencedOnly("contract.create"), { shouldMutate: false }),
    turn("Como cadastro imóvel?", "explain", "property", referencedOnly("help.register_properties"), { shouldMutate: false }),
  ], { assertions: { creditCharge: 0, forbidden: ["hidden_delete", "hidden_publish", "hidden_contract_create", "hidden_property_create"] } }),
  goldenCase("CONTEXT", "73", "Exemplo citado", "KNOWLEDGE_ONLY", "P0", ["lead"], [
    turn("Se eu falar ‘cadastra o João’, você cadastra?", "capability_question", "lead", referencedOnly("lead.create"), { shouldMutate: false }),
  ], { assertions: { requiredFacts: ["explicar comportamento sem executar o exemplo citado"], creditCharge: 0, forbidden: ["create_joao"] } }),
  goldenCase("CONTEXT", "74", "Recomendação → execução", "SUPPORTED_NOW", "P1", ["studio", "property"], [
    turn("Preciso divulgar mais esse imóvel. O que você recomenda?", "query", "studio", "help.marketing_studio", { secondaryDomains: ["property"], referenceId: "property-studio", shouldMutate: false }),
    turn("Faz a campanha de Instagram então.", "execute", "studio", selectedWithoutExecution("studio.generateInstagram"), { secondaryDomains: ["property"], referenceId: "property-studio", shouldMutate: true, requiresConfirmation: true }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { requiredFacts: ["recomendar somente fluxos reais e compatíveis"], sourceIssues: ["O segundo turno equivale ao cenário 45, classificado como SUPPORTED_WITH_KNOWN_GAP, mas esta conversa é SUPPORTED_NOW."], forbidden: ["execute_on_recommendation_turn"] } }),
  goldenCase("CONTEXT", "75", "Jornada completa", "SUPPORTED_NOW", ["P0", "P1"], ["lead", "property", "proposal", "agenda"], [
    turn("Quem está precisando de atenção?", "query", "lead", "lead.summary", { shouldMutate: false }, active("lead", "lead-carlos-mendes", "Carlos Mendes")),
    turn("O que ele procura mesmo?", "query", "lead", "lead.find", { referenceId: "lead-carlos-mendes", shouldMutate: false }),
    turn("Tenho algo bom pra ele?", "query", "property", "property.search", { secondaryDomains: ["lead"], referenceId: "lead-carlos-mendes", shouldMutate: false }, active("property", "property-solar-comercial", "Solar Comercial")),
    turn("Quanto está?", "query", "property", "property.get", { referenceId: "property-solar-comercial", shouldMutate: false }),
    turn("Já fiz proposta?", "query", "proposal", "proposal.summary", { secondaryDomains: ["lead", "property"], referenceId: "lead-carlos-mendes", shouldMutate: false }, active("proposal", "proposal-carlos-solar", "Proposta Carlos + Solar")),
    turn("Marca amanhã às 10.", "execute", "agenda", "agenda.create", { secondaryDomains: ["lead"], referenceId: "lead-carlos-mendes", shouldMutate: true }),
  ], { assertions: { fixture: ["Carlos NEGOTIATING, comercial em Porto Alegre até 900000", "Solar Comercial, 850000", "proposta Carlos+Solar, 780000"], workingSet: { active_client: "lead-carlos-mendes", active_property: "property-solar-comercial", active_proposal: "proposal-carlos-solar", topic: "negociação" }, persistence: ["AgendaEvent amanhã 10:00 ligado a Carlos Mendes"], sourceIssues: ["A jornada contém matching equivalente ao cenário 3, classificado como known gap, mas a jornada inteira está como SUPPORTED_NOW.", "Prioridade P0/P1 não pertence ao enum de prioridade única; preservada como duas prioridades."], forbidden: ["lose_working_set", "ask_known_client"] } }),

  goldenCase("PLAN", "76", "Plano atual", "PRODUCT_EXISTS_COS_GAP", "P1", ["plan"], [
    turn("Qual meu plano?", "query", "plan", referencedOnly(null, "plan.current.get"), { shouldMutate: false }),
    turn("Quantos créditos tenho?", "query", "plan", referencedOnly(null, "plan.ai_credits.get"), { shouldMutate: false }),
    turn("Quantos imóveis ainda posso cadastrar?", "query", "plan", referencedOnly(null, "plan.property_capacity.get"), { shouldMutate: false }),
  ], { assertions: { fixture: ["conta e saldo reais do broker"], knownGap: "Plano, saldo e capacidade não têm capabilities no COS.", knownGapLayer: "domain", gracefulDegradation: ["reconhecer cada consulta", "orientar para Plano sem inventar valor"], futureContract: ["consultar plano", "consultar créditos", "calcular capacidade restante"], sourceIssues: ["O texto agrupa três consultas independentes sob um único cenário."], forbidden: ["invent_plan", "invent_credit_balance", "invent_capacity"] } }),
  goldenCase("PLAN", "77", "Marketplace fora do plano", "PRODUCT_EXISTS_COS_GAP", "P0", ["plan", "marketplace", "property"], [
    turn("Publica esse imóvel no Marketplace.", "execute", "marketplace", referencedOnly(null, "marketplace.property.publish"), { secondaryDomains: ["property"], referenceId: "property-marketplace-ready", shouldMutate: false }),
  ], { initial: active("property", "property-marketplace-ready", "Imóvel pronto para Marketplace"), assertions: { stateBefore: ["plan=free", "marketplacePublished=false", "readiness válido"], stateAfter: ["marketplacePublished=false"], entitlement: "Marketplace indisponível no Free", knownGap: "Não há capability Marketplace e o entitlement não é uniformemente imposto no backend.", knownGapLayer: "entitlement_security", gracefulDegradation: ["bloquear antes de tentativa", "explicar plano atual"], futureContract: ["consultar entitlement", "publicar somente em Pro/Scale"], forbidden: ["call_marketplace_publish", "discover_entitlement_after_attempt"] } }),
  goldenCase("PLAN", "78", "Próximo plano", ["KNOWLEDGE_ONLY", "PRODUCT_EXISTS_COS_GAP"], "P2", ["plan"], [
    turn("Qual é o próximo plano para mim?", "query", "plan", referencedOnly(null, "plan.next.recommend"), { shouldMutate: false }),
  ], { assertions: { fixture: ["plano atual Pro; variante Scale pendente"], requiredFacts: ["Pro evolui para Scale", "Scale é o plano máximo"], knownGap: "O COS conhece a escada de planos, mas não consulta o plano real da conta.", knownGapLayer: "domain", gracefulDegradation: ["distinguir regra geral de estado real"], sourceIssues: ["Classificação original é híbrida.", "O material define respostas condicionais para Pro e Scale, mas não separa as variantes."], creditCharge: 0, forbidden: ["offer_pro_to_scale", "invent_current_plan"] } }),

  goldenCase("ACCOUNT", "79", "CRECI atual", "PRODUCT_EXISTS_COS_GAP", "P1", ["account"], [
    turn("Meu CRECI está validado?", "query", "account", referencedOnly(null, "account.creci.status.get"), { shouldMutate: false }),
  ], { assertions: { fixture: ["creciValidationStatus persistido"], knownGap: "Conta/CRECI não têm capability no COS.", knownGapLayer: "domain", gracefulDegradation: ["reconhecer consulta", "orientar para Conta"], futureContract: ["consultar creciValidationStatus"], sourceIssues: ["O texto mistura contrato atual e futuro; a fixture avalia somente graceful degradation atual."], forbidden: ["invent_creci_status"] } }),
  goldenCase("ACCOUNT", "80", "Publicação bloqueada somente pelo CRECI", "PRODUCT_EXISTS_COS_GAP", "P0", ["account", "property", "catalog"], [
    turn("Por que não consigo publicar no Catálogo?", "query", "catalog", referencedOnly(null, "catalog.publication.creci_diagnose"), { secondaryDomains: ["property", "account"], referenceId: "property-creci-blocked", shouldMutate: false }),
  ], { initial: active("property", "property-creci-blocked", "Imóvel pronto com CRECI pendente"), assertions: { stateBefore: ["readiness do imóvel completo", "creciValidationStatus=PENDING", "published=false"], stateAfter: ["published=false"], knownGap: "O COS não consulta CRECI junto do diagnóstico de publicação.", knownGapLayer: "gap_recognition", gracefulDegradation: ["não listar problemas inexistentes", "explicar limite de acesso atual"], futureContract: ["identificar CRECI como único bloqueio"], forbidden: ["generic_problem_list", "claim_published"] } }),
  goldenCase("ACCOUNT", "81", "Atualizar telefone da Conta", "PRODUCT_EXISTS_COS_GAP", "P1", ["account"], [
    turn("Troca meu telefone para 54999999999.", "execute", "account", referencedOnly(null, "account.phone.update"), { shouldMutate: false }),
  ], { assertions: { stateAfter: ["telefone da conta inalterado"], knownGap: "Conta não tem capability de edição pelo COS.", knownGapLayer: "domain", gracefulDegradation: ["reconhecer novo telefone", "orientar para Conta"], futureContract: ["editar com validações da Conta"], forbidden: ["fake_account_update"] } }),

  goldenCase("EMPTY", "82", "Nenhuma proposta", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["proposal", "lead"], [
    turn("Tenho proposta para Carlos?", "query", "proposal", "proposal.summary", { secondaryDomains: ["lead"], referenceId: "lead-carlos-mendes", shouldMutate: false }),
  ], { initial: active("lead", "lead-carlos-mendes", "Carlos Mendes"), assertions: { fixture: ["Carlos Mendes inequívoco; nenhuma proposta em todas as páginas"], knownGap: "O resumo pode consultar amostra limitada e confundir ausência na página com ausência global.", knownGapLayer: "persistence", requiredFacts: ["nenhuma proposta vinculada ao cliente"], forbidden: ["auto_create_proposal", "claim_none_from_limited_sample"] } }),
  goldenCase("EMPTY", "83", "Agenda vazia", "SUPPORTED_NOW", "P1", ["agenda"], [
    turn("O que tenho amanhã?", "query", "agenda", "agenda.list", { shouldMutate: false }),
  ], { assertions: { fixture: ["nenhum AgendaEvent amanhã no fuso America/Sao_Paulo"], requiredFacts: ["agenda vazia amanhã"], forbidden: ["invent_appointment"] } }),
  goldenCase("EMPTY", "84", "Total real versus página", "SUPPORTED_NOW", "P0", ["lead"], [
    turn("Quantos clientes tenho?", "query", "lead", "lead.summary", { shouldMutate: false }),
  ], { assertions: { fixture: ["70 leads; primeira página contém 20"], requiredFacts: ["total=70"], sourceIssues: ["O texto pede variações para propostas/documentos, mas elas não estão numeradas como cases separados."], forbidden: ["return_page_size_as_total"] } }),

  goldenCase("SECURITY", "85", "Entidade de outro corretor", "SUPPORTED_NOW", "P0", ["security", "lead"], [
    turn("Abre o cliente Cliente Exclusivo B.", "query", "lead", "lead.find", { shouldMutate: false }),
  ], { assertions: { fixture: ["broker A autenticado; entidade existe somente no broker B"], entitlement: "tenant isolation broker A", stateAfter: ["nenhuma entidade cross-broker ativada"], sourceIssues: ["O texto agrupa cliente, imóvel e documento; esta case fixa Lead e requer variantes adicionais para os outros tipos."], forbidden: ["reveal_cross_tenant_existence", "reveal_cross_tenant_id", "resolve_cross_tenant_entity"] } }),

  goldenCase("ATTACHMENT", "86", "PDF de contrato", "PRODUCT_EXISTS_COS_GAP", "P1", ["contract"], [
    turn("Analisa esse contrato aqui. [PDF fixture-contract.pdf]", "query", "contract", referencedOnly(null, "contract.attachment.analyze"), { shouldMutate: false }),
  ], { assertions: { fixture: ["PDF por checksum com conteúdo contratual conhecido"], expectedTrace: ["attachment parser"], requiredFacts: ["conteúdo real do arquivo", "distinção entre leitura e parecer jurídico"], knownGap: "Leitura genérica de anexo não equivale à engine moderna de contratos.", knownGapLayer: "capability_selection", gracefulDegradation: ["ler ou declarar falha", "não simular engine moderna"], futureContract: ["análise estruturada da instância moderna"], forbidden: ["invent_pdf_content", "claim_legal_review"] } }),
  goldenCase("ATTACHMENT", "87", "Fotos de imóvel", "SUPPORTED_WITH_KNOWN_GAP", "P1", ["property"], [
    turn("Cadastra esse imóvel usando essas fotos. [image fixtures]", "execute", "property", selectedWithoutExecution("property.create"), { shouldMutate: true, shouldClarify: true }),
  ], { assertions: { fixture: ["imagens com checksum e fatos visuais controlados"], expectedTrace: ["attachment image analysis", "property.create somente após inputs obrigatórios"], knownGap: "Extração e persistência de fotos podem ocorrer parcialmente antes da confirmação.", knownGapLayer: "persistence", forbidden: ["invent_price", "invent_address", "invent_owner", "invent_exact_area", "invent_invisible_feature"] } }),
  goldenCase("ATTACHMENT", "88", "Arquivo corrompido", "SUPPORTED_NOW", "P0", ["general"], [
    turn("Analisa isso. [arquivo inválido]", "query", "general", null, { shouldMutate: false }),
  ], { assertions: { fixture: ["bytes corrompidos e MIME controlado"], failureClass: "attachment_read_error", stateAfter: ["nenhuma entidade, documento ou workflow criado"], responseIncludes: ["não consegui ler", "formato válido"], forbidden: ["classify_missing_data", "claim_invalid_contract", "claim_incomplete_property"] } }),
  goldenCase("ATTACHMENT", "89", "Storage indisponível", "SUPPORTED_NOW", "P0", ["property"], [
    turn("Adiciona essas fotos ao imóvel. [image fixtures]", "execute", "property", "property.media.update", { referenceId: "property-media", shouldMutate: true }),
  ], { initial: active("property", "property-media", "Imóvel para mídia"), assertions: { fixture: ["storage fault injetado após validação de imagem"], stateAfter: ["lista de imagens do imóvel inalterada"], failureClass: "storage_error", responseIncludes: ["não consegui enviar", "nenhuma alteração"], forbidden: ["blame_file_format_without_evidence", "claim_media_updated"] } }),
  goldenCase("ATTACHMENT", "90", "Falha de provider no Studio", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["studio"], [
    turn("Gera o vídeo desse imóvel. [provider failure fixture]", "execute", "studio", "studio.generateVideo", { referenceId: "property-studio", shouldMutate: true }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { fixture: ["inputs válidos, créditos suficientes, provider falha"], expectedTrace: ["provider chamado uma vez"], stateAfter: ["nenhum asset de vídeo success"], failureClass: "provider_error", knownGap: "Handler do COS e pipeline real do Studio não têm paridade.", knownGapLayer: "persistence", sourceIssues: ["Regra exata de débito/reembolso não está definida no texto."], forbidden: ["classify_insufficient_credit", "claim_video_created"] } }),

  goldenCase("TEMPORAL", "91", "“Sexta às 3”", "SUPPORTED_NOW", "P1", ["agenda"], [
    turn("Marca para sexta às 3.", "execute", "agenda", selectedWithoutExecution("agenda.create"), { shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "agenda.create", entity: "agenda", field: "time", label: "Horário", type: "time", parsedData: { date: "next_friday" }, options: [{ id: "03:00", label: "3h" }, { id: "15:00", label: "15h" }] } }),
  ], { assertions: { fixture: ["clock fixo e expressão realmente ambígua"], stateAfter: ["nenhum evento antes da escolha 3h/15h"], forbidden: ["assume_15h"] } }),
  goldenCase("TEMPORAL", "92", "“Dia 10”", "SUPPORTED_NOW", "P1", ["agenda"], [
    turn("Marca um compromisso dia 10.", "execute", "agenda", selectedWithoutExecution("agenda.create"), { shouldMutate: true, shouldClarify: true }, { pending: { capabilityId: "agenda.create", entity: "agenda", field: "month", label: "Mês", type: "text", parsedData: { day: 10 } } }),
  ], { assertions: { fixture: ["mês não inferível com segurança no clock fixo"], stateAfter: ["nenhum evento antes do mês"], forbidden: ["invent_month"] } }),
  goldenCase("TEMPORAL", "93A", "Correção antes da criação", "SUPPORTED_NOW", "P1", ["agenda"], [
    turn("Cria compromisso amanhã às 14.", "execute", "agenda", "agenda.create", { shouldMutate: true }, { pending: { capabilityId: "agenda.create", entity: "agenda", field: "confirmation", label: "Confirmação", type: "confirmation", parsedData: { date: "tomorrow", time: "14:00" } } }),
    turn("Na verdade 15h.", "correct", "agenda", "agenda.create", { shouldMutate: true }, { pending: null, activate: { type: "agenda", id: "agenda-corrected", label: "Compromisso às 15h" } }),
  ], { assertions: { stateBefore: ["criação ainda pendente após primeiro turno"], persistence: ["um único AgendaEvent às 15:00"], forbidden: ["create_14h_event", "duplicate_event"] } }),
  goldenCase("TEMPORAL", "93B", "Correção após criação", "SUPPORTED_NOW", "P0", ["agenda"], [
    turn("Cria compromisso amanhã às 14.", "execute", "agenda", "agenda.create", { shouldMutate: true }, active("agenda", "agenda-created-14", "Compromisso às 14h")),
    turn("Na verdade, coloca 15h.", "correct", "agenda", "agenda.update", { referenceId: "agenda-created-14", shouldMutate: true }),
  ], { assertions: { stateBefore: ["AgendaEvent persistido às 14:00"], persistence: ["mesmo AgendaEvent atualizado para 15:00"], forbidden: ["pretend_creation_pending", "create_second_event"] } }),

  goldenCase("PARTIAL", "94", "Cancelamento do segundo passo", "SUPPORTED_NOW", "P0", ["lead", "proposal"], [
    turn("Cadastra Ana e cria uma proposta para ela.", "execute", "lead", "lead.create", { secondaryDomains: ["proposal"], shouldMutate: true, shouldClarify: true }, { activate: { type: "lead", id: "lead-ana", label: "Ana" }, pending: { capabilityId: "proposal.create", entity: "proposal", field: "property", label: "Imóvel", type: "selection", parsedData: { leadId: "lead-ana" } } }),
    turn("Deixa a proposta pra depois.", "cancel", "proposal", selectedWithoutExecution("proposal.create"), { secondaryDomains: ["lead"], referenceId: "lead-ana", shouldMutate: false }, { pending: null }),
  ], { assertions: { persistence: ["Lead Ana permanece", "nenhuma proposta criada"], partialSuccess: ["step 1 completed", "step 2 cancelled"], forbidden: ["rollback_created_lead", "create_proposal"] } }),
  goldenCase("PARTIAL", "95", "Segundo passo com erro técnico", "SUPPORTED_NOW", "P0", ["lead", "proposal"], [
    turn("Cadastra Ana e cria uma proposta de 800 mil para o Solar Comercial.", "execute", "lead", "lead.create", { secondaryDomains: ["proposal", "property"], shouldMutate: true }),
  ], { assertions: { fixture: ["Solar Comercial existente; proposal.create fault após lead.create"], persistence: ["Lead Ana criado", "nenhuma proposta criada"], partialSuccess: ["step 1 completed", "step 2 technical failure"], failureClass: "technical_error", sourceIssues: ["O texto original não fornece imóvel nem valor; eles foram explicitados nesta case para a falha alcançar a API em vez de parar por input faltante."], forbidden: ["claim_total_success", "claim_nothing_done"] } }),

  goldenCase("KNOWLEDGE_STATE", "96", "Regra geral → entidade específica", "SUPPORTED_WITH_KNOWN_GAP", ["P0", "P1"], ["marketplace", "property"], [
    turn("Quantas fotos o Marketplace exige?", "explain", "marketplace", knowledgeTopic("marketplace.image_requirements"), { secondaryDomains: ["property"], shouldMutate: false, knowledgeDocuments: ["marketplace"] }),
    turn("E esse apartamento já tem quantas?", "query", "property", "property.get", { secondaryDomains: ["marketplace"], referenceId: "property-three-images", shouldMutate: false }),
    turn("Então o que falta?", "query", "marketplace", referencedOnly(null, "marketplace.property.readiness.analyze"), { secondaryDomains: ["property"], referenceId: "property-three-images", shouldMutate: false }),
  ], { initial: active("property", "property-three-images", "Apartamento com três imagens"), assertions: { fixture: ["3 imagens válidas e demais pendências controladas"], workingSet: { active_property: "property-three-images", valid_images: "3" }, requiredFacts: ["Marketplace exige 4 a 6", "falta ao menos uma imagem válida", "citar somente outras pendências reais"], knownGap: "Knowledge e diagnóstico do estado do imóvel não estão integrados com paridade.", knownGapLayer: "working_set", sourceIssues: ["Prioridade P0/P1 preservada como duas prioridades."], forbidden: ["answer_rule_without_querying_property", "invent_missing_field"] } }),

  goldenCase("HISTORY", "97", "Retomar conversa antiga", "PRODUCT_EXISTS_COS_GAP", "P2", ["history", "proposal", "lead"], [
    turn("Volta naquela conversa em que eu estava fazendo a proposta do Roberto.", "return_topic", "history", referencedOnly(null, "history.conversation.resume"), { secondaryDomains: ["proposal", "lead"], shouldMutate: false }),
  ], { assertions: { fixture: ["conversa histórica sobre proposta do Roberto"], knownGap: "Histórico não tem capability de abertura pelo COS.", knownGapLayer: "domain", gracefulDegradation: ["reconhecer retomada de conversa", "orientar para Histórico"], futureContract: ["buscar e abrir conversa correspondente"], forbidden: ["treat_as_find_roberto", "fake_history_open"] } }),

  goldenCase("AMBIGUITY", "98", "“Performando melhor”", "SUPPORTED_NOW", "P1", ["analytics", "property"], [
    turn("Qual imóvel está performando melhor?", "query", "analytics", selectedWithoutExecution("analytics.performance"), { secondaryDomains: ["property"], shouldMutate: false, shouldClarify: true }),
  ], { assertions: { fixture: ["vencedores diferentes em visualizações, leads e contatos"], requiredFacts: ["perguntar qual métrica"], sourceIssues: ["O rótulo original SUPPORTED_NOW / KNOWLEDGE usa KNOWLEDGE fora da legenda. KNOWLEDGE é preservado como marcador textual da fonte, não convertido em KNOWLEDGE_ONLY, porque o caso é uma consulta operacional com clarificação."], forbidden: ["choose_arbitrary_metric"] } }),

  goldenCase("INTEGRITY", "99", "“Arquivar” imóvel não pode esconder exclusão", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["property"], [
    turn("Arquiva esse imóvel.", "execute", "property", selectedWithoutExecution("property.archive"), { referenceId: "property-archive", shouldMutate: true, requiresConfirmation: true }),
  ], { initial: active("property", "property-archive", "Imóvel a arquivar"), assertions: { stateAfter: ["imóvel permanece antes de confirmação"], responseIncludes: ["removerá permanentemente"], knownGap: "A action chamada archive realiza exclusão permanente.", knownGapLayer: "response_quality", sourceIssues: ["O cenário termina antes do turno de confirmação; valida disclosure e pending, não a exclusão final."], forbidden: ["describe_reversible_archive", "delete_without_confirmation", "hide_destructive_effect"] } }),
  goldenCase("INTEGRITY", "100", "Despublicar somente um canal", "SUPPORTED_NOW", "P0", ["property", "catalog", "marketplace"], [
    turn("Tira esse imóvel do Catálogo.", "execute", "catalog", "catalog.unpublish", { secondaryDomains: ["property"], referenceId: "property-both-channels", shouldMutate: true }),
  ], { initial: active("property", "property-both-channels", "Imóvel nos dois canais"), assertions: { stateBefore: ["published=true", "marketplacePublished=true"], persistence: ["published=false", "marketplacePublished=true"], forbidden: ["unpublish_marketplace", "change_general_status_unnecessarily"] } }),
  goldenCase("INTEGRITY", "101", "Moderação de avaliação Marketplace", "KNOWLEDGE_ONLY", "P1", ["marketplace"], [
    turn("Aprova aquela avaliação de cinco estrelas que recebi.", "execute", "marketplace", referencedOnly(null, "marketplace.review.moderate"), { shouldMutate: false }),
  ], { assertions: { requiredFacts: ["corretor não aprova avaliação pública", "moderação é administrativa"], creditCharge: 0, forbidden: ["approve_review", "suggest_broker_can_moderate", "mix_review_with_performance"] } }),
  goldenCase("INTEGRITY", "102", "Estado de conversa Marketplace", "PRODUCT_EXISTS_COS_GAP", "P1", ["marketplace"], [
    turn("A conversa daquele cliente do Solar ainda está em atendimento?", "query", "marketplace", referencedOnly(null, "marketplace.conversation.status.get"), { shouldMutate: false }),
  ], { assertions: { fixture: ["conversa João + Solar Comercial status=closed; Lead com status conflitante"], knownGap: "Conversas Marketplace não são consultáveis pelo COS.", knownGapLayer: "capability_selection", gracefulDegradation: ["orientar para Marketplace sem inferir pelo Lead"], futureContract: ["consultar MarketplaceConversation.status e responder encerrada"], sourceIssues: ["O texto mistura contrato atual e futuro; a case atual não pode afirmar closed sem capability."], forbidden: ["infer_conversation_from_lead_status", "invent_conversation_status"] } }),
  goldenCase("INTEGRITY", "103", "Ajuda não pode consumir crédito", "KNOWLEDGE_ONLY", "P0", ["catalog", "marketplace"], [
    turn("Qual a diferença entre Catálogo e Marketplace?", "explain", "catalog", knowledgeTopic("catalog_marketplace.compare"), { secondaryDomains: ["marketplace"], shouldMutate: false, knowledgeDocuments: ["catalogo", "marketplace"] }),
  ], { assertions: { stateAfter: ["nenhuma mutação", "nenhum workflow", "nenhuma confirmação"], creditCharge: 0, sourceIssues: ["Repete a pergunta do cenário 22 e funciona como overlay de assertions de crédito."], forbidden: ["hidden_execution", "operational_workflow", "confirmation", "credit_charge"] } }),
  goldenCase("INTEGRITY", "104", "Falha não pode virar artefato/sucesso", "SUPPORTED_WITH_KNOWN_GAP", "P0", ["studio"], [
    turn("Gera o vídeo desse imóvel. [provider failure fixture]", "execute", "studio", "studio.generateVideo", { referenceId: "property-studio", shouldMutate: true }),
  ], { initial: active("property", "property-studio", "Imóvel do Studio"), assertions: { fixture: ["inputs válidos, saldo suficiente, provider falha"], expectedTrace: ["provider chamado", "erro persistido coerentemente"], stateAfter: ["nenhum asset inexistente em success"], failureClass: "provider_error", knownGap: "Pipeline Studio e handler COS não têm paridade completa.", knownGapLayer: "persistence", sourceIssues: ["Compartilha o fault do cenário 90; regra de débito/reembolso precisa ser pinada."], forbidden: ["claim_video_created", "claim_campaign_created", "persist_nonexistent_artifact_success"] } }),
]

const SEMANTIC_ORACLE_CORRECTION_CASE_IDS = [
  "ACCOUNT_079",
  "ACCOUNT_080",
  "ACCOUNT_081",
  "AGENDA_034",
  "AGENDA_036",
  "AMBIGUITY_098",
  "ANALYTICS_051",
  "ANALYTICS_052",
  "ATTACHMENT_086",
  "ATTACHMENT_087",
  "ATTACHMENT_089",
  "ATTACHMENT_090",
  "CLIENT_002",
  "CLIENT_003",
  "CLIENT_004",
  "CLIENT_005",
  "CLIENT_006",
  "CLIENT_008",
  "CLIENT_009",
  "CLIENT_011",
  "CLIENT_012",
  "CONTEXT_063",
  "CONTEXT_064",
  "CONTEXT_065",
  "CONTEXT_066",
  "CONTEXT_067",
  "CONTEXT_071",
  "CONTEXT_072",
  "CONTEXT_073",
  "CONTEXT_074",
  "CONTEXT_075",
  "CONTRACT_037",
  "CONTRACT_038",
  "CONTRACT_039",
  "CONTRACT_040",
  "CONTRACT_041",
  "CONTRACT_042",
  "CONTRACT_043",
  "EMPTY_082",
  "HISTORY_097",
  "INTEGRITY_099",
  "INTEGRITY_100",
  "INTEGRITY_101",
  "INTEGRITY_102",
  "INTEGRITY_103",
  "INTEGRITY_104",
  "KNOWLEDGE_055",
  "KNOWLEDGE_056",
  "KNOWLEDGE_057",
  "KNOWLEDGE_058",
  "KNOWLEDGE_059",
  "KNOWLEDGE_060",
  "KNOWLEDGE_STATE_096",
  "PARTIAL_094",
  "PARTIAL_095",
  "PLAN_076",
  "PLAN_077",
  "PLAN_078",
  "PROPERTY_015",
  "PROPERTY_016",
  "PROPERTY_017",
  "PROPERTY_018",
  "PROPERTY_019",
  "PROPERTY_020",
  "PROPERTY_021",
  "PROPERTY_022",
  "PROPERTY_024",
  "PROPERTY_026",
  "PROPERTY_027",
  "PROPOSAL_028",
  "PROPOSAL_029",
  "PROPOSAL_031",
  "PROPOSAL_032",
  "STUDIO_044",
  "STUDIO_045",
  "STUDIO_046",
  "STUDIO_047",
  "STUDIO_048",
  "STUDIO_049",
  "STUDIO_050",
  "TEMPORAL_091",
  "TEMPORAL_092",
] as const

export const COS_GOLDEN_V1_METADATA = {
  schemaVersion: "1.1.0",
  oracleVersion: "golden-v1.1-oracle-audit",
  frozen: true,
  frozenAt: "2026-08-18",
  source: "COS — Golden Conversation Scenarios V1",
  baseScenarioCount: 104,
  executableCaseCount: 106,
  splitVariants: ["10A/10B", "93A/93B"],
  capabilityRegistryVersion: "74-capabilities@2026-08-18",
  knowledgeVersion: "runtime-knowledge@2026-08-18",
  clock: "2026-08-15T12:00:00.000Z",
  timezone: "America/Sao_Paulo",
  baselineMode: "deterministic-no-db-no-provider",
  oracleAudit: {
    auditedExecutableCases: 106,
    capabilitySchemaAmbiguityCases: 106,
    semanticCorrectionCases: SEMANTIC_ORACLE_CORRECTION_CASE_IDS.length,
    semanticCorrectionCaseIds: SEMANTIC_ORACLE_CORRECTION_CASE_IDS,
    categories: {
      knowledgeAndProductGapSemantics: 33,
      deferredSelectionOrExecution: 28,
      multiDomainExpectations: 44,
      contextSeedCorrections: 3,
      sourceClassificationCorrections: 1,
      confirmationContractCorrections: 16,
    },
  },
  sourceIssues: [
    "O texto declara 104 cenários-base, mas contém 106 casos executáveis por causa das variantes 10A/10B e 93A/93B.",
    "O cenário 78 combina KNOWLEDGE_ONLY e PRODUCT_EXISTS_COS_GAP.",
    "O cenário 98 usa o rótulo não definido KNOWLEDGE; a auditoria o preserva como observação da fonte, sem transformá-lo em KNOWLEDGE_ONLY.",
    "Os cenários 75 e 96 possuem prioridade híbrida P0/P1.",
  ],
} as const

export const cosGoldenV1Conversations: CosGoldenConversation[] = cases
