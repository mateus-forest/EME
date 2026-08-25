import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Clock3,
  Crosshair,
  DollarSign,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react"

const acceleratorFeatures = [
  {
    title: "Inteligência de Mercado",
    description:
      "Análise completa da economia, juros, crédito, inflação, mercado imobiliário e comportamento do consumidor.",
    icon: TrendingUp,
  },
  {
    title: "Captação Inteligente de Imóveis",
    description: "Nossa equipe busca, filtra e prioriza imóveis com potencial na sua região para você.",
    icon: Search,
  },
  {
    title: "Radar de Oportunidades",
    description:
      "Identificamos setores, regiões, perfis de imóveis e movimentos que geram vantagem competitiva.",
    icon: Crosshair,
  },
  {
    title: "Presença Estratégica & Ambientes de Influência",
    description:
      "Onde estar, com quem se relacionar e como construir presença recorrente e autoridade.",
    icon: UsersRound,
  },
  {
    title: "Posicionamento & Abordagem",
    description:
      "Como ser percebido, se comunicar e abordar com naturalidade e valor em qualquer situação.",
    icon: UserRound,
  },
  {
    title: "Gestão de Risco",
    description:
      "Antecipe riscos e tome decisões com segurança e previsibilidade para proteger seus resultados.",
    icon: ShieldCheck,
  },
] as const

const impactMetrics = [
  { value: "+37%", label: "Oportunidades identificadas", icon: TrendingUp },
  { value: "+52%", label: "Taxa de conversão de propostas", icon: UsersRound },
  { value: "+28%", label: "Crescimento de receita dos corretores", icon: DollarSign },
  { value: "−41%", label: "Tempo perdido com decisões manuais", icon: Clock3 },
] as const

