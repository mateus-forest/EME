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
  /** Key benefits, shown as a short checklist. */
  benefits: string[]
  /** Call-to-action label. */
  cta: string
  /** Premium device mockup for the panel's left side. */
  mockup: string
  /** How the mockup fills the panel's left column.
   *  - "contain" (default): centred with padding — for single-device renders.
   *  - "cover": full-bleed edge-to-edge — for full device scenes (e.g. COS). */
  mockupFit?: "contain" | "cover"
}

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
      "Cadastra e edita clientes",
      "Anexa documentos",
      "Cria imóveis e anúncios",
      "Analisa a saúde da operação",
      "Monitora leads e oportunidades",
      "Ensina e orienta no uso do sistema",
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
      "Cadastro completo de clientes",
      "Registro automático de leads do catálogo",
      "Histórico e documentos centralizados",
      "Acompanhamento do funil de atendimento",
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
      "Cadastro inteligente com IA",
      "Cadastro manual tradicional",
      "Importação por XML, URL, anúncio ou imagem",
      "Importação em massa de imóveis",
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
      "Catálogos modernos e responsivos",
      "Link compartilhável com sua marca",
      "Registro automático de leads",
      "Atualizações em tempo real",
      "Mais profissionalismo e credibilidade",
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/catalogo.png",
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
      "Criativos para Instagram automaticamente",
      "Vídeos profissionais dos imóveis",
      "Transformação de obra em imóvel pronto",
      "Campanhas para vender imóveis",
      "Campanhas para captar proprietários",
      "Biblioteca inteligente de conteúdos",
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
      "Preenchimento manual e simples",
      "Proposta pronta em até 5 segundos",
      "Design profissional que transmite credibilidade",
      "Mais agilidade, mais resultados",
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
      "Modelos prontos e personalizáveis",
      "Anexe contratos e documentos",
      "Tudo organizado em um só lugar",
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
      "Agendamento rápido de compromissos",
      "Lembretes automáticos",
      "Sincronização com seu calendário",
      "Acompanhamento claro das atividades",
    ],
    cta: "Conhecer módulo",
    mockup: "/modals/agenda.png",
  },
]
