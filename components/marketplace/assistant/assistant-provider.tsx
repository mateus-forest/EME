'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  MapPin,
  MessageCircle,
  Minus,
  Paperclip,
  Send,
  Star,
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
import { formatPrice, type SearchProperty } from '@/lib/marketplace/search-data'
import {
  filterSearchResults,
  inferMarketplaceFilters,
} from '@/lib/marketplace/search-filters'
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

export type AssistantBroker = {
  slug: string
  name: string
  image: string
  specialty: string
  verified: boolean
  region?: string
  creci?: string
  about?: string
  activeListings?: number
  rating?: number
  reviewCount?: number
  transaction?: 'compra' | 'aluguel' | 'ambos'
}

type AssistantBrokerMatch = {
  broker: AssistantBroker
  area: string
  score: number
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

const defaultInitialMessage = 'Olá. Conte o que procura e eu vou analisar os imóveis publicados e os corretores cadastrados no Marketplace EME.'

const intentOptions = ['Quero comprar', 'Quero alugar', 'Ainda estou pesquisando']
const priorityOptions = ['Pátio maior', 'Perto do centro', 'Imóvel mais novo']

const brokerIntentPattern = /\b(corretor(?:a|es|as)?|profissiona(?:l|is)(?:\s+imobiliari[oa]s?)?|consultor(?:a|es|as)?\s+imobiliari[oa]s?|quem\s+(?:vende|trabalha\s+com)\s+imoveis|falar\s+com\s+(?:um|uma)?\s*(?:corretor|profissional))\b/
const brokerSearchStopWords = new Set([
  'a', 'as', 'com', 'corretor', 'corretora', 'corretoras', 'corretores', 'da', 'das', 'de', 'do', 'dos',
  'e', 'em', 'falar', 'imobiliaria', 'imobiliarias', 'imobiliario', 'imobiliarios', 'imoveis', 'mais',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'para', 'por', 'profissionais', 'profissional', 'que', 'quem',
  'quero', 'um', 'uma', 'vende',
])

function normalizeAssistantText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

function meaningfulTokens(value: string) {
  return normalizeAssistantText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !brokerSearchStopWords.has(token))
}

function isBrokerDiscoveryIntent(value: string) {
  return brokerIntentPattern.test(normalizeAssistantText(value))
}

function brokerLocations(broker: AssistantBroker, properties: SearchProperty[]) {
  const locations = properties
    .filter((property) => property.brokerSlug === broker.slug)
    .flatMap((property) => [property.city, property.neighborhood, property.region])
  if (broker.region && !normalizeAssistantText(broker.region).includes('nao informada')) locations.unshift(broker.region)
  return [...new Set(locations.map((location) => location?.trim()).filter((location): location is string => Boolean(location)))]
}

function inferBrokerLocation(text: string, brokers: AssistantBroker[], properties: SearchProperty[]) {
  const query = normalizeAssistantText(text)
  const queryTokens = new Set(meaningfulTokens(query))
  const knownLocations = [...new Set(brokers.flatMap((broker) => brokerLocations(broker, properties)))]
  const knownMatch = knownLocations
    .map((location) => ({ location, normalized: normalizeAssistantText(location) }))
    .filter(({ normalized }) => (
      query.includes(normalized) || meaningfulTokens(normalized).some((token) => token.length >= 5 && queryTokens.has(token))
    ))
    .sort((left, right) => right.normalized.length - left.normalized.length)[0]

  if (knownMatch) return knownMatch.location

  const explicitLocation = query.match(/\b(?:em|na|no)\s+([a-z][a-z\s-]{2,60}?)(?:\?|!|\.|,|$)/)?.[1]
    || query.match(/\b(?:corretor(?:a|es|as)?|profissiona(?:l|is))\s+(?:de|da|do)\s+([a-z][a-z\s-]{2,60}?)(?:\?|!|\.|,|$)/)?.[1]
  return explicitLocation?.trim() || ''
}

function locationMatchesBroker(location: string, broker: AssistantBroker, properties: SearchProperty[]) {
  if (!location) return true
  const normalizedLocation = normalizeAssistantText(location)
  const locationTokens = meaningfulTokens(normalizedLocation)
  return brokerLocations(broker, properties).some((candidate) => {
    const normalizedCandidate = normalizeAssistantText(candidate)
    const candidateTokens = new Set(meaningfulTokens(normalizedCandidate))
    return normalizedCandidate.includes(normalizedLocation)
      || normalizedLocation.includes(normalizedCandidate)
      || locationTokens.some((token) => token.length >= 5 && candidateTokens.has(token))
  })
}

