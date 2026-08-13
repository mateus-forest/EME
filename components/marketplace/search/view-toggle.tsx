'use client'

import { List, Map } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ResultsView = 'lista' | 'mapa'

export function ViewToggle({
  view,
  onChange,
  className,
}: {
  view: ResultsView
  onChange: (view: ResultsView) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Alternar entre lista e mapa"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      {(
        [
          { value: 'lista' as const, label: 'Lista', Icon: List },
          { value: 'mapa' as const, label: 'Mapa', Icon: Map },
        ]
      ).map(({ value, label, Icon }) => {
        const active = view === value
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
