'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'
import { createPublicLead } from '@/lib/lead-client'
import { createWhatsAppUrl } from '@/lib/whatsapp'
import { trackMarketplaceEvent } from '@/lib/marketplace/analytics'
import { StructuredInput } from '@/components/ui/structured-input'
import { normalizePhone } from '@/lib/structured-fields'

export function BrokerContactForm({ brokerName, brokerSlug, brokerPhone }: { brokerName: string; brokerSlug: string; brokerPhone: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const whatsappMessage = `Olá! Sou ${name} e encontrei seu perfil no Marketplace EME. ${message || 'Gostaria de conhecer os imóveis disponíveis.'}`

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-[1.5rem] border border-border/70 bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-eme-50 text-primary"><CheckCircle2 className="h-7 w-7" aria-hidden="true" /></span>
        <h3 className="mt-5 text-lg font-semibold text-foreground">Contato enviado</h3>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">{brokerName.split(' ')[0]} recebeu seu interesse no fluxo de Clientes do EME.</p>
        <a onClick={() => void trackMarketplaceEvent({ eventType: 'whatsapp_click', catalogSlug: brokerSlug })} href={createWhatsAppUrl(brokerPhone, whatsappMessage)} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"><WhatsappGlyph className="h-4 w-4" />Abrir WhatsApp</a>
      </div>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createPublicLead({ catalogSlug: brokerSlug, catalogType: 'broker', source: 'marketplace', name, phone: normalizePhone(phone), message: message || `Interesse no perfil de ${brokerName}`, intent: 'perfil-corretor' })
      setSubmitted(true)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível enviar seu contato agora.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
      <h3 className="text-lg font-semibold text-foreground">Falar com {brokerName.split(' ')[0]}</h3>
      <p className="mt-1 text-sm text-muted-foreground">Conte o que procura e receba um retorno direto pelo WhatsApp.</p>
      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">Seu nome<input required value={name} onChange={(event) => setName(event.target.value)} type="text" placeholder="Seu nome" className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10" /></label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">WhatsApp<StructuredInput kind="phone" required value={phone} onValueChange={(value) => setPhone(value)} aria-label="WhatsApp" placeholder="(54) 90000-0000" className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10" /></label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">O que você procura<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Ex.: casa com pátio em Vacaria, até R$ 750 mil" className="resize-none rounded-xl border border-border bg-background px-3 py-2.5 font-normal text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10" /></label>
      </div>
      <button type="submit" disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.35)] transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"><WhatsappGlyph className="h-4 w-4" />{submitting ? 'Enviando contato...' : 'Continuar pelo WhatsApp'}</button>
      {error ? <p role="alert" className="mt-3 text-center text-xs text-red-600">{error}</p> : null}
    </form>
  )
}
