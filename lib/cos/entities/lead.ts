import type { CosEntityModule } from "@/lib/cos/types"

export const leadEntityModule: CosEntityModule = {
  entity: {
    id: "lead",
    title: "Cliente (Lead)",
    description: "Capacidades relacionadas ao CRM, cadastro e análise de clientes/leads.",
  },
  capabilities: [
    {
      descriptor: {
        id: "lead.create",
        action: "createLead",
        title: "Cadastro de cliente",
        description: "Cria ou atualiza um lead/cliente a partir da conversa.",
        domain: "lead",
        entity: "lead",
        aliases: ["cadastrar cliente", "cadastrar lead", "novo cliente", "novo lead"],
        responseMode: "raw",
        source: "legacy",
        mutatesData: true,
        requiresConfirmation: true,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp"],
        confirmationMessage: "Posso cadastrar ou atualizar este cliente agora. Deseja confirmar?",
      },
    },
    {
      descriptor: {
        id: "lead.summary",
        action: "getLeadsSummary",
        title: "Resumo de clientes",
        description: "Retorna um resumo operacional dos leads/clientes do corretor.",
        domain: "lead",
        entity: "lead",
        aliases: ["resumo de clientes", "resumo de leads", "analisar clientes"],
        responseMode: "raw",
        source: "modular",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp"],
      },
    },
    {
      descriptor: {
        id: "lead.summarize",
        action: "summarizeLead",
        title: "Análise de clientes",
        description: "Resume os últimos leads e atendimentos relevantes.",
        domain: "lead",
        entity: "lead",
        aliases: ["reply_client", "resumir lead", "analisar lead", "revisar clientes"],
        responseMode: "raw",
        source: "legacy",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp"],
      },
    },
  ],
}
