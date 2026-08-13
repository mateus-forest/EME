'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  MessageCircle,
  Minus,
  Paperclip,
  Send,
  X,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { searchResults, formatPrice, type SearchResult } from '@/lib/marketplace/search-data'
import { brokers } from '@/lib/marketplace/data'
import { AssistantMark } from '@/components/marketplace/assistant/assistant-mark'
import { EmeLoader } from '@/components/marketplace/eme-loader'
import { cn } from '@/lib/utils'

type ChatMessage = {
  id: number
  from: 'assistant' | 'user'
  text: string
}

type AssistantContextValue = {
  open: boolean
  openAssistant: () => void
  closeAssistant: () => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    from: 'assistant',
    text: 'Olá. Vou ajudar você a encontrar um imóvel que realmente combine com o que procura.',
  },
  {
    id: 2,
    from: 'user',
    text: 'Procuro uma casa em Vacaria, até R$ 750 mil, com 3 quartos e pátio.',
  },
  {
    id: 3,
    from: 'assistant',
    text: 'Encontrei algumas possibilidades. Antes de mostrar, o que pesa mais para você?',
  },
]

const intentOptions = ['Quero comprar', 'Quero alugar', 'Ainda estou pesquisando']
const priorityOptions = ['Pátio maior', 'Perto do centro', 'Imóvel mais novo']
const featured = searchResults.slice(0, 2)

export function useEmeAssistant() {
  const context = useContext(AssistantContext)
  if (!context) throw new Error('useEmeAssistant deve ser usado dentro de AssistantProvider')
  return context
}

function Bubble({ message }: { message: ChatMessage }) {
  const assistant = message.from === 'assistant'
  return (
    <div className={cn('flex items-end gap-2.5', !assistant && 'justify-end')}>
      {assistant && <AssistantMark size="sm" className="mb-1" />}
      <p
        className={cn(
          'max-w-[82%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm',
          assistant
            ? 'rounded-bl-md border border-border/70 bg-card text-foreground'
            : 'rounded-br-md bg-eme-50 text-foreground',
        )}
      >
        {message.text}
      </p>
    </div>
  )
}

function PropertySuggestion({
  property,
  onBroker,
}: {
  property: SearchResult
  onBroker: (property: SearchResult) => void
}) {
  return (
    <article className="min-w-[230px] flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-soft)]">
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={property.image}
          alt={property.title}
          fill
          sizes="260px"
          className="object-cover"
        />
      </div>
      <div className="p-3.5">
        <h3 className="text-pretty text-sm font-semibold leading-snug text-foreground">
          {property.title}
        </h3>
        <p className="mt-1 text-sm font-semibold text-primary">{formatPrice(property.price)}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {property.reasons[0]}. {property.bedrooms} quartos e {property.area} m².
        </p>
      </div>
      <div className="grid grid-cols-2 border-t border-border/60">
        <Link
          href={`/imoveis/imovel/${property.slug}`}
          className="inline-flex min-h-11 items-center justify-center gap-1 border-r border-border/60 px-2 text-xs font-medium text-primary transition-colors hover:bg-eme-50"
        >
          Ver imóvel <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => onBroker(property)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Falar com corretor
        </button>
      </div>
    </article>
  )
}

