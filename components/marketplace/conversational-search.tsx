'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Sparkles } from 'lucide-react'
import { useMarketplaceSearchLoading } from '@/components/marketplace/search/cinematic-search-loading'
import { cn } from '@/lib/utils'
import {
  CATALOG_GLASS_SURFACE_CLASS,
  CATALOG_PRIMARY_CTA_CLASS,
} from '@/lib/catalog-visual-system'

export function ConversationalSearch({
  placeholder,
  className,
  showIcon = true,
  size = 'md',
  purpose,
  value: controlledValue,
  onValueChange,
  onSubmitQuery,
}: {
  placeholder: string
  className?: string
  showIcon?: boolean
  size?: 'md' | 'lg'
  // Finalidade da busca. Quando informada, é anexada à rota de resultados.
  purpose?: 'compra' | 'aluguel'
  value?: string
  onValueChange?: (value: string) => void
  onSubmitQuery?: (value: string) => void
}) {
  const router = useRouter()
  const { startSearchLoading } = useMarketplaceSearchLoading()
  const [internalValue, setInternalValue] = useState('')
  const [composing, setComposing] = useState(false)
  const value = controlledValue ?? internalValue

  function submit() {
    // Leva a consulta em linguagem natural para a página de resultados.
    const query = value.trim()
    if (onSubmitQuery) {
      onSubmitQuery(query)
      return
    }
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (purpose) params.set('finalidade', purpose)
    const qs = params.toString()
    startSearchLoading()
    router.push(qs ? `/imoveis/busca?${qs}` : '/imoveis/busca')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    if (composing || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    submit()
  }

  const lg = size === 'lg'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className={cn(
        CATALOG_GLASS_SURFACE_CLASS,
        'marketplace-field group flex items-center gap-2 overflow-visible rounded-full transition-[border-color,box-shadow] duration-200',
        lg ? 'p-2.5 pl-5' : 'p-2 pl-4',
        className,
      )}
    >
      {showIcon && (
        <Sparkles
          className={cn(
            'shrink-0 text-primary transition-transform duration-300 group-focus-within:scale-110',
            lg ? 'h-5 w-5' : 'h-5 w-5',
          )}
          aria-hidden="true"
        />
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setInternalValue(e.target.value)
          onValueChange?.(e.target.value)
        }}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/80',
          lg ? 'py-2.5 text-[15px] placeholder:text-sm' : 'py-2 text-sm',
        )}
      />
      <button
        type="submit"
        aria-label="Buscar imóveis"
        className={cn(
          CATALOG_PRIMARY_CTA_CLASS,
          'flex shrink-0 items-center justify-center transition-transform duration-200 hover:scale-[1.03] active:scale-95',
          lg ? 'h-12 w-12' : 'h-11 w-11',
        )}
      >
        <Search className={cn(lg ? 'h-5 w-5' : 'h-5 w-5')} aria-hidden="true" />
      </button>
    </form>
  )
}
