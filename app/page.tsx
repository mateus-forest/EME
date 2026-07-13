import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  CirclePlay,
  ClipboardList,
  FolderOpen,
  Grid2x2,
  House,
  ImageIcon,
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

type StudioMenuItem = {
  label: string
  icon: typeof Grid2x2
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

const studioMenuItems: StudioMenuItem[] = [
  { label: "Catálogo", icon: Grid2x2 },
  { label: "Gerar imagem", icon: ImageIcon },
  { label: "Gerar vídeo", icon: Video },
  { label: "Textos prontos", icon: NotebookTabs },
  { label: "Templates", icon: ClipboardList },
  { label: "Meus arquivos", icon: FolderOpen },
]

const checklist = ["7 dias grátis", "Acesso completo", "Sem cartão de crédito", "Cancelamento fácil"] as const

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbfcf8] text-[#111111]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(26,183,88,0.14),transparent_38%),radial-gradient(circle_at_top_right,rgba(26,183,88,0.08),transparent_32%),linear-gradient(180deg,#ffffff_0%,#fbfcf8_74%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[38rem] h-[70rem] bg-[radial-gradient(circle_at_center,rgba(32,181,97,0.10),transparent_28%),radial-gradient(circle_at_bottom,rgba(17,24,39,0.03),transparent_38%)]" />

      <div className="relative mx-auto max-w-[1280px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-6 rounded-[28px] border border-black/[0.05] bg-white/88 px-5 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-7">
          <Link href="/" className="flex items-center gap-3" aria-label="EME">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#18b75c] shadow-[0_10px_24px_rgba(24,183,92,0.22)]">
              <Image
                src="/images/eme-logo-official.png"
                alt="EME"
                width={52}
                height={52}
                className="h-8 w-8 object-contain brightness-0 invert"
                priority
              />
            </div>
            <span className="text-[2rem] font-extrabold tracking-[-0.04em] text-[#18b75c]">EME</span>
          </Link>

          <nav className="hidden items-center gap-10 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-[15px] font-semibold transition-colors ${
                  link.highlight ? "text-[#18b75c]" : "text-[#161616] hover:text-[#18b75c]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-[#151515] transition-colors hover:text-[#18b75c] sm:px-5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#18b75c] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(24,183,92,0.24)] transition-all hover:bg-[#11994a] sm:px-5"
            >
              Testar gratuitamente
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        <section
          id="como-funciona"
          className="grid items-center gap-12 px-2 pb-20 pt-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(540px,1.08fr)] lg:px-4"
        >
          <div className="max-w-[560px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8f1df] bg-white/80 px-3 py-2 text-sm font-medium text-[#5d6a61] shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[#18b75c]">
                <BadgeCheck className="size-3.5" />
                IA
              </span>
              O primeiro colega de trabalho inteligente do corretor
            </div>

            <h1 className="mt-9 max-w-[11ch] text-[3.1rem] font-extrabold leading-[0.98] tracking-[-0.07em] text-[#121212] sm:text-[4.35rem]">
              O seu novo superpoder para <span className="text-[#18b75c]">vender</span> imóveis.
            </h1>

            <p className="mt-8 max-w-[33rem] text-[1.2rem] leading-9 text-[#53606b]">
              O EME entende, executa e entrega tudo que você precisa para{" "}
              <span className="font-semibold text-[#18b75c]">vender mais, distribuir mais</span> e{" "}
              <span className="font-semibold text-[#18b75c]">atender melhor</span>. Em segundos.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cadastro/corretor"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-[20px] bg-[#18b75c] px-7 text-base font-semibold text-white shadow-[0_18px_36px_rgba(24,183,92,0.24)] transition-all hover:bg-[#11994a]"
              >
                Testar gratuitamente
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#studio-ia"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-[20px] border border-black/[0.08] bg-white px-7 text-base font-semibold text-[#171717] shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#f8faf8]"
              >
                Ver o Studio IA
                <CirclePlay className="size-4" />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-[#5f6973]">
              <TrustItem label="7 dias grátis" />
              <TrustItem label="Sem cartão de crédito" />
              <TrustItem label="Acesso completo" />
            </div>
          </div>

          <HeroConversationMock />
        </section>

        <section
          id="para-corretores"
          className="grid gap-10 border-t border-black/[0.04] px-2 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:px-4"
        >
          {heroFeatures.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </section>

        <section
          id="studio-ia"
          className="grid items-center gap-12 px-2 pb-10 pt-12 lg:grid-cols-[minmax(290px,0.42fr)_minmax(0,0.58fr)] lg:px-4"
        >
          <div className="max-w-[360px]">
            <p className="text-sm font-semibold text-[#18b75c]">Studio IA</p>
            <h2 className="mt-4 text-[2.35rem] font-extrabold leading-[1.02] tracking-[-0.06em] text-[#111111] sm:text-[3.25rem]">
              Crie, edite e publique. <span className="text-[#18b75c]">Tudo em um só lugar.</span>
            </h2>
            <p className="mt-6 text-lg leading-8 text-[#5f6973]">
              Imagens, vídeos, textos e muito mais. O Studio IA do EME transforma ideias em resultados de verdade.
            </p>
            <a
              href="#recursos"
              className="mt-9 inline-flex h-14 items-center justify-center gap-3 rounded-[20px] border border-black/[0.08] bg-white px-6 text-base font-semibold text-[#171717] shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-colors hover:bg-[#f8faf8]"
            >
              Ver todos os recursos do Studio IA
              <ArrowRight className="size-4" />
            </a>
          </div>

          <StudioPreviewMock />
        </section>

        <section
          id="recursos"
          className="grid gap-10 border-b border-black/[0.04] px-2 pb-16 pt-6 sm:grid-cols-2 lg:grid-cols-5 lg:px-4"
        >
          {studioResources.map((resource) => (
            <FeatureCard key={resource.title} {...resource} iconBox />
          ))}
        </section>

        <section className="px-2 py-16 lg:px-4">
          <div className="mx-auto max-w-[980px] text-center">
            <h2 className="text-[2.5rem] font-extrabold tracking-[-0.06em] text-[#111111] sm:text-[3.3rem]">
              Experimente o <span className="text-[#18b75c]">EME agora</span>
            </h2>
            <p className="mt-3 text-lg text-[#68737d]">Faça uma solicitação e veja o EME trabalhando para você.</p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {promptActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                      action.active
                        ? "border-[#daf2e2] bg-[#eef9f2] text-[#167b46]"
                        : "border-transparent bg-transparent text-[#39424a] hover:bg-white"
                    }`}
                  >
                    <Icon className="size-4" />
                    {action.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-8 rounded-[30px] border border-black/[0.06] bg-white p-4 shadow-[0_25px_65px_rgba(15,23,42,0.07)]">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-[72px] flex-1 items-center rounded-[24px] border border-black/[0.06] bg-[#fcfcfb] px-6 text-left text-lg text-[#8b949c]">
                  Descreva o imóvel para criar um anúncio incrível...
                </div>
                <Link
                  href="/cadastro/corretor"
                  className="inline-flex h-[72px] items-center justify-center gap-3 rounded-[22px] bg-[#18b75c] px-8 text-base font-semibold text-white shadow-[0_18px_34px_rgba(24,183,92,0.24)] transition-all hover:bg-[#11994a]"
                >
                  Gerar com IA
                  <Sparkles className="size-4" />
                </Link>
              </div>
            </div>

            <p className="mt-4 text-left text-[15px] text-[#6f7982] sm:text-center">
              Exemplo: Apartamento 2 quartos, suíte, sacada gourmet, 1 vaga, condomínio com piscina em{" "}
              <span className="font-semibold text-[#18b75c]">Canoas.</span>
            </p>
          </div>
        </section>

        <section
          id="precos"
          className="grid items-center gap-10 rounded-[34px] border border-black/[0.05] bg-white/88 px-6 py-10 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur xl:grid-cols-[220px_minmax(0,1fr)_340px_220px]"
        >
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {["/placeholder-user.jpg", "/placeholder-user.jpg", "/placeholder-user.jpg"].map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="overflow-hidden rounded-full border-2 border-white shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
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
            <h3 className="max-w-[14ch] text-[2.45rem] font-extrabold leading-[1.02] tracking-[-0.06em] text-[#111111]">
              Pronto para desbloquear seu novo <span className="text-[#18b75c]">superpoder?</span>
            </h3>
            <p className="mt-4 max-w-[28rem] text-lg leading-8 text-[#5f6973]">
              Teste gratuitamente por 7 dias e descubra como o EME pode transformar sua rotina e seus resultados.
            </p>
          </div>

          <div className="grid gap-4">
            {checklist.map((item) => (
              <div key={item} className="flex items-center gap-3 text-[15px] text-[#39424a]">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#ecf8f0] text-[#18b75c]">
                  <Check className="size-4" />
                </span>
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/cadastro/corretor"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-[20px] bg-[#18b75c] px-7 text-base font-semibold text-white shadow-[0_18px_34px_rgba(24,183,92,0.24)] transition-all hover:bg-[#11994a]"
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
    <div className="relative mx-auto w-full max-w-[760px]">
      <div className="absolute inset-0 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(24,183,92,0.14),transparent_34%)] blur-2xl" />
      <div className="overflow-hidden rounded-[34px] border border-black/[0.06] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
        <div className="grid min-h-[620px] grid-cols-[64px_minmax(0,1fr)] sm:grid-cols-[84px_minmax(0,1fr)]">
          <div className="border-r border-black/[0.05] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfb_100%)] px-3 py-6">
            <div className="grid justify-center gap-4">
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
            <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <button className="text-[#18b75c]">
                  <ArrowRight className="size-4 rotate-180" />
                </button>
                <Image src="/placeholder-user.jpg" alt="COS" width={38} height={38} className="size-9 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-semibold text-[#121212]">COS</p>
                  <p className="text-xs text-[#7f8a93]">Online</p>
                </div>
              </div>
              <div className="text-[#98a1a9]">•••</div>
            </div>

            <div className="flex-1 space-y-5 bg-[linear-gradient(180deg,#ffffff_0%,#fdfefd_100%)] px-5 py-6 sm:px-7">
              <ChatBubble align="right" dark>
                Crie um anúncio para esse apartamento de 2 quartos, suíte e sacada gourmet.
              </ChatBubble>

              <div className="space-y-3">
                <SystemLine text="Aqui está o anúncio:" />
                <div className="max-w-[390px] rounded-[22px] border border-black/[0.06] bg-white p-3 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-3">
                    <Image src="/placeholder.jpg" alt="Apartamento" width={84} height={84} className="h-20 w-24 rounded-2xl object-cover" />
                    <div>
                      <p className="font-semibold text-[#161616]">Apartamento à venda</p>
                      <p className="mt-1 text-sm text-[#6f7982]">2 quartos, suíte e sacada gourmet</p>
                      <p className="mt-1 text-sm text-[#6f7982]">R$ 560.000,00 · Centro, Canoas/RS</p>
                    </div>
                  </div>
                </div>
              </div>

              <ChatBubble align="right" dark>
                Agora gere um vídeo para o Instagram.
              </ChatBubble>

              <div className="space-y-3">
                <SystemLine text="Vídeo criado com sucesso!" />
                <div className="relative max-w-[420px] overflow-hidden rounded-[24px] border border-black/[0.06] bg-[#e8ece8]">
                  <Image src="/placeholder.jpg" alt="Vídeo do imóvel" width={640} height={336} className="h-40 w-full object-cover" />
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

            <div className="border-t border-black/[0.05] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3 rounded-[22px] border border-black/[0.07] bg-white px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                <input
                  aria-label="Fale com o COS"
                  placeholder="Fale com o COS..."
                  className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#97a1aa]"
                />
                <button className="inline-flex size-9 items-center justify-center rounded-full border border-black/[0.06] text-[#8f99a1]">
                  <Sparkles className="size-4" />
                </button>
                <button className="inline-flex size-10 items-center justify-center rounded-full bg-[#18b75c] text-white shadow-[0_12px_26px_rgba(24,183,92,0.22)]">
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
      <div className="absolute inset-0 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_top_left,rgba(24,183,92,0.15),transparent_35%)] blur-2xl" />
      <div className="overflow-hidden rounded-[32px] border border-black/[0.06] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="border-r border-black/[0.05] bg-[linear-gradient(180deg,#f9fcfa_0%,#ffffff_100%)] px-4 py-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#5d6a61]">
              <div className="flex size-8 items-center justify-center rounded-xl bg-[#eaf8ef]">
                <Image src="/images/eme-logo-official.png" alt="EME" width={24} height={24} className="size-5 object-contain" />
              </div>
              EME
            </div>
            <div className="mt-6 grid gap-2">
              {studioMenuItems.map(({ label, icon: LucideIcon }, index) => {
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${
                      index === 1 ? "bg-[#eef9f2] font-semibold text-[#167b46]" : "text-[#606b74]"
                    }`}
                  >
                    <LucideIcon className="size-4" />
                    {label}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-[#18b75c]">Gerar imagem</p>
                <p className="mt-2 max-w-[19rem] text-[13px] leading-6 text-[#7b848d]">
                  Sala ampla integrada com cozinha americana, sofá claro, luz natural, decoração moderna.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[#96a0a8]">
                <button className="inline-flex size-8 items-center justify-center rounded-full border border-black/[0.06]">
                  <TimerReset className="size-4" />
                </button>
                <button className="inline-flex size-8 items-center justify-center rounded-full border border-black/[0.06]">
                  <Sparkles className="size-4" />
                </button>
                <button className="inline-flex size-8 items-center justify-center rounded-full border border-black/[0.06]">
                  <CirclePlay className="size-4" />
                </button>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="mb-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#18b75c] px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(24,183,92,0.22)]">
                <Sparkles className="size-4" />
                Gerar imagem
              </div>

              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="grid gap-3">
                  <Image src="/placeholder.jpg" alt="Prévia 1" width={240} height={164} className="h-28 w-full rounded-[20px] object-cover" />
                  <Image src="/placeholder.jpg" alt="Prévia 2" width={240} height={164} className="h-28 w-full rounded-[20px] object-cover" />
                </div>

                <div className="overflow-hidden rounded-[26px] border border-black/[0.06] bg-[#f4f4f2]">
                  <Image src="/placeholder.jpg" alt="Imagem principal do Studio IA" width={940} height={640} className="h-full min-h-[360px] w-full object-cover" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-[#121212] px-5 py-4 text-white">
              <CirclePlay className="size-5 fill-white/90 text-white" />
              <div className="h-1.5 flex-1 rounded-full bg-white/20">
                <div className="h-1.5 w-1/3 rounded-full bg-white" />
              </div>
              <span className="text-sm">0:08 / 0:18</span>
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
          iconBox ? "size-12 bg-[#eef9f2] text-[#18b75c]" : "text-[#18b75c]"
        }`}
      >
        <Icon className={iconBox ? "size-5" : "size-5"} />
      </div>
      <h3 className="text-[1.28rem] font-bold tracking-[-0.03em] text-[#141414]">{title}</h3>
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
          ? "border-[#d7f0df] bg-[#eef9f2] text-[#18b75c] shadow-[0_12px_24px_rgba(24,183,92,0.10)]"
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
        className={`max-w-[320px] rounded-[18px] px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${
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
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#ecf8f0] text-[#18b75c]">
        <Bot className="size-3.5" />
      </span>
      {text}
    </div>
  )
}