function QuickChoices({
  options,
  onChoose,
}: {
  options: string[]
  onChoose: (option: string) => void
}) {
  return (
    <div className="ml-9 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChoose(option)}
          className="rounded-full border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary"
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [handoff, setHandoff] = useState<SearchResult | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(10)

  const append = useCallback((from: ChatMessage['from'], text: string) => {
    setMessages((current) => [...current, { id: nextId.current++, from, text }])
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, handoff])

  function answer(text: string) {
    append('user', text)
    setThinking(true)
    window.setTimeout(() => {
      append(
        'assistant',
        text.includes('alugar')
          ? 'Entendi. Posso considerar valor mensal, localização e o que precisa estar pronto para a mudança.'
          : 'Perfeito. Vou considerar isso junto com localização, espaço e faixa de valor.',
      )
      setThinking(false)
    }, 650)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value || thinking) return
    setInput('')
    append('user', value)
    setThinking(true)
    window.setTimeout(() => {
      append(
        'assistant',
        'Entendi sua busca. Estes dois imóveis são os mais compatíveis agora. Você pode abrir os detalhes ou pedir que eu encaminhe a conversa ao corretor responsável.',
      )
      setThinking(false)
    }, 750)
  }

  function requestBroker(property: SearchResult) {
    setHandoff(property)
    append('user', `Quero falar com o corretor sobre ${property.title}.`)
    setThinking(true)
    window.setTimeout(() => {
      append(
        'assistant',
        `Certo. A ${brokers[0].name} é a responsável por este imóvel. Confirme abaixo e ela receberá o contexto desta conversa em uma futura integração.`,
      )
      setThinking(false)
    }, 650)
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="eme-assistant-title"
      className="fixed inset-0 z-[80] flex h-[100dvh] flex-col overflow-hidden bg-background shadow-[0_24px_80px_rgba(25,38,31,.22)] md:inset-y-5 md:left-auto md:right-5 md:h-auto md:w-[min(540px,calc(100vw-2.5rem))] md:rounded-[1.75rem] md:border md:border-border/70"
    >
      <header className="flex min-h-20 items-center gap-3 border-b border-border/60 bg-background/95 px-5 backdrop-blur-xl md:px-6">
        <AssistantMark size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id="eme-assistant-title" className="text-lg font-semibold tracking-tight text-foreground">
            Assistente EME
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(43,167,94,.10)]" />
            Tecnologia COS · online 24 horas
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hidden h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
          aria-label="Minimizar Assistente EME"
        >
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Fechar Assistente EME"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 py-5 md:px-5">
        <div className="flex flex-col gap-3.5">
          <Bubble message={messages[0]} />
          <QuickChoices options={intentOptions} onChoose={answer} />
          {messages.slice(1, 2).map((message) => <Bubble key={message.id} message={message} />)}
          {messages.slice(2, 3).map((message) => <Bubble key={message.id} message={message} />)}
          <QuickChoices options={priorityOptions} onChoose={answer} />

          <div className="ml-0 flex gap-3 overflow-x-auto pb-1 pl-9 no-scrollbar sm:pl-9">
            {featured.map((property) => (
              <PropertySuggestion key={property.slug} property={property} onBroker={requestBroker} />
            ))}
          </div>

          {messages.slice(3).map((message) => <Bubble key={message.id} message={message} />)}

          {thinking && (
            <div className="ml-9 flex items-center gap-2 text-xs text-muted-foreground">
              <EmeLoader size="sm" label="Assistente EME está pensando" />
              <span>Analisando sua busca...</span>
            </div>
          )}

          {handoff && !thinking && (
            <div className="ml-9 rounded-2xl border border-primary/20 bg-eme-50 p-4">
              <div className="flex items-center gap-3">
                <Image
                  src={brokers[0].image}
                  alt={brokers[0].name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {brokers[0].name}
                    <Check className="h-3.5 w-3.5 text-primary" aria-label="Verificada" />
                  </p>
                  <p className="text-xs text-muted-foreground">{brokers[0].role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => append('assistant', 'Encaminhamento demonstrativo confirmado. Nenhuma mensagem real foi enviada nesta etapa.')}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Confirmar encaminhamento
              </button>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                Demonstração local: nenhum dado ou mensagem será enviado.
              </p>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-border/60 bg-background p-3.5 md:p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[var(--shadow-soft)] focus-within:border-primary/35 focus-within:ring-4 focus-within:ring-primary/10">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Anexar arquivo — disponível em breve"
            title="Disponível em breve"
          >
            <Paperclip className="h-5 w-5" aria-hidden="true" />
          </button>
          <label htmlFor="eme-assistant-input" className="sr-only">Conte o que você procura</label>
          <input
            ref={inputRef}
            id="eme-assistant-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Conte o que você procura..."
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:scale-105 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  )
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open || window.matchMedia('(min-width: 768px)').matches) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <AssistantContext.Provider
      value={{ open, openAssistant: () => setOpen(true), closeAssistant: () => setOpen(false) }}
    >
      {children}
      {open && <AssistantPanel onClose={() => setOpen(false)} />}
    </AssistantContext.Provider>
  )
}
