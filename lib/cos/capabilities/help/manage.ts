import "server-only"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"

import { loadHelpManualContext, type HelpTopic } from "@/lib/cos/capabilities/help/manual"
import type { CosCapabilityHandler } from "@/lib/cos/types"

// Dedicated to the 7 COS "Ajuda" capabilities — deliberately NOT lib/eme-backend.ts's
// generateAssessorText, whose instructions are the WhatsApp SDR persona ("Responda em 1 a 4
// linhas... Sem onboarding, manual, listas grandes"). This is the opposite goal: an orientation
// conversation, grounded in the official manual (docs/help/*.md), that can be as thorough as the
// question needs.
const HELP_SYSTEM_PROMPT = [
  "Você é o assistente de suporte e orientação do EME, o Sistema Operacional do Corretor.",
  "Use o manual oficial do EME fornecido abaixo como fonte de verdade sobre o sistema — não invente funcionalidades, telas ou comportamentos que não estejam nele.",
  "Isso é uma conversa de orientação/onboarding, não uma resposta comercial curta: explique com o detalhe necessário, use passo a passo e listas quando isso ajudar a esclarecer.",
  "Responda em português, de forma clara e organizada.",
  "Se o manual não cobrir o que foi perguntado, diga isso com honestidade em vez de inventar, e sugira o caminho mais próximo disponível no sistema.",
].join(" ")

const HELP_FALLBACK_EXCERPT_LENGTH = 1400

const GUIDED_HELP_RESPONSES: Partial<Record<HelpTopic, string>> = {
  first_steps: [
    "Posso te ajudar a começar por três frentes.",
    "",
    "1. Configurar seu acesso e segurança",
    "2. Cadastrar clientes e imóveis",
    "3. Usar o COS para executar tarefas",
    "",
    "Me diga qual destas você quer ver primeiro.",
  ].join("\n"),
  use_cos: [
    "Você pode usar o COS de forma bem prática.",
    "",
    "• Cadastrar ou editar clientes",
    "• Buscar, criar e revisar imóveis",
    "• Gerar proposta ou contrato",
    "• Consultar agenda, operação e desempenho",
    "",
    "Me diga a ação que você quer executar agora e eu te guio só nela.",
  ].join("\n"),
  register_properties: [
    "Você pode cadastrar um imóvel de três formas.",
    "",
    "• Manualmente pela tela de imóveis",
    "• Pela IA com imagem, print ou texto",
    "• Importando dados de um anúncio",
    "",
    "Se quiser, me diga qual forma você quer usar e eu explico só esse fluxo.",
  ].join("\n"),
  manage_clients: [
    "No módulo Clientes você pode seguir este fluxo.",
    "",
    "• Cadastrar um novo cliente",
    "• Atualizar dados e documentos",
    "• Buscar histórico e oportunidades",
    "• Excluir quando necessário",
    "",
    "Me diga qual etapa você quer fazer e eu foco só nela.",
  ].join("\n"),
  contracts_proposals: [
    "Contratos e propostas seguem dois caminhos principais.",
    "",
    "• Criar um novo documento",
    "• Revisar, enviar ou acompanhar um existente",
    "",
    "Se você me disser o que quer fazer agora, eu explico só esse passo.",
  ].join("\n"),
  marketing_studio: [
    "No Studio IA você pode começar por quatro frentes.",
    "",
    "• Criar campanhas e copies",
    "• Gerar Instagram Feed e Story",
    "• Criar vídeo",
    "• Reaproveitar materiais da biblioteca",
    "",
    "Me diga qual delas você quer usar primeiro.",
  ].join("\n"),
}

// Used when the OpenAI client is unavailable/disabled — still genuinely useful (the manual
// content itself) instead of a dead-end error.
function buildHelpFallbackResponse(manualContext: string) {
  const trimmed = manualContext.trim()
  return trimmed.length > HELP_FALLBACK_EXCERPT_LENGTH
    ? `${trimmed.slice(0, HELP_FALLBACK_EXCERPT_LENGTH).trimEnd()}…`
    : trimmed
}

function createHelpCapability(topic: HelpTopic): CosCapabilityHandler {
  return async ({ message, action }) => {
    const guidedResponse = GUIDED_HELP_RESPONSES[topic]
    if (guidedResponse) {
      return {
        response: guidedResponse,
        metadata: { noCharge: true, topic, source: "guided_help" },
      }
    }

    const manualContext = await loadHelpManualContext(topic)
    const client = getOpenAIClient()

    if (!client) {
      return {
        response: buildHelpFallbackResponse(manualContext),
        metadata: { noCharge: true, topic, source: "manual_fallback" },
      }
    }

    const { model } = getOpenAIEnv()
    const response = await createOpenAIResponse({
      client,
      operationKey: "cos.help.reply",
      metadata: { topic, action },
      request: {
        model,
        max_output_tokens: 700,
        instructions: HELP_SYSTEM_PROMPT,
        input: [`Manual oficial do EME:\n\n${manualContext}`, `Pergunta do corretor: ${message}`].join("\n\n"),
      },
    })

    const answer = response.output_text.trim()

    return {
      response: answer || buildHelpFallbackResponse(manualContext),
      metadata: { noCharge: true, topic },
    }
  }
}

export const helpFirstStepsCapability = createHelpCapability("first_steps")
export const helpUseCosCapability = createHelpCapability("use_cos")
export const helpRegisterPropertiesCapability = createHelpCapability("register_properties")
export const helpManageClientsCapability = createHelpCapability("manage_clients")
export const helpContractsProposalsCapability = createHelpCapability("contracts_proposals")
export const helpMarketingStudioCapability = createHelpCapability("marketing_studio")
export const helpGeneralQuestionCapability = createHelpCapability("general_question")
