import type { CosEntityModule } from "@/lib/cos/types"

export const proposalEntityModule: CosEntityModule = {
  entity: {
    id: "proposal",
    title: "Proposta",
    description: "Capacidades relacionadas à geração e orquestração de propostas comerciais.",
  },
  capabilities: [
    {
      descriptor: {
        id: "proposal.create",
        action: "CREATE_PROPOSAL",
        title: "Proposta gerada",
        description: "Cria propostas comerciais em rascunho para revisão posterior.",
        domain: "proposal",
        entity: "document",
        aliases: ["criar proposta", "gerar proposta", "nova proposta", "montar proposta"],
        responseMode: "raw",
        source: "modular",
        mutatesData: true,
        requiresConfirmation: true,
        requiresSelection: true,
        surfaces: ["portal", "cos_home", "whatsapp"],
        confirmationMessage: "Posso gerar esta proposta agora e salvar em Documentos. Deseja confirmar?",
      },
    },
  ],
}
