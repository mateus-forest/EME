'use client'

import { MapPin, Minus, Plus } from 'lucide-react'
import type { SearchResult } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'

function shortPrice(value: number) {
  return `R$ ${Math.round(value / 1000)} mil`
}

export function ResultsMap({
  results,
  highlighted,
  onHover,
  onSelect,
  className,
}: {
  results: SearchResult[]
  highlighted: string | null
  onHover: (slug: string | null) => void
  onSelect: (slug: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-[1.75rem] border border-border/70 bg-muted shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      {/* Mapa demonstrativo — sem serviços externos, apenas textura visual coerente */}
      <svg
        viewBox="0 0 400 500"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect width="400" height="500" fill="var(--color-muted)" />
        {/* Áreas verdes suaves (praças e parques) */}
        <path d="M-20 60 Q 80 20 150 70 T 320 60 L 340 -20 -40 -20 Z" fill="var(--color-eme-50)" opacity="0.7" />
        <ellipse cx="70" cy="360" rx="90" ry="70" fill="var(--color-eme-50)" opacity="0.7" />
        <ellipse cx="330" cy="420" rx="80" ry="90" fill="var(--color-eme-50)" opacity="0.6" />
        {/* Rio discreto */}
        <path
          d="M-20 250 C 120 210 180 320 400 270"
          stroke="var(--color-eme-100)"
          strokeWidth="14"
          fill="none"
          opacity="0.6"
          strokeLinecap="round"
        />
        {/* Ruas discretas */}
        <g stroke="var(--color-border)" strokeWidth="2" opacity="0.9">
          <line x1="0" y1="120" x2="400" y2="150" />
          <line x1="0" y1="220" x2="400" y2="250" />
          <line x1="0" y1="330" x2="400" y2="360" />
          <line x1="0" y1="440" x2="400" y2="460" />
          <line x1="90" y1="0" x2="120" y2="500" />
          <line x1="210" y1="0" x2="230" y2="500" />
          <line x1="320" y1="0" x2="330" y2="500" />
        </g>
        <g stroke="var(--color-border)" strokeWidth="1" opacity="0.55">
          <line x1="0" y1="70" x2="400" y2="95" />
          <line x1="0" y1="385" x2="400" y2="410" />
          <line x1="155" y1="0" x2="175" y2="500" />
          <line x1="265" y1="0" x2="280" y2="500" />
        </g>
      </svg>

      {/* Rótulo da região */}
      <div className="glass-strong absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)]">
        <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Vacaria · RS
      </div>

      {/* Controles mínimos (decorativos) */}
      <div className="glass-strong absolute right-4 top-4 flex flex-col overflow-hidden rounded-full shadow-[var(--shadow-soft)]">
        <button
          type="button"
          aria-label="Aproximar (demonstrativo)"
          className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-eme-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="h-px w-full bg-border" aria-hidden="true" />
        <button
          type="button"
          aria-label="Afastar (demonstrativo)"
          className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-eme-50"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Marcadores */}
      {results.map((result) => {
        const active = highlighted === result.slug
        return (
          <button
            key={result.slug}
            type="button"
            onMouseEnter={() => onHover(result.slug)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(result.slug)}
            aria-pressed={active}
            aria-label={`${result.title} — ${shortPrice(result.price)}`}
            style={{ left: `${result.map.x}%`, top: `${result.map.y}%` }}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-float)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'z-20 scale-110 bg-primary text-primary-foreground'
                : 'z-10 bg-card text-foreground ring-1 ring-border hover:bg-eme-50',
            )}
          >
            {shortPrice(result.price)}
          </button>
        )
      })}
    </div>
  )
}
