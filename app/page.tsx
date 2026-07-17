import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Camera,
  Check,
  CirclePlay,
  FolderOpen,
  Grid2x2,
  House,
  ImageIcon,
  Megaphone,
  MessageCircleMore,
  NotebookTabs,
  Sparkles,
  Video,
} from "lucide-react"

import { LandingCosDemoSection } from "@/components/landing-cos-demo-section"
import { LandingStudioMediaDemo } from "@/components/landing-studio-media-demo"

type NavLink = {
  label: string
  href: string
  highlight?: boolean
}

const navLinks: NavLink[] = [
  { label: "Recursos", href: "#recursos" },
  { label: "Studio IA", href: "#studio-ia", highlight: true },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Para corretores", href: "#studio-ia" },
  { label: "Precos", href: "#precos" },
]

const studioResources = [
  {
    icon: ImageIcon,
    title: "Gerar imagem",
    description: "Fotos realistas de ambientes e fachadas em segundos.",
  },
  {
    icon: Video,
    title: "Gerar video",
    description: "Videos verticais prontos para Instagram, Reels e TikTok.",
  },
  {
    icon: NotebookTabs,
    title: "Textos prontos",
    description: "Anuncios, descricoes e legendas que vendem.",
  },
  {
    icon: Grid2x2,
    title: "Templates",
    description: "Modelos prontos para cada ocasiao e objetivo.",
  },
  {
    icon: FolderOpen,
    title: "Meus arquivos",
    description: "Tudo organizado para voce usar quando quiser.",
  },
] as const

const checklist = ["7 dias gratis", "Acesso completo", "Sem cartao de credito", "Cancelamento facil"] as const

