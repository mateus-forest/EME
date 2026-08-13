import Link from 'next/link'
import { ConversationalSearch } from '@/components/marketplace/conversational-search'
import { Reveal } from '@/components/marketplace/reveal'
import { OrganicLines } from '@/components/marketplace/organic-lines'

export function ClosingCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-12 pt-4 md:px-8 md:pb-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] rounded-tr-[6rem] border border-border/70 bg-surface px-6 py-12 shadow-[var(--shadow-soft)] md:px-14 md:py-16">
          <OrganicLines className="opacity-70" count={5} animate={false} />

          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              O imóvel certo pode começar por uma conversa.
            </h2>
            <div>
              <ConversationalSearch
                size="lg"
                placeholder="Me conte o que você procura..."
                className="bg-card"
              />
              <p className="mt-3 pl-1 text-sm text-muted-foreground">
                Ex.: casa com pátio, apartamento próximo ao centro, imóvel para investir
              </p>
              <p className="mt-6 pl-1 text-sm text-muted-foreground">
                Você é corretor?{' '}
                <Link
                  href="#tecnologia"
                  className="font-medium text-primary transition-colors hover:text-eme-700"
                >
                  Conheça o EME.
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
