import type { CosEntityModule } from "@/lib/cos/types"

export const contractEntityModule: CosEntityModule = {
  entity: {
    id: "contract",
    title: "Contrato",
    description: "Capacidades relacionadas à geração, listagem e consulta de contratos.",
  },
  capabilities: [
    {
      descriptor: {
        id: "contract.create",
        action: "CREATE_CONTRACT",
        title: "Contrato gerado",
        description: "Cria contratos em rascunho vinculados a cliente e imóvel.",
        domain: "contract",
        entity: "contract",
        aliases: ["criar contrato", "gerar contrato", "contrato de compra e venda"],
        responseMode: "raw",
        source: "legacy",
        mutatesData: true,
        requiresConfirmation: true,
        requiresSelection: true,
        surfaces: ["portal", "cos_home", "whatsapp"],
        confirmationMessage: "Posso gerar este contrato agora, salvar em Documentos e deixar como rascunho para revisao. Deseja confirmar?",
      },
    },
    {
      descriptor: {
        id: "contract.list",
        action: "LIST_CONTRACTS",
        title: "Consulta de contratos",
        description: "Lista contratos relacionados ao contexto consultado.",
        domain: "contract",
        entity: "contract",
        aliases: ["mostrar contratos", "meus contratos", "listar contratos"],
        responseMode: "raw",
        source: "legacy",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp"],
      },
    },
    {
      descriptor: {
        id: "contract.get",
        action: "GET_CONTRACT",
        title: "Contrato consultado",
        description: "Abre ou resume o contrato mais relevante para o contexto consultado.",
        domain: "contract",
        entity: "contract",
        aliases: ["abrir contrato", "ver contrato", "enviar contrato"],
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
