import type { CosEntityModule } from "@/lib/cos/types"

export const operationEntityModule: CosEntityModule = {
  entity: {
    id: "operation",
    title: "Operação",
    description: "Capacidades transversais da operação diária do corretor.",
  },
  capabilities: [
    {
      descriptor: {
        id: "operation.summary",
        action: "createInternalNotification",
        title: "Resumo da operação",
        description: "Consolida pendências e indicadores operacionais do corretor.",
        domain: "operation",
        entity: "operation",
        aliases: [],
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
        id: "document.list",
        action: "LIST_DOCUMENTS",
        title: "Consulta de documentos",
        description: "Lista documentos relacionados ao cliente ou imóvel consultado.",
        domain: "document",
        entity: "document",
        aliases: [],
        responseMode: "raw",
        source: "legacy",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "whatsapp"],
      },
    },
    {
      descriptor: {
        id: "document.get",
        action: "GET_DOCUMENT",
        title: "Documento consultado",
        description: "Abre ou resume o documento mais relevante para o contexto consultado.",
        domain: "document",
        entity: "document",
        aliases: [],
        responseMode: "raw",
        source: "legacy",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "whatsapp"],
      },
    },
  ],
}
