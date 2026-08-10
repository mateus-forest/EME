import "server-only"

import type { Prisma } from "@prisma/client"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"

import { loadHelpManualContext, type HelpTopic } from "@/lib/cos/capabilities/help/manual"
import type { CosCapabilityHandler } from "@/lib/cos/types"

const HELP_SYSTEM_PROMPT = [
  "Você é o assistente de suporte e orientação do EME, o Sistema Operacional do Corretor.",
  "Use o manual oficial do EME fornecido abaixo como fonte de verdade sobre o sistema e não invente funcionalidades.",
  "Responda em português, de forma clara, direta e orientada à ação.",
  "Quando o manual não cobrir algo, admita isso com honestidade e aponte o caminho mais próximo disponível.",
].join(" ")

const HELP_FALLBACK_EXCERPT_LENGTH = 1400

// Mensagem literal enviada pelo botao "Tirar uma duvida" do menu "+" (ver actionMap em
// components/broker-portal.tsx). So mostramos o menu fixo de topicos quando a mensagem e
// exatamente esse gatilho generico — uma pergunta especifica real que caia em general_question
// continua sendo respondida pela IA usando o manual completo.
const GENERAL_QUESTION_TRIGGER_MESSAGE = "Preciso de ajuda para entender uma funcionalidade do EME."

function isGeneralQuestionMenuTrigger(message: string) {
  return message.trim().toLowerCase() === GENERAL_QUESTION_TRIGGER_MESSAGE.toLowerCase()
}

type GuidedHelpOption = Prisma.InputJsonObject & {
  id: string
  actionId: string
  action: string
  message: string
  label: string
}

const GUIDED_HELP_RESPONSES: Partial<Record<HelpTopic, string>> = {
  first_steps: "Escolha por onde deseja começar.",
  register_properties: "Escolha como deseja cadastrar o imóvel.",
  manage_clients: "Escolha a frente de clientes que deseja seguir.",
  contracts_proposals: "Escolha o fluxo que deseja abrir.",
  marketing_studio: "Escolha a frente do Studio IA.",
  general_question: "Sobre o que você quer tirar dúvida?",
}

const GUIDED_HELP_OPTIONS: Partial<Record<HelpTopic, GuidedHelpOption[]>> = {
  first_steps: [
    { id: "first_steps_use_cos", actionId: "help:first_steps:use_cos", action: "help_use_cos", message: "Como usar o COS", label: "Como usar o COS" },
    { id: "first_steps_properties", actionId: "help:first_steps:properties", action: "help_register_properties", message: "Cadastrar imóveis", label: "Cadastrar imóveis" },
    { id: "first_steps_clients", actionId: "help:first_steps:clients", action: "help_manage_clients", message: "Gerenciar clientes", label: "Gerenciar clientes" },
  ],
  register_properties: [
    { id: "register_properties_manual", actionId: "help:register_properties:manual", action: "createPropertyDraft", message: "Criar imóvel", label: "Cadastro manual" },
    { id: "register_properties_image", actionId: "help:register_properties:image", action: "createPropertyDraft", message: "Crie um imóvel com essa imagem.", label: "IA por imagem" },
    { id: "register_properties_import", actionId: "help:register_properties:import", action: "createPropertyDraft", message: "Importar dados de um anúncio", label: "Importação" },
  ],
  manage_clients: [
    { id: "manage_clients_create", actionId: "help:manage_clients:create", action: "createLead", message: "Cadastrar cliente", label: "Cadastrar cliente" },
    { id: "manage_clients_update", actionId: "help:manage_clients:update", action: "UPDATE_LEAD", message: "Atualizar cliente", label: "Atualizar cliente" },
    { id: "manage_clients_find", actionId: "help:manage_clients:find", action: "FIND_LEAD", message: "Buscar cliente", label: "Buscar cliente" },
  ],
  contracts_proposals: [
    { id: "contracts_proposals_contract", actionId: "help:contracts:create_contract", action: "CREATE_CONTRACT", message: "Novo contrato", label: "Novo contrato" },
    { id: "contracts_proposals_proposal", actionId: "help:contracts:create_proposal", action: "CREATE_PROPOSAL", message: "Criar proposta", label: "Criar proposta" },
    { id: "contracts_proposals_review", actionId: "help:contracts:review", action: "help_contracts_proposals", message: "Revisar documentos existentes", label: "Revisar existentes" },
  ],
  marketing_studio: [
    { id: "marketing_studio_campaign", actionId: "help:studio:campaign", action: "STUDIO_GENERATE_CAMPAIGN", message: "Gerar campanha", label: "Campanhas" },
    { id: "marketing_studio_instagram", actionId: "help:studio:instagram", action: "STUDIO_GENERATE_INSTAGRAM", message: "Criar campanha Instagram", label: "Instagram" },
    { id: "marketing_studio_video", actionId: "help:studio:video", action: "STUDIO_GENERATE_VIDEO", message: "Gerar vídeo do imóvel", label: "Vídeo" },
  ],
  general_question: [
    { id: "general_question_first_steps", actionId: "help:general:first_steps", action: "help_first_steps", message: "Primeiros passos", label: "Primeiros passos" },
    { id: "general_question_use_cos", actionId: "help:general:use_cos", action: "help_use_cos", message: "Como usar o COS", label: "Como usar o COS" },
    { id: "general_question_properties", actionId: "help:general:properties", action: "help_register_properties", message: "Cadastrar imóveis", label: "Cadastrar imóveis" },
    { id: "general_question_clients", actionId: "help:general:clients", action: "help_manage_clients", message: "Gerenciar clientes", label: "Gerenciar clientes" },
    { id: "general_question_contracts", actionId: "help:general:contracts", action: "help_contracts_proposals", message: "Contratos e propostas", label: "Contratos e propostas" },
    { id: "general_question_studio", actionId: "help:general:studio", action: "help_marketing_studio", message: "Marketing e Studio IA", label: "Marketing e Studio IA" },
  ],
}

function buildHelpFallbackResponse(manualContext: string) {
  const trimmed = manualContext.trim()
  return trimmed.length > HELP_FALLBACK_EXCERPT_LENGTH
    ? `${trimmed.slice(0, HELP_FALLBACK_EXCERPT_LENGTH).trimEnd()}...`
    : trimmed
}

function createHelpCapability(topic: HelpTopic): CosCapabilityHandler {
  return async ({ message, action }) => {
    const guidedResponse = GUIDED_HELP_RESPONSES[topic]
    const showGuidedMenu = Boolean(guidedResponse) && (topic !== "general_question" || isGeneralQuestionMenuTrigger(message))
    if (showGuidedMenu && guidedResponse) {
      return {
        response: guidedResponse,
        metadata: {
          noCharge: true,
          topic,
          source: "guided_help",
          options: (GUIDED_HELP_OPTIONS[topic] ?? []) as Prisma.InputJsonValue,
        },
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
        max_output_tokens: 1800,
        reasoning: {
          effort: "minimal",
        },
        instructions: HELP_SYSTEM_PROMPT,
        input: [`Manual oficial do EME:\n\n${manualContext}`, `Pergunta do corretor: ${message}`].join("\n\n"),
      },
    })

    if (response.status === "incomplete" && response.incomplete_details?.reason === "max_output_tokens") {
      console.error("[cos][help][openai-response-truncated]", { topic, status: response.status })
      return {
        response: buildHelpFallbackResponse(manualContext),
        metadata: { noCharge: true, topic, source: "manual_fallback_truncated" },
      }
    }

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