function findBrokerMatches(text: string, brokers: AssistantBroker[], properties: SearchProperty[]) {
  const query = normalizeAssistantText(text)
  const location = inferBrokerLocation(text, brokers, properties)
  const locationTokens = new Set(meaningfulTokens(location))
  const specialtyTokens = meaningfulTokens(query).filter((token) => !locationTokens.has(token))
  const requiresVerified = /\b(verificad[oa]s?|creci|credenciad[oa]s?)\b/.test(query)
  const valuesTrust = requiresVerified || /\b(confiavel|confiaveis|segur[oa]s?)\b/.test(query)

  return brokers
    .map((broker): AssistantBrokerMatch | null => {
      const locations = brokerLocations(broker, properties)
      const regionFit = locationMatchesBroker(location, broker, properties)
      if ((location && !regionFit) || (requiresVerified && !broker.verified)) return null

      const expertise = new Set(meaningfulTokens(broker.specialties.join(' ')))
      const specialtyFit = specialtyTokens.filter((token) => expertise.has(token)).length
      const rating = broker.reviewCount ? broker.rating || 0 : 0
      const score = (regionFit && location ? 80 : 0)
        + specialtyFit * 12
        + (valuesTrust && broker.verified ? 14 : 0)
        + rating * 2
        + Math.min(broker.reviewCount || 0, 10)
        + Math.min(broker.activeListings || 0, 10)

      return {
        broker,
        area: locations[0] || broker.region || 'Área de atuação não informada',
        score,
      }
    })
    .filter((match): match is AssistantBrokerMatch => Boolean(match))
    .sort((left, right) => right.score - left.score || left.broker.name.localeCompare(right.broker.name, 'pt-BR'))
    .slice(0, 5)
}
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
  href,
  onNavigate,
  hideUnavailableFacts,
  preventNavigation,
}: {
  property: SearchProperty
  onBroker: (property: SearchProperty) => void
  href: string
  onNavigate: () => void
  hideUnavailableFacts: boolean
  preventNavigation: boolean
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
          {hideUnavailableFacts ? (
            <>
              {property.reasons[0]}
              {property.bedrooms > 0 ? ` · ${property.bedrooms} ${property.bedrooms === 1 ? 'quarto' : 'quartos'}` : ''}
              {property.area > 0 ? ` · ${property.area} m²` : ''}.
            </>
          ) : `${property.reasons[0]}. ${property.bedrooms} quartos e ${property.area} m².`}
        </p>
      </div>
      <div className="grid grid-cols-2 border-t border-border/60">
        <Link
          href={href}
          onClick={(event) => {
            if (preventNavigation) event.preventDefault()
            onNavigate()
          }}
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

function BrokerSuggestion({
  match,
  href,
  onNavigate,
  preventNavigation,
}: {
  match: AssistantBrokerMatch
  href: string
  onNavigate: () => void
  preventNavigation: boolean
}) {
  const { broker, area } = match
  const hasCreci = Boolean(broker.creci && !normalizeAssistantText(broker.creci).includes('nao informado'))
  const hasReviews = Boolean(broker.reviewCount && broker.rating)

  return (
    <article className="min-w-[250px] flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-soft)]">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Image
            src={broker.image}
            alt={broker.name}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h3 className="text-pretty text-sm font-semibold leading-snug text-foreground">{broker.name}</h3>
              {broker.verified ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" /> : null}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{broker.specialties.join(' · ')}</p>
          </div>
        </div>

        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{area}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {hasCreci ? <span className="rounded-full border border-border px-2.5 py-1">{broker.creci}</span> : null}
            {broker.verified ? <span className="rounded-full bg-eme-50 px-2.5 py-1 font-medium text-primary">Verificado</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className={cn('h-3.5 w-3.5 text-primary', hasReviews && 'fill-primary')} aria-hidden="true" />
              {hasReviews ? `${broker.rating?.toFixed(1).replace('.', ',')} · ${broker.reviewCount} avaliações` : 'Perfil novo'}
            </span>
            {typeof broker.activeListings === 'number' ? <span>{broker.activeListings} imóveis ativos</span> : null}
          </div>
        </div>
      </div>

      <Link
        href={href}
        onClick={(event) => {
          if (preventNavigation) event.preventDefault()
          onNavigate()
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-border/60 px-3 text-xs font-semibold text-primary transition-colors hover:bg-eme-50"
      >
        Ver perfil e entrar em contato <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
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

function AssistantPanel({
  onClose,
  properties,
  brokers,
  initialMessage,
  propertyHref,
  brokerHref,
  confirmedVerificationOnly,
  hideUnavailablePropertyFacts,
  onPropertySelect,
  onBrokerSelect,
}: {
  onClose: () => void
  properties: SearchProperty[]
  brokers: AssistantBroker[]
  initialMessage: string
  propertyHref: (property: SearchProperty) => string
  brokerHref: (broker: AssistantBroker) => string
  confirmedVerificationOnly: boolean
  hideUnavailablePropertyFacts: boolean
  onPropertySelect?: (property: SearchProperty) => void
  onBrokerSelect?: (broker: AssistantBroker) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, from: 'assistant', text: initialMessage },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [matchedProperties, setMatchedProperties] = useState<SearchProperty[]>([])
  const [matchedBrokers, setMatchedBrokers] = useState<AssistantBrokerMatch[]>([])
  const [handoff, setHandoff] = useState<SearchProperty | null>(null)
  const handoffBroker = handoff ? brokers.find((broker) => broker.slug === handoff.brokerSlug) : null
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(10)

  const append = useCallback((from: ChatMessage['from'], text: string) => {
    setMessages((current) => [...current, { id: nextId.current++, from, text }])
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, handoff, matchedBrokers, matchedProperties])

  function runAssistantSearch(text: string) {
    append('user', text)
    setHandoff(null)
    setThinking(true)

    if (isBrokerDiscoveryIntent(text)) {
      const location = inferBrokerLocation(text, brokers, properties)
      const matches = findBrokerMatches(text, brokers, properties)
      setMatchedProperties([])
      setMatchedBrokers(matches)
      window.setTimeout(() => {
        if (!matches.length) {
          append(
            'assistant',
            `Não encontrei corretor cadastrado${location ? ` com atuação compatível em ${location}` : ' compatível com esses critérios'} agora. Tente ampliar a região ou retirar um dos critérios para eu buscar novamente.`,
          )
        } else {
          append(
            'assistant',
            `Encontrei ${matches.length} ${matches.length === 1 ? 'corretor cadastrado' : 'corretores cadastrados'}${location ? ` com atuação compatível em ${location}` : ''}. Ordenei os profissionais por aderência da área de atuação, especialidade e métricas públicas disponíveis.`,
          )
        }
        setThinking(false)
      }, 420)
      return
    }

    const broadSearch = text === 'Ainda estou pesquisando'
    const inferred = inferMarketplaceFilters(broadSearch ? '' : text, properties)
    const matches = filterSearchResults(properties, inferred, broadSearch ? '' : text).slice(0, 3)
    setMatchedBrokers([])
    setMatchedProperties(matches)
    window.setTimeout(() => {
      if (!matches.length) {
        append('assistant', 'Não encontrei um imóvel publicado que atenda a esses sinais agora. Tente ampliar a localização ou retirar um dos critérios para eu buscar novamente.')
      } else {
        const refinement = !inferred.purpose
          ? ' Diga se pretende comprar ou alugar para eu refinar.'
          : !inferred.priceMin && !inferred.priceMax
            ? ' Se informar sua faixa de valor, o ranking fica ainda mais preciso.'
            : !inferred.location
              ? ' Você também pode indicar cidade ou bairro.'
              : ''
        append(
          'assistant',
          `Encontrei ${matches.length} ${matches.length === 1 ? 'imóvel publicado' : 'imóveis publicados'} com melhor aderência. A ordem considera os atributos cadastrados e os motivos aparecem em cada opção.${refinement}`,
        )
      }
      setThinking(false)
    }, 420)
  }

  function answer(text: string) {
    runAssistantSearch(text)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value || thinking) return
    setInput('')
    runAssistantSearch(value)
  }

  function requestBroker(property: SearchProperty) {
    setHandoff(property)
    append('user', `Quero falar com o corretor sobre ${property.title}.`)
    append(
      'assistant',
      `Certo. Abra o perfil de ${brokers.find((broker) => broker.slug === property.brokerSlug)?.name || 'quem atende este imóvel'} para continuar pelo canal de contato disponível.`,
    )
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
          {messages.map((message) => <Bubble key={message.id} message={message} />)}
          {messages.length === 1 && (
            <>
              <QuickChoices options={intentOptions} onChoose={answer} />
              <QuickChoices options={priorityOptions} onChoose={answer} />
            </>
          )}

          {matchedBrokers.length > 0 && (
            <div className="ml-0 flex gap-3 overflow-x-auto pb-1 pl-9 no-scrollbar sm:pl-9" aria-label="Corretores sugeridos pelo Assistente EME">
              {matchedBrokers.map((match) => (
                <BrokerSuggestion
                  key={match.broker.slug}
                  match={match}
                  href={brokerHref(match.broker)}
                  onNavigate={() => {
                    onClose()
                    onBrokerSelect?.(match.broker)
                  }}
                  preventNavigation={Boolean(onBrokerSelect)}
                />
              ))}
            </div>
          )}

          {matchedProperties.length > 0 && (
            <div className="ml-0 flex gap-3 overflow-x-auto pb-1 pl-9 no-scrollbar sm:pl-9" aria-label="Imóveis sugeridos pelo Assistente EME">
              {matchedProperties.map((property) => (
                <PropertySuggestion
                  key={property.slug}
                  property={property}
                  onBroker={requestBroker}
                  href={propertyHref(property)}
                  onNavigate={() => {
                    onClose()
                    onPropertySelect?.(property)
                  }}
                  hideUnavailableFacts={hideUnavailablePropertyFacts}
                  preventNavigation={Boolean(onPropertySelect)}
                />
              ))}
            </div>
          )}

          {thinking && (
            <div className="ml-9 flex items-center gap-2 text-xs text-muted-foreground">
              <EmeLoader size="sm" label="Assistente EME está pensando" />
              <span>Analisando sua busca...</span>
            </div>
          )}

          {handoff && handoffBroker && !thinking && (
            <div className="ml-9 rounded-2xl border border-primary/20 bg-eme-50 p-4">
              <div className="flex items-center gap-3">
                <Image
                  src={handoffBroker.image}
                  alt={handoffBroker.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {handoffBroker.name}
                    {(!confirmedVerificationOnly || handoffBroker.verified) ? <Check className="h-3.5 w-3.5 text-primary" aria-label="Verificada" /> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{handoffBroker.specialties.join(' · ')}</p>
                </div>
              </div>
              <Link
                href={brokerHref(handoffBroker)}
                onClick={(event) => {
                  if (onBrokerSelect) event.preventDefault()
                  onClose()
                  onBrokerSelect?.(handoffBroker)
                }}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Continuar com o corretor
              </Link>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                Você revisa seus dados antes de enviar qualquer mensagem.
              </p>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-border/60 bg-background p-3.5 md:p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[var(--shadow-soft)] focus-within:border-primary/25 focus-within:ring-2 focus-within:ring-primary/5">
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

export function AssistantProvider({
  children,
  properties,
  brokers,
  initialMessage = defaultInitialMessage,
  propertyHref = (property) => `/imoveis/imovel/${property.slug}`,
  brokerHref = (broker) => `/imoveis/corretores/${broker.slug}#contato-corretor`,
  confirmedVerificationOnly = false,
  hideUnavailablePropertyFacts = false,
  onPropertySelect,
  onBrokerSelect,
}: {
  children: ReactNode
  properties: SearchProperty[]
  brokers: AssistantBroker[]
  initialMessage?: string
  propertyHref?: (property: SearchProperty) => string
  brokerHref?: (broker: AssistantBroker) => string
  confirmedVerificationOnly?: boolean
  hideUnavailablePropertyFacts?: boolean
  onPropertySelect?: (property: SearchProperty) => void
  onBrokerSelect?: (broker: AssistantBroker) => void
}) {
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
      {open ? (
        <AssistantPanel
          onClose={() => setOpen(false)}
          properties={properties}
          brokers={brokers}
          initialMessage={initialMessage}
          propertyHref={propertyHref}
          brokerHref={brokerHref}
          confirmedVerificationOnly={confirmedVerificationOnly}
          hideUnavailablePropertyFacts={hideUnavailablePropertyFacts}
          onPropertySelect={onPropertySelect}
          onBrokerSelect={onBrokerSelect}
        />
      ) : null}
    </AssistantContext.Provider>
  )
}
