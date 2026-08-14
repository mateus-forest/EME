'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Building2, ChevronLeft, ExternalLink, FileText, MessageCircle, PencilLine, Plus, Send, Star, Users, X } from 'lucide-react'
import { BrokerPageShell } from '@/components/broker-page-shell'
import { MarketplaceMessageCard } from '@/components/marketplace/chat/marketplace-message-card'
import { formatCurrencyBRLFromCents } from '@/lib/structured-fields'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { cn } from '@/lib/utils'

type Dashboard = {
  profile: BrokerProfile | null
  settings: { slug: string; displayName: string; photoUrl: string; specialty: string; region: string; transactions: string; about: string }
  publicPath: string | null
  properties: Array<{ id: string; title: string; marketplaceSlug: string; purpose: string; price: number; city: string; image: string }>
  leads: Array<{ id: string; name: string | null; phone: string | null; intent: string | null; status: string; createdAt: string }>
  counts: { conversations: number; properties: number; leads: number; reviews: Record<string, number> }
}

type Conversation = {
  id: string
  customerName: string
  customerPhone: string
  status: string
  property: { title: string } | null
  lastMessageAt: string
  reviewRequestedAt: string | null
  messages: Array<{ id: string; sender: string; kind?: string; body: string; metadata?: unknown; createdAt: string }>
}

type ShareOptions = {
  properties: Array<{ id: string; title: string; location: string; price: number; image: string; slug: string | null }>
  proposals: Array<{ id: string; title: string; status: string; propertyTitle: string; updatedAt: string }>
}