const studioLandingActions = [
  {
    title: "Vender este imovel",
    description: "Organize uma acao focada em conversao para apresentar o imovel certo no momento certo.",
    icon: House,
  },
  {
    title: "Criar campanha para Instagram",
    description: "Monte uma campanha visual para publicar o imovel com narrativa pronta para redes sociais.",
    icon: Megaphone,
  },
  {
    title: "Criar video do imovel",
    description: "Estruture a producao de um video comercial com foco em captacao de atencao e visitas.",
    icon: Video,
  },
  {
    title: "Transformar obra em imovel pronto",
    description: "Use uma imagem real da obra e gere uma versao pronta para venda com aprovacao e novas versoes.",
    icon: Sparkles,
  },
  {
    title: "Atrair compradores",
    description: "Planeje a mensagem e os ganchos comerciais para aumentar interesse qualificado no imovel.",
    icon: MessageCircleMore,
  },
  {
    title: "Captar proprietarios",
    description: "Estruture abordagens de captacao para ampliar a carteira com foco no perfil certo.",
    icon: Camera,
  },
] as const

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fcfcf8] text-[#111111]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] bg-[radial-gradient(circle_at_top_left,rgba(22,163,74,0.10),transparent_42%),radial-gradient(circle_at_top_right,rgba(22,163,74,0.06),transparent_36%),linear-gradient(180deg,#ffffff_0%,#fcfcf8_76%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[40rem] h-[76rem] bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.06),transparent_30%),radial-gradient(circle_at_bottom,rgba(15,23,42,0.025),transparent_40%)]" />

      <div className="relative mx-auto max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-5 rounded-[24px] border border-black/[0.04] bg-white/92 px-5 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="EME">
            <Image
              src="/images/eme-logo-header-official.png"
              alt="EME"
              width={220}
              height={84}
              className="h-8 w-auto object-contain sm:h-9"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-[13px] font-medium transition-colors ${
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
              className="inline-flex h-9 items-center justify-center rounded-[16px] px-4 text-sm font-medium text-[#151515] transition-colors hover:text-[#16a34a] sm:px-5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[16px] bg-[#16a34a] px-5 text-sm font-medium text-white shadow-[0_12px_24px_rgba(22,163,74,0.18)] transition-all hover:bg-[#14803d] sm:px-6"
            >
              Testar gratuitamente
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </header>

        <section
          id="como-funciona"
          className="grid items-center gap-10 px-2 pb-18 pt-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)] lg:px-4 lg:pt-16"
        >
          <div className="max-w-[540px] pl-1 lg:pl-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e3f2e7] bg-white/90 px-3 py-1.5 text-[13px] font-medium text-[#66716c] shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#edf8f0] px-2 py-0.5 text-[#16a34a]">
                <BadgeCheck className="size-3.5" />
                IA
              </span>
              O primeiro colega de trabalho inteligente do corretor
            </div>

            <h1 className="mt-8 max-w-[12ch] text-[3rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[#121212] sm:text-[4.1rem]">
              O corretor que <span className="text-[#16a34a]">vende mais</span>, utiliza EME.
            </h1>

            <p className="mt-7 max-w-[32rem] text-[1.05rem] leading-9 text-[#5f6b73]">
              O EME entende, executa e entrega tudo que voce precisa para{" "}
              <span className="font-medium text-[#16a34a]">vender mais, distribuir mais</span> e{" "}
              <span className="font-medium text-[#16a34a]">atender melhor</span>. Em segundos.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cadastro/corretor"
                className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[18px] bg-[#16a34a] px-7 text-[14px] font-medium text-white shadow-[0_14px_28px_rgba(22,163,74,0.18)] transition-all hover:bg-[#14803d]"
              >
                Testar gratuitamente
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#studio-ia"
                className="inline-flex h-[52px] items-center justify-center gap-3 rounded-[18px] border border-black/[0.07] bg-white px-7 text-[14px] font-medium text-[#171717] shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition-colors hover:bg-[#fafcf9]"
              >
                Ver o Studio IA
                <CirclePlay className="size-4" />
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2.5 text-[13px] font-medium text-[#5f6973]">
              <TrustItem label="7 dias gratis" />
              <TrustItem label="Sem cartao de credito" />
              <TrustItem label="Acesso completo" />
            </div>
          </div>

          <HeroConversationMock />
        </section>

        <section
          id="studio-ia"
          className="grid items-center gap-10 px-2 pb-8 pt-4 lg:grid-cols-[minmax(320px,0.4fr)_minmax(0,0.6fr)] lg:px-4 lg:pt-8"
        >
          <div className="max-w-[30rem]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-white/92 px-3.5 py-1.5 text-[13px] font-medium text-[#16a34a] shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
              <Bot className="size-4" />
              STUDIO IA
            </div>
            <h2 className="mt-6 text-[2.45rem] font-semibold leading-[1.05] tracking-[-0.06em] text-[#111111] sm:text-[3.45rem]">
              Studio IA do EME:
              <br />
              o atalho para resultados
              <br />
              que <span className="text-[#16a34a]">geram negocio.</span>
            </h2>
            <p className="mt-5 max-w-[29rem] text-[1rem] leading-8 text-[#5f6973]">
              Escolha o objetivo comercial e deixe a IA cuidar do resto. Do conteudo a estrategia, tudo em um so
              lugar para voce vender mais, com mais agilidade.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                "Fluxos prontos para gerar resultados",
                "IA treinada para imobiliarias",
                "Seus dados seguros e confidenciais",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef8f1] text-[#16a34a]">
                    <Check className="size-3.5" />
                  </span>
                  <p className="text-[13px] leading-5.5 text-[#4f5d67]">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/cadastro/corretor"
                className="inline-flex h-[50px] items-center justify-center gap-2 rounded-[18px] bg-[#16a34a] px-6 text-[14px] font-medium text-white shadow-[0_14px_28px_rgba(22,163,74,0.18)] transition-all hover:bg-[#14803d]"
              >
                Conhecer o Studio IA
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#recursos"
                className="inline-flex h-[50px] items-center justify-center gap-3 rounded-[18px] border border-black/[0.07] bg-white px-6 text-[14px] font-medium text-[#171717] shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition-colors hover:bg-[#fafcf9]"
              >
                Ver todos os recursos
                <CirclePlay className="size-4" />
              </a>
            </div>
          </div>

          <StudioPreviewMock />
        </section>

        <section className="px-2 pb-12 pt-4 lg:px-4">
          <LandingStudioMediaDemo />
        </section>

        <section
          id="recursos"
          className="grid gap-8 border-b border-black/[0.04] px-2 pb-14 pt-6 sm:grid-cols-2 lg:grid-cols-5 lg:px-4"
        >
          {studioResources.map((resource) => (
            <FeatureCard key={resource.title} {...resource} iconBox />
          ))}
        </section>

        <section className="px-2 py-14 lg:px-4">
          <LandingCosDemoSection />
        </section>

        <section
          id="precos"
          className="grid items-center gap-8 rounded-[28px] border border-black/[0.04] bg-white/92 px-6 py-8 shadow-[0_12px_34px_rgba(15,23,42,0.045)] backdrop-blur xl:grid-cols-[200px_minmax(0,1fr)_300px_200px]"
        >
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {["/placeholder-user.jpg", "/placeholder-user.jpg", "/placeholder-user.jpg"].map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="overflow-hidden rounded-full border-2 border-white shadow-[0_8px_16px_rgba(15,23,42,0.05)]"
                >
                  <Image src={src} alt="" width={52} height={52} className="size-11 object-cover" />
                </div>
              ))}
            </div>
            <p className="max-w-[9rem] text-[13px] leading-5.5 text-[#5f6973]">
              <span className="font-semibold text-[#111111]">+2.500 corretores</span> ja estao vendendo mais com o EME
            </p>
          </div>

          <div>
            <h3 className="max-w-[14ch] text-[2.15rem] font-semibold leading-[1.06] tracking-[-0.055em] text-[#111111]">
              Pronto para desbloquear seu novo <span className="text-[#16a34a]">superpoder?</span>
            </h3>
            <p className="mt-3 max-w-[26rem] text-[1rem] leading-7 text-[#5f6973]">
              Teste gratuitamente por 7 dias e descubra como o EME pode transformar sua rotina e seus resultados.
            </p>
          </div>

          <div className="grid gap-3">
            {checklist.map((item) => (
              <div key={item} className="flex items-center gap-3 text-[14px] text-[#39424a]">
                <span className="inline-flex size-5.5 items-center justify-center rounded-full bg-[#ecf8f0] text-[#16a34a]">
                  <Check className="size-4" />
                </span>
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/cadastro/corretor"
            className="inline-flex h-[50px] items-center justify-center gap-2 rounded-[18px] bg-[#16a34a] px-6 text-[15px] font-medium text-white shadow-[0_14px_26px_rgba(22,163,74,0.18)] transition-all hover:bg-[#14803d]"
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
    <div className="relative mx-auto w-full max-w-[760px] lg:-mr-2">
      <div className="absolute inset-0 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(22,163,74,0.12),transparent_36%)] blur-3xl" />
      <div className="flex min-h-[560px] items-center justify-center p-2 sm:p-3">
        <div className="relative h-full min-h-[510px] w-full max-w-[560px] drop-shadow-[0_18px_34px_rgba(15,23,42,0.085)]">
          <Image
            src="/images/landing-cos-reference-refined.png"
            alt="Tela real do COS no portal do corretor"
            fill
            priority
            className="object-contain object-center"
            sizes="(min-width: 1024px) 48vw, 100vw"
          />
        </div>
      </div>
    </div>
  )
}

function StudioPreviewMock() {
  return (
    <div className="relative mx-auto w-full max-w-[860px]">
      <div className="absolute inset-0 -z-10 rounded-[44px] bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.11),transparent_34%)] blur-3xl" />
      <div className="overflow-hidden rounded-[30px] border border-black/[0.05] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfa_100%)] p-3.5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-4">
        <div className="rounded-[24px] border border-black/[0.045] bg-white/96 px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.04)] sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.9rem] font-semibold text-[#111111]">Escolha um fluxo para comecar</p>
              <p className="mt-1 text-[13px] text-[#667085]">Acoes orientadas a resultado para o seu dia a dia.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#dce9df] bg-white px-3 py-1.5 text-[11px] font-medium text-[#5f6973]">
                15 creditos disponiveis
              </span>
              <span className="rounded-full bg-[#16a34a] px-3.5 py-1.5 text-[11px] font-semibold text-white">+ Novo fluxo</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {studioLandingActions.map((action) => {
              const Icon = action.icon

              return (
                <article
                  key={action.title}
                  className="rounded-[20px] border border-black/[0.05] bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfa_100%)] p-4 shadow-[0_10px_20px_rgba(15,23,42,0.035)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-[18px] border border-[#009b3a]/14 bg-[#eef9f1] text-[#16a34a]">
                      <Icon className="size-4.5" />
                    </div>
                    <span className="rounded-full bg-[#eef9f1] px-2 py-1 text-[10px] font-medium text-[#16a34a]">
                      Disponivel
                    </span>
                  </div>
                  <p className="mt-4 max-w-[14ch] text-[1rem] font-semibold leading-7 text-[#111111]">{action.title}</p>
                  <div className="mt-5 flex items-center justify-end text-[#16a34a]">
                    <ArrowRight className="size-4" />
                  </div>
                </article>
              )
            })}
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
    <div className="max-w-[210px]">
      <div
        className={`mb-5 inline-flex items-center justify-center rounded-2xl ${
          iconBox ? "size-10 rounded-[18px] bg-[#eef8f1] text-[#16a34a]" : "text-[#16a34a]"
        }`}
      >
        <Icon className="size-4.5" />
      </div>
      <h3 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-[#141414]">{title}</h3>
      <p className="mt-2.5 text-[14px] leading-6 text-[#5f6973]">{description}</p>
    </div>
  )
}

function TrustItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex size-4.5 items-center justify-center rounded-full border border-black/[0.08] bg-white text-[#111111]">
        <Check className="size-3" />
      </span>
      {label}
    </div>
  )
}
