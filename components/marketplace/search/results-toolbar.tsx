'use client'

import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Popover } from '@/components/marketplace/search/popover'
import { ViewToggle, type ResultsView } from '@/components/marketplace/search/view-toggle'
import { sortOptions, formatPrice, type SortValue } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'

export type QuickFilters = {
  precoMax?: number
  quartos?: number
  areaMin?: number
}

const priceOptions = [500000, 600000, 700000, 750000, 900000]
const roomOptions = [1, 2, 3, 4]
const areaOptions = [80, 100, 120, 140]

export function ResultsToolbar({
  count,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  onOpenMoreFilters,
  onClear,
  view,
  onViewChange,
}: {
  count: number
  sort: SortValue
  onSortChange: (value: SortValue) => void
  filters: QuickFilters
  onFiltersChange: (next: QuickFilters) => void
  onOpenMoreFilters: () => void
  onClear: () => void
  view: ResultsView
  onViewChange: (view: ResultsView) => void
}) {
  const sortLabel = sortOptions.find((o) => o.value === sort)?.label ?? 'Ordenar'
  const hasFilters = Boolean(filters.precoMax || filters.quartos || filters.areaMin)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{count}</span>{' '}
          {count === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
        </p>

        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={onViewChange} className="lg:hidden" />
          <Popover
            align="end"
            active={sort !== 'compatibilidade'}
            label={
              <>
                <ArrowUpDown className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="hidden sm:inline">{sortLabel}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </>
            }
          >
            {(close) => (
              <div role="radiogroup" aria-label="Ordenar resultados" className="flex flex-col">
                {sortOptions.map((option) => {
                  const active = option.value === sort
                  return (
                    <button
                      key={option.value}
                      role="radio"
                      aria-checked={active}
                      type="button"
                      onClick={() => {
                        onSortChange(option.value)
                        close()
                      }}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                        active ? 'font-medium text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {option.label}
                      {active && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}
          </Popover>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        <Popover
          active={Boolean(filters.precoMax)}
          label={
            <>
              {filters.precoMax ? `Até ${formatPrice(filters.precoMax)}` : 'Faixa de valor'}
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </>
          }
        >
          {(close) => (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Valor máximo</p>
              <div className="flex flex-col gap-1.5">
                {priceOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, precoMax: value })}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                      filters.precoMax === value ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Até {formatPrice(value)}
                    {filters.precoMax === value && (
                      <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, precoMax: undefined })}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </Popover>

        <Popover
          active={Boolean(filters.quartos)}
          label={
            <>
              {filters.quartos ? `${filters.quartos}+ quartos` : 'Quartos'}
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </>
          }
        >
          {(close) => (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Quartos (mínimo)</p>
              <div className="flex flex-wrap gap-2">
                {roomOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, quartos: value })}
                    className={cn(
                      'flex h-10 w-12 items-center justify-center rounded-xl border text-sm font-medium transition-colors',
                      filters.quartos === value
                        ? 'border-primary/40 bg-eme-50 text-eme-700'
                        : 'border-border text-foreground hover:bg-secondary',
                    )}
                  >
                    {value}+
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, quartos: undefined })}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </Popover>

        <Popover
          active={Boolean(filters.areaMin)}
          label={
            <>
              {filters.areaMin ? `${filters.areaMin} m²+` : 'Área'}
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </>
          }
        >
          {(close) => (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Área mínima</p>
              <div className="flex flex-wrap gap-2">
                {areaOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, areaMin: value })}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                      filters.areaMin === value
                        ? 'border-primary/40 bg-eme-50 text-eme-700'
                        : 'border-border text-foreground hover:bg-secondary',
                    )}
                  >
                    {value} m²+
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, areaMin: undefined })}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </Popover>

        <button
          type="button"
          onClick={onOpenMoreFilters}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-eme-50/50"
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
          Mais filtros
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="whitespace-nowrap rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
