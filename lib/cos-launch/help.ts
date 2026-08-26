import type { CosLaunchIntent, CosLaunchResponse } from "@/lib/cos-launch/types"
const help: Partial<Record<CosLaunchIntent, CosLaunchResponse>> = {
  help_properties: {
    message: "Imóveis é a área da sua carteira no EME. Use para cadastrar e editar imóveis, organizar fotos e documentos, acompanhar o status e publicar imóveis elegíveis no Catálogo ou Marketplace. Acesse quando precisar completar dados, revisar pendências ou gerenciar uma publicação.",
    actions: [{ id: "query:properties", label: "Ver imóveis" }, { id: "form:property", label: "Cadastrar imóvel" }, { id: "open:properties", label: "Abrir Imóveis", href: "/corretor/imoveis" }],
  },
  help_clients: {
    message: "Clientes reúne os contatos e oportunidades da sua operação. Você pode cadastrar clientes, acompanhar o status comercial, registrar interesses e relacionar imóveis. Use esta área para manter o atendimento organizado e retomar negociações com contexto.",
    actions: [{ id: "query:clients", label: "Ver clientes" }, { id: "form:client", label: "Cadastrar cliente" }, { id: "open:clients", label: "Abrir Clientes", href: "/corretor/clientes" }],
  },
  help_contracts: {
    message: "Contratos organiza os documentos contratuais vinculados a clientes e imóveis. Você pode criar rascunhos, revisar informações, acompanhar o status e abrir o documento completo. Use quando a negociação avançar para a formalização; envio e assinatura externa continuam fora do COS.",
    actions: [{ id: "query:contracts", label: "Ver contratos" }, { id: "form:contract", label: "Criar rascunho" }, { id: "open:contracts", label: "Abrir Contratos", href: "/corretor/contratos" }],
  },
  help_proposals: {
    message: "Propostas reúne as condições comerciais apresentadas aos clientes. Você pode criar um rascunho, relacionar cliente e imóvel, informar valores e acompanhar o status. Use quando houver interesse concreto e for necessário registrar ou revisar uma negociação.",
    actions: [{ id: "query:proposals", label: "Ver propostas" }, { id: "form:proposal", label: "Criar proposta" }, { id: "open:proposals", label: "Abrir Propostas", href: "/corretor/propostas" }],
  },
  help_studio: {
    message: "Studio IA transforma os dados reais dos seus imóveis em materiais de divulgação. Use para criar campanhas, preparar conteúdos para Instagram e gerar novas versões de peças compatíveis. A geração depende das informações do imóvel e dos Créditos IA disponíveis.",
    actions: [{ id: "open:studio", label: "Abrir Studio IA", href: "/corretor/studio-ia" }],
  },
  help_catalog: {
    message: "O Catálogo reúne seu perfil público e os imóveis publicados em um link compartilhável. Ele apresenta foto, especialidades, contatos e os imóveis elegíveis da sua carteira. Use para divulgar sua atuação e revisar pendências que impedem uma publicação.",
    actions: [{ id: "open:catalog", label: "Abrir Catálogo", href: "/corretor/catalogo" }],
  },
  help_marketplace: {
    message: "O Marketplace amplia a exposição dos imóveis publicados e conecta sua operação a novos interessados. Você pode acompanhar publicações, leads, conversas, avaliações e pendências. Use para revisar a presença pública e o desempenho dos anúncios elegíveis.",
    actions: [{ id: "open:marketplace", label: "Abrir Marketplace", href: "/corretor/marketplace" }],
  },
  help_plan_account: {
    message: "Plano mostra Free, Pro ou Scale, limites de imóveis, Créditos IA, pacotes, capacidade adicional e opções de upgrade. Conta reúne perfil, segurança e Faturamento, onde ficam assinatura, forma de pagamento, cobranças e cancelamento pelo Stripe. O COS orienta e abre essas áreas, mas não executa alterações de billing pela conversa.",
    actions: [{ id: "open:plan", label: "Abrir Plano", href: "/corretor/plano" }, { id: "open:billing", label: "Abrir Faturamento", href: "/corretor/conta?tab=faturamento" }, { id: "open:account", label: "Abrir Conta", href: "/corretor/conta" }],
  },
  help_cos: {
    message: "O COS é o assistente operacional do EME. Use para consultar dados reais, localizar registros, criar rascunhos e executar ações simples suportadas sem sair da conversa. Escolha uma ação rápida ou escreva de forma direta; quando uma tarefa não estiver disponível, o COS indica a tela correta.",
  },
}
export function getCosLaunchHelp(intent: CosLaunchIntent): CosLaunchResponse { return help[intent] ?? { message: "Ainda não consigo fazer isso diretamente por aqui.", actions: [{ id: "help:cos", label: "Ver ajuda" }] } }
