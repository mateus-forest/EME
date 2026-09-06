import type { LucideIcon } from "lucide-react"
import { Users, Home, BookOpen, WandSparkles, FileText, Store, WalletCards } from "lucide-react"

export type ModuleView = {
  id: string
  label: string
  description: string
  benefits: string[]
  note: string
  href?: string
  action?: string
}

export type EmeModule = {
  id: string
  name: string
  description: string
  icon: LucideIcon
  /** Six equally spaced positions. 180 degrees is front-center. */
  angle: number
  priorityMobile: boolean
  tagline: string
  longDescription: string
  benefits: (string | { title: string; description: string })[]
  cta: string
  mockup: string
  mockupFit?: "contain" | "cover"
  demoHref?: string
  demoLabel?: string
  note?: string
  views?: ModuleView[]
}

const catalogView: ModuleView = {
  id: "catalogo", label: "Catálogo",
  description: "Apresente sua carteira com sua identidade e compartilhe o link do seu catálogo.",
  benefits: ["Perfil e identidade do corretor", "Imóveis escolhidos para apresentação", "Link próprio para compartilhar"],
  note: "A publicação exige os dados mínimos do imóvel e a validação cadastral do CRECI. Essa consulta não garante a segurança da transação.",
  href: "https://www.meueme.com/catalogo/fabricio-foscarini", action: "Ver catálogo real",
}
const marketplaceView: ModuleView = {
  id: "marketplace", label: "Marketplace",
  description: "Publique no ambiente EME para que as pessoas busquem, comparem imóveis e entrem em contato.",
  benefits: ["Publicação no Marketplace EME", "Busca e comparação de imóveis", "Contato com o corretor responsável"],
  note: "Publicação disponível nos planos Pro e Scale, sujeita à revisão da ficha, às fotos exigidas e à validação cadastral do CRECI. Não há garantia de tráfego ou contatos.",
  href: "/imoveis", action: "Explorar o Marketplace",
}

export const emeModules: EmeModule[] = [
  {
    id: "clientes", name: "Clientes e agenda", description: "Atendimentos e compromissos.", icon: Users,
    angle: 240, priorityMobile: true,
    tagline: "Seu próximo atendimento começa organizado.",
    longDescription: "Organize os dados dos clientes e consulte os compromissos que você registra na agenda.",
    benefits: ["Contatos e etapas do atendimento", "Documentos junto ao cadastro", "Compromissos com data e horário"],
    note: "Você registra e atualiza as informações. Clientes e agenda são áreas distintas da sua operação.",
    cta: "", mockup: "",
  },
  {
    id: "imoveis", name: "Imóveis", description: "Cadastro, carteira e publicação.", icon: Home,
    angle: 180, priorityMobile: true,
    tagline: "Sua carteira, pronta para apresentar.",
    longDescription: "Organize os dados, revise as informações e escolha onde publicar.",
    benefits: ["Cadastro manual ou com apoio de IA", "Fotos e informações organizadas", "Publicação sob seu controle"],
    note: "Você revisa. Você decide. Rascunhos podem ser completados depois; publicar exige os dados e as fotos de cada canal, CRECI validado e plano compatível.",
    cta: "", mockup: "",
  },
  {
    id: "catalogo", name: "Catálogo e marketplace", description: "Sua carteira, mais caminhos.", icon: BookOpen,
    angle: 120, priorityMobile: true,
    tagline: "Sua apresentação. Mais caminhos para encontrar seus imóveis.",
    longDescription: catalogView.description, benefits: catalogView.benefits,
    note: catalogView.note, cta: "", mockup: "", views: [catalogView, marketplaceView],
  },
  {
    id: "studio-ia", name: "Studio IA", description: "Materiais com apoio de IA.", icon: WandSparkles,
    angle: 60, priorityMobile: true,
    tagline: "Prepare materiais para apresentar seus imóveis.",
    longDescription: "Prepare imagens e textos com apoio de IA. Revise o resultado antes de aprová-lo na Biblioteca.",
    benefits: ["Preparação de imagens do imóvel", "Revisão e aprovação do resultado", "Biblioteca de materiais e apoio à escrita"],
    note: "As gerações utilizam Créditos IA. Alterações virtuais não representam o estado real do imóvel. Criar um anúncio não é publicá-lo nem contratar mídia paga.",
    cta: "", mockup: "",
  },
  {
    id: "propostas", name: "Propostas e contratos", description: "Documentos, etapa por etapa.", icon: FileText,
    angle: 0, priorityMobile: true,
    tagline: "Da proposta ao documento, com mais organização.",
    longDescription: "Prepare as informações, revise os campos e organize os documentos da negociação.",
    benefits: [], cta: "", mockup: "",
    views: [
      { id: "propostas", label: "Propostas", description: "Reúna dados do cliente, do imóvel e as condições da proposta antes de gerar o documento.", benefits: ["Dados cadastrados ou preenchimento manual", "Valores e condições para revisão", "Rascunho e geração do documento"], note: "A geração depende do preenchimento e das condições do plano e dos créditos. O envio e a negociação permanecem sob seu controle." },
      { id: "contratos", label: "Contratos", description: "Organize seus modelos, preencha os campos e revise as informações antes de gerar o PDF.", benefits: ["Importação de modelos PDF ou DOCX", "Preenchimento e revisão dos campos", "PDF de rascunho ou final, conforme completude"], note: "O EME não substitui a revisão jurídica. Não há promessa de análise de riscos, aprovação jurídica ou assinatura concluída." },
    ],
  },
  {
    id: "financeiro", name: "Financeiro", description: "Recebimentos, despesas e comissões.", icon: WalletCards,
    angle: 300, priorityMobile: true,
    tagline: "Saiba o que entrou e o que falta receber.",
    longDescription: "Acompanhe recebimentos, despesas, comissões e os pagamentos das locações em uma visão operacional.",
    benefits: ["Recebido, previsto e atrasado", "Despesas e comissões registradas", "Recebimentos das locações e contas opcionais"],
    note: "Valor da carteira não é receita. Contas são controles manuais, sem integração bancária, conciliação automática ou contabilidade.",
    cta: "", mockup: "",
  },
]

/** Compatibility outside the orbit; no separate Marketplace card. */
export const marketplaceModule: EmeModule = {
  ...emeModules[2], id: "marketplace", name: "Marketplace", icon: Store,
  longDescription: marketplaceView.description, benefits: marketplaceView.benefits,
  note: marketplaceView.note, demoHref: marketplaceView.href, demoLabel: marketplaceView.action,
}
