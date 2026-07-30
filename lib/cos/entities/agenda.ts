import type { CosEntityModule } from "@/lib/cos/types"

export const agendaEntityModule: CosEntityModule = {
  entity: {
    id: "agenda",
    title: "Agenda",
    description: "Capacidades relacionadas a compromissos, lembretes e consultas de agenda.",
  },
  capabilities: [
    {
      descriptor: {
        id: "agenda.create",
        action: "CREATE_AGENDA_EVENT",
        title: "Compromisso criado",
        description: "Cria compromissos e lembretes na agenda do corretor.",
        domain: "agenda",
        entity: "agenda",
        aliases: ["agendar compromisso", "criar compromisso", "nova visita"],
        responseMode: "raw",
        source: "legacy",
        mutatesData: true,
        requiresConfirmation: true,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp"],
        confirmationMessage: "Posso criar este compromisso agora na sua agenda. Deseja confirmar?",
      },
    },
    {
      descriptor: {
        id: "agenda.list",
        action: "LIST_AGENDA_EVENTS",
        title: "Consulta de agenda",
        description: "Lista compromissos pendentes ou filtrados por data.",
        domain: "agenda",
        entity: "agenda",
        aliases: ["meus compromissos", "agenda de hoje", "quais compromissos tenho hoje", "mostrar agenda"],
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
        id: "agenda.complete",
        action: "MARK_AGENDA_DONE",
        title: "Compromisso concluído",
        description: "Marca compromissos pendentes como concluídos.",
        domain: "agenda",
        entity: "agenda",
        aliases: ["concluir compromisso", "marcar compromisso como concluido"],
        responseMode: "raw",
        source: "modular",
        mutatesData: true,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "whatsapp"],
      },
    },
  ],
}
