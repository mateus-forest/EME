'use client'

import { useState } from 'react'
import { Check, Pencil, Sparkles, X } from 'lucide-react'
import type { Criterion } from '@/lib/marketplace/search-data'
import { SearchCriteriaChip } from '@/components/marketplace/search/search-criteria-chip'
import { cn } from '@/lib/utils'

export function SearchInterpretation({
  query,
  criteria,
  onSubmitQuery,
  onRemoveCriterion,
  onAdjustFilters,
}: {
  query: string
  criteria: Criterion[]
  onSubmitQuery: (value: string) => void
  onRemoveCriterion: (key: Criterion['key']) => void
  onAdjustFilters: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(query)
  const [composing, setComposing] = useState(false)

  function confirm() {
    const value = draft.trim()
    if (value) onSubmitQuery(value)
    setEditing(false)
  }

  return (
    <section aria-label="Interpretação da busca" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-eme-50 px-3 py-1 text-xs font-medium text-eme-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Busca por intenção
        </span>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Encontramos possibilidades para você.
        </h1>
      </div>

      {/* Campo da busca — mesmo padrão da home, em escala de resultados */}
      <div
        className={cn(
          'group flex items-center gap-3 rounded-2xl border bg-card p-2 pl-4 shadow-[var(--shadow-soft)] transition-all duration-300',
          editing
            ? 'border-primary/25 shadow-[0_8px_26px_rgba(16,24,20,0.08)] ring-2 ring-primary/5'
            : 'border-border',
        )}
      >
        <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !composing && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                confirm()
              }
              if (e.key === 'Escape') {
                setDraft(query)
                setEditing(false)
              }
            }}
            aria-label="Editar sua busca"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <p className="min-w-0 flex-1 truncate py-2 text-[15px] text-foreground">{query || 'Todos os imóveis publicados no Marketplace'}</p>
        )}

        {editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(query)
                setEditing(false)
              }}
              aria-label="Cancelar edição"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={confirm}
              aria-label="Confirmar nova busca"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(query)
              setEditing(true)
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-eme-50"
          >
            <Pencil className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Refinar busca
          </button>
        )}
      </div>

      {/* Painel translúcido "O que entendemos" */}
      <div className="glass-strong rounded-2xl p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">O que entendemos</p>
          <button
            type="button"
            onClick={onAdjustFilters}
            className="text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
          >
            Ajustar busca
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {criteria.length > 0 ? (
            criteria.map((criterion) => (
              <SearchCriteriaChip
                key={criterion.key}
                criterion={criterion}
                onRemove={onRemoveCriterion}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum critério ativo. Descreva o que procura para começar.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
