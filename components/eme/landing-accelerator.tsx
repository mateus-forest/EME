import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Crosshair,
  Crown,
  DollarSign,
  FileText,
  Grid2X2,
  Headphones,
  Search,
  ShieldCheck,
  Sparkles,
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

const offerBenefits = [
  { label: "Acesso a todo o conteúdo", icon: Grid2X2 },
  { label: "Consultoria estratégica", icon: Target },
  { label: "Relatórios e insights exclusivos", icon: FileText },
  { label: "Suporte prioritário", icon: Headphones },
  { label: "Créditos no Studio IA", icon: Sparkles },
] as const

const offerChecklist = [
  "Estudo da situação atual do país",
  "Captação inteligente de imóveis",
  "Radar de oportunidades",
  "Posicionamento & abordagem",
  "Gestão de risco",
  "Plano de ação personalizado",
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

      <div className="eme-accelerator__footer">
        <ImpactPanel />
        <OfferPanel />
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

      <div className="eme-accelerator__footer is-compact">
        <ImpactPanel compact />
        <OfferPanel compact />
      </div>

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
          O Acelerador EME transforma dados de mercado, economia, sua operação e seu posicionamento em oportunidades reais e um plano de ação claro para você gerar mais resultados.
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

function ImpactPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`eme-accelerator-impact${compact ? " is-compact" : ""}`}>
      <h2>Impacto para corretores que usam inteligência</h2>
      <div className="eme-accelerator-impact__metrics">
        {impactMetrics.map(({ value, label, icon: Icon }) => (
          <div key={value} className="eme-accelerator-impact__metric">
            <div>
              <Icon aria-hidden strokeWidth={1.6} />
              <strong>{value}</strong>
            </div>
            <p>{label}</p>
          </div>
        ))}
      </div>
      <p className="eme-accelerator-impact__note">
        Resultados médios observados por corretores que utilizam inteligência estratégica.
      </p>
    </section>
  )
}

function OfferPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`eme-accelerator-offer${compact ? " is-compact" : ""}`}>
      <div className="eme-accelerator-offer__hundred">
        <Crown aria-hidden strokeWidth={1.5} />
        <strong>100</strong>
        <span>primeiros</span>
      </div>

      <div className="eme-accelerator-offer__main">
        <p className="eme-accelerator-offer__eyebrow">
          Condição exclusiva para os 100 primeiros corretores
        </p>
        <h2>3 meses de acesso completo + acompanhamento estratégico</h2>
        <div className="eme-accelerator-offer__benefits">
          {offerBenefits.map(({ label, icon: Icon }) => (
            <div key={label}>
              <Icon aria-hidden strokeWidth={1.6} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className="eme-accelerator-offer__checklist">
        {offerChecklist.map((item) => (
          <li key={item}>
            <Check aria-hidden strokeWidth={2} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
