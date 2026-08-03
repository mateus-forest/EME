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
    tagline: "Seu assistente inteligente, sempre ao seu lado.",
    longDescription:
      "O COS entende sua rotina de corretor e antecipa o proximo passo. Ele organiza informacoes, responde duvidas e cuida das tarefas repetitivas para voce focar no que importa: vender.",
    benefits: [
      "Respostas instantaneas sobre clientes e imoveis",
      "Sugestoes automaticas de proximos passos",
      "Automacao das tarefas repetitivas do dia",
    ],
    cta: "Conhecer modulo",
    mockup: "/mockups/cos.png",
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
    tagline: "Propostas profissionais em poucos cliques.",
    longDescription:
      "Monte propostas claras e elegantes que transmitem confianca. Ajuste valores, condicoes e envie para o cliente sem sair da plataforma.",
    benefits: [
      "Modelos profissionais prontos",
      "Calculo automatico de valores e condicoes",
      "Envio e acompanhamento integrados",
    ],
    cta: "Conhecer modulo",
    mockup: "/mockups/propostas.png",
  },
  {
    id: "contratos",
    name: "Contratos",
    description: "Documentos em poucos passos",
    icon: ShieldCheck,
    angle: 180,
    priorityMobile: false,
    tagline: "Contratos digitais, seguros e sem burocracia.",
    longDescription:
      "Gere e assine contratos digitalmente com total seguranca juridica. Todo o processo acontece em poucos passos, com validade legal garantida.",
    benefits: [
      "Assinatura digital com validade legal",
      "Modelos revisados e seguros",
      "Armazenamento organizado e protegido",
    ],
    cta: "Conhecer modulo",
    mockup: "/mockups/contratos.png",
  },
  {
    id: "agenda",
    name: "Agenda",
    description: "Sua rotina organizada",
    icon: CalendarDays,
    angle: 225,
    priorityMobile: false,
    tagline: "Sua rotina de visitas, sempre sob controle.",
    longDescription:
      "Organize visitas, compromissos e lembretes em uma agenda pensada para o corretor. Sincronize tudo e nunca mais perca um horario.",
    benefits: [
      "Agendamento rapido de visitas",
      "Lembretes automaticos para voce e o cliente",
      "Sincronizacao com seu calendario",
    ],
    cta: "Conhecer modulo",
    mockup: "/mockups/agenda.png",
  },
]
