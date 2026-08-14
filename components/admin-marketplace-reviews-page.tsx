'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, MessageSquareText, Phone, Star, UserRoundCheck } from 'lucide-react'
import { AdminPageShell } from '@/components/admin-page-shell'
import { formatPhone } from '@/lib/structured-fields'
import { cn } from '@/lib/utils'

type Review = {
  id: string
  authorName: string
  authorPhone: string | null
  rating: number
  comment: string
  origin: 'POST_CHAT' | 'PUBLIC_PROFILE'
  verified: boolean
  attendanceConfirmed: boolean
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
  createdAt: string
  broker: { id: string; catalogSlug: string; user: { name: string } }
  conversation: { id: string; customerName: string; customerPhone: string; property: { title: string } | null } | null
  lead: { id: string; name: string | null; phone: string | null; whatsapp: string | null } | null
}

const statusLabel = { PENDING_REVIEW: 'Pendente', APPROVED: 'Aprovada', REJECTED: 'Rejeitada' }

export function AdminMarketplaceReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [status, setStatus] = useState('PENDING_REVIEW')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')
  const [rejectingId, setRejectingId] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = status === 'ALL' ? '' : `?status=${encodeURIComponent(status)}`
      const response = await fetch(`/api/admin/marketplace/reviews${query}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar as avaliações.')
      setReviews(payload.reviews)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as avaliações.')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { void load() }, [load])

  async function moderate(reviewId: string, nextStatus: 'APPROVED' | 'REJECTED') {
    setWorkingId(reviewId)
    setError('')
    try {
      const response = await fetch(`/api/admin/marketplace/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason: nextStatus === 'REJECTED' ? reason : undefined }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível moderar a avaliação.')
      setRejectingId('')
      setReason('')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível moderar a avaliação.')
    } finally {
      setWorkingId('')
    }
  }

  return <AdminPageShell title="Avaliações Marketplace" subtitle="Moderação EME de avaliações públicas e pós-atendimento">
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-[1.5rem] border border-black/[0.06] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><p className="font-semibold text-[#101828]">Fila de moderação</p><p className="mt-1 text-sm text-[#667085]">Telefone, lead e conversa são internos e nunca aparecem no perfil público.</p></div>
        <select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#009b3a]/40"><option value="PENDING_REVIEW">Pendentes</option><option value="APPROVED">Aprovadas</option><option value="REJECTED">Rejeitadas</option><option value="ALL">Todas</option></select>
      </section>
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <div className="rounded-[1.5rem] border border-black/[0.06] bg-white p-8 text-center text-sm text-[#667085]">Carregando avaliações...</div> : reviews.length ? <div className="grid gap-4">{reviews.map((review) => <article key={review.id} className="rounded-[1.5rem] border border-black/[0.06] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', review.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : review.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{statusLabel[review.status]}</span><span className="rounded-full bg-[#f5f7f5] px-2.5 py-1 text-[11px] font-medium text-[#667085]">{review.origin === 'POST_CHAT' ? 'Pós-chat' : 'Perfil público'}</span>{review.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eef9f1] px-2.5 py-1 text-[11px] font-semibold text-[#007d32]"><BadgeCheck className="h-3.5 w-3.5" />Atendimento vinculado</span> : <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700">Sem vínculo automático</span>}</div><h2 className="mt-3 text-lg font-semibold text-[#101828]">{review.authorName} <span className="font-normal text-[#98a2b3]">sobre</span> {review.broker.user.name}</h2><div className="mt-1 flex items-center gap-1">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={cn('h-4 w-4', value <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-[#d0d5dd]')} />)}</div><p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#475467]">{review.comment}</p></div><p className="shrink-0 text-xs text-[#98a2b3]">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(review.createdAt))}</p></div>
        <div className="mt-5 grid gap-3 rounded-2xl bg-[#f7f8f5] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-[#98a2b3]">Telefone privado</p><p className="mt-1 flex items-center gap-1.5 font-medium text-[#344054]"><Phone className="h-3.5 w-3.5" />{review.authorPhone ? formatPhone(review.authorPhone) : 'Não informado'}</p></div><div><p className="text-xs text-[#98a2b3]">Corretor avaliado</p><Link href={`/imoveis/corretores/${review.broker.catalogSlug}`} target="_blank" className="mt-1 inline-flex items-center gap-1.5 font-medium text-[#009b3a]"><UserRoundCheck className="h-3.5 w-3.5" />Ver perfil</Link></div><div><p className="text-xs text-[#98a2b3]">Conversa relacionada</p><p className="mt-1 font-medium text-[#344054]">{review.conversation ? review.conversation.property?.title || review.conversation.customerName : 'Não localizada'}</p></div><div><p className="text-xs text-[#98a2b3]">Lead relacionado</p><p className="mt-1 font-medium text-[#344054]">{review.lead?.name || (review.lead ? 'Lead identificado' : 'Não localizado')}</p></div></div>
        {review.rejectionReason ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><strong>Motivo:</strong> {review.rejectionReason}</p> : null}
        {review.status === 'PENDING_REVIEW' ? <div className="mt-4 flex flex-col gap-3 border-t border-black/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-end">{rejectingId === review.id ? <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da rejeição (opcional)" className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-red-300" /><button type="button" onClick={() => { setRejectingId(''); setReason('') }} className="h-10 rounded-xl border border-black/10 px-4 text-sm font-medium">Cancelar</button><button disabled={workingId === review.id} type="button" onClick={() => void moderate(review.id, 'REJECTED')} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60">Confirmar rejeição</button></div> : <><button type="button" onClick={() => setRejectingId(review.id)} className="h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700">Rejeitar</button><button disabled={workingId === review.id} type="button" onClick={() => void moderate(review.id, 'APPROVED')} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white disabled:opacity-60">Aprovar</button></>}</div> : null}
      </article>)}</div> : <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white p-10 text-center"><MessageSquareText className="mx-auto h-6 w-6 text-[#98a2b3]" /><p className="mt-3 font-medium text-[#344054]">Nenhuma avaliação neste filtro</p></div>}
    </div>
  </AdminPageShell>
}
