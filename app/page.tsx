import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BriefcaseBusiness,
  Camera,
  ChartNoAxesCombined,
  Check,
  CirclePlay,
  ClipboardList,
  FolderOpen,
  Grid2x2,
  House,
  ImageIcon,
  Megaphone,
  MessageCircleMore,
  NotebookTabs,
  Search,
  Send,
  Sparkles,
  TimerReset,
  Video,
} from "lucide-react"

type NavLink = {
  label: string
  href: string
  highlight?: boolean
}

type PromptAction = {
  icon: typeof ImageIcon
  label: string
  active?: boolean
}

const navLinks: NavLink[] = [
  { label: "Recursos", href: "#recursos" },
  { label: "Studio IA", href: "#studio-ia", highlight: true },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Para corretores", href: "#para-corretores" },
  { label: "Preços", href: "#precos" },
]

const heroFeatures = [
  {
    icon: Grid2x2,
    title: "Distribua mais",
    description: "Anúncios prontos para portais, redes sociais e WhatsApp.",
  },
  {
    icon: MessageCircleMore,
    title: "Atenda melhor",
    description: "Respostas inteligentes que encantam e convertem.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Venda mais",
    description: "Propostas e negociações mais rápidas e profissionais.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Tenha controle",
    description: "Acompanhe clientes, visitas e resultados em um só lugar.",
  },
  {
    icon: TimerReset,
    title: "Ganhe tempo",
    description: "Automatize tarefas chatas e foque no que realmente importa.",
  },
] as const

const studioResources = [
  {
    icon: ImageIcon,
    title: "Gerar imagem",
    description: "Fotos realistas de ambientes e fachadas em segundos.",
  },
  {
    icon: Video,
    title: "Gerar vídeo",
    description: "Vídeos verticais prontos para Instagram, Reels e TikTok.",
  },
  {
    icon: NotebookTabs,
    title: "Textos prontos",
    description: "Anúncios, descrições e legendas que vendem.",
  },
  {
    icon: Grid2x2,
    title: "Templates",
    description: "Modelos prontos para cada ocasião e objetivo.",
  },
  {
    icon: FolderOpen,
    title: "Meus arquivos",
    description: "Tudo organizado para você usar quando quiser.",
  },
] as const

const promptActions: PromptAction[] = [
  { icon: ImageIcon, label: "Criar anúncio", active: true },
  { icon: Video, label: "Gerar vídeo" },
  { icon: ClipboardList, label: "Criar catálogo" },
  { icon: Search, label: "Procurar imóvel" },
  { icon: Bot, label: "Conversar com o COS" },
]

const checklist = ["7 dias grátis", "Acesso completo", "Sem cartão de crédito", "Cancelamento fácil"] as const

