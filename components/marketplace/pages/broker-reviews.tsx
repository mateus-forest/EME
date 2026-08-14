import { MessageSquareText, ShieldCheck, Star } from 'lucide-react'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { PublicBrokerReviewButton } from '@/components/marketplace/pages/public-broker-review-button'

export function BrokerReviews({ broker }: { broker: BrokerProfile }) {
  const hasAggregate = broker.reviewCount > 0 && broker.rating > 0

  return (
    <section id="avaliacoes" aria-labelledby="avaliacoes-title" className="mt-16 scroll-mt-28">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="avaliacoes-title" className="text-2xl font-semibold tracking-tight text-foreground">
            Avaliações de clientes
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Apenas avaliações registradas no EME entram na nota pública do perfil.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasAggregate ? (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-eme-50 px-4 py-2 text-sm font-semibold text-foreground">
              <Star className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
              {broker.rating.toFixed(1).replace('.', ',')} · {broker.reviewCount} {broker.reviewCount === 1 ? 'avaliação' : 'avaliações'}
            </div>
          ) : null}
          <PublicBrokerReviewButton brokerSlug={broker.slug} brokerName={broker.name} />
        </div>
      </div>

      {broker.reviews.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {broker.reviews.map((review) => (
            <article key={review.id} className="rounded-[1.5rem] border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{review.authorName}</p>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
                  {review.rating.toFixed(1).replace('.', ',')}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {review.verified ? <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : null}
                {review.verified ? 'Atendimento verificado' : 'Avaliação publicada'} · {review.publishedAtLabel}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-eme-50 text-primary">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-foreground">
              {hasAggregate ? 'Resumo disponível; comentários ainda não publicados' : 'Nenhuma avaliação publicada neste perfil'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {hasAggregate
                ? 'A nota e a quantidade acima vêm do cadastro real do corretor. O Marketplace ainda não possui comentários individuais vinculados a esses registros.'
                : 'A nota permanecerá oculta até existir uma avaliação válida, evitando estimativas ou depoimentos demonstrativos.'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
