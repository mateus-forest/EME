import "server-only"

import type { CosCapabilityHandler } from "@/lib/cos/types"

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

export const generalChatCapability: CosCapabilityHandler = async ({ message }) => {
  const normalized = normalize(message)
  const isGreeting = /^(oi|ola|olá|bom dia|boa tarde|boa noite|ajuda|menu|help)$/.test(normalized)

  if (isGreeting) {
    return {
      response: "Escolha por onde deseja começar.",
      metadata: {
        noCharge: true,
        source: "general_chat",
        options: [
          { id: "onboarding_clients", actionId: "onboarding:clients", action: "FIND_LEAD", message: "Clientes", label: "Clientes" },
          { id: "onboarding_properties", actionId: "onboarding:properties", action: "searchProperties", message: "Imóveis", label: "Imóveis" },
          { id: "onboarding_cos", actionId: "onboarding:cos", action: "help_use_cos", message: "Como usar o COS", label: "Como usar o COS" },
        ],
      },
    }
  }

  return {
    response: "Escolha a operação que deseja executar.",
    metadata: {
      noCharge: true,
      source: "general_chat_fallback",
      options: [
        { id: "fallback_clients", actionId: "fallback:clients", action: "FIND_LEAD", message: "Clientes", label: "Clientes" },
        { id: "fallback_properties", actionId: "fallback:properties", action: "searchProperties", message: "Buscar imóveis", label: "Buscar imóveis" },
        { id: "fallback_proposal", actionId: "fallback:proposal", action: "CREATE_PROPOSAL", message: "Criar proposta", label: "Criar proposta" },
        { id: "fallback_contract", actionId: "fallback:contract", action: "CREATE_CONTRACT", message: "Novo contrato", label: "Novo contrato" },
        { id: "fallback_agenda", actionId: "fallback:agenda", action: "CREATE_AGENDA_EVENT", message: "Agenda", label: "Agenda" },
      ],
    },
  }
}
