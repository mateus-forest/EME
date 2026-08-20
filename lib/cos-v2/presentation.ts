import {
  buildCosConfirmationResponseViewModel,
  buildCosExecutionResponseViewModel,
  buildCosSimpleResponseViewModel,
  sanitizeCosResponseText,
} from "@/lib/cos/response-view-model"
import type { CosExecutionPlan, CosExecutionPlanResult } from "@/lib/cos/types"
import type { CosV2HelpTopic, CosV2Interpretation } from "@/lib/cos-v2/types"

const DOMAIN_OVERVIEWS: Record<CosV2Interpretation["primaryDomain"], string> = {
  clients: "Clientes é onde você organiza seus contatos e negociações. Posso ajudar a cadastrar, localizar, atualizar informações, acompanhar histórico e relacionar imóveis e documentos.",
  properties: "Imóveis é onde você organiza sua carteira e os dados dos anúncios. Posso ajudar a cadastrar, localizar, consultar detalhes, melhorar descrições e cuidar da publicação.",
  proposals: "Propostas reúne as condições comerciais apresentadas aos clientes. Posso ajudar a consultar as propostas existentes e criar uma nova a partir do cliente e do imóvel.",
  agenda: "Compromissos organiza visitas, ligações e tarefas. Posso ajudar a consultar sua agenda, criar, remarcar, concluir ou cancelar um compromisso.",
  general: "O EME conecta clientes, imóveis, propostas e compromissos no mesmo fluxo. Diga por onde quer começar e eu ajudo com a próxima ação.",
}

const HELP_ANSWERS: Record<CosV2HelpTopic, string> = {
  first_steps: "Para começar no EME, revise sua conta e segurança, cadastre os primeiros clientes, adicione seus imóveis e organize os compromissos. Depois, você pode navegar pelas áreas ou pedir ao COS a próxima tarefa em linguagem natural.",
  using_cos: "Converse com o COS em linguagem natural e diga o objetivo, por exemplo: “cadastre a Marina”, “busque imóveis até 800 mil” ou “agende uma visita amanhã às 15h”. Ele usa o contexto, pergunta só o indispensável e pede confirmação quando a ação é sensível.",
  registering_properties: "Você pode cadastrar imóveis pela área de Imóveis, por importação/IA ou pedindo ao COS para criar um rascunho em linguagem natural. No COS, informe o valor; tipo, localização, características e fotos podem ser complementados depois, antes da publicação.",
  managing_clients: "Clientes é onde você organiza seus contatos e negociações. Posso ajudar a cadastrar, localizar, atualizar informações, acompanhar histórico e relacionar imóveis e documentos.",
  proposals: "Propostas reúne as condições comerciais apresentadas aos clientes. Posso consultar as propostas existentes ou criar um rascunho quando o cliente e o imóvel estiverem identificados.",
  general: DOMAIN_OVERVIEWS.general,
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
  return buildCosSimpleResponseViewModel({
    kind: interpretation.missingData.length > 0 || interpretation.clarificationQuestion ? "awaiting_input" : "explanation",
    text,
  })
}

export function buildCosV2ValidationResponse(interpretation: CosV2Interpretation, errors: string[]) {
  const unavailable = errors.includes("capability_not_in_v2_registry_scope")
  const unsafe = errors.some((error) => error.startsWith("prompt_injection") || error.startsWith("suspicious_attachment"))
  const lowConfidence = errors.includes("confidence_below_execution_threshold")
  const text = unsafe
    ? "Não posso seguir com esse pedido. Diga a ação e o item que você quer usar, sem instruções para contornar as regras."
    : unavailable
      ? "Essa ação ainda não está disponível por aqui. Posso ajudar com clientes, imóveis, propostas ou compromissos."
      : lowConfidence
        ? sanitizeCosResponseText(interpretation.clarificationQuestion) || "Qual ação você quer fazer?"
        : "Não consegui validar esse pedido. Diga o que você quer fazer e com qual item."
  return buildCosSimpleResponseViewModel({ kind: "awaiting_input", text })
}

export function buildCosV2ConfirmationResponse(plan: CosExecutionPlan) {
  return buildCosConfirmationResponseViewModel({
    prompt: plan.confirmationMessage ?? "Confirma esta ação?",
    capabilityTitle: plan.primaryStep.plan.capability.title,
    action: plan.primaryStep.action,
  })
}

export function buildCosV2ExecutionResponse(input: {
  message: string
  plan: CosExecutionPlan
  result: CosExecutionPlanResult
  objectiveKind: CosV2Interpretation["objective"]["kind"]
}) {
  const response = buildCosExecutionResponseViewModel({ message: input.message, plan: input.plan, result: input.result })
  if (input.result.status === "completed" && input.objectiveKind === "query") {
    return { ...response, kind: "query_result" as const, title: "Resultado da consulta", interactionType: "result" as const }
  }
  return response
}

export function buildCosV2CancelledResponse(hadWorkflow: boolean) {
  return buildCosSimpleResponseViewModel({
    kind: "cancelled",
    text: hadWorkflow ? "Tudo bem. Não vou continuar com isso." : "Tudo bem. Não há nenhuma ação em andamento.",
  })
}
