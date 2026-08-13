'use client'

import Image from 'next/image'
import { useState } from 'react'
import { BadgeCheck, CheckCircle2 } from 'lucide-react'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'
import { buildWhatsappMessage, registerLead, type LeadQualification } from '@/lib/marketplace/lead'
import type { Broker } from '@/lib/marketplace/data'
import type { PropertyDetail } from '@/lib/marketplace/property-detail'
import { cn } from '@/lib/utils'

const options: { key: keyof LeadQualification; label: string }[] = [
  { key: 'financiamento', label: 'Financiamento' },
  { key: 'querVisitar', label: 'Quero visitar' },
  { key: 'precisaVender', label: 'Preciso vender outro imóvel' },
]

export function PropertyContact({
  property,
  broker,
  creci,
}: {
  property: PropertyDetail
  broker: Broker
  creci: string
}) {
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [qualification, setQualification] = useState<LeadQualification>({})
  const [submitted, setSubmitted] = useState(false)

  const toggle = (key: keyof LeadQualification) =>
    setQualification((q) => ({ ...q, [key]: !q[key] }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    registerLead({
      name,
      whatsapp,
      propertySlug: property.slug,
      propertyTitle: property.title,
      propertyCode: property.code,
      origin: 'contato-rapido',
      qualification,
      createdAt: new Date().toISOString(),
    })
    setSubmitted(true)
  }

  const message = buildWhatsappMessage({
    name,
    propertyTitle: property.title,
    propertyCode: property.code,
    qualification,
  })

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-surface p-6 shadow-[var(--shadow-soft)] md:p-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.85fr_1fr_1fr] lg:gap-10">
        {/* Chamada + corretora */}
        <div>
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Fale com quem conhece este imóvel
          </h2>
          <div className="mt-6 flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
              <Image
                src={broker.image || '/marketplace/placeholder-user.jpg'}
                alt={broker.name}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-pretty font-semibold leading-tight text-foreground">{broker.name}</p>
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{creci}</p>
              <p className="mt-1 text-xs text-muted-foreground">{broker.role}</p>
            </div>
          </div>
        </div>

        {/* Contato rápido */}
        <div>
          <p className="text-sm font-semibold text-foreground">Contato rápido</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fale pelo WhatsApp e receba as principais informações.
          </p>

          {submitted ? (
            <div className="mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-eme-50 text-primary">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">
                Contato preparado para {broker.name.split(' ')[0]}
              </p>
              <p className="mt-2 rounded-xl bg-secondary/60 px-3 py-2.5 text-left text-xs leading-relaxed text-foreground">
                {message}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Demonstrativo — nenhuma mensagem é enviada nesta etapa.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                aria-label="Seu nome"
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
              <input
                required
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp"
                aria-label="Seu WhatsApp"
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              />
              <button
                type="submit"
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.32)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                <WhatsappGlyph className="h-4 w-4" />
                Continuar pelo WhatsApp
              </button>
            </form>
          )}
        </div>

        {/* Qualificação opcional */}
        <div>
          <p className="text-sm font-semibold text-foreground">Quero um atendimento mais preciso</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Me conte seus objetivos para que eu possa te ajudar melhor.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {options.map((opt) => {
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
          <p className="mt-4 text-xs text-muted-foreground">
            Suas respostas seguem junto com o contato para agilizar o atendimento.
          </p>
        </div>
      </div>
    </div>
  )
}
