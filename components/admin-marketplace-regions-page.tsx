'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, ImageIcon, Link as LinkIcon, MapPinned, RefreshCw, Upload } from 'lucide-react'

import { AdminPageShell } from '@/components/admin-page-shell'

type RegionMedia = {
  slug: string
  displayName: string
  city: string
  state: string
  ibgeCode: string | null
  provider: string
  pexelsPhotoId: string | null
  imageUrl: string
  automaticImageUrl: string
  originalUrl: string | null
  photoPageUrl: string | null
  photographer: string | null
  photographerUrl: string | null
  query: string | null
  resolvedAt: string | null
  source: string
  manualImageUrl: string | null
}

export function AdminMarketplaceRegionsPage() {
  const [regions, setRegions] = useState<RegionMedia[]>([])
  const [manualUrls, setManualUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [workingSlug, setWorkingSlug] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/marketplace/regions', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar as regiões.')
      const nextRegions = Array.isArray(payload?.regions) ? payload.regions as RegionMedia[] : []
      setRegions(nextRegions)
      setManualUrls(Object.fromEntries(nextRegions.map((region) => [region.slug, ''])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as regiões.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveUrlOverride(region: RegionMedia) {
    const sourceUrl = manualUrls[region.slug]?.trim() || ''
    if (!sourceUrl) {
      setError('Informe a URL da imagem que deve substituir a mídia automática.')
      return
    }
    setWorkingSlug(region.slug)
    setError('')
    try {
      const response = await fetch(`/api/admin/marketplace/regions/${encodeURIComponent(region.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar a imagem manual.')
      setRegions((current) => current.map((item) => item.slug === region.slug ? payload.region : item))
      setManualUrls((current) => ({ ...current, [region.slug]: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar a imagem manual.')
    } finally {
      setWorkingSlug('')
    }
  }

  async function uploadOverride(region: RegionMedia, file: File) {
    setWorkingSlug(region.slug)
    setError('')
    try {
      const formData = new FormData()
      formData.set('file', file)
      const response = await fetch(`/api/admin/marketplace/regions/${encodeURIComponent(region.slug)}`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível enviar a imagem.')
      setRegions((current) => current.map((item) => item.slug === region.slug ? payload.region : item))
      setManualUrls((current) => ({ ...current, [region.slug]: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar a imagem.')
    } finally {
      setWorkingSlug('')
    }
  }

  async function restoreAutomatic(region: RegionMedia) {
    setWorkingSlug(region.slug)
    setError('')
    try {
      const response = await fetch(`/api/admin/marketplace/regions/${encodeURIComponent(region.slug)}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível voltar para a imagem automática.')
      setRegions((current) => current.map((item) => item.slug === region.slug ? payload.region : item))
      setManualUrls((current) => ({ ...current, [region.slug]: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível voltar para a imagem automática.')
    } finally {
      setWorkingSlug('')
    }
  }

  return (
    <AdminPageShell
      title="Regiões do Marketplace"
      subtitle="Mídias resolvidas automaticamente por município, com override opcional do Master"
    >
      <div className="space-y-5">
        <section className="rounded-[1.5rem] border border-black/[0.06] bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef9f1] text-[#008633]">
              <MapPinned className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-[#101828]">Catálogo automático de regiões</p>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#667085]">
                As regiões continuam vindo dos imóveis publicados. IBGE identifica o município e a foto automática é salva uma única vez para reutilização.
              </p>
            </div>
          </div>
        </section>

        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {loading ? (
          <div className="rounded-[1.5rem] border border-black/[0.06] bg-white p-10 text-center text-sm text-[#667085]">Carregando regiões...</div>
        ) : regions.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {regions.map((region) => {
              const working = workingSlug === region.slug
              return (
                <article key={region.slug} className="overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white shadow-sm">
                  <div className="relative aspect-[16/7] overflow-hidden bg-[radial-gradient(circle_at_75%_20%,rgba(35,120,55,.22),transparent_38%),linear-gradient(145deg,#1f2d25,#102018)]">
                    {region.imageUrl ? (
                      <Image src={region.imageUrl} alt={`Imagem atual de ${region.displayName}`} fill sizes="(max-width: 1280px) 100vw, 50vw" className="object-cover" />
                    ) : (
                      <ImageIcon className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-white/55" aria-hidden="true" />
                    )}
                    <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#344054] shadow-sm backdrop-blur">
                      {region.source === 'manual' ? 'Override manual' : region.provider === 'pexels' ? 'Pexels automático' : 'Fallback EME'}
                    </span>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-[#101828]">{region.displayName}{region.state ? `, ${region.state}` : ''}</h2>
                        <p className="mt-1 text-xs text-[#98a2b3]">IBGE {region.ibgeCode || 'não identificado'} · chave {region.slug}</p>
                      </div>
                      {region.resolvedAt ? <time className="text-xs text-[#98a2b3]">Resolvida em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(region.resolvedAt))}</time> : null}
                    </div>

                    {region.provider === 'pexels' ? (
                      <div className="rounded-xl bg-[#f7f8f5] px-3 py-2 text-xs text-[#667085]">
                        <p>Foto {region.pexelsPhotoId} · busca “{region.query}”</p>
                        <div className="mt-1 flex flex-wrap gap-3">
                          {region.photoPageUrl ? <a href={region.photoPageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[#008633]">Abrir foto <ExternalLink className="h-3 w-3" /></a> : null}
                          {region.photographerUrl && region.photographer ? <a href={region.photographerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[#008633]">{region.photographer} <ExternalLink className="h-3 w-3" /></a> : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id={`upload-${region.slug}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={working}
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (file) void uploadOverride(region, file)
                          }}
                        />
                        <label htmlFor={`upload-${region.slug}`} className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white ${working ? 'pointer-events-none opacity-60' : ''}`}>
                          <Upload className="h-4 w-4" /> Enviar imagem
                        </label>
                        <span className="text-xs text-[#98a2b3]">JPG, PNG ou WebP · até 4 MB</span>
                      </div>

                      <label htmlFor={`manual-${region.slug}`} className="text-xs font-medium text-[#475467]">Usar URL de uma imagem</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          id={`manual-${region.slug}`}
                          type="url"
                          value={manualUrls[region.slug] || ''}
                          onChange={(event) => setManualUrls((current) => ({ ...current, [region.slug]: event.target.value }))}
                          placeholder="https://..."
                          className="h-10 min-w-0 flex-1 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-[#009b3a]/40"
                        />
                        <button type="button" disabled={working} onClick={() => void saveUrlOverride(region)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-semibold text-[#475467] disabled:opacity-60">
                          <LinkIcon className="h-4 w-4" /> Usar URL
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-black/[0.06] pt-4">
                      <p className="text-xs text-[#98a2b3]">A imagem automática permanece registrada separadamente.</p>
                      <button type="button" disabled={working} onClick={() => void restoreAutomatic(region)} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-black/10 px-3 text-xs font-semibold text-[#475467] disabled:opacity-60">
                        <RefreshCw className={`h-3.5 w-3.5 ${working ? 'animate-spin' : ''}`} /> Usar automática
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-white p-10 text-center">
            <MapPinned className="mx-auto h-6 w-6 text-[#98a2b3]" />
            <p className="mt-3 font-medium text-[#344054]">Nenhuma região com imóvel publicado</p>
          </div>
        )}
      </div>
    </AdminPageShell>
  )
}
