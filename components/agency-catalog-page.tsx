"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Copy,
  Flame,
  Heart,
  ExternalLink,
  Link2,
  RefreshCw,
  Search,
} from "lucide-react"

import { AgencyPageShell } from "@/components/agency-page-shell"
import { PropertyCard } from "@/components/property-card"
import { useAgencyCatalogSettings } from "@/components/use-agency-catalog-settings"
import { useAgencyProfile } from "@/components/use-agency-profile"
import { useAgencyProperties } from "@/components/use-agency-properties"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function AgencyCatalogPage() {
  const { profile } = useAgencyProfile()
  const { settings, saveSettings } = useAgencyCatalogSettings()
  const { properties } = useAgencyProperties()
  const [draftSettings, setDraftSettings] = useState(settings)
  const [saveFeedback, setSaveFeedback] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [previewSearch, setPreviewSearch] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraftSettings(settings)
  }, [settings])

  const catalogUrl = useMemo(() => {
    if (!draftSettings.slug) return ""
    const origin = typeof window === "undefined" ? "" : window.location.origin
    return `${origin}/catalogo/imobiliaria/${draftSettings.slug}`
  }, [draftSettings.slug])
  const publicCatalogPath = useMemo(() => `/catalogo/imobiliaria/${draftSettings.slug}`, [draftSettings.slug])
  const whatsAppUrl = createWhatsAppUrl(
    profile.whatsApp,
    `Olá, tenho interesse no catálogo institucional ${catalogUrl || publicCatalogPath}`,
  )
  const normalizedPreviewSearch = previewSearch.trim().toLowerCase()
  const visibleProperties = useMemo(
    () =>
      properties
        .filter((property) => property.status === "Publicado")
        .filter((property) =>
          normalizedPreviewSearch
            ? property.title.toLowerCase().includes(normalizedPreviewSearch) ||
              property.location.toLowerCase().includes(normalizedPreviewSearch) ||
              property.broker.name.toLowerCase().includes(normalizedPreviewSearch)
            : true,
        ),
    [normalizedPreviewSearch, properties],
  )

  async function copyCatalogLink() {
    if (!catalogUrl) return

    try {
      await navigator.clipboard.writeText(catalogUrl)
      setCopyFeedback(true)
      window.setTimeout(() => setCopyFeedback(false), 1800)
    } catch {
      setCopyFeedback(false)
    }
  }

  function openCatalogLink() {
    if (!draftSettings.slug) return
    window.open(publicCatalogPath, "_blank", "noopener,noreferrer")
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return
    const logoUrl = await readFileAsDataUrl(file)
    setDraftSettings((current) => ({ ...current, logoUrl }))
  }

  async function handleSaveCatalog() {
    try {
      setIsSaving(true)
      const savedSettings = await saveSettings(draftSettings)
      setDraftSettings(savedSettings)
      setSaveFeedback("Catálogo atualizado.")
    } catch (caughtError) {
      setSaveFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar o catálogo.")
    } finally {
      setIsSaving(false)
      window.setTimeout(() => setSaveFeedback(""), 2200)
    }
  }

  function toggleFavorite(propertyId: string) {
    setFavorites((current) =>
      current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId],
    )
  }

  return (
    <AgencyPageShell title="Catálogo da imobiliária" subtitle="Gerencie o catálogo institucional da sua operação">
      <div className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Gestão do catálogo institucional</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 pt-0">
              <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex flex-col items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
                  />
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#00C853]/15 text-xl font-semibold text-[#69F0AE]">
                    {draftSettings.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draftSettings.logoUrl} alt={draftSettings.displayName} className="h-full w-full object-cover" />
                    ) : (
                      "EP"
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 text-white/75 hover:bg-white/[0.08] hover:text-white"
                  >
                    Trocar logo
                  </Button>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-white/70">Nome da imobiliária</span>
                      <Input
                        value={draftSettings.displayName}
                        onChange={(event) =>
                          setDraftSettings((current) => ({ ...current, displayName: event.target.value }))
                        }
                        className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-white/70">Link do catálogo</span>
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 items-stretch gap-2">
                          <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white/45">
                            <Link2 className="size-4 text-white/40" />
                            <span>/catalogo/imobiliaria/</span>
                          </div>
                          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3">
                            <input
                              value={draftSettings.slug}
                              onChange={(event) =>
                                setDraftSettings((current) => ({ ...current, slug: sanitizeSlug(event.target.value) }))
                              }
                              className="h-10 min-w-0 flex-1 truncate bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                              placeholder="nome-da-imobiliaria"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="ghost" onClick={copyCatalogLink} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white" disabled={!draftSettings.slug}>
                            <Copy className="size-4" />
                            {copyFeedback ? "Link copiado" : "Copiar link"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={openCatalogLink} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white" disabled={!draftSettings.slug}>
                            <ExternalLink className="size-4" />
                            Abrir catálogo
                          </Button>
                        </div>
                      </div>
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-white/70">Descrição institucional</span>
                    <Textarea
                      value={draftSettings.description}
                      onChange={(event) =>
                        setDraftSettings((current) => ({ ...current, description: event.target.value }))
                      }
                      className="min-h-24 rounded-[1rem] border-white/[0.08] bg-white/[0.04] text-white"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleSaveCatalog}
                      disabled={isSaving}
                      className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                    >
                      {isSaving ? "Salvando..." : "Salvar alterações"}
                    </Button>
                    {saveFeedback && <p className="text-sm text-[#69F0AE]">{saveFeedback}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">URL pública</p>
                <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
                  <Link2 className="size-4 shrink-0 text-white/35" />
                  <p className="min-w-0 truncate text-base font-medium text-white">{catalogUrl || "Slug indisponível no momento"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardContent className="flex flex-wrap items-center gap-3 p-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1.5 text-sm text-[#69F0AE]">
                  <CheckCircle2 className="size-4" />
                  Catálogo ativo
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white/65">
                  <RefreshCw className="size-4" />
                  Exibindo apenas dados reais
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)] sm:p-6">
          <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Preview público</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Catálogo institucional</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">A prévia abaixo usa o slug real e mostra apenas imóveis publicados do contexto da sua imobiliária.</p>
            </div>

            <Button type="button" variant="ghost" onClick={openCatalogLink} className="h-10 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 text-white/75 hover:bg-white/[0.08] hover:text-white" disabled={!draftSettings.slug}>
              Ver como cliente
            </Button>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/[0.08] bg-[#0f0f0f] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#00C853]/15 text-lg font-semibold text-[#69F0AE]">
                  {draftSettings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draftSettings.logoUrl} alt={draftSettings.displayName} className="h-full w-full object-cover" />
                  ) : (
                    "EP"
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{draftSettings.displayName}</p>
                  <p className="mt-1 max-w-2xl text-sm text-white/50">{draftSettings.description || "Catálogo público com imóveis reais publicados pela sua operação."}</p>
                </div>
              </div>

              <Button asChild className="h-10 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white hover:bg-[#2fe06f]">
                <a href={whatsAppUrl} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
              </Button>
            </div>

            <div className="mt-5 max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/45" />
                <Input
                  value={previewSearch}
                  onChange={(event) => setPreviewSearch(event.target.value)}
                  placeholder="Buscar imóvel"
                  className="h-11 rounded-full border-white/10 bg-white/5 pl-11 text-sm text-white placeholder:text-white/35"
                />
              </div>
            </div>

            {normalizedPreviewSearch && (
              <div className="mt-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
                Filtrando resultados...
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {visibleProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  title={property.title}
                  location={property.location}
                  price={property.price}
                  bedrooms={property.bedrooms}
                  bathrooms={property.bathrooms}
                  parking={property.parking}
                  image={property.image}
                  imageSeed={property.id}
                  status={property.status}
                  statusTone="published"
                  badges={
                    <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
                      <Flame className="h-3 w-3 text-orange-400" />
                      <span className="text-[10px] text-white">Publicado</span>
                    </div>
                  }
                  imageActions={
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleFavorite(property.id)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/55"
                    >
                      <Heart className={`h-4 w-4 ${favorites.includes(property.id) ? "fill-[#69F0AE] text-[#69F0AE]" : "text-white"}`} />
                    </button>
                  }
                  meta={
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                        Publicado por {property.broker.name}
                      </span>
                    </div>
                  }
                  footer={
                    <Button asChild className="h-10 w-full rounded-full bg-[#25D366] text-sm font-semibold text-white hover:bg-[#2fe06f]">
                      <a href={whatsAppUrl} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
                    </Button>
                  }
                />
              ))}
            </div>

            {visibleProperties.length === 0 && (
              <div className="mt-6 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-center text-sm text-white/60">
                Nenhum imóvel encontrado.
              </div>
            )}
          </div>
        </section>
      </div>
    </AgencyPageShell>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível ler o logo selecionado."))
    reader.readAsDataURL(file)
  })
}

function sanitizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}
