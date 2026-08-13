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
} from "lucide-react"

export type EmeModule = {
  id: string
  name: string
  description: string
  icon: LucideIcon
  /** Base angle (degrees) on the orbit. 0 = front-center, grows clockwise.
   *  All eight modules are spaced by a uniform 45° step (no manual offsets) so
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
    "Transforma a experiência de busca do seu cliente",
    "Busca e comparação inteligente de imóveis",
    "Aumenta suas oportunidades de conversão",
    "Gera e registra novos leads automaticamente",
    "Dá mais visibilidade aos seus imóveis e ao seu perfil",
    "Amplia sua distribuição com tráfego e campanhas do EME",
  ],
  cta: "Ver exemplo no Marketplace",
  mockup: "/modals/marketplace.png",
  demoHref: "/imoveis",
  demoLabel: "Abrir demonstração",
} satisfies EmeModule

/**
 * The eight modules that orbit the EME logo.
 * `angle` places each card around an elliptical orbit and is the single value
 * that scroll interaction offsets to rotate the whole universe.
 */
export const emeModules: EmeModule[] = [
  {
    id: "cos",
    name: "COS",
    description: "Seu assistente inteligente",
    icon: Sparkles,
    angle: 270,
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
    mockup: "/modals/cos.png",
    mockupFit: "cover",
  },
  {
    id: "clientes",
    name: "Clientes",
    description: "Relacionamentos organizados",
    icon: Users,
    angle: 315,
    priorityMobile: true,
    tagline: "Todo relacionamento, organizado em um só lugar.",
    longDescription:
      "Centralize clientes, documentos, histórico e oportunidades. O EME acompanha cada contato desde o primeiro interesse até o fechamento do negócio.",
    benefits: [
      { title: "Cadastro completo de clientes", description: "Dados, preferências e contatos em um só lugar." },
      { title: "Registro automático de leads do catálogo", description: "Todo interesse do catálogo vira cliente automaticamente." },
      { title: "Histórico e documentos centralizados", description: "Nada se perde entre conversas e etapas." },
      { title: "Acompanhamento do funil de atendimento", description: "Saiba exatamente em que fase está cada negociação." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/clientes.png",
  },
  {
    id: "imoveis",
    name: "Imóveis",
    description: "Sua carteira conectada",
    icon: Home,
    angle: 0,
    priorityMobile: true,
    tagline: "Sua carteira de imóveis, sempre atualizada.",
    longDescription:
      "Cadastre imóveis manualmente, com IA ou importe anúncios em segundos. O EME organiza toda sua carteira automaticamente para você vender mais.",
    benefits: [
      { title: "Cadastro inteligente com IA", description: "Descreva o imóvel e a IA organiza tudo para você." },
      { title: "Cadastro manual tradicional", description: "Total controle campo a campo, quando preferir." },
      { title: "Importação por XML, URL, anúncio ou imagem", description: "Traga imóveis de onde já estiverem publicados." },
      { title: "Importação em massa de imóveis", description: "Suba toda sua carteira de uma só vez." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/imoveis.png",
  },
  {
    id: "catalogo",
    name: "Catálogo",
    description: "Apresente e compartilhe",
    icon: BookOpen,
    angle: 45,
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
    mockup: "/modals/catalogo.png",
    demoLabel: "Ver um exemplo de catálogo",
    demoHref: "/catalogo/mateusforest",
  },
  {
    id: "studio-ia",
    name: "Studio IA",
    description: "Crie campanhas com IA",
    icon: WandSparkles,
    angle: 90,
    priorityMobile: false,
    tagline: "Sua central de criação com Inteligência Artificial.",
    longDescription:
      "Crie campanhas, vídeos e conteúdos profissionais em minutos. O Studio IA reúne todas as ferramentas para divulgar imóveis, captar proprietários e acelerar suas vendas.",
    benefits: [
      { title: "Criativos para Instagram automaticamente", description: "Posts e stories prontos em minutos." },
      { title: "Vídeos profissionais dos imóveis", description: "Edição automática com trilha e narração." },
      { title: "Transformação de obra em imóvel pronto", description: "Visualize o resultado antes da entrega." },
      { title: "Campanhas para vender imóveis", description: "Peças completas para acelerar cada venda." },
      { title: "Campanhas para captar proprietários", description: "Atraia quem quer anunciar com você." },
      { title: "Biblioteca inteligente de conteúdos", description: "Tudo o que você já criou, sempre à mão." },
    ],
    cta: "Explorar módulo",
    mockup: "/modals/studio-ia.png",
  },
  {
    id: "propostas",
    name: "Propostas",
    description: "Negociações mais simples",
    icon: FileText,
    angle: 135,
    priorityMobile: false,
    tagline: "Propostas profissionais, prontas para impressionar.",
    longDescription:
      "Insira as informações manualmente e gere uma proposta profissional em até 5 segundos. Mais agilidade para enviar ao cliente e se destacar no mercado.",
    benefits: [
      { title: "Preenchimento manual e simples", description: "Só as informações essenciais, sem burocracia." },
      { title: "Proposta pronta em até 5 segundos", description: "Gere e envie antes que o cliente esfrie." },
      { title: "Design profissional que transmite credibilidade", description: "A primeira impressão que fecha negócio." },
      { title: "Mais agilidade, mais resultados", description: "Menos tempo formatando, mais tempo vendendo." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/propostas.png",
  },
  {
    id: "contratos",
    name: "Contratos",
    description: "Documentos em poucos passos",
    icon: ShieldCheck,
    // Front-centre of the ring, on the uniform 45° grid — no manual offset.
    angle: 180,
    priorityMobile: false,
    tagline: "Contratos organizados, sem burocracia.",
    longDescription:
      "Crie ou anexe contratos e documentos com total segurança. Tudo organizado para você focar no que importa: seus negócios.",
    benefits: [
      { title: "Modelos prontos e personalizáveis", description: "Adapte para cada tipo de negociação." },
      { title: "Anexe contratos e documentos", description: "Guarde tudo junto ao imóvel ou cliente certo." },
      { title: "Tudo organizado em um só lugar", description: "Encontre qualquer documento em segundos." },
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/contratos.png",
  },
  {
    id: "agenda",
    name: "Compromissos",
    description: "Sua rotina organizada",
    icon: CalendarDays,
    angle: 225,
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
]
