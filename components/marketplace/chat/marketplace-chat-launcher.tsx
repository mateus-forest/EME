'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { MessageCircle, Send, Star, X } from 'lucide-react'
import { StructuredInput } from '@/components/ui/structured-input'
import { normalizePhone } from '@/lib/structured-fields'
import { createWhatsAppUrl } from '@/lib/whatsapp'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'
import { cn } from '@/lib/utils'

type Conversation = {
  token: string
  status: 'OPEN' | 'CLOSED'
  reviewRequestedAt: string | null
  broker: { name: string }
  property: { title: string } | null
  messages: Array<{ id: string; sender: 'CUSTOMER' | 'BROKER'; body: string; createdAt: string }>
  review: { rating: number; comment: string; status: string } | null
}

export function MarketplaceChatLauncher({ brokerSlug, brokerName, brokerPhone, propertyId, propertyTitle, prefill = '', className }: { brokerSlug: string; brokerName: string; brokerPhone?: string; propertyId?: string; propertyTitle?: string; prefill?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(prefill || (propertyTitle ? `Olá, gostaria de saber mais sobre ${propertyTitle}.` : 'Olá, gostaria de conhecer seus imóveis disponíveis.'))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const storageKey = `eme-marketplace-chat:${brokerSlug}:${propertyId || 'perfil'}`

  const loadConversation = useCallback(async (token: string) => {
    const response = await fetch(`/api/marketplace/conversations/${encodeURIComponent(token)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Não foi possível carregar a conversa.')
    const payload = await response.json()
    setConversation(payload.conversation)
  }, [])

  useEffect(() => {
    if (!open) return
    const token = window.localStorage.getItem(storageKey)
    if (token) void loadConversation(token).catch(() => window.localStorage.removeItem(storageKey))
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keydown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown) }
  }, [loadConversation, open, storageKey])

  useEffect(() => {
    if (!open || !conversation || conversation.status === 'CLOSED') return
    const timer = window.setInterval(() => void loadConversation(conversation.token).catch(() => null), 5000)
    return () => window.clearInterval(timer)
  }, [conversation, loadConversation, open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!message.trim()) return
    setSending(true); setError('')
    try {
      if (conversation) {
        const response = await fetch(`/api/marketplace/conversations/${conversation.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar a mensagem.')
        setConversation(payload.conversation)
      } else {
        const response = await fetch('/api/marketplace/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brokerSlug, propertyId, customerName: name, customerPhone: normalizePhone(phone), message }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Não foi possível iniciar o atendimento.')
        window.localStorage.setItem(storageKey, payload.conversation.token)
        setConversation(payload.conversation)
      }
      setMessage('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível enviar agora.') } finally { setSending(false) }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,.25)] transition-transform hover:scale-[1.01] active:scale-95', className)}><MessageCircle className="h-4 w-4" />Falar agora</button>
    {open ? <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fechar conversa" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <section role="dialog" aria-modal="true" aria-label={`Conversa com ${brokerName}`} className="relative flex h-[min(92dvh,700px)] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-border bg-background shadow-[var(--shadow-float)] sm:max-w-lg sm:rounded-[1.75rem]">
        <header className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-semibold text-foreground">{brokerName}</p><p className="text-xs text-muted-foreground">{propertyTitle || 'Atendimento pelo Marketplace EME'}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-5 w-5" /></button></header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 px-5 py-5">
          {!conversation ? <div className="rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">Inicie uma conversa interna. O corretor será notificado e o histórico continuará disponível no EME.</div> : conversation.messages.map((item) => <div key={item.id} className={cn('flex', item.sender === 'CUSTOMER' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[84%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', item.sender === 'CUSTOMER' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border bg-card text-foreground')}>{item.body}</div></div>)}
          {conversation?.status === 'CLOSED' ? <ReviewForm token={conversation.token} existing={conversation.review} requested={Boolean(conversation.reviewRequestedAt)} onSaved={() => void loadConversation(conversation.token)} /> : null}
        </div>
        {conversation?.status !== 'CLOSED' ? <form onSubmit={submit} className="space-y-3 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!conversation ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary/40" /><StructuredInput kind="phone" required value={phone} onValueChange={setPhone} placeholder="WhatsApp" className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary/40" /></div> : null}
          <div className="flex items-end gap-2"><textarea required rows={2} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva sua mensagem" className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary/40" /><button disabled={sending} type="submit" aria-label="Enviar mensagem" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button></div>
          {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : null}
          {brokerPhone ? <a href={createWhatsAppUrl(brokerPhone, message || `Olá, encontrei seu perfil no Marketplace EME.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><WhatsappGlyph className="h-3.5 w-3.5" />Preferir WhatsApp</a> : null}
        </form> : null}
      </section>
    </div> : null}
  </>
}

function ReviewForm({ token, existing, requested, onSaved }: { token: string; existing: Conversation['review']; requested: boolean; onSaved: () => void }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  if (existing) return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Avaliação enviada com nota {existing.rating}. Ela será publicada após a moderação.</div>
  return <form onSubmit={async (event) => { event.preventDefault(); setError(''); const response = await fetch('/api/marketplace/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationToken: token, rating, comment }) }); if (response.ok) onSaved(); else setError((await response.json()).error || 'Não foi possível avaliar.') }} className="rounded-2xl border border-border bg-card p-4"><p className="font-medium text-foreground">{requested ? 'Como foi o atendimento?' : 'Atendimento encerrado'}</p><p className="mt-1 text-xs text-muted-foreground">Sua avaliação entra como pendente e só aparece após aprovação.</p><div className="mt-3 flex gap-1">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} estrelas`}><Star className={cn('h-6 w-6', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} /></button>)}</div><textarea required minLength={3} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Conte como foi o atendimento" className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40" /><button className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Enviar avaliação</button>{error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}</form>
}
