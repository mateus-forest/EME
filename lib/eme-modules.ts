import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  CalendarDays,
  FileText,
  Home,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react"

export type EmeModule = {
  id: string
  name: string
  description: string
  icon: LucideIcon
  angle: number
  priorityMobile: boolean
  tagline: string
  longDescription: string
  benefits: Array<
    | string
    | {
        title: string
        description?: string
      }
  >
  cta: string
  mockup: string
  demoLink?: string
  demoLabel?: string
  demoBadge?: string
  demoHint?: string
}

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
    mockup: "/mockups/cos-premium.png",
  },
  {
    id: "clientes",
    name: "Clientes",
    description: "Relacionamentos organizados",
    icon: Users,
    angle: 315,
    priorityMobile: true,
    tagline: "Todo relacionamento, organizado em um so lugar.",
    longDescription:
      "Centralize contatos, historico e preferencias de cada cliente. Acompanhe cada negociacao e nunca mais perca uma oportunidade por falta de follow-up.",
    benefits: [
      "Historico completo de cada contato",
      "Lembretes de follow-up automaticos",
      "Segmentacao por interesse e estagio",
    ],
    cta: "Conhecer modulo",
    mockup: "/mockups/clientes.png",
  },
  {
    id: "imoveis",
    name: "Imoveis",
    description: "Sua carteira conectada",
    icon: Home,
    angle: 0,
    priorityMobile: true,
    tagline: "Sua carteira de imoveis, sempre conectada.",
    longDescription:
      "Gerencie toda a sua carteira com fotos, detalhes e disponibilidade em tempo real. Encontre o imovel certo para cada cliente em segundos.",
    benefits: [
      "Cadastro rico com fotos e detalhes",
      "Busca inteligente por perfil de cliente",
      "Disponibilidade atualizada em tempo real",
    ],
    cta: "Conhecer modulo",
    mockup: "/mockups/imoveis.png",
  },
  {
    id: "catalogo",
    name: "Catalogo",
    description: "Apresente e compartilhe",
    icon: BookOpen,
    angle: 45,
    priorityMobile: true,
    tagline: "Catálogo de imóveis que impressiona e converte.",
    longDescription:
      "Apresente seus imóveis com design profissional, informações completas e uma experiência impecável. Compartilhe facilmente com seus clientes por qualquer canal e acompanhe o interesse em cada imóvel.",
    benefits: [
      {
        title: "Catálogos modernos e responsivos",
        description: "Experiência perfeita no computador ou celular.",
      },
      {
        title: "Link compartilhável com sua marca",
        description: "Personalize e compartilhe por qualquer canal.",
      },
      {
        title: "Registro e catálogo de leads automático",
        description: "Cada visita e interesse é registrado automaticamente.",
      },
      {
        title: "Atualizações em tempo real",
        description: "Imóveis sempre atualizados sem retrabalho.",
      },
      {
        title: "Mais profissionalismo e credibilidade",
        description: "Sua marca apresentada com o padrão que você merece.",
      },
    ],
    cta: "Explorar catálogo",
    mockup: "/mockups/catalogo-premium.png",
    demoLabel: "Ver exemplo de catálogo online",
    demoLink: "https://www.meueme.com/catalogo/mateus-forest",
    demoBadge: "PERSONALIZÁVEL",
    demoHint: "Seu link pode ser personalizado com sua marca.",
  },
  {
    id: "studio-ia",
    name: "Studio IA",
    description: "Crie campanhas com IA",
    icon: WandSparkles,
    angle: 90,
    priorityMobile: false,
    tagline: "Campanhas profissionais, criadas com IA.",
    longDescription:
      "Gere artes, textos e campanhas de marketing para seus imoveis em minutos. O Studio IA cuida da criacao para voce cuidar das vendas.",
    benefits: [
      "Artes e posts gerados automaticamente",
      "Textos persuasivos para cada imovel",
      "Campanhas prontas para redes sociais",
    ],
    cta: "Explorar modulo",
    mockup: "/mockups/studio-ia.png",
  },
  {
    id: "propostas",
    name: "Propostas",
    description: "Negociacoes mais simples",
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
    mockup: "/mockups/propostas-premium.png",
  },
  {
    id: "contratos",
    name: "Contratos",
    description: "Documentos em poucos passos",
    icon: ShieldCheck,
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
    mockup: "/mockups/contratos-premium.png",
  },
  {
    id: "agenda",
    name: "Compromissos",
    description: "Sua rotina sob controle",
    icon: CalendarDays,
    angle: 225,
    priorityMobile: false,
    tagline: "Sua rotina de compromissos, sempre sob controle.",
    longDescription:
      "Organize visitas, reuniões e lembretes em um só lugar. Sincronize tudo e nunca mais perca um horário importante.",
    benefits: [
      "Agendamento rápido de compromissos",
      "Lembretes automáticos para você e o cliente",
      "Sincronização com seu calendário",
      "Acompanhamento claro do que precisa ser feito",
    ],
    cta: "Conhecer módulo",
    mockup: "/mockups/compromissos-premium.png",
  },
]
