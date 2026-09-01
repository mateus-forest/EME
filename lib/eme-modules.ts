import type { LucideIcon } from "lucide-react"
import {
  Sparkles,
  Users,
  Home,
  BookOpen,
  WandSparkles,
  FileText,
  ShieldCheck,
  CalendarDays,
  Store,
  WalletCards,
} from "lucide-react"

export type EmeModule = {
  id: string
  name: string
  description: string
  icon: LucideIcon
  /** Base angle (degrees) on the orbit. 0 = front-center, grows clockwise.
   *  All nine modules are spaced by a uniform 40° step (no manual offsets) so
   *  the ring keeps a perfectly continuous rhythm — every card is placed by the
   *  exact same orbital formula and none can drift or read as isolated. */
  angle: number
  /** Kept visible on small screens when true. */
  priorityMobile: boolean

  // ---- Phase 4: the content the card reveals when it expands --------------
  /** One-line headline shown large inside the expanded panel. */
  tagline: string
  /** 2–3 line description. */
  longDescription: string
  /** Key benefits, shown as a checklist. A plain string renders as a single line; an object
   *  with a description renders as a bold title plus a lighter supporting line beneath it. */
  benefits: (string | { title: string; description: string })[]
  /** Call-to-action label. */
  cta: string
  /** Premium device mockup for the panel's left side. */
  mockup: string
  /** How the mockup fills the panel's left column.
   *  - "contain" (default): centred with padding — for single-device renders.
   *  - "cover": full-bleed edge-to-edge — for full device scenes (e.g. COS). */
  mockupFit?: "contain" | "cover"
  /** Optional secondary link shown in the panel footer (e.g. a live demo). Omitted modules
   *  simply don't render that half of the footer — this is not every module's job to have one. */
  demoHref?: string
  demoLabel?: string
}

/** Marketplace is part of the hero composition, but not of the rotating module ring. */
export const marketplaceModule = {
  id: "marketplace",
  name: "Marketplace",
  description: "Seus imóveis, além do seu catálogo",
  icon: Store,
  angle: 0,
  priorityMobile: true,
  tagline: "Seus imóveis, além do seu catálogo.",
  longDescription:
    "Publique seus imóveis no EME Imóveis e amplie sua presença em uma vitrine feita para conectar pessoas ao imóvel certo — e ao corretor responsável.",
  benefits: [
    { title: "Transforma a experiência de busca do seu cliente", description: "Seu cliente encontra com mais facilidade o imóvel ideal." },
    { title: "Busca e comparação inteligente de imóveis", description: "O sistema entende o que ele procura e compara as melhores opções." },
    { title: "Aumenta suas oportunidades de conversão", description: "Mais visibilidade, mais interesse e mais negócios fechados." },
    { title: "Gera e registra novos leads automaticamente", description: "Cada interesse vira um lead direto no seu sistema." },
    { title: "Dá mais visibilidade aos seus imóveis e ao seu perfil", description: "Seu trabalho em destaque para quem realmente importa." },
    { title: "Amplia sua distribuição com tráfego e campanhas do EME", description: "Mais alcance, mais relevância e mais resultados para você." },
    { title: "Experiência e segurança para quem vende e compra", description: "Ambiente seguro e confiável para gerar confiança em todas as negociações." },
  ],
  cta: "Marketplace",
  mockup: "/modals/marketplace-2026.png",
  demoHref: "/imoveis",
  demoLabel: "Abrir demonstração",
} satisfies EmeModule

/**
 * The nine modules that orbit the EME logo.
 * `angle` places each card around an elliptical orbit and is the single value
 * that scroll interaction offsets to rotate the whole universe.
 */
