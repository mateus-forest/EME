'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Building2, ChevronLeft, ExternalLink, FileText, MessageCircle, PencilLine, Plus, Send, Star, Users, X } from 'lucide-react'
import { BrokerPageShell } from '@/components/broker-page-shell'
import {
  BrokerEmptyState,
  BrokerPageIntro,
  BrokerStatItem,
  BrokerStatStrip,
  BrokerStatusPill,
  BrokerSurface,
} from '@/components/broker-portal-ui'
import { MarketplaceMessageCard } from '@/components/marketplace/chat/marketplace-message-card'
import { BrokerSpecialtyChips } from '@/components/marketplace/broker-specialty-chips'
import { formatCurrencyBRLFromCents } from '@/lib/structured-fields'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'
import { cn } from '@/lib/utils'

type Dashboard = {
  profile: BrokerProfile | null
  settings: { slug: string; displayName: string; photoUrl: string; specialties: string[]; region: string; transactions: string; bio: string }
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
  const [draft, setDraft] = useState({ specialties: [''], region: '', transactions: 'BOTH', bio: '' })
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
      setDraft({ specialties: payload.settings.specialties.length ? payload.settings.specialties : [''], region: payload.settings.region, transactions: payload.settings.transactions, bio: payload.settings.bio })
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
    const specialties = draft.specialties.map((value) => value.trim()).filter(Boolean)
    const preservedLegacySpecialties = new Set(
      (data?.settings.specialties ?? []).filter((value) => value.length > 40),
    )
    if (specialties.some((value) => value.length > 40 && !preservedLegacySpecialties.has(value))) {
      setFeedback('Cada especialidade deve ter no máximo 40 caracteres.')
      return
    }
    const specialtyKeys = specialties.map((value) => value.toLocaleLowerCase('pt-BR'))
    if (new Set(specialtyKeys).size !== specialtyKeys.length) {
      setFeedback('Não é possível repetir a mesma especialidade.')
      return
    }
    const response = await fetch('/api/brokers/marketplace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
    const payload = await response.json().catch(() => null)
    if (response.ok) {
      setData(payload)
      setEditing(false)
      setFeedback('Perfil atualizado.')
    } else setFeedback(payload?.error || 'Não foi possível salvar o perfil.')
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

  return (
    <BrokerPageShell title="Marketplace" contentClassName="pb-10">
      <div className="grid gap-4 p-3 sm:p-0">
        <BrokerPageIntro
          eyebrow="Visão geral"
          title="Seu atendimento público em um só lugar"
          description="Perfil, conversas, leads e imóveis publicados usam os dados reais do Marketplace."
          actions={
            <>
              <button onClick={() => setEditing((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f7f8f5]">
                <PencilLine className="h-4 w-4" />Editar perfil
              </button>
              {data.publicPath ? <Link href={data.publicPath} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#009b3a] px-3 text-xs font-semibold text-white hover:bg-[#008633]">Ver perfil público<ExternalLink className="h-4 w-4" /></Link> : null}
            </>
          }
        />

        <BrokerStatStrip>
          <BrokerStatItem icon={<MessageCircle className="size-4" />} label="Conversas abertas" value={data.counts.conversations} />
          <BrokerStatItem icon={<Users className="size-4" />} label="Leads Marketplace" value={data.counts.leads} />
          <BrokerStatItem icon={<Building2 className="size-4" />} label="Imóveis publicados" value={data.counts.properties} />
          <BrokerStatItem icon={<Star className="size-4" />} label="Avaliações pendentes" value={data.counts.reviews.PENDING_REVIEW || 0} />
        </BrokerStatStrip>

        {editing ? (
          <form onSubmit={saveProfile}>
            <BrokerSurface padding="compact">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-[#344054]">Região<input value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.08] px-3 font-normal outline-none focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/10" /></label>
                <label className="text-sm font-medium text-[#344054]">Atuação<select value={draft.transactions} onChange={(event) => setDraft({ ...draft, transactions: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-black/[0.08] bg-white px-3 font-normal"><option value="BOTH">Compra e aluguel</option><option value="SALE">Compra</option><option value="RENT">Aluguel</option></select></label>
              </div>
              <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#fbfcfa] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-sm font-medium text-[#344054]">Especialidades</p><p className="mt-0.5 text-xs text-[#667085]">Adicione até 4 especialidades, com no máximo 40 caracteres cada.</p></div>
                  <button type="button" disabled={draft.specialties.length >= 4} onClick={() => setDraft({ ...draft, specialties: [...draft.specialties, ''] })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#009b3a]/20 bg-white px-2.5 text-xs font-semibold text-[#008633] hover:bg-[#eef9f1] disabled:cursor-not-allowed disabled:opacity-45"><Plus className="size-3.5" />Adicionar especialidade</button>
                </div>
                <div className="mt-3 grid gap-2">
                  {draft.specialties.map((specialty, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1"><input value={specialty} onChange={(event) => setDraft({ ...draft, specialties: draft.specialties.map((value, currentIndex) => currentIndex === index ? event.target.value : value) })} placeholder="Ex.: Lançamentos imobiliários" className="h-10 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm outline-none focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/10" /><p className={`mt-1 text-right text-[11px] ${specialty.length > 40 && !(data?.settings.specialties ?? []).includes(specialty) ? 'text-red-600' : 'text-[#7b8491]'}`}>{specialty.length}/40</p></div>
                      <button type="button" aria-label={`Remover especialidade ${index + 1}`} onClick={() => setDraft({ ...draft, specialties: draft.specialties.length === 1 ? [''] : draft.specialties.filter((_, currentIndex) => currentIndex !== index) })} className="mb-4 flex size-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.07] text-[#667085] hover:border-red-200 hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <label className="mt-3 block text-sm font-medium text-[#344054]">Apresentação / bio<textarea rows={3} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} className="mt-1.5 w-full resize-none rounded-lg border border-black/[0.08] px-3 py-2 font-normal outline-none focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/10" /></label>
              <div className="mt-3 flex flex-wrap items-center gap-3"><button className="h-9 rounded-lg bg-[#009b3a] px-4 text-xs font-semibold text-white hover:bg-[#008633]">Salvar perfil</button>{feedback ? <span className="text-sm text-[#667085]">{feedback}</span> : null}</div>
            </BrokerSurface>
          </form>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(17rem,.72fr)_minmax(0,1.28fr)]">
          <BrokerSurface padding="compact">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-[#111827]">Preview do perfil público</h3><BrokerStatusPill tone="positive">Card | Perfil</BrokerStatusPill></div>
            {profile ? (
              <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#fcfcfb] p-4">
                <div className="flex items-center gap-3"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f3f4f2]">{profile.image ? <Image src={profile.image} alt="" fill sizes="56px" className="object-cover" /> : null}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-[#111827]">{profile.name}</p><p className="truncate text-xs text-[#667085]">{profile.creci}</p><BrokerSpecialtyChips specialties={profile.specialties} className="mt-1.5" /></div></div>
                <p className="mt-3 line-clamp-4 text-sm leading-5 text-[#667085]">{profile.about || 'Complete o texto do perfil para apresentar seu atendimento.'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#667085]"><span>{profile.activeListings} imóveis</span>{profile.reviewCount ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{profile.rating.toFixed(1)} ({profile.reviewCount})</span> : null}</div>
              </div>
            ) : <BrokerEmptyState className="mt-4 min-h-36" title="Perfil público ainda indisponível" description="O perfil será ativado quando houver ao menos um imóvel publicado no Marketplace." />}
          </BrokerSurface>
          <ConversationPanel conversations={conversations} selected={selected} selectedId={selectedId} reply={reply} setReply={setReply} setSelectedId={setSelectedId} sendReply={sendReply} closeConversation={closeConversation} reload={load} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <BrokerSurface padding="compact">
            <h3 className="flex items-center gap-2 font-semibold text-[#111827]"><Users className="h-4 w-4 text-[#009b3a]" />Leads</h3>
            <div className="mt-3 grid divide-y divide-black/[0.055]">{data.leads.slice(0, 6).map((lead) => <div key={lead.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#111827]">{lead.name || 'Contato Marketplace'}</p><p className="truncate text-xs text-[#667085]">{lead.intent || lead.phone}</p></div><BrokerStatusPill tone={lead.status === 'OPEN' || lead.status === 'NEW' ? 'positive' : 'neutral'}>{formatMarketplaceLeadStatus(lead.status)}</BrokerStatusPill></div>)}{!data.leads.length ? <p className="py-5 text-sm text-[#667085]">Novos contatos aparecerão aqui.</p> : null}</div>
          </BrokerSurface>
          <BrokerSurface padding="compact">
            <h3 className="font-semibold text-[#111827]">Imóveis publicados</h3>
            <div className="mt-3 grid divide-y divide-black/[0.055]">{data.properties.slice(0, 6).map((property) => <Link href={`/imoveis/imovel/${property.marketplaceSlug}`} target="_blank" key={property.id} className="flex min-w-0 items-center gap-3 py-2.5"><div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-[#e8ece8]">{property.image ? <Image src={property.image} alt="" fill sizes="56px" className="object-cover" /> : null}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#111827]">{property.title}</p><p className="truncate text-xs text-[#667085]">{property.city} · {formatCurrencyBRLFromCents(property.price * 100)}</p></div><ExternalLink className="h-4 w-4 shrink-0 text-[#667085]" /></Link>)}{!data.properties.length ? <p className="py-5 text-sm text-[#667085]">Nenhum imóvel publicado.</p> : null}</div>
          </BrokerSurface>
        </section>
      </div>
    </BrokerPageShell>
  )
}

function formatMarketplaceLeadStatus(status: string) {
  const labels: Record<string, string> = {
    NEW: 'Novo',
    OPEN: 'Em atendimento',
    CONTACTED: 'Em atendimento',
    NEGOTIATING: 'Negociação',
    WON: 'Convertido',
    CLOSED: 'Encerrado',
    LOST: 'Encerrado',
    ARCHIVED: 'Arquivado',
  }
  return labels[status] ?? status
}

function marketplaceConversationStatusTone(status: string): 'positive' | 'neutral' | 'warning' {
  if (status === 'OPEN') return 'positive'
  if (status === 'CLOSED') return 'neutral'
  return 'warning'
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
  return <div className="flex h-[min(42rem,calc(100dvh-7rem))] min-h-[26rem] min-w-0 flex-col overflow-hidden rounded-[var(--broker-radius-lg)] border border-[var(--broker-border)] bg-[var(--broker-surface)] shadow-[var(--broker-shadow-xs)] md:h-[30rem] md:min-h-0">
    <div className="border-b border-[var(--broker-border)] px-4 py-3.5"><h3 className="font-semibold text-[#111827]">Conversas</h3><p className="mt-0.5 text-xs text-[#667085]">Atendimento persistido dentro do EME.</p></div>
    <div className="grid min-h-0 flex-1 md:grid-cols-[12rem_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-hidden border-b border-black/[0.06] md:border-r md:border-b-0"><div className="eme-subtle-scrollbar max-h-36 overflow-y-auto overscroll-contain p-1.5 md:h-full md:max-h-none">{conversations.length ? conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn('w-full rounded-lg px-2.5 py-2.5 text-left', selectedId === conversation.id ? 'bg-[#f2fbf5]' : 'hover:bg-[#f7f8f5]')}><span className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{conversation.customerName}</span><BrokerStatusPill tone={marketplaceConversationStatusTone(conversation.status)} className="shrink-0 px-2 py-0 text-[10px]">{formatMarketplaceLeadStatus(conversation.status)}</BrokerStatusPill></span><span className="mt-0.5 block truncate text-xs text-[#667085]">{conversation.property?.title || conversation.messages.at(-1)?.body}</span></button>) : <p className="p-4 text-sm text-[#667085]">Nenhuma conversa ainda.</p>}</div></aside>
      <div className="flex min-h-0 min-w-0 flex-col">{selected ? <>
        <div className="eme-subtle-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-3" data-testid="marketplace-conversation-scroll">{selected.messages.map((message) => <div key={message.id} className={cn('flex min-w-0', message.sender === 'BROKER' ? 'justify-end' : '')}>{message.kind && message.kind !== 'TEXT' ? <MarketplaceMessageCard kind={message.kind} body={message.body} metadata={message.metadata} brokerView /> : <p className={cn('max-w-[88%] break-words rounded-xl px-3 py-2 text-sm [overflow-wrap:anywhere]', message.sender === 'BROKER' ? 'bg-[#009b3a] text-white' : 'bg-[#f3f4f2]')}>{message.body}</p>}</div>)}</div>
        {selected.status === 'OPEN' ? <form onSubmit={sendReply} className="relative shrink-0 border-t border-black/[0.06] px-3 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          {shareMenuOpen ? <div className="absolute bottom-[4.1rem] left-3 z-20 w-[min(320px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_18px_45px_rgba(15,23,42,.16)]">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2.5"><button type="button" aria-label="Voltar" onClick={() => setShareMode(null)} className={cn('flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f5f7f5]', !shareMode && 'invisible')}><ChevronLeft className="h-4 w-4" /></button><p className="text-sm font-semibold">{shareMode === 'PROPERTY' ? 'Enviar imóvel' : shareMode === 'PROPOSAL' ? 'Enviar proposta' : 'Compartilhar'}</p><button type="button" aria-label="Fechar opções" onClick={() => setShareMenuOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f5f7f5]"><X className="h-4 w-4" /></button></div>
            {!shareMode ? <div className="p-2"><button type="button" onClick={() => void chooseShareMode('PROPERTY')} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f8f5]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef9f1] text-[#009b3a]"><Building2 className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Enviar imóvel</span><span className="block text-xs text-[#667085]">Somente imóveis publicados</span></span></button><button type="button" onClick={() => void chooseShareMode('PROPOSAL')} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f7f8f5]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef9f1] text-[#009b3a]"><FileText className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Enviar proposta</span><span className="block text-xs text-[#667085]">Propostas deste atendimento</span></span></button></div> : <div className="max-h-64 overflow-y-auto p-2">{shareLoading && !shareOptions ? <p className="p-4 text-center text-sm text-[#667085]">Carregando...</p> : items?.length ? items.map((item) => <button disabled={shareLoading} type="button" key={item.id} onClick={() => void share(shareMode, item.id)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[#f7f8f5] disabled:opacity-60">{'image' in item ? <div className="relative h-11 w-12 shrink-0 overflow-hidden rounded-lg bg-[#e8ece8]">{item.image ? <Image src={item.image} alt="" fill sizes="48px" className="object-cover" /> : <Building2 className="absolute inset-0 m-auto h-4 w-4 text-[#7b8491]" />}</div> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef9f1] text-[#009b3a]"><FileText className="h-4 w-4" /></span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-xs text-[#667085]">{'location' in item ? `${item.location} · ${formatCurrencyBRLFromCents(item.price)}` : item.propertyTitle || 'Proposta compatível'}</span></span></button>) : <p className="p-4 text-center text-sm text-[#667085]">{shareMode === 'PROPERTY' ? 'Nenhum imóvel publicado.' : 'Nenhuma proposta compatível com este atendimento.'}</p>}{shareError ? <p role="alert" className="px-3 pb-3 text-xs text-red-600">{shareError}</p> : null}</div>}
          </div> : null}
          <div className="flex gap-2"><button type="button" aria-label="Compartilhar na conversa" aria-expanded={shareMenuOpen} onClick={() => { setShareMenuOpen((value) => !value); setShareMode(null); setShareError('') }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 text-[#667085] hover:bg-[#f7f8f5] hover:text-[#050505]"><Plus className="h-4 w-4" /></button><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Responder" className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#009b3a]/40" /><button aria-label="Enviar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009b3a] text-white"><Send className="h-4 w-4" /></button></div>
          <button type="button" onClick={closeConversation} className="mt-2 text-xs font-medium text-[#667085] hover:text-[#050505]">Encerrar e solicitar avaliação</button>
        </form> : <p className="shrink-0 border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-[#667085]">{formatMarketplaceLeadStatus(selected.status)}{selected.reviewRequestedAt ? ' · avaliação solicitada' : ''}.</p>}
      </> : <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#667085]"><MessageCircle className="mr-2 h-4 w-4" />Selecione uma conversa</div>}</div>
    </div>
  </div>
}
