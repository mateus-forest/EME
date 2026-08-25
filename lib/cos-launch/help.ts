import type { CosLaunchIntent, CosLaunchResponse } from "@/lib/cos-launch/types"
const help: Partial<Record<CosLaunchIntent, CosLaunchResponse>> = {
  help_properties: { message: "Em Imóveis você organiza a carteira, mantém dados e mídias e publica quando o cadastro estiver pronto.", actions: [{ id: "query:properties", label: "Ver imóveis" }, { id: "form:property", label: "Cadastrar imóvel" }] },
  help_clients: { message: "Em Clientes você acompanha contatos, interesses, status e vínculos com imóveis, propostas e documentos.", actions: [{ id: "query:clients", label: "Ver clientes" }, { id: "form:client", label: "Cadastrar cliente" }] },
  help_contracts: { message: "Contratos ficam organizados como documentos do negócio. O COS pode consultar e criar um rascunho para revisão.", actions: [{ id: "query:contracts", label: "Ver contratos" }, { id: "form:contract", label: "Criar rascunho" }] },
  help_proposals: { message: "Propostas relacionam cliente, imóvel e condições comerciais. O COS pode consultar ou criar um rascunho real.", actions: [{ id: "query:proposals", label: "Ver propostas" }, { id: "form:proposal", label: "Criar proposta" }] },
  help_studio: { message: "O Studio IA cria campanhas e conteúdos usando os dados reais dos seus imóveis. Formatos avançados continuam disponíveis na própria área.", actions: [{ id: "open:studio", label: "Abrir Studio IA", href: "/corretor/studio" }] },
  help_catalog: { message: "O Catálogo é sua vitrine pública. Ele reúne imóveis publicados, perfil e contatos em um link compartilhável.", actions: [{ id: "open:catalog", label: "Abrir Catálogo", href: "/corretor/catalogo" }] },
  help_marketplace: { message: "O Marketplace amplia a distribuição dos imóveis elegíveis e conecta interessados ao corretor responsável.", actions: [{ id: "open:marketplace", label: "Abrir Marketplace", href: "/corretor/marketplace" }] },
  help_cos: { message: "Peça consultas ou use Criar para cadastrar clientes, imóveis, propostas, contratos e compromissos. Quando uma ação não estiver disponível, eu indicarei a área correta sem simular execução." },
}
export function getCosLaunchHelp(intent: CosLaunchIntent): CosLaunchResponse { return help[intent] ?? { message: "Ainda não consigo fazer isso diretamente por aqui.", actions: [{ id: "help:cos", label: "Ver ajuda" }] } }
