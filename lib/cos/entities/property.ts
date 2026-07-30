import type { CosEntityModule } from "@/lib/cos/types"

export const propertyEntityModule: CosEntityModule = {
  entity: {
    id: "property",
    title: "Imóvel",
    description: "Capacidades relacionadas ao cadastro, busca e qualificação comercial de imóveis.",
  },
  capabilities: [
    {
      descriptor: {
        id: "property.create",
        action: "createPropertyDraft",
        title: "Cadastro de imóvel",
        description: "Cria um imóvel em rascunho a partir de instruções em linguagem natural.",
        domain: "property",
        entity: "property",
        aliases: ["create_ad"],
        responseMode: "raw",
        source: "legacy",
        mutatesData: true,
        requiresConfirmation: true,
        requiresSelection: false,
        surfaces: ["portal", "cos_home", "whatsapp"],
        confirmationMessage: "Encontrei um pedido para cadastrar um imóvel em rascunho. Deseja confirmar?",
      },
    },
    {
      descriptor: {
        id: "property.search",
        action: "searchProperties",
        title: "Busca de imóveis",
        description: "Pesquisa imóveis do corretor com base em filtros extraídos da mensagem.",
        domain: "property",
        entity: "property",
        aliases: ["match_properties", "search_property"],
        responseMode: "raw",
        source: "legacy",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: true,
        surfaces: ["portal", "cos_home", "whatsapp", "demo"],
      },
    },
    {
      descriptor: {
        id: "property.description.improve",
        action: "improvePropertyDescription",
        title: "Melhoria de descrição",
        description: "Melhora a base de descrição comercial de um imóvel.",
        domain: "property",
        entity: "property",
        aliases: ["improve_description"],
        responseMode: "nlg",
        source: "legacy",
        mutatesData: false,
        requiresConfirmation: false,
        requiresSelection: false,
        surfaces: ["portal", "whatsapp"],
      },
    },
  ],
}
