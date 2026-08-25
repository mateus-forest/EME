import {
  buildCosConfirmationResponseViewModel,
  buildCosExecutionResponseViewModel,
  buildCosSimpleResponseViewModel,
  sanitizeCosResponseText,
} from "@/lib/cos/response-view-model"
import type { CosExecutionPlan, CosExecutionPlanResult } from "@/lib/cos/types"
import { humanizeCosV2Response } from "@/lib/cos-v2/response-language"
import type { CosV2HelpTopic, CosV2Interpretation } from "@/lib/cos-v2/types"

const DOMAIN_OVERVIEWS: Record<CosV2Interpretation["primaryDomain"], string> = {
  clients: "Clientes é onde você organiza seus contatos e negociações. Posso ajudar a cadastrar, localizar, atualizar informações, acompanhar histórico e relacionar imóveis e documentos.",
  properties: "Imóveis é onde você organiza sua carteira e os dados dos anúncios. Posso ajudar a cadastrar, localizar, consultar detalhes, melhorar descrições e cuidar da publicação.",
  proposals: "Propostas reúne as condições comerciais apresentadas aos clientes. Posso ajudar a consultar as propostas existentes e criar uma nova a partir do cliente e do imóvel.",
  agenda: "Compromissos organiza visitas, ligações e tarefas. Posso ajudar a consultar sua agenda, criar, remarcar, concluir ou cancelar um compromisso.",
  general: "O EME conecta clientes, imóveis, propostas e compromissos no mesmo fluxo. Diga por onde quer começar e eu ajudo com a próxima ação.",
}

const HELP_ANSWERS: Record<CosV2HelpTopic, string> = {
  first_steps: "O EME organiza sua operação em um só lugar. Você pode configurar sua conta, cadastrar clientes e imóveis e planejar compromissos. O COS pode orientar cada etapa e executar as ações disponíveis. Se quiser, diga por qual área prefere começar.",
  using_cos: "O COS ajuda você a consultar informações e realizar tarefas em linguagem natural. Você pode pedir para localizar clientes e imóveis, criar propostas ou organizar compromissos. Quando faltar algum dado, ele pergunta somente o necessário e confirma ações sensíveis. Se quiser, diga agora o que precisa fazer.",
  registering_properties: "Você pode cadastrar um imóvel manualmente, usando IA ou por importação. Depois, complete os dados e fotos. Quando estiver pronto, pode publicá-lo no Catálogo e, se cumprir os requisitos, também no Marketplace. Se quiser, posso iniciar um cadastro com você agora.",
  managing_clients: "Na área de Clientes você acompanha seus contatos e negociações. Pode cadastrar clientes, atualizar dados, registrar interesses, mudar a etapa do atendimento, consultar o histórico e relacionar imóveis, documentos e propostas. Se quiser, posso localizar ou cadastrar um cliente para você.",
  proposals: "Na área de Propostas você organiza as condições comerciais apresentadas aos clientes. Pode consultar documentos existentes e gerar uma proposta usando os dados do cliente, do imóvel e da negociação. O COS pode localizar propostas ou iniciar uma nova. Se quiser, diga qual cliente e imóvel deseja usar.",
  general: DOMAIN_OVERVIEWS.general,
}

function finalizeV2Response<T>(response: T) {
  return humanizeCosV2Response(response)
}

export function getCosV2DomainOverview(domain: CosV2Interpretation["primaryDomain"]) {
  return DOMAIN_OVERVIEWS[domain]
}

export function getCosV2HelpAnswer(topic: CosV2HelpTopic) {
  return HELP_ANSWERS[topic]
}

function canonicalMissingQuestion(missingData: string[]) {
  const normalized = missingData.map((field) => field.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  if (normalized.some((field) => ["client", "cliente", "lead", "clientid", "leadid"].includes(field))) return "Qual cliente?"
  if (normalized.some((field) => ["property", "imovel", "propertyid"].includes(field))) return "Qual imóvel?"
  if (normalized.some((field) => ["proposal", "proposta", "proposalid"].includes(field))) return "Qual proposta?"
  if (normalized.some((field) => ["appointment", "compromisso", "agenda", "agendaeventid"].includes(field))) return "Qual compromisso?"
  if (normalized.some((field) => ["time", "horario", "hora"].includes(field))) return "Qual horário?"
  return null
}

export function buildCosV2ContextResponse(interpretation: CosV2Interpretation) {
  const text = canonicalMissingQuestion(interpretation.missingData) ||
    sanitizeCosResponseText(interpretation.clarificationQuestion) ||
    "Entendi. Vou considerar isso no próximo passo."
  return finalizeV2Response(buildCosSimpleResponseViewModel({
    kind: interpretation.missingData.length > 0 || interpretation.clarificationQuestion ? "awaiting_input" : "explanation",
    text,
  }))
}

export function buildCosV2ValidationResponse(interpretation: CosV2Interpretation, errors: string[]) {
  const unavailable = errors.includes("capability_not_in_v2_registry_scope") ||
    errors.includes("capability_not_available_at_launch")
  const unsafe = errors.some((error) => error.startsWith("prompt_injection") || error.startsWith("suspicious_attachment"))
  const lowConfidence = errors.includes("confidence_below_execution_threshold")
  const text = unsafe
    ? "Não posso seguir com esse pedido. Diga a ação e o item que você quer usar, sem instruções para contornar as regras."
    : unavailable
      ? "Ainda não consigo executar essa ação diretamente por aqui. Posso te orientar sobre como fazer no EME."
      : lowConfidence
        ? sanitizeCosResponseText(interpretation.clarificationQuestion) || "Qual ação você quer fazer?"
        : "Não consegui validar esse pedido. Diga o que você quer fazer e com qual item."
  return finalizeV2Response(buildCosSimpleResponseViewModel({ kind: "awaiting_input", text }))
}

export function buildCosV2ConfirmationResponse(plan: CosExecutionPlan) {
  return finalizeV2Response(buildCosConfirmationResponseViewModel({
    prompt: plan.confirmationMessage ?? "Confirma esta ação?",
    capabilityTitle: plan.primaryStep.plan.capability.title,
    action: plan.primaryStep.action,
  }))
}

export function buildCosV2ExecutionResponse(input: {
  message: string
  plan: CosExecutionPlan
  result: CosExecutionPlanResult
  objectiveKind: CosV2Interpretation["objective"]["kind"]
}) {
  const response = buildCosExecutionResponseViewModel({ message: input.message, plan: input.plan, result: input.result })
  if (input.result.status === "completed" && input.objectiveKind === "query") {
    return finalizeV2Response({ ...response, kind: "query_result" as const, title: "Resultado da consulta", interactionType: "result" as const })
  }
  return finalizeV2Response(response)
}

export function buildCosV2CancelledResponse(hadWorkflow: boolean) {
  return finalizeV2Response(buildCosSimpleResponseViewModel({
    kind: "cancelled",
    text: hadWorkflow ? "Tudo bem. Não vou continuar com isso." : "Tudo bem. Não há nenhuma ação em andamento.",
  }))
}
