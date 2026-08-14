'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Copy, ExternalLink, ImagePlus, Link2, Save, Share2 } from 'lucide-react'
import { BrokerPageShell } from '@/components/broker-page-shell'
import { useBrokerCatalogSettings } from '@/components/use-broker-catalog-settings'
import { useBrokerProperties } from '@/components/use-broker-properties'
import { compressImageToDataUrl } from '@/lib/client-image'
import { buildBrokerCatalogPath, buildBrokerCatalogUrl } from '@/lib/public-catalog-url'

export function BrokerCatalogPage() {
  const { settings, saveSettings } = useBrokerCatalogSettings()
  const { properties, isLoading } = useBrokerProperties()
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [copied, setCopied] = useState(false)
  const photoInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => setDraft(settings), [settings])
  const publicPath = useMemo(() => buildBrokerCatalogPath(draft.slug), [draft.slug])
  const publicUrl = useMemo(() => draft.slug ? buildBrokerCatalogUrl(draft.slug) : '', [draft.slug])
  const published = properties.filter((property) => property.published)

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFeedback('')
    try { await saveSettings({ slug: draft.slug, displayName: draft.displayName, photoUrl: draft.photoUrl, description: draft.description }); setFeedback('Configurações salvas.') }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar.') }
    finally { setSaving(false) }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return
    try { const photoUrl = await compressImageToDataUrl(file, { maxDimension: 960 }); setDraft((current) => ({ ...current, photoUrl })) }
    catch { setFeedback('Não foi possível processar esta imagem.') }
  }

  async function copyLink() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  async function shareLink() {
    if (!publicUrl) return
    if (navigator.share) await navigator.share({ title: `Catálogo de ${draft.displayName}`, url: publicUrl }).catch(() => null)
    else await copyLink()
  }

  return <BrokerPageShell title="Catálogo" contentClassName="pb-10">
    <div className="space-y-5 p-4 sm:p-0">
      <section className="flex flex-col gap-4 rounded-3xl border border-black/[0.06] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#009b3a]">Catálogo individual</p><h2 className="mt-2 text-2xl font-semibold text-[#050505]">Gerencie sua vitrine pública</h2><p className="mt-2 text-sm leading-relaxed text-[#667085]">Identidade, link e uma prévia compacta do catálogo que seus clientes acessam.</p></div>
        <div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2fbf5] px-3 py-1.5 text-xs font-semibold text-[#007d32]"><Check className="h-3.5 w-3.5" />Catálogo ativo</span><span className="rounded-full border border-black/[0.07] px-3 py-1.5 text-xs font-medium text-[#667085]">{published.length} {published.length === 1 ? 'imóvel publicado' : 'imóveis publicados'}</span></div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
        <form onSubmit={submit} className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-base font-semibold text-[#050505]">Configuração</h3><p className="mt-1 text-sm text-[#667085]">Dados exibidos exclusivamente no seu catálogo.</p>
          <div className="mt-6 flex items-center gap-4"><button type="button" onClick={() => photoInput.current?.click()} className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/[0.08] bg-[#f5f6f3]">{draft.photoUrl ? <Image src={draft.photoUrl} alt="Foto do catálogo" fill sizes="80px" className="object-cover" /> : <ImagePlus className="h-6 w-6 text-[#8b95a1]" />}<span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">Alterar</span></button><div><p className="text-sm font-semibold">Foto do catálogo</p><p className="mt-1 text-xs leading-relaxed text-[#667085]">JPG, PNG ou WebP. A imagem é otimizada antes de salvar.</p><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadPhoto(event.target.files?.[0])} /></div></div>
          <div className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#344054]">Nome público<input required maxLength={120} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-black/[0.09] bg-white px-3 text-[#050505] outline-none transition focus:border-[#009b3a]/45 focus:ring-4 focus:ring-[#009b3a]/8" /></label><label className="block text-sm font-medium text-[#344054]">Endereço do catálogo<div className="mt-1.5 flex h-11 items-center overflow-hidden rounded-xl border border-black/[0.09] bg-white focus-within:border-[#009b3a]/45 focus-within:ring-4 focus-within:ring-[#009b3a]/8"><span className="border-r border-black/[0.06] bg-[#f7f8f5] px-3 text-xs text-[#667085]">/catalogo/</span><input required value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="min-w-0 flex-1 px-3 text-sm outline-none" /></div></label><label className="block text-sm font-medium text-[#344054]">Descrição<textarea maxLength={600} rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Apresente seu atendimento e a seleção de imóveis do catálogo." className="mt-1.5 w-full resize-none rounded-xl border border-black/[0.09] px-3 py-2.5 text-sm outline-none transition focus:border-[#009b3a]/45 focus:ring-4 focus:ring-[#009b3a]/8" /></label></div>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/15 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar catálogo'}</button>{feedback ? <p role="status" className="text-sm text-[#667085]">{feedback}</p> : null}</div>
        </form>

        <section className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 sm:px-6"><div><h3 className="font-semibold text-[#050505]">Preview do catálogo</h3><p className="mt-1 text-xs text-[#667085]">Amostra real do catálogo público individual.</p></div><span className="rounded-full bg-[#f7f8f5] px-3 py-1 text-[11px] font-semibold text-[#667085]">Sincronizado</span></div>
          <div className="bg-[#f3f1eb] p-4 sm:p-6"><div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-[0_18px_45px_rgba(15,23,42,.08)]"><div className="flex items-center gap-4 border-b border-black/[0.06] p-5"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#eef1ec]">{draft.photoUrl ? <Image src={draft.photoUrl} alt="" fill sizes="56px" className="object-cover" /> : null}</div><div className="min-w-0"><p className="truncate font-semibold text-[#050505]">{draft.displayName || 'Seu nome no catálogo'}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#667085]">{draft.description || 'Sua descrição aparecerá aqui.'}</p></div></div><div className="grid gap-3 p-4 sm:grid-cols-3">{isLoading ? <p className="col-span-full py-6 text-center text-sm text-[#667085]">Carregando imóveis...</p> : published.length ? published.slice(0, 3).map((property) => <article key={property.id} className="min-w-0 overflow-hidden rounded-xl border border-black/[0.06]"><div className="relative aspect-[4/3] bg-[#eef1ec]">{property.images[0] ? <Image src={property.images[0]} alt="" fill sizes="180px" className="object-cover" /> : null}</div><div className="p-3"><p className="truncate text-xs font-semibold text-[#050505]">{property.title}</p><p className="mt-1 truncate text-[11px] text-[#667085]">{property.location}</p><p className="mt-2 text-xs font-semibold text-[#009b3a]">{property.price}</p></div></article>) : <div className="col-span-full rounded-xl border border-dashed border-black/[0.1] px-4 py-8 text-center text-sm text-[#667085]">Os imóveis publicados aparecerão nesta prévia.</div>}</div></div></div>
          <div className="border-t border-black/[0.06] p-5 sm:p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-[#7b8491]"><Link2 className="h-4 w-4 text-[#009b3a]" />URL pública</div><div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-black/[0.07] bg-[#f7f8f5] p-2 pl-3"><p className="min-w-0 flex-1 truncate text-sm text-[#344054]">{publicUrl || 'Defina o endereço do catálogo'}</p><button type="button" disabled={!publicUrl} onClick={() => void copyLink()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#667085] shadow-sm disabled:opacity-40" aria-label="Copiar link">{copied ? <Check className="h-4 w-4 text-[#009b3a]" /> : <Copy className="h-4 w-4" />}</button></div><div className="mt-3 flex flex-wrap gap-2"><Link href={publicPath} target="_blank" aria-disabled={!draft.slug} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.08] px-4 text-sm font-semibold text-[#344054]"><ExternalLink className="h-4 w-4" />Abrir link</Link><button type="button" disabled={!publicUrl} onClick={() => void shareLink()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.08] px-4 text-sm font-semibold text-[#344054] disabled:opacity-40"><Share2 className="h-4 w-4" />Compartilhar</button></div></div>
        </section>
      </div>
    </div>
  </BrokerPageShell>
}
