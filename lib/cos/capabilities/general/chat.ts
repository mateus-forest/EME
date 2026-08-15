import "server-only"

import {
  buildCosConversationResponse,
  classifyCosSocialIntent,
  COS_GENERAL_CHAT_OPTIONS,
} from "@/lib/cos/conversation"
import { getCosCapabilityDescriptorById } from "@/lib/cos/capability-catalog"
import type { CosCapabilityHandler } from "@/lib/cos/types"

const CAPABILITY_DOMAIN_RESPONSES = {
  lead: "cadastrar, consultar e organizar clientes",
  property: "cadastrar, consultar e operar imóveis",
  proposal: "criar e consultar propostas",
  contract: "criar, consultar e acompanhar contratos",
  agenda: "consultar e organizar compromissos",
  catalog: "consultar e operar o catálogo",
  marketplace: "orientar sobre o Marketplace",
  finance: "consultar informações financeiras",
  analytics: "consultar desempenho e indicadores",
  studio: "usar os recursos disponíveis do Studio IA",
  help: "explicar como usar o EME",
  general: "ajudar nas operações disponíveis no EME",
} as const

export const generalChatCapability: CosCapabilityHandler = async ({ message, context }) => {
  const socialIntent = classifyCosSocialIntent(message)
  const decision = context?.decision

  if (decision?.dialogueAct === "capability_question") {
    const usesRegistryAnswer = context?.surface === "portal" || context?.surface === "cos_home"
    if (usesRegistryAnswer) {
      const targetCapabilityId = decision.objective.targetCapabilityId
      const descriptor = targetCapabilityId ? getCosCapabilityDescriptorById(targetCapabilityId) : null
      const available = Boolean(
        descriptor && descriptor.id !== "general.chat" && descriptor.surfaces.includes(context.surface),
      )
      const knowledgeDocumentIds = context.knowledge?.selectedDocuments.map((document) => document.id) ?? []

      if (!available || !descriptor) {
        return {
          response: "Não encontrei uma ação operacional do COS para fazer isso agora. Posso explicar o que existe no EME ou ajudar você a reformular o pedido.",
          metadata: {
            noCharge: true,
            source: "capability_question_registry_miss",
            targetCapabilityId,
            primaryDomain: decision.primaryDomain,
            knowledgeDocumentIds,
          },
        }
      }

      const actionLabel = descriptor.title.charAt(0).toLowerCase() + descriptor.title.slice(1)
      return {
        response: `Sim. Posso ${actionLabel}. Nada foi executado agora; quando quiser, peça a ação diretamente e eu conduzo os dados necessários com você.`,
        metadata: {
          noCharge: true,
          source: "capability_question_registry",
          targetCapabilityId: descriptor.id,
          targetAction: descriptor.action,
          primaryDomain: decision.primaryDomain,
          mutatesData: descriptor.mutatesData,
          requiresConfirmation: descriptor.requiresConfirmation,
          requiresSelection: descriptor.requiresSelection,
          knowledgeDocumentIds,
        },
      }
    }

    const capabilityDescription = CAPABILITY_DOMAIN_RESPONSES[decision.primaryDomain]
    return {
      response: `Sim. Posso ${capabilityDescription}. Se quiser, me diga para executar e eu conduzo os dados necessários com você.`,
      metadata: {
        noCharge: true,
        source: "capability_question",
        targetCapabilityId: decision.objective.targetCapabilityId,
        primaryDomain: decision.primaryDomain,
      },
    }
  }

  return {
    response: buildCosConversationResponse({
      message,
      intent: socialIntent,
      firstName: context?.actor?.firstName,
      memory: context?.memory,
      workspace: context?.workspace,
    }),
    metadata: {
      noCharge: true,
      source: socialIntent ? "general_chat_social" : "general_chat",
      conversationKind: socialIntent ?? "general",
      options: [...COS_GENERAL_CHAT_OPTIONS],
    },
  }
}
