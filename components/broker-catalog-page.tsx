'use client'

import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Film,
  ImagePlus,
  Link2,
  Save,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react'

import { BrokerPageShell } from '@/components/broker-page-shell'
import { BrokerPageIntro, BrokerStatusPill, BrokerSurface } from '@/components/broker-portal-ui'
import { useBrokerCatalogSettings } from '@/components/use-broker-catalog-settings'
import { useBrokerProperties } from '@/components/use-broker-properties'
import { compressImageToDataUrl } from '@/lib/client-image'
import { buildBrokerCatalogPath, buildBrokerCatalogUrl } from '@/lib/public-catalog-url'

type CatalogMediaKind = 'banner' | 'video'

function parseList(value: string) {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 16)
}

export function BrokerCatalogPage() {
  const { settings, saveSettings, applyPersistedSettings } = useBrokerCatalogSettings()
  const { properties, isLoading } = useBrokerProperties()
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<CatalogMediaKind | null>(null)
  const [feedback, setFeedback] = useState('')
  const [copied, setCopied] = useState(false)
  const [citiesText, setCitiesText] = useState('')
  const [specialtiesText, setSpecialtiesText] = useState('')
  const [differentialsText, setDifferentialsText] = useState('')
  const photoInput = useRef<HTMLInputElement | null>(null)
  const bannerInput = useRef<HTMLInputElement | null>(null)
  const videoInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraft(settings)
    setCitiesText(settings.cities.join(', '))
    setSpecialtiesText(settings.specialties.join(', '))
    setDifferentialsText(settings.differentials.join('\n'))
  }, [settings])
  const publicPath = useMemo(() => buildBrokerCatalogPath(draft.slug), [draft.slug])
  const publicUrl = useMemo(() => draft.slug ? buildBrokerCatalogUrl(draft.slug) : '', [draft.slug])
  const published = properties.filter((property) => property.published)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || uploading) return
    setSaving(true)
    setFeedback('')
    try {
      const saved = await saveSettings(draft)
      setDraft(saved)
      setFeedback('Catálogo atualizado com sucesso.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return
    try {
      const photoUrl = await compressImageToDataUrl(file, { maxDimension: 960 })
      setDraft((current) => ({ ...current, photoUrl }))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível processar esta imagem.')
    }
  }

  async function uploadMedia(kind: CatalogMediaKind, file?: File) {
    if (!file || saving || uploading) return
    setUploading(kind)
    setFeedback('')
    try {
      const body = new FormData()
      body.set('kind', kind)
      body.set('file', file)
      const response = await fetch('/api/brokers/catalog/media', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        body,
      })
      const data = await response.json().catch(() => null) as { mediaUrl?: string; error?: string } | null
      if (!response.ok || !data?.mediaUrl) throw new Error(data?.error ?? 'Não foi possível enviar o arquivo.')
      applyPersistedSettings(
        kind === 'banner' ? { bannerUrl: data.mediaUrl } : { videoUrl: data.mediaUrl },
      )
      setDraft((current) => ({
        ...current,
        ...(kind === 'banner' ? { bannerUrl: data.mediaUrl! } : { videoUrl: data.mediaUrl! }),
      }))
      setFeedback(kind === 'banner' ? 'Banner enviado e salvo.' : 'Vídeo enviado e salvo.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.')
    } finally {
      setUploading(null)
    }
  }

  async function removeMedia(kind: CatalogMediaKind) {
    if (saving || uploading) return
    setUploading(kind)
    setFeedback('')
    try {
      const response = await fetch(`/api/brokers/catalog/media?kind=${kind}`, {
        method: 'DELETE',
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível remover o arquivo.')
      applyPersistedSettings(kind === 'banner' ? { bannerUrl: '' } : { videoUrl: '' })
      setDraft((current) => ({
        ...current,
        ...(kind === 'banner' ? { bannerUrl: '' } : { videoUrl: '' }),
      }))
      setFeedback(kind === 'banner' ? 'Banner removido; o fallback premium será usado.' : 'Vídeo removido.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível remover o arquivo.')
    } finally {
      setUploading(null)
    }
  }

  async function copyLink() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function shareLink() {
    if (!publicUrl) return
    if (navigator.share) await navigator.share({ title: `Catálogo de ${draft.displayName}`, url: publicUrl }).catch(() => null)
    else await copyLink()
  }

  return (
    <BrokerPageShell title="Catálogo" contentClassName="pb-10">
      <div className="space-y-4 p-3 sm:p-0">
        <BrokerPageIntro
          eyebrow="Catálogo individual"
          title="Seu perfil público profissional"
          description="Configure a apresentação, experiência e mídias exibidas no seu catálogo público."
          actions={<><BrokerStatusPill tone="positive"><Check className="h-3.5 w-3.5" />Catálogo ativo</BrokerStatusPill><BrokerStatusPill>{published.length} {published.length === 1 ? 'imóvel publicado' : 'imóveis publicados'}</BrokerStatusPill></>}
        />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(26rem,.95fr)]">
          <form onSubmit={submit} className="grid gap-4">
            <fieldset disabled={saving || uploading !== null} className="contents">
            <BrokerSurface padding="compact">
              <SectionHeading title="Identidade" description="Foto, nome, endereço e apresentação curta do catálogo." />

              <div className="mt-5 flex items-center gap-3">
                <button type="button" onClick={() => photoInput.current?.click()} className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/[0.08] bg-[#f5f6f3]">
                  {draft.photoUrl ? <Image src={draft.photoUrl} alt="Foto do catálogo" fill sizes="80px" className="object-cover" /> : <ImagePlus className="size-5 text-[#8b95a1]" />}
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[10px] text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">Alterar</span>
                </button>
                <div><p className="text-sm font-semibold text-[#253028]">Foto do perfil</p><p className="mt-1 text-xs leading-relaxed text-[#667085]">JPG, PNG ou WebP. A imagem é otimizada antes de salvar.</p></div>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nome público"><input required maxLength={120} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className={inputClass} /></Field>
                <Field label="Endereço do catálogo"><div className="flex h-10 items-center overflow-hidden rounded-lg border border-black/[0.09] bg-white focus-within:border-[#009b3a]/45 focus-within:ring-2 focus-within:ring-[#009b3a]/8"><span className="border-r border-black/[0.06] bg-[#f7f8f5] px-3 text-xs text-[#667085]">/catalogo/</span><input required value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="min-w-0 flex-1 px-3 text-sm outline-none" /></div></Field>
                <div className="sm:col-span-2"><Field label="Especialidade / apresentação curta"><input maxLength={180} value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} placeholder="Ex.: Especialista em imóveis de alto padrão" className={inputClass} /></Field></div>
              </div>

              <div className="mt-4 rounded-xl border border-black/[0.06] bg-[#f8faf8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#7b8491]">CRECI da conta</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#344054]">
                  <span>{draft.creci ? `CRECI ${draft.creci}${draft.creciUf ? ` · ${draft.creciUf}` : ''}` : 'CRECI não informado'}</span>
                  {draft.creciVerified ? <span className="inline-flex items-center gap-1 rounded-full bg-[#edf9f1] px-2.5 py-1 text-xs font-semibold text-[#168842]"><BadgeCheck className="size-4" />Verificado</span> : <span className="rounded-full bg-[#f0f2ef] px-2.5 py-1 text-xs text-[#667085]">{draft.creciValidationStatus === 'PENDING' ? 'Validação pendente' : 'Não verificado'}</span>}
                </div>
                <p className="mt-2 text-xs text-[#7b8491]">O selo é controlado pela validação real da conta e não pode ser editado aqui.</p>
              </div>
            </BrokerSurface>

            <BrokerSurface padding="compact">
              <SectionHeading title="Banner" description="Imagem panorâmica do topo (JPG, PNG ou WebP, até 4 MB). Sem upload, o catálogo usa o fallback premium EME." />
              <div className="relative mt-4 aspect-[3/1] min-h-36 overflow-hidden rounded-2xl border border-black/[0.07] bg-[#eef2ef]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.bannerUrl || '/marketplace/images/hero-residence.png'} alt="Prévia do banner" className="h-full w-full object-cover" />
                {!draft.bannerUrl ? <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#4f5b54] shadow-sm">Fallback premium</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={saving || uploading !== null} onClick={() => bannerInput.current?.click()} className={secondaryButtonClass}><Upload className="size-4" />{uploading === 'banner' ? 'Enviando...' : draft.bannerUrl ? 'Trocar banner' : 'Enviar banner'}</button>
                {draft.bannerUrl ? <button type="button" disabled={saving || uploading !== null} onClick={() => void removeMedia('banner')} className={dangerButtonClass}><Trash2 className="size-4" />Remover</button> : null}
                <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void uploadMedia('banner', event.target.files?.[0])} />
              </div>
            </BrokerSurface>

            <BrokerSurface padding="compact">
              <SectionHeading title="Experiência e atuação" description="Só os campos preenchidos aparecem no perfil público." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Tempo de atuação (anos)"><input type="number" min={0} max={100} value={draft.experienceYears ?? ''} onChange={(event) => setDraft({ ...draft, experienceYears: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} /></Field>
                <Field label="Imóveis vendidos"><input type="number" min={0} max={1000000} value={draft.soldProperties ?? ''} onChange={(event) => setDraft({ ...draft, soldProperties: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} /></Field>
                <Field label="Área de atuação"><input maxLength={180} value={draft.serviceArea} onChange={(event) => setDraft({ ...draft, serviceArea: event.target.value })} placeholder="Ex.: Litoral Norte de SC" className={inputClass} /></Field>
                <Field label="Faixa de preço"><input maxLength={120} value={draft.priceRange} onChange={(event) => setDraft({ ...draft, priceRange: event.target.value })} placeholder="Ex.: R$ 700 mil – R$ 7,8 mi" className={inputClass} /></Field>
                <div className="sm:col-span-2"><Field label="Cidades atendidas" hint="Separe por vírgulas ou linhas."><textarea rows={3} value={citiesText} onChange={(event) => { setCitiesText(event.target.value); setDraft({ ...draft, cities: parseList(event.target.value) }) }} placeholder="Balneário Camboriú, Itapema, Itajaí" className={textareaClass} /></Field></div>
              </div>
            </BrokerSurface>

            <BrokerSurface padding="compact">
              <SectionHeading title="Sobre o corretor" description="Conte sua trajetória e os pontos que diferenciam seu atendimento." />
              <div className="mt-5 grid gap-4">
                <Field label="Apresentação / bio"><textarea maxLength={2500} rows={7} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder="Apresente sua experiência, seu jeito de atender e o mercado em que atua." className={textareaClass} /></Field>
                <Field label="Especialidades" hint="Separe por vírgulas ou linhas."><textarea rows={3} value={specialtiesText} onChange={(event) => { setSpecialtiesText(event.target.value); setDraft({ ...draft, specialties: parseList(event.target.value) }) }} placeholder="Alto padrão, Frente mar, Coberturas" className={textareaClass} /></Field>
                <Field label="Diferenciais" hint="Cada linha vira um item no perfil público."><textarea rows={4} value={differentialsText} onChange={(event) => { setDifferentialsText(event.target.value); setDraft({ ...draft, differentials: parseList(event.target.value) }) }} placeholder={'Atendimento consultivo e personalizado\nCuradoria rigorosa de imóveis'} className={textareaClass} /></Field>
              </div>
            </BrokerSurface>

            <BrokerSurface padding="compact">
              <SectionHeading title="Vídeo de apresentação" description="Opcional. Envie até 4 MB ou use uma URL HTTPS para arquivos maiores. O player mantém o formato original — paisagem, quadrado ou vertical — sem cortar." />
              {draft.videoUrl ? (
                <div className="mt-4 flex min-h-44 items-center justify-center overflow-hidden rounded-2xl bg-[#101411]">
                  <video src={draft.videoUrl} controls preload="metadata" className="h-auto max-h-[440px] w-auto max-w-full object-contain" />
                </div>
              ) : <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.12] bg-[#fafbf9] text-center"><Film className="size-6 text-[#7f8a83]" /><p className="mt-2 text-sm text-[#667085]">Nenhum vídeo configurado.</p></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={saving || uploading !== null} onClick={() => videoInput.current?.click()} className={secondaryButtonClass}><Upload className="size-4" />{uploading === 'video' ? 'Enviando...' : draft.videoUrl ? 'Trocar vídeo' : 'Enviar vídeo'}</button>
                {draft.videoUrl ? <button type="button" disabled={saving || uploading !== null} onClick={() => void removeMedia('video')} className={dangerButtonClass}><Trash2 className="size-4" />Remover</button> : null}
                <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => void uploadMedia('video', event.target.files?.[0])} />
              </div>
              <Field label="Ou use uma URL pública de vídeo" hint="MP4, WebM ou MOV hospedado em HTTPS."><input type="url" value={draft.videoUrl} onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="https://.../apresentacao.mp4" className={inputClass} /></Field>
            </BrokerSurface>

            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.07] bg-white/92 p-3 shadow-[0_15px_40px_rgba(15,23,42,.1)] backdrop-blur-xl">
              <button disabled={saving || uploading !== null} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-sm shadow-[#009b3a]/12 disabled:opacity-60"><Save className="size-4" />{saving ? 'Salvando...' : 'Salvar catálogo'}</button>
              {feedback ? <p role="status" className="min-w-0 flex-1 text-sm text-[#667085]">{feedback}</p> : null}
            </div>
            </fieldset>
          </form>

          <div className="grid gap-4 xl:sticky xl:top-4">
            <section className="overflow-hidden rounded-[var(--broker-radius-lg)] border border-[var(--broker-border)] bg-[var(--broker-surface)] shadow-[var(--broker-shadow-xs)]">
              <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4"><div><h3 className="font-semibold text-[#050505]">Preview do catálogo</h3><p className="mt-1 text-xs text-[#667085]">Amostra com os dados reais preenchidos.</p></div><span className="rounded-full bg-[#f7f8f5] px-3 py-1 text-[11px] font-semibold text-[#667085]">Sincronizado</span></div>
              <div className="bg-[#f3f5f1] p-4">
                <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-[0_18px_45px_rgba(15,23,42,.08)]">
                  <div className="relative min-h-52 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.bannerUrl || '/marketplace/images/hero-residence.png'} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/88 to-white/10" />
                    <div className="relative flex min-h-52 items-center gap-4 p-5">
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-white bg-[#eef1ec] shadow-md">{draft.photoUrl ? <Image src={draft.photoUrl} alt="" fill sizes="80px" className="object-cover" /> : null}</div>
                      <div className="min-w-0"><p className="flex items-center gap-1.5 truncate text-lg font-semibold text-[#050505]">{draft.displayName || 'Seu nome'}{draft.creciVerified ? <BadgeCheck className="size-4 text-[#16a34a]" /> : null}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#58625c]">{draft.headline || 'Sua especialidade aparecerá aqui.'}</p></div>
                    </div>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-3">{isLoading ? <p className="col-span-full py-6 text-center text-sm text-[#667085]">Carregando imóveis...</p> : published.length ? published.slice(0, 3).map((property) => <article key={property.id} className="min-w-0 overflow-hidden rounded-xl border border-black/[0.06]"><div className="relative aspect-[4/3] bg-[#eef1ec]">{property.images[0] ? <Image src={property.images[0]} alt="" fill sizes="180px" className="object-cover" /> : null}</div><div className="p-3"><p className="truncate text-xs font-semibold text-[#050505]">{property.title}</p><p className="mt-1 truncate text-[11px] text-[#667085]">{property.location}</p><p className="mt-2 text-xs font-semibold text-[#009b3a]">{property.price}</p></div></article>) : <div className="col-span-full rounded-xl border border-dashed border-black/[0.1] px-4 py-8 text-center text-sm text-[#667085]">Os imóveis publicados aparecerão nesta prévia.</div>}</div>
                </div>
              </div>
            </section>

            <BrokerSurface padding="compact">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-[#7b8491]"><Link2 className="size-4 text-[#009b3a]" />URL pública</div>
              <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-black/[0.07] bg-[#f7f8f5] p-2 pl-3"><p className="min-w-0 flex-1 truncate text-sm text-[#344054]">{publicUrl || 'Defina o endereço do catálogo'}</p><button type="button" disabled={!publicUrl} onClick={() => void copyLink()} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#667085] shadow-sm disabled:opacity-40" aria-label="Copiar link">{copied ? <Check className="size-4 text-[#009b3a]" /> : <Copy className="size-4" />}</button></div>
              <div className="mt-3 flex flex-wrap gap-2"><Link href={publicPath} target="_blank" aria-disabled={!draft.slug} className={secondaryButtonClass}><ExternalLink className="size-4" />Abrir link</Link><button type="button" disabled={!publicUrl} onClick={() => void shareLink()} className={secondaryButtonClass}><Share2 className="size-4" />Compartilhar</button></div>
            </BrokerSurface>
          </div>
        </div>
      </div>
    </BrokerPageShell>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h3 className="text-base font-semibold text-[#152019]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#667085]">{description}</p></div>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-[#344054]"><span>{label}</span>{hint ? <span className="ml-1 text-xs font-normal text-[#8a94a1]">{hint}</span> : null}<div className="mt-1.5">{children}</div></label>
}

const inputClass = 'h-10 w-full rounded-lg border border-black/[0.09] bg-white px-3 text-sm text-[#050505] outline-none transition focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/8'
const textareaClass = 'w-full resize-y rounded-lg border border-black/[0.09] bg-white px-3 py-2.5 text-sm text-[#050505] outline-none transition focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/8'
const secondaryButtonClass = 'inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-semibold text-[#344054] shadow-sm transition hover:bg-[#f8faf8] disabled:opacity-50'
const dangerButtonClass = 'inline-flex h-10 items-center gap-2 rounded-xl border border-[#f1d7d7] bg-white px-4 text-sm font-semibold text-[#b42318] transition hover:bg-[#fff7f7] disabled:opacity-50'
