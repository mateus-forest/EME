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
      response:
        "Posso te ajudar com clientes, imóveis, propostas, contratos, agenda, Studio IA, financeiro e desempenho.\n\nDiga a ação que você quer executar e eu continuo por esse fluxo.",
      metadata: { noCharge: true, source: "general_chat" },
    }
  }

  return {
    response:
      "Entendi seu pedido, mas ainda preciso de mais contexto para escolher a ação certa.\n\nVocê pode me pedir, por exemplo:\n- cadastrar cliente\n- buscar imóveis\n- criar proposta\n- criar contrato\n- agendar compromisso",
    metadata: { noCharge: true, source: "general_chat_fallback" },
  }
}
