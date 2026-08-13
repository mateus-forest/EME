import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ConversationalSearch } from '@/components/marketplace/conversational-search'
import { OrganicLines } from '@/components/marketplace/organic-lines'
import { Reveal } from '@/components/marketplace/reveal'

// CTA de ajuda: a pessoa descreve o que precisa e é convidada a falar com um profissional.
export function HelpCta({
  title,
  text,
  placeholder,
  purpose,
  secondaryLabel = 'Falar com um especialista',
  secondaryHref = '/imoveis/corretores',
}: {
  title: string
  text: string
  placeholder: string
  purpose: 'compra' | 'aluguel'
  secondaryLabel?: string
  secondaryHref?: string
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card p-8 shadow-[var(--shadow-soft)] md:p-12">
          <OrganicLines className="opacity-70" />
          <div className="relative max-w-2xl">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {title}
            </h2>
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
              {text}
            </p>
            <div className="mt-7 flex flex-col gap-4">
              <ConversationalSearch placeholder={placeholder} purpose={purpose} size="lg" />
              <Link
                href={secondaryHref}
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-eme-600"
              >
                {secondaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
