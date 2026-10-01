import { UsersRound, Building2, Search, Store, BookOpen, Sparkles, FileText, CalendarDays, ChartNoAxesCombined, Wallet, Handshake, MessagesSquare } from "lucide-react"

// Same groupings and protected destinations as the current broker sidebar.
export const officeSectors = [
  { id: "carteira", name: "Carteira", intro: "Cada relacionamento e cada imóvel, com contexto.", x: 19, y: 51, items: [
    { name: "Clientes", icon: UsersRound, route: "/corretor/clientes", text: "Organize contatos, informações e observações para retomar cada atendimento com contexto." },
    { name: "Imóveis", icon: Building2, route: "/corretor/imoveis", text: "Reúna os dados e as mídias da sua carteira. Revise informações e acompanhe seus imóveis em um só lugar." },
    { name: "Captação", icon: Search, route: "/corretor/captacao", text: "Busque anúncios, salve oportunidades e prepare sua abordagem. A disponibilidade e a identidade do anunciante precisam ser confirmadas." },
  ] },
  { id: "vender", name: "Vender", intro: "Uma apresentação à altura da sua carteira.", x: 26, y: 32, items: [
    { name: "Marketplace", icon: Store, route: "/corretor/marketplace", text: "Prepare e publique os imóveis elegíveis no Marketplace EME, conforme as condições do seu plano." },
    { name: "Catálogo", icon: BookOpen, route: "/corretor/catalogo", text: "Apresente sua carteira em um catálogo público com sua identidade e um endereço para compartilhar." },
    { name: "Studio IA", icon: Sparkles, route: "/corretor/studio-ia", text: "Prepare imagens e materiais de divulgação com inteligência artificial. Revise as criações antes de usar; gerações estão sujeitas a créditos e disponibilidade." },
  ] },
  { id: "cos", name: "COS", intro: "Contexto para decidir. Apoio para agir.", x: 55, y: 33, items: [
    { name: "COS", icon: MessagesSquare, route: "/corretor", text: "Converse com o assistente, consulte informações da sua operação e acesse as ações disponíveis no EME." },
  ] },
  { id: "documentos", name: "Documentos", intro: "Informações organizadas para o próximo passo.", x: 84, y: 33, items: [
    { name: "Propostas", icon: FileText, route: "/corretor/documentos", text: "Prepare propostas com os dados do imóvel e as condições da negociação. Confira o documento antes de compartilhar." },
    { name: "Contratos", icon: FileText, route: "/corretor/documentos/contratos", text: "Organize contratos e utilize os modelos disponíveis, revisando os dados e as condições de cada negociação." },
  ] },
  { id: "operacao", name: "Operação", intro: "Seu negócio, acompanhado de perto.", x: 82, y: 55, items: [
    { name: "Compromissos", icon: CalendarDays, route: "/corretor/agenda", text: "Organize sua agenda e acompanhe compromissos e próximos passos da sua rotina." },
    { name: "Financeiro", icon: Wallet, route: "/corretor/financeiro", text: "Registre e acompanhe as informações financeiras da sua operação." },
    { name: "Desempenho", icon: ChartNoAxesCombined, route: "/corretor/analytics", text: "Consulte os indicadores disponíveis para acompanhar a atividade registrada no sistema." },
    { name: "Parceiros EME", icon: Handshake, route: "/corretor/parceiros", text: "Organize indicações, acompanhe contatos e simule o potencial da parceria. Simulações não representam comissões já recebidas." },
  ] },
]
