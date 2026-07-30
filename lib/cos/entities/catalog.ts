import type { CosEntityModule } from "@/lib/cos/types"

export const catalogEntityModule: CosEntityModule = {
  entity: {
    id: "catalog",
    title: "Catálogo",
    description: "Capacidades relacionadas ao desempenho e leitura comercial do catálogo.",
  },
  capabilities: [
    {
      descriptor: {
        id: "analytics.summary",
        action: "getAnalyticsSummary",
        title: "Consulta de desempenho",
        description: "Resume analytics do catálogo e o desempenho comercial recente.",
        domain: "analytics",
        entity: "analytics",
        aliases: ["lead_ideas"],
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
        id: "catalog.summary",
        action: "getCatalogSummary",
        title: "Resumo do catálogo",
        description: "Retorna um resumo sintético do catálogo publicado do corretor.",
        domain: "catalog",
        entity: "catalog",
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
        id: "catalog.analyze",
        action: "analyzeCatalog",
        title: "Catálogo analisado",
        description: "Analisa o catálogo e retorna um panorama comercial resumido.",
        domain: "catalog",
        entity: "catalog",
        aliases: ["analyze_catalog", "create_catalog"],
        responseMode: "raw",
        source: "modular",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp", "demo"],
      },
    },
  ],
}
