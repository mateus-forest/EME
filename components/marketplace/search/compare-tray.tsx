'use client'

import Image from 'next/image'
import { Scale, X } from 'lucide-react'
import { formatPrice, type SearchResult } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'

const MAX = 3

export function CompareTray({
  selected,
  onRemove,
  onClear,
  onCompare,
}: {
  selected: SearchResult[]
  onRemove: (slug: string) => void
  onClear: () => void
  onCompare: () => void
}) {
  if (selected.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300">
      <div className="glass-strong mx-auto flex w-full max-w-4xl items-center gap-3 rounded-2xl p-3 shadow-[var(--shadow-glass)] sm:gap-4 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto no-scrollbar">
          {Array.from({ length: MAX }).map((_, i) => {
            const item = selected[i]
            if (item) {
              return (
                <div
                  key={item.slug}
                  className="relative flex shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-card/80 py-1.5 pl-1.5 pr-3"
                >
                  <div className="relative h-10 w-12 overflow-hidden rounded-lg">
                    <Image src={item.image || '/marketplace/placeholder.svg'} alt="" fill sizes="48px" className="object-cover" />
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="max-w-[120px] truncate text-xs font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.slug)}
                    aria-label={`Remover ${item.title} da comparação`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )
            }
            return (
              <div
                key={`empty-${i}`}
                aria-hidden="true"
                className="hidden h-[52px] w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground sm:flex"
              >
                Adicionar
              </div>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onCompare}
            disabled={selected.length < 2}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-transform',
              selected.length < 2
                ? 'cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] hover:scale-[1.02] active:scale-95',
            )}
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
            Comparar
            {selected.length >= 2 && <span>({selected.length})</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
