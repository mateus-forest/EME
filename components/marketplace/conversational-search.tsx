'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConversationalSearch({
  placeholder,
  className,
  showIcon = true,
  size = 'md',
  purpose,
}: {
  placeholder: string
  className?: string
  showIcon?: boolean
  size?: 'md' | 'lg'
  // Finalidade da busca. Quando informada, é anexada à rota de resultados.
  purpose?: 'compra' | 'aluguel'
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [composing, setComposing] = useState(false)

  function submit() {
    // Leva a consulta em linguagem natural para a página de resultados.
    const query = value.trim()
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (purpose) params.set('finalidade', purpose)
    const qs = params.toString()
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
        'group flex items-center gap-2 rounded-full border border-border bg-card shadow-[var(--shadow-soft)] transition-all duration-300',
        'focus-within:border-primary/40 focus-within:shadow-[var(--shadow-float)] focus-within:ring-4 focus-within:ring-primary/10',
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
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground',
          lg ? 'py-2.5 text-base' : 'py-2 text-[15px]',
        )}
      />
      <button
        type="submit"
        aria-label="Buscar imóveis"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] transition-all duration-200 hover:scale-105 hover:bg-eme-600 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          lg ? 'h-12 w-12' : 'h-11 w-11',
        )}
      >
        <ArrowRight className={cn(lg ? 'h-5 w-5' : 'h-5 w-5')} aria-hidden="true" />
      </button>
    </form>
  )
}