export function LandingAcceleratorTeaser({
  onOpen,
  className,
  compact = false,
}: {
  onOpen: () => void
  className?: string
  compact?: boolean
}) {
  return (
    <aside
      className={`pointer-events-auto absolute ${className || ""}`}
      style={{
        bottom: compact
          ? "max(0.75rem, calc(env(safe-area-inset-bottom) + 0.5rem))"
          : "clamp(2rem, 5vh, 3.75rem)",
        right: compact ? "0.5rem" : "clamp(1.5rem, 4vw, 4rem)",
        left: "auto",
        top: "auto",
        zIndex: 80,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label="Conheça o Acelerador EME"
        className={`group relative z-10 flex items-center justify-between border border-white/60 bg-white/42 text-left text-foreground shadow-[0_18px_44px_-25px_rgba(15,38,27,0.55),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-[14px] transition-[transform,background-color,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme/60 ${
          compact
            ? "h-[54px] w-[168px] rounded-[16px] px-3"
            : "h-[78px] w-[292px] rounded-[22px] px-5"
        }`}
      >
        <span className="min-w-0">
          <span
            className={`block font-medium text-muted-foreground ${
              compact ? "text-[8px] leading-none" : "text-[11px] leading-none"
            }`}
          >
            Novo produto a caminho
          </span>
          <strong
            className={`mt-1.5 block truncate font-medium tracking-[-0.02em] text-foreground ${
              compact ? "text-[10px]" : "text-[14px]"
            }`}
          >
            Conheça o Acelerador EME
          </strong>
        </span>

        <span
          className={`ml-3 flex shrink-0 items-center justify-center rounded-full bg-white/85 text-eme shadow-[0_8px_20px_-12px_rgba(24,99,50,0.7)] transition-transform duration-500 ease-out group-hover:translate-x-1 ${
            compact ? "size-8" : "size-10"
          }`}
        >
          <ArrowRight aria-hidden className={compact ? "size-3.5" : "size-4.5"} strokeWidth={1.8} />
        </span>
      </button>
    </aside>
  )
}

export function AcceleratorHero({
  onBack,
  compact = false,
}: {
  onBack: () => void
  compact?: boolean
}) {
  if (compact) {
    return <AcceleratorMobileHero onBack={onBack} />
  }

  return (
    <section
      aria-label="Acelerador EME"
      className="relative flex h-full min-h-0 flex-col overflow-hidden px-[clamp(2.5rem,5vw,5.25rem)] pb-[clamp(1.25rem,2.8vh,2.5rem)] pt-[clamp(1.5rem,4vh,2.75rem)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(247,250,252,0.72)_0%,rgba(247,250,252,0.38)_34%,rgba(243,248,249,0.22)_100%)]"
      />

      <div className="relative z-10 flex items-center justify-between">
        <ProductBadge />
        <div className="flex items-center gap-3">
          <BackButton onBack={onBack} />
          <span className="eme-gradient flex h-11 items-center gap-2 rounded-full px-5 text-[12px] font-semibold text-white shadow-[0_14px_28px_-16px_rgba(20,110,55,0.75)]">
            <Bell aria-hidden className="size-4" strokeWidth={1.7} />
            Quero ser avisado
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-[clamp(1.75rem,4vh,3.5rem)] grid min-h-0 flex-1 grid-cols-[minmax(19rem,0.78fr)_minmax(34rem,1.42fr)] gap-[clamp(2rem,5vw,5.75rem)]">
        <div className="relative flex min-h-0 flex-col">
          <div>
            <h1 className="text-[clamp(3.15rem,5vw,5.25rem)] font-normal leading-[0.95] tracking-[-0.055em] text-[#151b2b]">
              Acelerador <span className="text-eme">EME</span>
            </h1>
            <p className="mt-[clamp(1rem,2.5vh,1.75rem)] max-w-[30rem] text-[clamp(1.1rem,1.45vw,1.55rem)] font-medium leading-[1.35] tracking-[-0.025em] text-[#3e4757]">
              Inteligência estratégica para decidir onde crescer e como agir.
            </p>
            <p className="mt-[clamp(0.9rem,2vh,1.4rem)] max-w-[31rem] text-[clamp(0.72rem,0.86vw,0.92rem)] leading-[1.62] text-[#4c5767]">
              O Acelerador EME transforma dados de mercado, economia, sua operação e seu posicionamento em oportunidades reais e um plano de ação claro para você gerar mais resultados.
            </p>
            <DevelopmentBadge />
          </div>

          <Image
            src="/images/eme-logo-3d-cutout.webp"
            alt="EME"
            width={560}
            height={280}
            priority
            className="mt-auto h-auto w-[min(30vw,31rem)] max-w-full object-contain object-left-bottom drop-shadow-[0_28px_32px_rgba(16,74,39,0.18)]"
          />
        </div>

        <div className="grid min-h-0 grid-cols-3 grid-rows-2 gap-[clamp(0.65rem,1.2vw,1.1rem)]">
          {acceleratorFeatures.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-[clamp(0.85rem,2vh,1.5rem)] grid h-[clamp(8rem,18vh,10.5rem)] shrink-0 grid-cols-[0.92fr_1.08fr] gap-4">
        <ImpactPanel />
        <OfferPanel />
      </div>

      <div className="relative z-10 mt-3 flex h-9 shrink-0 items-center justify-center gap-5 rounded-[14px] border border-white/55 bg-white/40 px-5 text-[10px] text-[#65707c] backdrop-blur-[12px]">
        <span>Estudo da situação atual do país incluso</span>
        <span className="h-3 w-px bg-[#77818d]/30" />
        <span>Ações dedicadas ao cenário atual</span>
        <span className="h-3 w-px bg-[#77818d]/30" />
        <span>Recomendações práticas e imediatas</span>
        <span className="h-3 w-px bg-[#77818d]/30" />
        <span>O que fazer hoje para crescer no futuro</span>
      </div>
    </section>
  )
}

function AcceleratorMobileHero({ onBack }: { onBack: () => void }) {
  return (
    <section
      aria-label="Acelerador EME"
      className="relative h-full overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(160deg,rgba(247,250,252,0.82)_0%,rgba(247,250,252,0.48)_58%,rgba(238,247,241,0.58)_100%)]"
      />

      <div className="relative z-10 flex items-center justify-between">
        <ProductBadge compact />
        <BackButton onBack={onBack} compact />
      </div>

      <div className="relative z-10 mt-10">
        <h1 className="text-[44px] font-normal leading-[0.94] tracking-[-0.055em] text-[#151b2b]">
          Acelerador <span className="text-eme">EME</span>
        </h1>
        <p className="mt-4 max-w-[20rem] text-[18px] font-medium leading-[1.28] tracking-[-0.025em] text-[#3e4757]">
          Inteligência estratégica para decidir onde crescer e como agir.
        </p>
        <p className="mt-3 text-[12px] leading-[1.58] text-[#4c5767]">
          O Acelerador EME transforma dados de mercado, economia, sua operação e seu posicionamento em oportunidades reais e um plano de ação claro para você gerar mais resultados.
        </p>
        <DevelopmentBadge />
        <Image
          src="/images/eme-logo-3d-cutout.webp"
          alt="EME"
          width={420}
          height={210}
          priority
          className="mx-auto mt-5 h-auto w-[78vw] max-w-[22rem] object-contain drop-shadow-[0_24px_28px_rgba(16,74,39,0.18)]"
        />
      </div>

      <div className="relative z-10 mt-5 grid grid-cols-2 gap-2.5">
        {acceleratorFeatures.map((feature) => (
          <FeatureCard key={feature.title} {...feature} compact />
        ))}
      </div>

      <div className="relative z-10 mt-3 space-y-3">
        <ImpactPanel compact />
        <OfferPanel compact />
      </div>
    </section>
  )
}

function ProductBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/60 bg-white/55 font-semibold uppercase text-[#515d69] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-[10px] ${
        compact ? "gap-2 px-3 py-2 text-[8px] tracking-[0.16em]" : "gap-3 px-5 py-2.5 text-[10px] tracking-[0.18em]"
      }`}
    >
      <span className="size-2 rounded-full bg-eme" />
      Novo produto
    </span>
  )
}

function BackButton({
  onBack,
  compact = false,
}: {
  onBack: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className={`flex items-center rounded-full border border-white/60 bg-white/60 font-medium text-[#47515e] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-[12px] transition-[transform,background-color] duration-300 hover:-translate-x-0.5 hover:bg-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme/60 ${
        compact ? "gap-1.5 px-3 py-2 text-[10px]" : "h-11 gap-2 px-5 text-[12px]"
      }`}
    >
      <ArrowLeft aria-hidden className={compact ? "size-3.5" : "size-4"} strokeWidth={1.8} />
      Voltar ao EME
    </button>
  )
}

function DevelopmentBadge() {
  return (
    <span className="mt-[clamp(1rem,2.4vh,1.7rem)] inline-flex items-center gap-2 rounded-full border border-white/65 bg-white/55 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-eme backdrop-blur-[10px]">
      <Target aria-hidden className="size-3.5" strokeWidth={1.8} />
      Em desenvolvimento
    </span>
  )
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  compact = false,
}: (typeof acceleratorFeatures)[number] & { compact?: boolean }) {
  return (
    <article
      className={`flex min-h-0 flex-col border border-white/60 bg-white/53 shadow-[0_20px_45px_-32px_rgba(21,46,33,0.48),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[15px] ${
        compact ? "min-h-[170px] rounded-[20px] p-3.5" : "rounded-[22px] p-[clamp(1rem,1.45vw,1.5rem)]"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-white/65 text-eme shadow-[0_10px_25px_-18px_rgba(19,87,43,0.7)] ${
          compact ? "size-9" : "size-[clamp(2.5rem,3.2vw,3.4rem)]"
        }`}
      >
        <Icon aria-hidden className={compact ? "size-[18px]" : "size-[clamp(1.2rem,1.55vw,1.6rem)]"} strokeWidth={1.6} />
      </span>
      <h2
        className={`font-semibold leading-[1.15] tracking-[-0.025em] text-[#1d2430] ${
          compact ? "mt-3 text-[12px]" : "mt-[clamp(0.7rem,1.4vh,1rem)] text-[clamp(0.78rem,1vw,1.02rem)]"
        }`}
      >
        {title}
      </h2>
      <p
        className={`text-[#4f5966] ${
          compact ? "mt-2 text-[9.5px] leading-[1.45]" : "mt-[clamp(0.45rem,0.8vh,0.7rem)] text-[clamp(0.62rem,0.77vw,0.78rem)] leading-[1.5]"
        }`}
      >
        {description}
      </p>
      <ArrowRight aria-hidden className="mt-auto size-3.5 pt-2 text-[#46515d]" strokeWidth={1.6} />
    </article>
  )
}

function ImpactPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`border border-white/60 bg-white/48 shadow-[0_18px_42px_-32px_rgba(21,46,33,0.42),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-[14px] ${
        compact ? "rounded-[22px] p-4" : "rounded-[20px] px-[clamp(1.25rem,2.4vw,2.5rem)] py-[clamp(0.8rem,1.7vh,1.35rem)]"
      }`}
    >
      <h2 className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#68727e]">
        Impacto para corretores que usam inteligência
      </h2>
      <div className={`grid grid-cols-4 ${compact ? "mt-4 gap-2" : "mt-[clamp(0.7rem,1.5vh,1.2rem)] gap-3"}`}>
        {impactMetrics.map(({ value, label, icon: Icon }) => (
          <div key={value} className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon aria-hidden className="size-4 shrink-0 text-eme" strokeWidth={1.6} />
              <strong className={`${compact ? "text-[12px]" : "text-[clamp(0.72rem,0.92vw,0.95rem)]"} text-[#252d38]`}>
                {value}
              </strong>
            </div>
            <p className={`${compact ? "mt-1 text-[7px] leading-[1.25]" : "mt-1 text-[clamp(0.5rem,0.6vw,0.63rem)] leading-[1.3]"} text-[#5b6672]`}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function OfferPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`relative overflow-hidden border border-white/60 bg-white/52 shadow-[0_18px_42px_-32px_rgba(21,46,33,0.42),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[14px] ${
        compact ? "rounded-[22px] p-4 pr-[6.5rem]" : "rounded-[20px] px-[clamp(1.25rem,2.2vw,2.2rem)] py-[clamp(0.8rem,1.7vh,1.35rem)] pr-[clamp(9rem,14vw,13rem)]"
      }`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-eme">
        Condição exclusiva para os 100 primeiros corretores
      </p>
      <h2 className={`${compact ? "mt-3 text-[12px] leading-[1.25]" : "mt-[clamp(0.65rem,1.2vh,1rem)] text-[clamp(0.75rem,0.95vw,1rem)]"} font-semibold uppercase text-[#242c37]`}>
        3 meses de acesso completo + acompanhamento estratégico
      </h2>
      <div className={`${compact ? "mt-4" : "mt-[clamp(0.8rem,1.7vh,1.35rem)]"} flex items-center gap-4 text-[9px] text-[#4e5965]`}>
        <span>Acesso a todo o conteúdo</span>
        <span>Consultoria estratégica</span>
        <span className={compact ? "hidden" : "inline"}>Suporte prioritário</span>
      </div>
      <div className={`absolute inset-y-0 right-0 flex flex-col items-center justify-center bg-[linear-gradient(155deg,#073a29,#0c5c37)] text-center text-white ${compact ? "w-24" : "w-[clamp(8rem,13vw,12rem)]"}`}>
        <span className={`${compact ? "text-[28px]" : "text-[clamp(2rem,3.5vw,3.75rem)]"} font-semibold leading-none text-[#a7f07f]`}>
          100
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#d8f489]">primeiros</span>
        <span className="mt-3 text-[10px] font-semibold uppercase">3 meses grátis</span>
      </div>
    </section>
  )
}