export function BrokerMarketplacePage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ specialty: '', region: '', transactions: 'BOTH', about: '' })
  const [reply, setReply] = useState('')
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    const [dashboardResponse, conversationResponse] = await Promise.all([
      fetch('/api/brokers/marketplace', { cache: 'no-store' }),
      fetch('/api/brokers/marketplace/conversations', { cache: 'no-store' }),
    ])
    if (dashboardResponse.ok) {
      const payload = await dashboardResponse.json()
      setData(payload)
      setDraft({ specialty: payload.settings.specialty, region: payload.settings.region, transactions: payload.settings.transactions, about: payload.settings.about })
    }
    if (conversationResponse.ok) {
      const payload = await conversationResponse.json()
      setConversations(payload.conversations)
      setSelectedId((current) => current || payload.conversations[0]?.id || '')
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const selected = conversations.find((conversation) => conversation.id === selectedId)

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setFeedback('')
    const response = await fetch('/api/brokers/marketplace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
    if (response.ok) {
      setData(await response.json())
      setEditing(false)
      setFeedback('Perfil atualizado.')
    } else setFeedback('Não foi possível salvar o perfil.')
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault()
    if (!selected || !reply.trim()) return
    const response = await fetch(`/api/brokers/marketplace/conversations/${selected.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: reply }) })
    if (response.ok) {
      setReply('')
      await load()
    }
  }

  async function closeConversation() {
    if (!selected) return
    const response = await fetch(`/api/brokers/marketplace/conversations/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close', requestReview: true }) })
    if (response.ok) await load()
  }

  if (!data) return <BrokerPageShell title="Marketplace"><div className="p-8 text-sm text-[#6b7280]">Carregando Marketplace...</div></BrokerPageShell>
  const profile = data.profile

  return <BrokerPageShell title="Marketplace" contentClassName="pb-10"><div className="space-y-6 p-4 sm:p-0">
    <section className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#009b3a]">Visão geral</p><h2 className="mt-2 text-2xl font-semibold">Seu atendimento público em um só lugar</h2><p className="mt-2 text-sm text-[#667085]">Perfil, conversas, leads e imóveis publicados usam os dados reais do Marketplace.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setEditing((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-semibold"><PencilLine className="h-4 w-4" />Editar perfil</button>{data.publicPath ? <Link href={data.publicPath} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white">Ver perfil público<ExternalLink className="h-4 w-4" /></Link> : null}</div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Conversas abertas', data.counts.conversations], ['Leads Marketplace', data.counts.leads], ['Imóveis publicados', data.counts.properties], ['Avaliações pendentes', data.counts.reviews.PENDING_REVIEW || 0]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-[#f7f8f5] p-4"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#667085]">{label}</p></div>)}</div>
    </section>

    {editing ? <form onSubmit={saveProfile} className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Região<input value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-black/10 px-3 font-normal outline-none focus:border-[#009b3a]/50" /></label><label className="text-sm font-medium">Especialidade<input value={draft.specialty} onChange={(event) => setDraft({ ...draft, specialty: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-black/10 px-3 font-normal outline-none focus:border-[#009b3a]/50" /></label><label className="text-sm font-medium">Atuação<select value={draft.transactions} onChange={(event) => setDraft({ ...draft, transactions: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-black/10 px-3 font-normal"><option value="BOTH">Compra e aluguel</option><option value="SALE">Compra</option><option value="RENT">Aluguel</option></select></label></div><label className="mt-4 block text-sm font-medium">Sobre o atendimento<textarea rows={3} value={draft.about} onChange={(event) => setDraft({ ...draft, about: event.target.value })} className="mt-1.5 w-full resize-none rounded-xl border border-black/10 px-3 py-2 font-normal outline-none focus:border-[#009b3a]/50" /></label><button className="mt-4 rounded-xl bg-[#009b3a] px-5 py-2.5 text-sm font-semibold text-white">Salvar perfil</button>{feedback ? <span className="ml-3 text-sm text-[#667085]">{feedback}</span> : null}</form> : null}

    <section className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
      <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-semibold">Preview do perfil público</h3><div className="rounded-full bg-[#f2fbf5] px-3 py-1 text-xs font-medium text-[#007d32]">Card | Perfil</div></div>{profile ? <div className="mt-5 rounded-2xl border border-black/[0.06] p-4"><div className="flex items-center gap-4"><div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-[#f3f4f2]">{profile.image ? <Image src={profile.image} alt="" fill sizes="64px" className="object-cover" /> : null}</div><div><p className="font-semibold">{profile.name}</p><p className="text-sm text-[#667085]">{profile.creci}</p><p className="mt-1 text-xs text-[#009b3a]">{profile.specialty}</p></div></div><p className="mt-4 text-sm leading-relaxed text-[#667085]">{profile.about || 'Complete o texto do perfil para apresentar seu atendimento.'}</p><div className="mt-4 flex gap-2 text-xs text-[#667085]"><span>{profile.activeListings} imóveis</span>{profile.reviewCount ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{profile.rating.toFixed(1)} ({profile.reviewCount})</span> : null}</div></div> : <div className="mt-5 rounded-2xl border border-dashed border-black/10 p-6 text-sm text-[#667085]">O perfil público será ativado quando houver ao menos um imóvel publicado no Marketplace.</div>}</div>
      <ConversationPanel conversations={conversations} selected={selected} selectedId={selectedId} reply={reply} setReply={setReply} setSelectedId={setSelectedId} sendReply={sendReply} closeConversation={closeConversation} reload={load} />
    </section>

    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-[#009b3a]" />Leads</h3><div className="mt-4 space-y-2">{data.leads.slice(0, 6).map((lead) => <div key={lead.id} className="flex items-center justify-between rounded-xl bg-[#f7f8f5] p-3"><div><p className="text-sm font-semibold">{lead.name || 'Contato Marketplace'}</p><p className="text-xs text-[#667085]">{lead.intent || lead.phone}</p></div><span className="text-[11px] font-medium text-[#009b3a]">{lead.status}</span></div>)}{!data.leads.length ? <p className="text-sm text-[#667085]">Novos contatos aparecerão aqui.</p> : null}</div></div><div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-sm"><h3 className="font-semibold">Imóveis publicados</h3><div className="mt-4 space-y-2">{data.properties.slice(0, 6).map((property) => <Link href={`/imoveis/imovel/${property.marketplaceSlug}`} target="_blank" key={property.id} className="flex items-center gap-3 rounded-xl bg-[#f7f8f5] p-3"><div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-[#e8ece8]">{property.image ? <Image src={property.image} alt="" fill sizes="56px" className="object-cover" /> : null}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{property.title}</p><p className="text-xs text-[#667085]">{property.city} · {formatCurrencyBRLFromCents(property.price * 100)}</p></div><ExternalLink className="h-4 w-4 text-[#667085]" /></Link>)}{!data.properties.length ? <p className="text-sm text-[#667085]">Nenhum imóvel publicado.</p> : null}</div></div></section>
  </div></BrokerPageShell>
}

type ConversationPanelProps = {
  conversations: Conversation[]
  selected?: Conversation
  selectedId: string
  reply: string
  setReply: (value: string) => void
  setSelectedId: (value: string) => void
  sendReply: (event: FormEvent) => Promise<void>
  closeConversation: () => Promise<void>
  reload: () => Promise<void>
}

function ConversationPanel({ conversations, selected, selectedId, reply, setReply, setSelectedId, sendReply, closeConversation, reload }: ConversationPanelProps) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [shareMode, setShareMode] = useState<'PROPERTY' | 'PROPOSAL' | null>(null)
  const [shareOptions, setShareOptions] = useState<ShareOptions | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState('')

  useEffect(() => {
    setShareMenuOpen(false)
    setShareMode(null)
    setShareOptions(null)
    setShareError('')
  }, [selectedId])

  async function chooseShareMode(mode: 'PROPERTY' | 'PROPOSAL') {
    if (!selected) return
    setShareMode(mode)
    setShareError('')
    if (shareOptions) return
    setShareLoading(true)
    try {
      const response = await fetch(`/api/brokers/marketplace/conversations/${selected.id}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os itens.')
      setShareOptions(payload)
    } catch (caught) {
      setShareError(caught instanceof Error ? caught.message : 'Não foi possível carregar os itens.')
    } finally {
      setShareLoading(false)
    }
  }

  async function share(kind: 'PROPERTY' | 'PROPOSAL', referenceId: string) {
    if (!selected) return
    setShareLoading(true)
    setShareError('')
    try {
      const response = await fetch(`/api/brokers/marketplace/conversations/${selected.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, referenceId }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível compartilhar.')
      setShareMenuOpen(false)
      setShareMode(null)
      await reload()
    } catch (caught) {
      setShareError(caught instanceof Error ? caught.message : 'Não foi possível compartilhar.')
    } finally {
      setShareLoading(false)
    }
  }

  const items = shareMode === 'PROPERTY' ? shareOptions?.properties : shareOptions?.proposals
  return <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-sm">
    <div className="border-b border-black/[0.06] p-5"><h3 className="font-semibold">Conversas</h3><p className="mt-1 text-sm text-[#667085]">Atendimento persistido dentro do EME.</p></div>
    <div className="grid min-h-[390px] md:grid-cols-[210px_1fr]">
      <aside className="border-b border-black/[0.06] md:border-b-0 md:border-r"><div className="max-h-[390px] overflow-y-auto p-2">{conversations.length ? conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn('w-full rounded-xl p-3 text-left', selectedId === conversation.id ? 'bg-[#f2fbf5]' : 'hover:bg-[#f7f8f5]')}><p className="truncate text-sm font-semibold">{conversation.customerName}</p><p className="mt-1 truncate text-xs text-[#667085]">{conversation.property?.title || conversation.messages.at(-1)?.body}</p></button>) : <p className="p-4 text-sm text-[#667085]">Nenhuma conversa ainda.</p>}</div></aside>
      <div className="flex min-w-0 flex-col">{selected ? <>
        <div className="flex max-h-[310px] min-h-[250px] flex-1 flex-col gap-2 overflow-y-auto p-4">{selected.messages.map((message) => <div key={message.id} className={cn('flex', message.sender === 'BROKER' ? 'justify-end' : '')}>{message.kind && message.kind !== 'TEXT' ? <MarketplaceMessageCard kind={message.kind} body={message.body} metadata={message.metadata} brokerView /> : <p className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm', message.sender === 'BROKER' ? 'bg-[#009b3a] text-white' : 'bg-[#f3f4f2]')}>{message.body}</p>}</div>)}</div>
        {selected.status === 'OPEN' ? <form onSubmit={sendReply} className="relative border-t border-black/[0.06] p-3">
          {shareMenuOpen ? <div className="absolute bottom-[4.1rem] left-3 z-20 w-[min(320px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_18px_45px_rgba(15,23,42,.16)]">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2.5"><button type="button" aria-label="Voltar" onClick={() => setShareMode(null)} className={cn('flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f5f7f5]', !shareMode && 'invisible')}><ChevronLeft className="h-4 w-4" /></button><p className="text-sm font-semibold">{shareMode === 'PROPERTY' ? 'Enviar imóvel' : shareMode === 'PROPOSAL' ? 'Enviar proposta' : 'Compartilhar'}</p><button type="button" aria-label="Fechar opções" onClick={() => setShareMenuOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f5f7f5]"><X className="h-4 w-4" /></button></div>
            {!shareMode ? <div className="p-2"><button type="button" onClick={() => void chooseShareMode('PROPERTY')} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f8f5]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef9f1] text-[#009b3a]"><Building2 className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Enviar imóvel</span><span className="block text-xs text-[#667085]">Somente imóveis publicados</span></span></button><button type="button" onClick={() => void chooseShareMode('PROPOSAL')} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f8f5]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef9f1] text-[#009b3a]"><FileText className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Enviar proposta</span><span className="block text-xs text-[#667085]">Propostas deste atendimento</span></span></button></div> : <div className="max-h-64 overflow-y-auto p-2">{shareLoading && !shareOptions ? <p className="p-4 text-center text-sm text-[#667085]">Carregando...</p> : items?.length ? items.map((item) => <button disabled={shareLoading} type="button" key={item.id} onClick={() => void share(shareMode, item.id)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[#f7f8f5] disabled:opacity-60">{'image' in item ? <div className="relative h-11 w-12 shrink-0 overflow-hidden rounded-lg bg-[#e8ece8]">{item.image ? <Image src={item.image} alt="" fill sizes="48px" className="object-cover" /> : <Building2 className="absolute inset-0 m-auto h-4 w-4 text-[#7b8491]" />}</div> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef9f1] text-[#009b3a]"><FileText className="h-4 w-4" /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-xs text-[#667085]">{'location' in item ? `${item.location} · ${formatCurrencyBRLFromCents(item.price)}` : item.propertyTitle || 'Proposta compatível'}</span></span></button>) : <p className="p-4 text-center text-sm text-[#667085]">{shareMode === 'PROPERTY' ? 'Nenhum imóvel publicado.' : 'Nenhuma proposta compatível com este atendimento.'}</p>}{shareError ? <p role="alert" className="px-3 pb-3 text-xs text-red-600">{shareError}</p> : null}</div>}
          </div> : null}
          <div className="flex gap-2"><button type="button" aria-label="Compartilhar na conversa" aria-expanded={shareMenuOpen} onClick={() => { setShareMenuOpen((value) => !value); setShareMode(null); setShareError('') }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 text-[#667085] hover:bg-[#f7f8f5] hover:text-[#050505]"><Plus className="h-4 w-4" /></button><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Responder" className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#009b3a]/40" /><button aria-label="Enviar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009b3a] text-white"><Send className="h-4 w-4" /></button></div>
          <button type="button" onClick={closeConversation} className="mt-2 text-xs font-medium text-[#667085] hover:text-[#050505]">Encerrar e solicitar avaliação</button>
        </form> : <p className="border-t p-4 text-xs text-[#667085]">Atendimento encerrado{selected.reviewRequestedAt ? ' · avaliação solicitada' : ''}.</p>}
      </> : <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#667085]"><MessageCircle className="mr-2 h-4 w-4" />Selecione uma conversa</div>}</div>
    </div>
  </div>
}
