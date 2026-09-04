'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'
import { buildWhatsappMessage, registerLead, type LeadOrigin, type LeadQualification } from '@/lib/marketplace/lead'
import type { PropertyDetail } from '@/lib/marketplace/property-detail'
import { formatPrice } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'
import { createWhatsAppUrl } from '@/lib/whatsapp'
import { trackMarketplaceEvent } from '@/lib/marketplace/analytics'
import { StructuredInput } from '@/components/ui/structured-input'
import { normalizePhone } from '@/lib/structured-fields'

type InterestContextValue = {
  open: (origin: LeadOrigin) => void
}

const InterestContext = createContext<InterestContextValue | null>(null)

export function useInterest() {
  const ctx = useContext(InterestContext)
  if (!ctx) throw new Error('useInterest deve ser usado dentro de InterestProvider')
  return ctx
}

const qualificationOptions: { key: keyof LeadQualification; label: string }[] = [
  { key: 'financiamento', label: 'Financiamento' },
  { key: 'querVisitar', label: 'Quero visitar' },
  { key: 'precisaVender', label: 'Preciso vender outro imóvel' },
]

export function InterestProvider({
  property,
  brokerName,
  brokerPhone,
  children,
}: {
  property: PropertyDetail
  brokerName: string
  brokerPhone: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [origin, setOrigin] = useState<LeadOrigin>('pagina-imovel')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [qualification, setQualification] = useState<LeadQualification>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const open = useCallback((from: LeadOrigin) => {
    setOrigin(from)
    setIsOpen(true)
    void trackMarketplaceEvent({ eventType: 'interest', propertyId: property.propertyId })
  }, [property.propertyId])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false)
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setSubmitted(false)
        setName('')
        setWhatsapp('')
        setQualification({})
      }, 220)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const toggle = (key: keyof LeadQualification) =>
    setQualification((q) => ({ ...q, [key]: !q[key] }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      await registerLead({ name, whatsapp: normalizePhone(whatsapp), propertyId: property.propertyId, propertySlug: property.slug, propertyTitle: property.title, propertyCode: property.code, origin, qualification, createdAt: new Date().toISOString() })
      setSubmitted(true)
    } catch (caughtError) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : 'Não foi possível registrar seu interesse agora.')
    } finally {
      setSubmitting(false)
    }
  }

  const message = buildWhatsappMessage({
    name,
    propertyTitle: property.title,
    propertyCode: property.code,
    qualification,
  })

  return (
    <InterestContext.Provider value={{ open }}>
      {children}

      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Tenho interesse — ${property.title}`}
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-[var(--shadow-float)] sm:max-w-lg sm:rounded-3xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">Tenho interesse</h2>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {property.title} · {formatPrice(property.price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-eme-50 text-primary">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  Tudo pronto, {name.split(' ')[0] || 'obrigado'}!
                </h3>
                <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                  Seu contato foi enviado para {brokerName}, com o imóvel e as informações que você respondeu.
                </p>
                <p className="mt-4 w-full rounded-2xl border border-border/70 bg-secondary/60 px-4 py-3 text-left text-sm leading-relaxed text-foreground">
                  {message}
                </p>
                <a onClick={() => void trackMarketplaceEvent({ eventType: 'whatsapp_click', propertyId: property.propertyId })} href={createWhatsAppUrl(brokerPhone, message)} target="_blank" rel="noreferrer" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95">Abrir WhatsApp</a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  Seu nome
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
                  WhatsApp
                  <StructuredInput
                    kind="phone"
                    required
                    value={whatsapp}
                    onValueChange={(value) => setWhatsapp(value)}
                    placeholder="(54) 90000-0000"
                    className="rounded-xl border border-border bg-card px-3 py-2.5 font-normal text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                </label>

                <fieldset className="mt-1">
                  <legend className="text-sm font-medium text-foreground">
                    Quer um atendimento mais preciso?
                  </legend>
                  <p className="mt-1 text-xs text-muted-foreground">Opcional — ajuda a corretora a te atender melhor.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {qualificationOptions.map((opt) => {
                      const active = Boolean(qualification[opt.key])
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggle(opt.key)}
                          aria-pressed={active}
                          className={cn(
                            'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                            active
                              ? 'border-primary bg-eme-50 text-eme-700'
                              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <WhatsappGlyph className="h-4 w-4" />
                  {submitting ? 'Enviando contato...' : 'Continuar pelo WhatsApp'}
                </button>
                {submitError ? <p role="alert" className="text-center text-xs text-red-600">{submitError}</p> : null}
                <p className="text-center text-xs text-muted-foreground">
                  Seu contato será enviado diretamente à corretora responsável.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </InterestContext.Provider>
  )
}
