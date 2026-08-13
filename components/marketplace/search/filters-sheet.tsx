'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { moreFilterGroups } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'

export function FiltersSheet({
  open,
  onClose,
  selected,
  onToggle,
  onClear,
}: {
  open: boolean
  onClose: () => void
  selected: Set<string>
  onToggle: (value: string) => void
  onClear: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Fechar filtros"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mais filtros"
        className={cn(
          'relative flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-background shadow-[var(--shadow-float)]',
          'sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-3xl',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom sm:motion-safe:slide-in-from-right motion-safe:duration-300',
        )}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">Mais filtros</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-7">
            {moreFilterGroups.map((group) => (
              <fieldset key={group.legend}>
                <legend className="mb-3 text-sm font-medium text-foreground">{group.legend}</legend>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const active = selected.has(`${group.legend}:${option}`)
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onToggle(`${group.legend}:${option}`)}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm transition-colors',
                          active
                            ? 'border-primary/40 bg-eme-50 font-medium text-eme-700'
                            : 'border-border text-foreground hover:bg-secondary',
                        )}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                Preço mínimo
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0"
                  className="rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                Preço máximo
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 750.000"
                  className="rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                Área mínima
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="80 m²"
                  className="rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                Área máxima
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="300 m²"
                  className="rounded-xl border border-border bg-card px-3 py-2 text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-6 py-4">
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  )
}
