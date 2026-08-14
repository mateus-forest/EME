'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import {
  emptyMarketplaceFilters,
  type MarketplaceFilters,
} from '@/lib/marketplace/search-filters'
import { StructuredInput } from '@/components/ui/structured-input'
import { searchIntents } from '@/lib/marketplace/search-intents'
import { cn } from '@/lib/utils'

const propertyTypes = [
  { value: 'casa', label: 'Casa' },
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'sobrado', label: 'Sobrado' },
] as const

const locations = ['Vacaria', 'Serra Gaúcha', 'Campos de Cima da Serra']
const featureOptions = [
  { value: 'patio', label: 'Pátio' },
  { value: 'mobiliado', label: 'Mobiliado' },
  { value: 'novo', label: 'Imóvel novo' },
]

export function MarketplaceFiltersDialog({
  open,
  filters,
  onClose,
  onApply,
  title = 'Buscar por filtros',
}: {
  open: boolean
  filters: MarketplaceFilters
  onClose: () => void
  onApply: (filters: MarketplaceFilters) => void
  title?: string
}) {
  const [draft, setDraft] = useState<MarketplaceFilters>(filters)

  useEffect(() => {
    if (open) setDraft({ ...filters, features: [...filters.features], intentions: [...filters.intentions] })
  }, [filters, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open])

  if (!open) return null

  function toggleFeature(value: string) {
    setDraft((current) => ({
      ...current,
      features: current.features.includes(value)
        ? current.features.filter((item) => item !== value)
        : [...current.features, value],
    }))
  }

  function toggleIntent(value: string) {
    setDraft((current) => ({
      ...current,
      intentions: current.intentions.includes(value)
        ? current.intentions.filter((item) => item !== value)
        : [...current.intentions, value],
    }))
  }

  const fieldClass =
    'h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10'

  return createPortal(
    <div className="marketplace-shell marketplace-overlay fixed inset-0 z-[100] flex items-end justify-center bg-transparent p-0 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
        aria-label="Fechar filtros"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-filters-title"
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-background shadow-[var(--shadow-float)] sm:max-w-2xl sm:rounded-[1.75rem]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 id="marketplace-filters-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Escolha só o que importa para sua busca.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="space-y-6">
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-foreground">Finalidade</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'compra', label: 'Comprar' },
                  { value: 'aluguel', label: 'Alugar' },
                ].map((option) => {
                  const active = draft.purpose === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDraft((current) => ({ ...current, purpose: option.value as 'compra' | 'aluguel' }))}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
                        active
                          ? 'border-primary/35 bg-eme-50 text-eme-700'
                          : 'border-border bg-card text-foreground hover:bg-secondary',
                      )}
                    >
                      {active && <Check className="h-4 w-4" aria-hidden="true" />}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-foreground">
                Tipo de imóvel
                <select
                  value={draft.propertyType || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    propertyType: (event.target.value || undefined) as MarketplaceFilters['propertyType'],
                  }))}
                  className={fieldClass}
                >
                  <option value="">Todos os tipos</option>
                  {propertyTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                Cidade ou região
                <select
                  value={draft.location || ''}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value || undefined }))}
                  className={fieldClass}
                >
                  <option value="">Todas as regiões</option>
                  {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="mb-3 text-sm font-medium text-foreground">Faixa de valor</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2 text-xs text-muted-foreground">
                  Mínimo
                  <StructuredInput
                    kind="currency"
                    value={draft.priceMin || ''}
                    onValueChange={(_, normalized) => setDraft((current) => ({ ...current, priceMin: typeof normalized === 'number' && normalized > 0 ? normalized / 100 : undefined }))}
                    placeholder="R$ 0"
                    aria-label="Preço mínimo"
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-2 text-xs text-muted-foreground">
                  Máximo
                  <StructuredInput
                    kind="currency"
                    value={draft.priceMax || ''}
                    onValueChange={(_, normalized) => setDraft((current) => ({ ...current, priceMax: typeof normalized === 'number' && normalized > 0 ? normalized / 100 : undefined }))}
                    placeholder="R$ 750.000"
                    aria-label="Preço máximo"
                    className={fieldClass}
                  />
                </label>
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { key: 'bedrooms', label: 'Quartos', placeholder: '3+' },
                { key: 'bathrooms', label: 'Banheiros', placeholder: '2+' },
                { key: 'parking', label: 'Vagas', placeholder: '1+' },
                { key: 'areaMin', label: 'Área mínima', placeholder: '100 m²' },
              ].map((field) => (
                <label key={field.key} className="space-y-2 text-xs text-muted-foreground sm:first:col-span-1">
                  {field.label}
                  <StructuredInput
                    kind={field.key === 'areaMin' ? 'decimal' : 'quantity'}
                    value={draft[field.key as keyof MarketplaceFilters] as number | undefined || ''}
                    onValueChange={(_, normalized) => setDraft((current) => ({
                      ...current,
                      [field.key]: typeof normalized === 'number' && normalized > 0 ? normalized : undefined,
                    }))}
                    placeholder={field.placeholder}
                    aria-label={field.label}
                    className={fieldClass}
                  />
                </label>
              ))}
            </div>

            <fieldset>
              <legend className="mb-3 text-sm font-medium text-foreground">Características</legend>
              <div className="flex flex-wrap gap-2">
                {featureOptions.map((option) => {
                  const active = draft.features.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleFeature(option.value)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm transition-colors',
                        active
                          ? 'border-primary/35 bg-eme-50 font-medium text-eme-700'
                          : 'border-border bg-card text-foreground hover:bg-secondary',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-sm font-medium text-foreground">O que importa para você</legend>
              <div className="flex flex-wrap gap-2">
                {searchIntents.map((intent) => {
                  const active = draft.intentions.includes(intent.slug)
                  return (
                    <button
                      key={intent.slug}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleIntent(intent.slug)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm transition-colors',
                        active
                          ? 'border-primary/35 bg-eme-50 font-medium text-eme-700'
                          : 'border-border bg-card text-foreground hover:bg-secondary',
                      )}
                    >
                      {intent.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border/70 bg-background px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDraft({ ...emptyMarketplaceFilters, features: [], intentions: [] })}
            className="rounded-full px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            Ver imóveis
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
