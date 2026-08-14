import "server-only"

import {
  buildCosConversationResponse,
  classifyCosSocialIntent,
  COS_GENERAL_CHAT_OPTIONS,
} from "@/lib/cos/conversation"
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
