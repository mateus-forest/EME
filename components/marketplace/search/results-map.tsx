'use client'

import { useState } from 'react'
import { MapPin, Minus, Plus } from 'lucide-react'
import type { SearchResult } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'

const shortPrice = (value: number) => `R$ ${Math.round(value / 1000)} mil`

export function ResultsMap({ results, highlighted, onHover, onSelect, className }: {
  results: SearchResult[]
  highlighted: string | null
  onHover: (slug: string | null) => void
  onSelect: (slug: string) => void
  className?: string
}) {
  const [zoom, setZoom] = useState(1)
  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-[1.75rem] border border-border/70 bg-muted shadow-[var(--shadow-soft)]', className)}>
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full transition-transform duration-300" style={{ transform: `scale(${zoom})` }} aria-hidden="true">
        <rect width="400" height="500" fill="#f4f3ef" />
        <g fill="#ecebe6" stroke="#e0dfd8" strokeWidth="1">
          <path d="M18 35 102 20 112 88 28 99Z" /><path d="m128 18 78 5-2 77-82-7Z" /><path d="m225 25 68-8 13 79-78 8Z" /><path d="m320 14 72 12-4 73-68-8Z" />
          <path d="m20 132 83-12 11 66-93 8Z" /><path d="m140 126 71-8 4 76-78 5Z" /><path d="m246 127 67-12 11 69-82 13Z" /><path d="m341 118 57 9-5 61-55-3Z" />
          <path d="m17 225 94-10 4 77-99 7Z" /><path d="m143 226 73-7 7 66-84 10Z" /><path d="m249 222 72-8 4 69-82 8Z" /><path d="m344 218 52 7-1 62-55-1Z" />
          <path d="m17 329 91-7 6 69-96 9Z" /><path d="m141 326 78-10 4 72-82 9Z" /><path d="m250 320 76-8 2 72-79 8Z" /><path d="m347 316 51 4-4 68-54-3Z" />
          <path d="m18 430 90-8 5 70-94 4Z" /><path d="m142 421 79-5 5 77-82 3Z" /><path d="m252 418 74-5 7 80-82 2Z" /><path d="m350 414 48 7-2 72-57-2Z" />
        </g>
        <g fill="none" strokeLinecap="round">
          <path d="M-20 111 C82 96 152 116 230 102 S340 83 430 110" stroke="#fff" strokeWidth="18" />
          <path d="M-20 111 C82 96 152 116 230 102 S340 83 430 110" stroke="#d5d3ca" strokeWidth="1.5" />
          <path d="M122-20 C115 82 128 158 120 236 S104 402 128 530" stroke="#fff" strokeWidth="20" />
          <path d="M122-20 C115 82 128 158 120 236 S104 402 128 530" stroke="#d5d3ca" strokeWidth="1.5" />
          <path d="M-20 306 C80 292 156 315 240 296 S342 271 430 291" stroke="#fff" strokeWidth="14" />
          <path d="M-20 306 C80 292 156 315 240 296 S342 271 430 291" stroke="#dddcd5" strokeWidth="1" />
          <path d="M232-20 C224 98 239 174 231 254 S217 414 238 530" stroke="#fff" strokeWidth="12" />
        </g>
        <g fill="var(--color-eme-50)" opacity="0.9"><path d="M270 335Q330 305 407 335L405 407Q335 421 276 392Z" /><ellipse cx="63" cy="252" rx="34" ry="24" /></g>
        <g fill="#8c8b84" fontFamily="sans-serif" fontSize="10"><text x="150" y="104">Av. Militar</text><text x="132" y="279" transform="rotate(-87 132 279)">Rua Júlio de Castilhos</text><text x="270" y="288">Centro</text><text x="292" y="365">Praça Daltro Filho</text><text x="34" y="252">Bela Vista</text></g>
      </svg>

      <div className="glass-strong absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)]">
        <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Vacaria · RS
      </div>
      <div className="glass-strong absolute right-4 top-4 flex flex-col overflow-hidden rounded-full shadow-[var(--shadow-soft)]">
        <button type="button" aria-label="Aproximar mapa demonstrativo" onClick={() => setZoom((value) => Math.min(1.12, Number((value + 0.04).toFixed(2))))} disabled={zoom >= 1.12} className="grid h-9 w-9 place-items-center text-foreground transition-colors hover:bg-eme-50 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
        <span className="h-px bg-border" />
        <button type="button" aria-label="Afastar mapa demonstrativo" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.04).toFixed(2))))} disabled={zoom <= 1} className="grid h-9 w-9 place-items-center text-foreground transition-colors hover:bg-eme-50 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
      </div>
      {results.map((result) => {
        const active = highlighted === result.slug
        return <button key={result.slug} type="button" onMouseEnter={() => onHover(result.slug)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(result.slug)} aria-pressed={active} aria-label={`${result.title} — ${shortPrice(result.price)}`} style={{ left: `${result.map.x}%`, top: `${result.map.y}%` }} className={cn('absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-float)] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', active ? 'z-20 scale-110 bg-primary text-primary-foreground' : 'z-10 bg-card text-foreground ring-1 ring-border hover:bg-eme-50')}>{shortPrice(result.price)}</button>
      })}
    </div>
  )
}
