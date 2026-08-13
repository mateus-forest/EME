import Link from 'next/link'
import { ArrowRight, BarChart3, Phone, Search, Sparkles, type LucideIcon } from 'lucide-react'
import { features, type Feature } from '@/lib/marketplace/data'
import { SectionHeading } from '@/components/marketplace/section-heading'
import { Reveal } from '@/components/marketplace/reveal'
import { OrganicLines } from '@/components/marketplace/organic-lines'

const icons: Record<Feature['icon'], LucideIcon> = {
  search: Search,
  sparkles: Sparkles,
  compare: BarChart3,
  phone: Phone,
}

export function FeaturesSection() {
  return (
    <section id="tecnologia" className="relative overflow-hidden bg-surface">
      {/* Linhas orgânicas da identidade EME conectando os recursos */}
      <OrganicLines className="opacity-80" count={6} />

      <div className="relative mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <Reveal>
          <SectionHeading
            title="Tecnologia para escolher melhor"
            support="O EME usa tecnologia para entender o que importa para você."
          />
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 md:mt-12 lg:grid-cols-4">
          {features.map((feature, i) => {
            const Icon = icons[feature.icon]
            return (
              <Reveal key={feature.title} delay={i * 80}>
                <div className="group relative flex h-full flex-col rounded-2xl p-4 transition-colors duration-300 hover:bg-card/70">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-eme-50 text-primary transition-transform duration-300 group-hover:scale-105">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                  <Link
                    href="#tecnologia"
                    aria-label={`Saiba mais sobre ${feature.title}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-all duration-300 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    Saiba mais
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
