import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react"

import acceleratorStyles from "./landing-accelerator.module.css"

const acceleratorFeatures = [
  {
    title: "Inteligência de Mercado",
    description:
      "Análise completa da economia, juros, crédito, inflação, mercado imobiliário e comportamento do consumidor.",
    icon: TrendingUp,
  },
  {
    title: "Captação Inteligente de Imóveis",
    description: "Proposta de apoio à pesquisa e organização da captação na sua região.",
    icon: Search,
  },
  {
    title: "Radar de Oportunidades",
    description:
      "Estudo de setores, regiões e perfis de imóveis para apoiar a leitura do mercado.",
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
      "Organização de informações para apoiar a avaliação de decisões e cenários.",
    icon: ShieldCheck,
  },
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
      className={`eme-accelerator-teaser${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <button type="button" onClick={onOpen} aria-label="Conheça o Acelerador EME">
        <span className="eme-accelerator-teaser__copy">
          <span className="eme-accelerator-teaser__eyebrow">Novo produto a caminho</span>
          <strong>Conheça o Acelerador EME</strong>
        </span>
        <span className="eme-accelerator-teaser__arrow">
          <ArrowRight aria-hidden strokeWidth={1.8} />
        </span>
      </button>
    </aside>
  )
}

export function AcceleratorHero({
  onBack,
  onEntrar,
  onComecar,
  compact = false,
}: {
  onBack: () => void
  onEntrar: () => void
  onComecar: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <AcceleratorMobileHero
        onBack={onBack}
        onEntrar={onEntrar}
        onComecar={onComecar}
      />
    )
  }

  return (
    <section
      aria-label="Acelerador EME"
      className={`eme-accelerator eme-accelerator--desktop ${acceleratorStyles.desktop}`}
    >
      <div aria-hidden className="eme-accelerator__wash" />
      <AcceleratorTopbar onEntrar={onEntrar} onComecar={onComecar} />

      <div className="eme-accelerator__body">
        <AcceleratorIntro />
        <FeatureGrid />
      </div>


      <BackButton onBack={onBack} />
    </section>
  )
}

function AcceleratorMobileHero({
  onBack,
  onEntrar,
  onComecar,
}: {
  onBack: () => void
  onEntrar: () => void
  onComecar: () => void
}) {
  return (
    <section aria-label="Acelerador EME" className="eme-accelerator eme-accelerator--mobile">
      <div aria-hidden className="eme-accelerator__wash" />
      <AcceleratorTopbar onEntrar={onEntrar} onComecar={onComecar} compact />
      <AcceleratorIntro compact />
      <FeatureGrid compact />


      <BackButton onBack={onBack} compact />
    </section>
  )
}

function AcceleratorTopbar({
  onEntrar,
  onComecar,
  compact = false,
}: {
  onEntrar: () => void
  onComecar: () => void
  compact?: boolean
}) {
  return (
    <div className={`eme-accelerator__topbar${compact ? " is-compact" : ""}`}>
      <ProductBadge compact={compact} />
      <div className="eme-accelerator__controls">
        <button type="button" onClick={onEntrar} className="eme-accelerator__auth-action">
          Entrar
        </button>
        <button
          type="button"
          onClick={onComecar}
          className="eme-accelerator__auth-action is-primary"
        >
          Começar agora
        </button>
      </div>
    </div>
  )
}

function AcceleratorIntro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`eme-accelerator__intro${compact ? " is-compact" : ""}`}>
      <div className="eme-accelerator__intro-copy">
        <h1>
          Acelerador <span>EME</span>
        </h1>
        <p className="eme-accelerator__lead">
          Inteligência estratégica para decidir onde crescer e como agir.
        </p>
        <p className="eme-accelerator__description">
          Uma proposta em desenvolvimento para apoiar a leitura de mercado e a organização estratégica do corretor. Recursos e condições serão apresentados quando estiverem disponíveis.
        </p>
        {compact ? <DevelopmentBadge /> : null}
      </div>

      <Image
        src="/images/eme-logo-3d-cutout.webp"
        alt="EME"
        width={560}
        height={280}
        priority
        className="eme-accelerator__logo"
      />
    </div>
  )
}

function FeatureGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`eme-accelerator__features${compact ? " is-compact" : ""}`}>
      {acceleratorFeatures.map((feature) => (
        <FeatureCard key={feature.title} {...feature} compact={compact} />
      ))}
    </div>
  )
}

function ProductBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`eme-accelerator__product-badge${compact ? " is-compact" : ""}`}>
      <span aria-hidden />
      {compact ? "Novo produto" : "Novo produto · Em desenvolvimento"}
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
      className={`eme-accelerator__back${compact ? " is-compact" : ""}`}
    >
      <ArrowLeft aria-hidden strokeWidth={1.8} />
      Voltar ao EME
    </button>
  )
}

function DevelopmentBadge() {
  return (
    <span className="eme-accelerator__development">
      <Target aria-hidden strokeWidth={1.8} />
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
    <article className={`eme-accelerator-card${compact ? " is-compact" : ""}`}>
      <span className="eme-accelerator-card__icon">
        <Icon aria-hidden strokeWidth={1.6} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {compact ? (
        <ArrowRight aria-hidden className="eme-accelerator-card__arrow" strokeWidth={1.6} />
      ) : null}
    </article>
  )
}
