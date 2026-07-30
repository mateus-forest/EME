import type { CosEntityModule } from "@/lib/cos/types"

export const generalEntityModule: CosEntityModule = {
  entity: {
    id: "general",
    title: "Geral",
    description: "Camada de atendimento geral e fallback conversacional do COS.",
  },
  capabilities: [
    {
      descriptor: {
        id: "general.chat",
        action: "general",
        title: "Atendimento geral",
        description: "Conduz a conversa geral do COS quando não há uma ação operacional específica.",
        domain: "general",
        entity: "conversation",
        aliases: ["chat", "chat_cos"],
        responseMode: "nlg",
        source: "legacy",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp", "demo"],
      },
    },
  ],
}
