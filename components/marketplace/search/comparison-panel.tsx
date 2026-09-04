'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, Minus, Sparkles, X } from 'lucide-react'
import { formatPrice, type SearchResult } from '@/lib/marketplace/search-data'
import { comparisonInsights } from '@/lib/marketplace/comparison-analysis'
import { formatLocation, formatPositiveArea } from '@/lib/structured-fields'
import { cn } from '@/lib/utils'

const rows: { label: string; get: (r: SearchResult) => string }[] = [
  { label: 'Valor', get: (r) => formatPrice(r.price) },
  { label: 'Área', get: (r) => formatPositiveArea(r.area) || 'Não informado' },
  { label: 'Quartos', get: (r) => r.bedrooms > 0 ? String(r.bedrooms) : 'Não informado' },
  { label: 'Suítes', get: (r) => r.suites > 0 ? String(r.suites) : 'Não informado' },
  { label: 'Banheiros', get: (r) => r.bathrooms > 0 ? String(r.bathrooms) : 'Não informado' },
  { label: 'Vagas', get: (r) => r.parking > 0 ? String(r.parking) : 'Não informado' },
  { label: 'Localização', get: (r) => formatLocation(r.city, r.state, ' · ') || 'Não informado' },
]

export function ComparisonPanel({
  open,
  onClose,
  results,
}: {
  open: boolean
  onClose: () => void
  results: SearchResult[]
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const cheapest = Math.min(...results.map((r) => r.price))
  const largest = Math.max(...results.map((r) => r.area))
  const insights = comparisonInsights(results, 4)
  const completeHref = `/imoveis/comparar?imoveis=${results.map((result) => result.slug).join(',')}`

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fechar comparação"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comparação de imóveis"
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-[var(--shadow-float)] sm:max-w-4xl sm:rounded-3xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Comparação lado a lado</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {results.length} {results.length === 1 ? 'imóvel selecionado' : 'imóveis selecionados'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div
            className="grid min-w-[520px] gap-4"
            style={{ gridTemplateColumns: `120px repeat(${results.length}, minmax(140px, 1fr))` }}
          >
            {/* Cabeçalho: fotografia + título + preço */}
            <div aria-hidden="true" />
            {results.map((r) => (
              <div key={r.slug} className="flex flex-col gap-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image src={r.image || '/marketplace/placeholder.svg'} alt={r.title} fill sizes="180px" className="object-cover" />
                </div>
                <h3 className="text-pretty text-sm font-medium leading-snug text-foreground">{r.title}</h3>
              </div>
            ))}

            {/* Linhas de atributos */}
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <div className="flex items-center border-t border-border/60 py-3 text-sm font-medium text-muted-foreground">
                  {row.label}
                </div>
                {results.map((r) => {
                  const isBest =
                    (row.label === 'Valor' && r.price === cheapest) ||
                    (row.label === 'Área' && r.area === largest)
                  return (
                    <div
                      key={r.slug + row.label}
                      className={cn(
                        'flex items-center border-t border-border/60 py-3 text-sm',
                        isBest ? 'font-semibold text-foreground' : 'text-foreground',
                      )}
                    >
                      {row.get(r)}
                      {isBest && (
                        <Sparkles className="ml-1.5 h-3.5 w-3.5 text-primary" aria-label="Destaque" />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Pátio */}
            <div className="contents">
              <div className="flex items-center border-t border-border/60 py-3 text-sm font-medium text-muted-foreground">
                Pátio
              </div>
              {results.map((r) => (
                <div key={r.slug + 'patio'} className="flex items-center border-t border-border/60 py-3 text-sm text-foreground">
                  {r.patio ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Check className="h-4 w-4" aria-hidden="true" /> Sim
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Minus className="h-4 w-4" aria-hidden="true" /> Não
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-eme-50 p-4 text-sm text-eme-700">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <ul className="space-y-1.5">
                {insights.map((insight) => <li key={insight}>{insight}</li>)}
              </ul>
            </div>
            <Link
              href={completeHref}
              onClick={onClose}
              className="mt-4 inline-flex items-center gap-1.5 font-semibold text-primary transition-colors hover:text-eme-700"
            >
              Abrir análise completa
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
