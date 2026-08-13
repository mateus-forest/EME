'use client'

import { Home, KeyRound, MapPin, TreePine, Wallet, X } from 'lucide-react'
import type { Criterion } from '@/lib/marketplace/search-data'

const icons = {
  buy: KeyRound,
  home: Home,
  pin: MapPin,
  wallet: Wallet,
  tree: TreePine,
} as const

export function SearchCriteriaChip({
  criterion,
  onRemove,
}: {
  criterion: Criterion
  onRemove: (key: Criterion['key']) => void
}) {
  const Icon = icons[criterion.icon]
  return (
    <span className="group inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/70 py-1.5 pl-3 pr-2 text-sm text-foreground shadow-[var(--shadow-soft)] transition-colors hover:border-primary/30">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      {criterion.label}
      <button
        type="button"
        onClick={() => onRemove(criterion.key)}
        aria-label={`Remover critério ${criterion.label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  )
}