const studioLandingActions = [
  {
    title: "Vender este imóvel",
    description: "Organize uma ação focada em conversão para apresentar o imóvel certo no momento certo.",
    icon: House,
  },
  {
    title: "Criar campanha para Instagram",
    description: "Monte uma campanha visual para publicar o imóvel com narrativa pronta para redes sociais.",
    icon: Megaphone,
  },
  {
    title: "Criar vídeo do imóvel",
    description: "Estruture a produção de um vídeo comercial com foco em captação de atenção e visitas.",
    icon: Video,
  },
  {
    title: "Transformar obra em imóvel pronto",
    description: "Use uma imagem real da obra e gere uma versão pronta para venda com aprovação e novas versões.",
    icon: Sparkles,
  },
  {
    title: "Atrair compradores",
    description: "Planeje a mensagem e os ganchos comerciais para aumentar interesse qualificado no imóvel.",
    icon: MessageCircleMore,
  },
  {
    title: "Captar proprietários",
    description: "Estruture abordagens de captação para ampliar a carteira com foco no perfil certo.",
    icon: Camera,
  },
] as const

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fcfcf8] text-[#111111]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] bg-[radial-gradient(circle_at_top_left,rgba(22,163,74,0.10),transparent_42%),radial-gradient(circle_at_top_right,rgba(22,163,74,0.06),transparent_36%),linear-gradient(180deg,#ffffff_0%,#fcfcf8_76%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[40rem] h-[76rem] bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.06),transparent_30%),radial-gradient(circle_at_bottom,rgba(15,23,42,0.025),transparent_40%)]" />

      <div className="relative mx-auto max-w-[1320px] px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-6 rounded-[26px] border border-black/[0.045] bg-white/92 px-5 py-3.5 shadow-[0_12px_40px_rgba(15,23,42,0.045)] backdrop-blur-xl sm:px-7">
          <Link href="/" className="flex items-center gap-3" aria-label="EME">
            <div className="flex size-10 items-center justify-center rounded-[16px] bg-[#16a34a] shadow-[0_10px_22px_rgba(22,163,74,0.18)]">
              <Image
                src="/images/eme-logo-official.png"
                alt="EME"
                width={52}
                height={52}
                className="h-8 w-8 object-contain brightness-0 invert"
                priority
              />
            </div>
            <span className="text-[1.95rem] font-bold tracking-[-0.045em] text-[#16a34a]">EME</span>
          </Link>

          <nav className="hidden items-center gap-9 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-[14px] font-medium transition-colors ${
                  link.highlight ? "text-[#16a34a]" : "text-[#161616] hover:text-[#16a34a]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-[18px] px-4 text-sm font-medium text-[#151515] transition-colors hover:text-[#16a34a] sm:px-5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-[#16a34a] px-5 text-sm font-medium text-white shadow-[0_14px_30px_rgba(22,163,74,0.2)] transition-all hover:bg-[#14803d] sm:px-6"
            >
              Testar gratuitamente
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        <section
          id="como-funciona"
          className="grid items-center gap-14 px-2 pb-28 pt-16 lg:grid-cols-[minmax(0,0.88fr)_minmax(620px,1.12fr)] lg:px-4 lg:pt-20"
        >
          <div className="max-w-[570px] pl-1 lg:pl-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e3f2e7] bg-white/90 px-3 py-2 text-sm font-medium text-[#66716c] shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#edf8f0] px-2 py-0.5 text-[#16a34a]">
                <BadgeCheck className="size-3.5" />
                IA
              </span>
              O primeiro colega de trabalho inteligente do corretor
            </div>

            <h1 className="mt-10 max-w-[12ch] text-[3.15rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[#121212] sm:text-[4.5rem]">
              O corretor que <span className="text-[#16a34a]">vende mais</span>, utiliza EME.
            </h1>

            <p className="mt-9 max-w-[34rem] text-[1.17rem] leading-[2.15rem] text-[#5f6b73]">
              O EME entende, executa e entrega tudo que você precisa para{" "}
              <span className="font-medium text-[#16a34a]">vender mais, distribuir mais</span> e{" "}
              <span className="font-medium text-[#16a34a]">atender melhor</span>. Em segundos.
            </p>

            <div className="mt-11 flex flex-col gap-3.5 sm:flex-row">
              <Link
                href="/cadastro/corretor"
                className="inline-flex h-[58px] items-center justify-center gap-2 rounded-[20px] bg-[#16a34a] px-8 text-[15px] font-medium text-white shadow-[0_16px_34px_rgba(22,163,74,0.2)] transition-all hover:bg-[#14803d]"
              >
                Testar gratuitamente
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#studio-ia"
                className="inline-flex h-[58px] items-center justify-center gap-3 rounded-[20px] border border-black/[0.07] bg-white px-8 text-[15px] font-medium text-[#171717] shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors hover:bg-[#fafcf9]"
              >
                Ver o Studio IA
                <CirclePlay className="size-4" />
              </a>
            </div>

            <div className="mt-11 flex flex-wrap gap-x-9 gap-y-3 text-sm font-medium text-[#5f6973]">
              <TrustItem label="7 dias grátis" />
              <TrustItem label="Sem cartão de crédito" />
              <TrustItem label="Acesso completo" />
            </div>
          </div>

          <HeroConversationMock />
        </section>

        <section
          id="para-corretores"
          className="grid gap-12 border-t border-black/[0.04] px-2 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:px-4"
        >
          {heroFeatures.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </section>

        <section
          id="studio-ia"
          className="grid items-center gap-14 px-2 pb-14 pt-20 lg:grid-cols-[minmax(320px,0.4fr)_minmax(0,0.6fr)] lg:px-4"
        >
          <div className="max-w-[360px]">
            <p className="text-sm font-medium text-[#16a34a]">Studio IA</p>
            <h2 className="mt-5 text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.055em] text-[#111111] sm:text-[3.55rem]">
              Crie, edite e publique. <span className="text-[#16a34a]">Tudo em um só lugar.</span>
            </h2>
            <p className="mt-7 text-[1.08rem] leading-8 text-[#5f6973]">
              Imagens, vídeos, textos e muito mais. O Studio IA do EME transforma ideias em resultados de verdade.
            </p>
            <a
              href="#recursos"
              className="mt-10 inline-flex h-[58px] items-center justify-center gap-3 rounded-[20px] border border-black/[0.07] bg-white px-7 text-[15px] font-medium text-[#171717] shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors hover:bg-[#fafcf9]"
            >
              Ver todos os recursos do Studio IA
              <ArrowRight className="size-4" />
            </a>
          </div>

          <StudioPreviewMock />
        </section>

        <section
          id="recursos"
          className="grid gap-12 border-b border-black/[0.04] px-2 pb-20 pt-8 sm:grid-cols-2 lg:grid-cols-5 lg:px-4"
        >
          {studioResources.map((resource) => (
            <FeatureCard key={resource.title} {...resource} iconBox />
          ))}
        </section>

        <section className="px-2 py-20 lg:px-4">
          <div className="mx-auto max-w-[980px] text-center">
            <h2 className="text-[2.55rem] font-semibold tracking-[-0.055em] text-[#111111] sm:text-[3.45rem]">
              Experimente o <span className="text-[#16a34a]">EME agora</span>
            </h2>
            <p className="mt-4 text-[1.05rem] text-[#68737d]">Faça uma solicitação e veja o EME trabalhando para você.</p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {promptActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                      action.active
                        ? "border-[#dceddf] bg-[#eef8f1] text-[#157945]"
                        : "border-transparent bg-transparent text-[#39424a] hover:bg-white"
                    }`}
                  >
                    <Icon className="size-4" />
                    {action.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-9 rounded-[28px] border border-black/[0.055] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-[72px] flex-1 items-center rounded-[22px] border border-black/[0.055] bg-[#fdfdfb] px-6 text-left text-lg text-[#8b949c]">
                  Descreva o imóvel para criar um anúncio incrível...
                </div>
                <Link
                  href="/cadastro/corretor"
                  className="inline-flex h-[72px] items-center justify-center gap-3 rounded-[22px] bg-[#16a34a] px-8 text-base font-medium text-white shadow-[0_16px_32px_rgba(22,163,74,0.2)] transition-all hover:bg-[#14803d]"
                >
                  Gerar com IA
                  <Sparkles className="size-4" />
                </Link>
              </div>
            </div>

            <p className="mt-4 text-left text-[15px] text-[#6f7982] sm:text-center">
              Exemplo: Apartamento 2 quartos, suíte, sacada gourmet, 1 vaga, condomínio com piscina em{" "}
              <span className="font-medium text-[#16a34a]">Canoas.</span>
            </p>
          </div>
        </section>

        <section
          id="precos"
          className="grid items-center gap-10 rounded-[30px] border border-black/[0.045] bg-white/92 px-6 py-10 shadow-[0_16px_48px_rgba(15,23,42,0.05)] backdrop-blur xl:grid-cols-[220px_minmax(0,1fr)_340px_220px]"
        >
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {["/placeholder-user.jpg", "/placeholder-user.jpg", "/placeholder-user.jpg"].map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="overflow-hidden rounded-full border-2 border-white shadow-[0_10px_20px_rgba(15,23,42,0.06)]"
                >
                  <Image src={src} alt="" width={52} height={52} className="size-12 object-cover" />
                </div>
              ))}
            </div>
            <p className="max-w-[10rem] text-sm leading-6 text-[#5f6973]">
              <span className="font-semibold text-[#111111]">+2.500 corretores</span> já estão vendendo mais com o EME
            </p>
          </div>

          <div>
            <h3 className="max-w-[14ch] text-[2.45rem] font-semibold leading-[1.06] tracking-[-0.055em] text-[#111111]">
              Pronto para desbloquear seu novo <span className="text-[#16a34a]">superpoder?</span>
            </h3>
            <p className="mt-4 max-w-[28rem] text-lg leading-8 text-[#5f6973]">
              Teste gratuitamente por 7 dias e descubra como o EME pode transformar sua rotina e seus resultados.
            </p>
          </div>

          <div className="grid gap-4">
            {checklist.map((item) => (
              <div key={item} className="flex items-center gap-3 text-[15px] text-[#39424a]">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#ecf8f0] text-[#16a34a]">
                  <Check className="size-4" />
                </span>
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/cadastro/corretor"
            className="inline-flex h-[56px] items-center justify-center gap-2 rounded-[20px] bg-[#16a34a] px-7 text-base font-medium text-white shadow-[0_16px_32px_rgba(22,163,74,0.2)] transition-all hover:bg-[#14803d]"
          >
            Testar gratuitamente
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </div>
    </main>
  )
}

function HeroConversationMock() {
  return (
    <div className="relative mx-auto w-full max-w-[820px] lg:-mr-3">
      <div className="absolute inset-0 -z-10 rounded-[44px] bg-[radial-gradient(circle_at_top,rgba(22,163,74,0.12),transparent_36%)] blur-3xl" />
      <div className="overflow-hidden rounded-[32px] border border-black/[0.055] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.065)]">
        <div className="grid min-h-[650px] grid-cols-[66px_minmax(0,1fr)] sm:grid-cols-[88px_minmax(0,1fr)]">
          <div className="border-r border-black/[0.045] bg-[linear-gradient(180deg,#ffffff_0%,#fcfdfb_100%)] px-3 py-6">
            <div className="grid justify-center gap-4.5">
              <SidebarPill active icon={House} />
              <SidebarPill icon={Grid2x2} />
              <SidebarPill icon={ClipboardList} />
              <SidebarPill icon={TimerReset} />
              <SidebarPill icon={MessageCircleMore} />
              <SidebarPill icon={FolderOpen} />
              <SidebarPill icon={NotebookTabs} />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-black/[0.045] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <button className="text-[#16a34a]">
                  <ArrowRight className="size-4 rotate-180" />
                </button>
                <Image src="/placeholder-user.jpg" alt="COS" width={38} height={38} className="size-9 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-medium text-[#121212]">COS</p>
                  <p className="text-xs text-[#7f8a93]">Online</p>
                </div>
              </div>
              <div className="text-[#98a1a9]">•••</div>
            </div>

            <div className="flex-1 space-y-6 bg-[linear-gradient(180deg,#ffffff_0%,#fdfefd_100%)] px-6 py-7 sm:px-8">
              <ChatBubble align="right" dark>
                Crie um anúncio para esse apartamento de 2 quartos, suíte e sacada gourmet.
              </ChatBubble>

              <div className="space-y-3">
                <SystemLine text="Aqui está o anúncio:" />
                <div className="max-w-[402px] rounded-[22px] border border-black/[0.055] bg-white p-3 shadow-[0_10px_20px_rgba(15,23,42,0.035)]">
                  <div className="flex items-center gap-3">
                    <Image src="/placeholder.jpg" alt="Apartamento" width={84} height={84} className="h-[84px] w-[94px] rounded-[18px] object-cover" />
                    <div>
                      <p className="font-medium text-[#161616]">Apartamento à venda</p>
                      <p className="mt-1 text-sm leading-6 text-[#6f7982]">2 quartos, suíte e sacada gourmet</p>
                      <p className="mt-1 text-sm leading-6 text-[#6f7982]">R$ 560.000,00 · Centro, Canoas/RS</p>
                    </div>
                  </div>
                </div>
              </div>

              <ChatBubble align="right" dark>
                Agora gere um vídeo para o Instagram.
              </ChatBubble>

              <div className="space-y-3">
                <SystemLine text="Vídeo criado com sucesso!" />
                <div className="relative max-w-[440px] overflow-hidden rounded-[24px] border border-black/[0.055] bg-[#e8ece8]">
                  <Image src="/placeholder.jpg" alt="Vídeo do imóvel" width={640} height={336} className="h-44 w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.62))] px-4 py-3 text-xs text-white">
                    <span>0:45</span>
                    <CirclePlay className="size-5 fill-white/90 text-white" />
                    <span>0:45</span>
                  </div>
                </div>
              </div>

              <ChatBubble align="right" dark>
                Agende uma visita para sábado às 10h.
              </ChatBubble>

              <SystemLine text="Visita agendada com sucesso!" />
            </div>

            <div className="border-t border-black/[0.045] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3 rounded-[20px] border border-black/[0.065] bg-white px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                <input
                  aria-label="Fale com o COS"
                  placeholder="Fale com o COS..."
                  className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#97a1aa]"
                />
                <button className="inline-flex size-9 items-center justify-center rounded-full border border-black/[0.06] text-[#8f99a1]">
                  <Sparkles className="size-4" />
                </button>
                <button className="inline-flex size-10 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-[0_12px_24px_rgba(22,163,74,0.18)]">
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudioPreviewMock() {
  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 rounded-[44px] bg-[radial-gradient(circle_at_top_left,rgba(22,163,74,0.11),transparent_36%)] blur-3xl" />
      <div className="overflow-hidden rounded-[30px] border border-black/[0.055] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.065)]">
        <div className="bg-[linear-gradient(180deg,#fbfcfa_0%,#f7faf8_100%)] p-5 sm:p-7">
          <div className="rounded-[28px] border border-black/[0.05] bg-white px-6 py-6 shadow-[0_18px_44px_rgba(15,23,42,0.045)] sm:px-7">
            <div className="rounded-[22px] border border-black/[0.05] bg-[#fcfcfb] px-6 py-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Bot className="size-3.5" />
                Studio IA
              </div>
              <h3 className="mt-5 text-[2rem] font-semibold tracking-[-0.04em] text-[#050505]">Ações orientadas a resultado</h3>
              <p className="mt-3 max-w-[52rem] text-[15px] leading-7 text-[#667085]">
                Escolha o objetivo comercial e siga para o fluxo certo. O Studio IA concentra as próximas automações do Portal do Corretor sem alterar sua operação atual.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {studioLandingActions.map((action) => {
                const Icon = action.icon

                return (
                  <div key={action.title} className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
                        <Icon className="size-5" />
                      </div>
                      <span className="rounded-full bg-[#eef9f1] px-2.5 py-1 text-[11px] font-medium text-[#009b3a]">
                        Disponível
                      </span>
                    </div>
                    <p className="mt-5 text-[1.05rem] font-semibold text-[#050505]">{action.title}</p>
                    <p className="mt-4 text-[13px] leading-6 text-[#667085]">{action.description}</p>
                    <div className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] bg-[#0b9f3d] px-4 text-sm font-semibold text-white shadow-[0_14px_26px_rgba(11,159,61,0.18)]">
                      Abrir fluxo
                      <ArrowRight className="size-4" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  iconBox = false,
}: {
  icon: typeof Grid2x2
  title: string
  description: string
  iconBox?: boolean
}) {
  return (
    <div className="max-w-[220px]">
      <div
        className={`mb-5 inline-flex items-center justify-center rounded-2xl ${
          iconBox ? "size-12 bg-[#eef8f1] text-[#16a34a]" : "text-[#16a34a]"
        }`}
      >
        <Icon className="size-5" />
      </div>
      <h3 className="text-[1.24rem] font-semibold tracking-[-0.03em] text-[#141414]">{title}</h3>
      <p className="mt-3 text-[15px] leading-7 text-[#5f6973]">{description}</p>
    </div>
  )
}

function TrustItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex size-5 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[#111111]">
        <Check className="size-3" />
      </span>
      {label}
    </div>
  )
}

function SidebarPill({ icon: Icon, active = false }: { icon: typeof House; active?: boolean }) {
  return (
    <div
      className={`inline-flex size-11 items-center justify-center rounded-2xl border ${
        active
          ? "border-[#dbeee1] bg-[#eef8f1] text-[#16a34a] shadow-[0_10px_20px_rgba(22,163,74,0.08)]"
          : "border-transparent bg-white text-[#7c8690]"
      }`}
    >
      <Icon className="size-5" />
    </div>
  )
}

function ChatBubble({
  align,
  children,
  dark = false,
}: {
  align: "left" | "right"
  children: React.ReactNode
  dark?: boolean
}) {
  return (
    <div className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[332px] rounded-[18px] px-4 py-3 text-sm leading-6 shadow-[0_8px_18px_rgba(15,23,42,0.06)] ${
          dark ? "bg-[#101010] text-white" : "bg-white text-[#111111]"
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function SystemLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#6b7680]">
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#ecf8f0] text-[#16a34a]">
        <Bot className="size-3.5" />
      </span>
      {text}
    </div>
  )
}
