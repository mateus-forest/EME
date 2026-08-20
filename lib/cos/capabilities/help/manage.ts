import "server-only"

import type { Prisma } from "@prisma/client"

import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"

import { loadHelpManualContext, type HelpTopic } from "@/lib/cos/capabilities/help/manual"
import {
  isDetailedCosKnowledgeRequest,
} from "@/lib/cos/knowledge/retrieval"
import {
  buildCosGroundedHelpResponse,
  formatCosKnowledgeFactsForResponse,
  normalizeCosGroundedResponse,
  normalizeCosHelpResponse,
} from "@/lib/cos/response-formatter"
import type { CosCapabilityHandler } from "@/lib/cos/types"

const HELP_SYSTEM_PROMPT = [
  "Você é o assistente de suporte e orientação do EME, o Sistema Operacional do Corretor.",
  "Use o manual oficial do EME fornecido abaixo como fonte de verdade sobre o sistema e não invente funcionalidades.",
  "Responda em português, de forma clara, direta e orientada à ação.",
  "Quando o manual não cobrir algo, admita isso com honestidade e aponte o caminho mais próximo disponível.",
].join(" ")

const KNOWLEDGE_SYSTEM_PROMPT = [
  "Você é o assistente de suporte e orientação do EME, o Sistema Operacional do Corretor.",
  "Use somente os fatos selecionados como base e não invente funcionalidades.",
  "Nunca copie, enumere ou mencione a fonte recebida.",
  "Para ajuda sobre uma área, diga primeiro o que ela é, depois o que permite fazer e termine oferecendo uma ajuda concreta do COS.",
  "Para orientação inicial, resuma os principais caminhos do EME e ofereça um próximo passo concreto.",
  "Para uma pergunta, responda diretamente sem iniciar, simular ou confirmar uma operação.",
  "Responda em português, de forma natural e diretamente ligada ao que foi perguntado.",
  "Não mencione o Livro, as fontes ou termos internos como general, capability, workflow, Registry, handler, descriptor, actions ou enums.",
  "Use os termos de apresentação do produto: cliente, imóvel, compromisso, proposta e contrato.",
  "Perguntas de orientação nunca executam ações nem afirmam que dados foram alterados.",
  "Quando os trechos não cobrirem algo, admita isso com honestidade.",
].join(" ")

const SHORT_ANSWER_INSTRUCTION = "Responda por padrão em até três frases curtas, sem título, introdução ou lista extensa."
const DETAILED_ANSWER_INSTRUCTION = "O corretor pediu detalhes; ainda seja objetivo e use no máximo oito itens curtos."
const SAFE_HELP_FALLBACK = "Não encontrei uma resposta objetiva para isso. Diga qual parte do EME você quer entender."

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

function buildHelpFallbackResponse(manualContext: string, message: string) {
  return normalizeCosGroundedResponse(manualContext, isDetailedCosKnowledgeRequest(message))
}

function createHelpCapability(topic: HelpTopic): CosCapabilityHandler {
  return async ({ message, action, context }) => {
    const usesKnowledgeLayer = Boolean(
      context?.knowledge && (context.surface === "portal" || context.surface === "cos_home"),
    )
    const guidedResponse = GUIDED_HELP_RESPONSES[topic]
    const showGuidedMenu = Boolean(guidedResponse) && (
      usesKnowledgeLayer
        ? topic === "general_question" && context?.decision?.source === "explicit_interface" && isGeneralQuestionMenuTrigger(message)
        : topic !== "general_question" || isGeneralQuestionMenuTrigger(message)
    )
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

    const knowledge = usesKnowledgeLayer ? context?.knowledge ?? null : null
    if (knowledge?.knowledgeMiss) {
      return {
        response: SAFE_HELP_FALLBACK,
        metadata: {
          noCharge: true,
          topic,
          source: "knowledge_miss",
          knowledgeVersion: knowledge.sourceVersion,
          knowledgeDocumentIds: [],
          knowledgeChunkIds: [],
        },
      }
    }

    const manualContext = knowledge
      ? formatCosKnowledgeFactsForResponse({ message, context: knowledge })
      : await loadHelpManualContext(topic)
    const detailedAnswer = isDetailedCosKnowledgeRequest(message)
    const fallbackResponse = knowledge
      ? buildCosGroundedHelpResponse({ message, context: knowledge })
      : buildHelpFallbackResponse(manualContext, message)
    const safeFallbackResponse = fallbackResponse || SAFE_HELP_FALLBACK
    const knowledgeMetadata = knowledge
      ? {
          knowledgeVersion: knowledge.sourceVersion,
          knowledgeDocumentIds: knowledge.selectedDocuments.map((document) => document.id),
          knowledgeChunkIds: knowledge.chunks.map((chunk) => chunk.id),
        }
      : {}
    const client = getOpenAIClient()

    if (!client) {
      return {
        response: safeFallbackResponse,
        metadata: {
          noCharge: true,
          topic,
          source: knowledge ? "knowledge_fallback" : "manual_fallback",
          ...knowledgeMetadata,
        },
      }
    }

    const { model } = getOpenAIEnv()
    try {
      const response = await createOpenAIResponse({
        client,
        operationKey: "cos.help.reply",
        metadata: { topic, action, ...knowledgeMetadata },
        request: {
          model,
          max_output_tokens: detailedAnswer ? 700 : 260,
          reasoning: {
            effort: "minimal",
          },
          instructions: `${knowledge ? KNOWLEDGE_SYSTEM_PROMPT : HELP_SYSTEM_PROMPT} ${detailedAnswer ? DETAILED_ANSWER_INSTRUCTION : SHORT_ANSWER_INSTRUCTION}`,
          input: [
            `${knowledge ? "Fatos relevantes do EME" : "Manual oficial do EME"}:\n\n${manualContext}`,
            `Pergunta do corretor: ${message}`,
          ].join("\n\n"),
        },
      })

      if (response.status === "incomplete" && response.incomplete_details?.reason === "max_output_tokens") {
        console.error("[cos][help][openai-response-truncated]", { topic, status: response.status })
        return {
          response: safeFallbackResponse,
          metadata: {
            noCharge: true,
            topic,
            source: knowledge ? "knowledge_fallback_truncated" : "manual_fallback_truncated",
            ...knowledgeMetadata,
          },
        }
      }

      const answer = knowledge
        ? normalizeCosHelpResponse(response.output_text, detailedAnswer)
        : normalizeCosGroundedResponse(response.output_text, detailedAnswer)

      return {
        response: answer || safeFallbackResponse,
        metadata: knowledge
          ? {
              noCharge: true,
              topic,
              source: "knowledge",
              ...knowledgeMetadata,
            }
          : { noCharge: true, topic },
      }
    } catch (caughtError) {
      if (!knowledge) throw caughtError
      console.error("[cos][help][provider-error]", {
        topic,
        error: caughtError instanceof Error ? caughtError.message : "unknown",
      })
      return {
        response: safeFallbackResponse,
        metadata: {
          noCharge: true,
          topic,
          source: knowledge ? "knowledge_fallback_provider_error" : "manual_fallback_provider_error",
          ...knowledgeMetadata,
        },
      }
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
