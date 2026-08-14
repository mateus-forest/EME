'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Star, X } from 'lucide-react'
import { StructuredInput } from '@/components/ui/structured-input'
import { normalizePhone } from '@/lib/structured-fields'
import { cn } from '@/lib/utils'

export function PublicBrokerReviewButton({ brokerSlug, brokerName }: { brokerSlug: string; brokerName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keydown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', keydown)
    }
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (rating < 1) {
      setError('Selecione uma nota de 1 a 5 estrelas.')
      return
    }
    setSending(true)
    try {
      const response = await fetch('/api/marketplace/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerSlug,
          authorName: name,
          authorPhone: normalizePhone(phone),
          rating,
          comment,
          attendanceConfirmed: confirmed,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível enviar a avaliação.')
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar a avaliação.')
    } finally {
      setSending(false)
    }
  }

  return <>
    <button type="button" onClick={() => { setOpen(true); setError('') }} className="inline-flex h-10 w-fit items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:text-primary">
      Avaliar atendimento
    </button>
    {open ? <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fechar avaliação" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <section role="dialog" aria-modal="true" aria-labelledby="public-review-title" className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] border border-border bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-float)] sm:max-w-md sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Avaliação pública</p><h3 id="public-review-title" className="mt-1 text-xl font-semibold text-foreground">Como foi o atendimento?</h3><p className="mt-1 text-sm text-muted-foreground">Conte sua experiência com {brokerName}.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        {saved ? <div className="mt-6 rounded-2xl border border-primary/15 bg-eme-50 p-5 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 font-semibold text-foreground">Avaliação enviada para moderação</p><p className="mt-1 text-sm text-muted-foreground">Ela só será exibida publicamente depois da aprovação da equipe EME.</p><button type="button" onClick={() => setOpen(false)} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Concluir</button></div> : <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-foreground">Nome<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal outline-none focus:border-primary/40" /></label>
          <label className="block text-sm font-medium text-foreground">Telefone/WhatsApp<StructuredInput kind="phone" required value={phone} onValueChange={setPhone} className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal outline-none focus:border-primary/40" /></label>
          <fieldset><legend className="text-sm font-medium text-foreground">Nota</legend><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} estrelas`} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary"><Star className={cn('h-6 w-6', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/35')} /></button>)}</div></fieldset>
          <label className="block text-sm font-medium text-foreground">Comentário<textarea required minLength={3} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Descreva sua experiência" className="mt-1.5 w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 font-normal outline-none focus:border-primary/40" /></label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-secondary/35 p-3 text-sm leading-relaxed text-foreground"><input required type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" /><span>Confirmo que fui atendido por este profissional.</span></label>
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <button disabled={sending} className="h-11 w-full rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{sending ? 'Enviando...' : 'Enviar avaliação'}</button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">O telefone não é publicado. Ele é usado apenas para verificar o atendimento e evitar duplicidade.</p>
        </form>}
      </section>
    </div> : null}
  </>
}