export const emeModules: EmeModule[] = [
  {
    id: "cos",
    name: "COS",
    description: "Seu assistente inteligente",
    icon: Sparkles,
    angle: 280,
    priorityMobile: false,
    tagline: "Seu sistema conversacional operacional, sempre ao seu lado.",
    longDescription:
      "O COS é o assistente que entende sua rotina e executa tarefas de verdade dentro do sistema: cadastra, edita, cria, analisa e orienta para você ganhar tempo e resultado.",
    benefits: [
      { title: "Cadastra e edita clientes", description: "Sem precisar abrir cada tela manualmente." },
      { title: "Anexa documentos", description: "Envie e organize arquivos direto na conversa." },
      { title: "Cria imóveis e anúncios", description: "Publique um imóvel só descrevendo para o COS." },
      { title: "Analisa a saúde da operação", description: "Veja o que precisa de atenção em segundos." },
      { title: "Monitora leads e oportunidades", description: "Nunca perca um contato quente de vista." },
      { title: "Ensina e orienta no uso do sistema", description: "Pergunte qualquer coisa sobre o EME a qualquer momento." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/cos-2026.png",
    mockupFit: "cover",
  },
  {
    id: "clientes",
    name: "Clientes",
    description: "Relacionamentos organizados",
    icon: Users,
    angle: 320,
    priorityMobile: true,
    tagline: "Todo relacionamento, organizado em um só lugar.",
    longDescription:
      "Centralize clientes, documentos, histórico e oportunidades. O EME acompanha cada contato desde o primeiro interesse até o fechamento do negócio.",
    benefits: [
      { title: "Cadastro completo de clientes", description: "Dados, preferências e contatos em um só lugar." },
      { title: "Registro automático de leads do catálogo e marketplace", description: "Todo interesse do catálogo vira cliente automaticamente." },
      { title: "Histórico e documentos centralizados", description: "Nada se perde entre conversas e etapas." },
      { title: "Acompanhamento do funil de atendimento", description: "Saiba exatamente em que fase está cada negociação." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/clientes-2026.png",
  },
  {
    id: "imoveis",
    name: "Imóveis",
    description: "Sua carteira conectada",
    icon: Home,
    angle: 0,
    priorityMobile: true,
    tagline: "Seu jeito de cadastrar. A IA faz o resto.",
    longDescription:
      "Cadastre imóveis manualmente, com IA ou importe anúncios em segundos. O EME organiza toda sua carteira automaticamente para você vender mais.",
    benefits: [
      { title: "Cadastro inteligente com IA", description: "Descreva o imóvel e a IA organiza tudo para você." },
      { title: "Cadastro manual tradicional", description: "Total controle campo a campo, quando preferir." },
      { title: "Importação por XML, URL, anúncio ou imagem", description: "Traga imóveis de onde já estiverem publicados." },
      { title: "Importação em massa de imóveis", description: "Suba toda sua carteira de uma só vez." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/imoveis-2026.png",
  },
  {
    id: "catalogo",
    name: "Catálogo",
    description: "Apresente e compartilhe",
    icon: BookOpen,
    angle: 40,
    priorityMobile: true,
    tagline: "Catálogo de imóveis que impressiona e converte.",
    longDescription:
      "Apresente seus imóveis com design profissional, informações completas e uma experiência impecável. Compartilhe facilmente com seus clientes por qualquer canal e acompanhe o interesse em cada imóvel.",
    benefits: [
      { title: "Catálogos modernos e responsivos", description: "Experiência perfeita no computador ou celular." },
      { title: "Link compartilhável com sua marca", description: "Personalize e compartilhe por qualquer canal." },
      { title: "Registro e catálogo de leads automático", description: "Cada visita e interesse é registrado automaticamente." },
      { title: "Atualizações em tempo real", description: "Imóveis sempre atualizados sem retrabalho." },
      { title: "Mais profissionalismo e credibilidade", description: "Sua marca apresentada com o padrão que você merece." },
    ],
    cta: "Conhecer módulo",
      mockup: "/modals/catalogo-2026-final.png",
    demoLabel: "Ver um exemplo de catálogo",
    demoHref: "/catalogo/mateusforest",
  },
  {
    id: "studio-ia",
    name: "Studio IA",
    description: "Crie campanhas com IA",
    icon: WandSparkles,
    angle: 80,
    priorityMobile: false,
    tagline: "Sua central de criação com Inteligência Artificial.",
    longDescription:
      "Crie campanhas, vídeos e conteúdos profissionais em minutos. O Studio IA reúne todas as ferramentas para divulgar imóveis, captar proprietários e acelerar suas vendas.",
    benefits: [
      { title: "Criar campanha", description: "Crie conteúdo completo para divulgar seus imóveis nas redes sociais." },
      { title: "Preparar imóvel", description: "Organize e prepare as fotografias do imóvel para uma apresentação mais atraente." },
      { title: "Visualizar projeto", description: "Área reservada para representações arquitetônicas em validação." },
      { title: "Criar vídeo", description: "Transforme as melhores imagens do imóvel em uma apresentação em vídeo." },
      { title: "Criar anúncio", description: "Crie materiais e mensagens focados em promover um imóvel e gerar oportunidades." },
      { title: "Biblioteca inteligente de conteúdos", description: "Acesse e reutilize materiais aprovados com facilidade." },
    ],
    cta: "Explorar módulo",
    mockup: "/modals/studio-ia-final.png",
  },
  {
    id: "propostas",
    name: "Propostas",
    description: "Negociações mais simples",
    icon: FileText,
    angle: 120,
    priorityMobile: false,
    tagline: "Propostas profissionais, prontas para impressionar.",
    longDescription:
      "Crie propostas completas em segundos, com cálculo automático de financiamento e envio rápido para o cliente.",
    benefits: [
      { title: "Preenchimento inteligente", description: "Dados do cliente e do imóvel preenchidos automaticamente." },
      { title: "Cálculo automático de financiamento", description: "Simule entradas, parcelas e taxas em poucos cliques." },
      { title: "Geração rápida", description: "Monte e envie sua proposta com mais agilidade." },
      { title: "Design profissional", description: "Propostas elegantes que transmitem credibilidade e geram mais negociação." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/propostas-2026.png",
  },
  {
    id: "contratos",
    name: "Contratos",
    description: "Documentos em poucos passos",
    icon: ShieldCheck,
    // Front-centre of the ring, on the uniform 45° grid — no manual offset.
    angle: 160,
    priorityMobile: false,
    tagline: "Contratos inteligentes, sem burocracia.",
    longDescription:
      "Importe contratos que você já utiliza, deixe o EME extrair os campos, preencher de forma automática e gerar documentos prontos em poucos cliques.",
    benefits: [
      { title: "Importe seu contrato atual", description: "Envie o PDF ou DOCX que você já utiliza." },
      { title: "Extração automática dos campos", description: "O EME identifica a estrutura e os pontos de preenchimento." },
      { title: "Preenchimento automático", description: "Informe apenas o essencial e complete com dados do cliente e do imóvel." },
      { title: "Análise inteligente", description: "Revise cláusulas, partes e pontos de atenção antes de gerar." },
      { title: "Geração rápida", description: "Revise, finalize e gere o contrato em poucos instantes." },
      { title: "Anexe contratos prontos", description: "Mantenha documentos finalizados organizados no EME." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/contratos-2026.png",
  },
  {
    id: "agenda",
    name: "Compromissos",
    description: "Sua rotina organizada",
    icon: CalendarDays,
    angle: 200,
    priorityMobile: false,
    tagline: "Sua rotina de compromissos, sempre sob controle.",
    longDescription:
      "Organize visitas, reuniões e lembretes em um só lugar. Sincronize tudo e nunca mais perca um horário importante.",
    benefits: [
      { title: "Agendamento rápido de compromissos", description: "Marque visitas e reuniões em poucos toques." },
      { title: "Lembretes automáticos", description: "Você e o cliente nunca esquecem um horário." },
      { title: "Sincronização com seu calendário", description: "Tudo alinhado com a agenda que você já usa." },
      { title: "Acompanhamento claro das atividades", description: "Veja sua semana inteira de uma só vez." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/agenda.png",
  },
  {
    id: "financeiro",
    name: "Financeiro",
    description: "Carteira, recebimentos, despesas e comissões.",
    icon: WalletCards,
    angle: 240,
    priorityMobile: true,
    tagline: "Sua operação financeira, organizada em um só lugar.",
    longDescription:
      "Acompanhe o valor da sua carteira, recebimentos, despesas, comissões, rendimentos de locação e fluxo de caixa operacional — tudo em um só lugar.",
    benefits: [
      { title: "Acompanhe o valor da sua carteira em tempo real", description: "Tenha uma visão atualizada da sua carteira de imóveis." },
      { title: "Controle recebimentos, despesas e comissões", description: "Registre e gerencie entradas, saídas e comissões com praticidade." },
      { title: "Visualize próximos recebimentos e atrasos", description: "Saiba o que está por vir e o que precisa de atenção." },
      { title: "Registre lançamentos operacionais com rapidez", description: "Inclua lançamentos de forma simples e organizada." },
      { title: "Organize locações, contratos e valores mensais", description: "Acompanhe locações ativas e valores de cada contrato." },
      { title: "Tenha mais clareza para decidir e crescer", description: "Com dados completos, suas decisões são mais seguras." },
    ],
    cta: "Financeiro",
    mockup: "/modals/financeiro-approved-reference.png",
  },
]
