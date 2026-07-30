import type { CosEntityModule } from "@/lib/cos/types"

export const financeEntityModule: CosEntityModule = {
  entity: {
    id: "finance",
    title: "Financeiro",
    description: "Capacidades relacionadas à leitura financeira da carteira e operação.",
  },
  capabilities: [
    {
      descriptor: {
        id: "finance.summary",
        action: "getFinancialSummary",
        title: "Análise financeira",
        description: "Resume carteira, ticket médio e distribuição de imóveis ativos.",
        domain: "finance",
        entity: "financial",
        aliases: ["financeiro", "resumo financeiro", "comissao prevista", "quanto tenho de comissao"],
        responseMode: "raw",
        source: "modular",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp"],
      },
    },
  ],
}
