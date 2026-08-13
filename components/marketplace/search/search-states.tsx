'use client'

import { Compass, LifeBuoy, RotateCcw, TriangleAlert } from 'lucide-react'
import { EmeLoader } from '@/components/marketplace/eme-loader'

export function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <EmeLoader size="sm" label="Buscando possibilidades" />
        <span>Buscando possibilidades para você...</span>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-[var(--shadow-soft)]"
          >
            <div className="aspect-[16/10] animate-pulse bg-secondary" />
            <div className="flex flex-col gap-3 p-5">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-secondary" />
              <div className="h-3 w-1/3 animate-pulse rounded-full bg-secondary" />
              <div className="mt-2 flex gap-3">
                <div className="h-3 w-16 animate-pulse rounded-full bg-secondary" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-secondary" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-secondary" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SearchEmptyState({
  onAdjust,
  onAlternatives,
  onHelp,
}: {
  onAdjust: () => void
  onAlternatives: () => void
  onHelp: () => void
}) {
  return (
    <div className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-14 text-center shadow-[var(--shadow-soft)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-eme-50 text-primary">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-balance text-xl font-semibold text-foreground">
        Ainda não encontramos uma opção com todos os critérios.
      </h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        Você pode ajustar a busca ou explorar possibilidades próximas.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onAdjust}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          Ajustar busca
        </button>
        <button
          type="button"
          onClick={onAlternatives}
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-eme-50"
        >
          Ver alternativas
        </button>
        <button
          type="button"
          onClick={onHelp}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
        >
          Pedir ajuda
        </button>
      </div>
    </div>
  )
}

export function SearchErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[1.75rem] border border-border/70 bg-card px-6 py-14 text-center shadow-[var(--shadow-soft)]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <TriangleAlert className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-balance text-xl font-semibold text-foreground">
        Não conseguimos carregar os imóveis agora.
      </h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
        Verifique sua conexão e tente novamente em instantes.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Tentar novamente
      </button>
    </div>
  )
}

export function IncompleteSearchHint({ onHelp }: { onHelp: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-eme-50/60 p-4 text-sm">
      <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-pretty text-foreground">
        Sua busca está bem ampla. Que tal informar a cidade, a finalidade e uma faixa de valor?{' '}
        <button
          type="button"
          onClick={onHelp}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Posso ajudar
        </button>
        .
      </p>
    </div>
  )
}
