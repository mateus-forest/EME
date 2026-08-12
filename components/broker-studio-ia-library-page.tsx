"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronLeft, ChevronRight, Film, Grid2X2, ImageIcon, Megaphone, Search, Sparkles } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  studioCampaignsClient,
  type StudioCampaignAssetType,
  type StudioCampaignKind,
  type StudioCampaignRecord,
  type StudioCampaignStatus,
} from "@/lib/studio-campaigns-client"
import {
  formatStudioCampaignDate,
  formatStudioCampaignKind,
  formatStudioCampaignStatus,
  formatStudioProvider,
  getCampaignPropertyLabel,
  getStudioStatusTone,
  resolveStudioLibraryThumbnail,
} from "@/lib/studio-campaigns-ui"
import { cn } from "@/lib/utils"
import { isProjectVisualization } from "@/lib/studio-asset-context"

type LibraryFilter =
  | "ALL"
  | "IMAGES"
  | "VIDEOS"
  | "INSTAGRAM"
  | "OWNERS"
  | "SELL_PROPERTY"
  | "CONSTRUCTION"
  | "APPROVED"
  | "PENDING_REVIEW"
  | "PUBLISHED"

const FILTERS: Array<{ key: LibraryFilter; label: string; icon: typeof Grid2X2 }> = [
  { key: "ALL", label: "Todos", icon: Grid2X2 },
  { key: "IMAGES", label: "Imagens", icon: ImageIcon },
  { key: "VIDEOS", label: "Vídeos", icon: Film },
  { key: "INSTAGRAM", label: "Instagram", icon: Megaphone },
  { key: "OWNERS", label: "Captação", icon: BookOpen },
  { key: "SELL_PROPERTY", label: "Venda", icon: Sparkles },
  { key: "CONSTRUCTION", label: "Construção", icon: ImageIcon },
  { key: "APPROVED", label: "Aprovadas", icon: BookOpen },
  { key: "PENDING_REVIEW", label: "Pendentes", icon: BookOpen },
  { key: "PUBLISHED", label: "Publicadas", icon: BookOpen },
]

function mapFilterToQuery(filter: LibraryFilter): {
  kind?: StudioCampaignKind
  status?: StudioCampaignStatus
  assetType?: StudioCampaignAssetType
} {
  switch (filter) {
    case "IMAGES":
      return { assetType: "IMAGE" }
    case "VIDEOS":
      return { kind: "VIDEO" }
    case "INSTAGRAM":
      return { kind: "INSTAGRAM" }
    case "OWNERS":
      return { kind: "OWNERS" }
    case "SELL_PROPERTY":
      return { kind: "SELL_PROPERTY" }
    case "CONSTRUCTION":
      return { kind: "CONSTRUCTION" }
    case "APPROVED":
      return { status: "APPROVED" }
    case "PENDING_REVIEW":
      return { status: "PENDING_REVIEW" }
    case "PUBLISHED":
      return { status: "PUBLISHED" }
    default:
      return {}
  }
}

function StatusPill({ status }: { status: StudioCampaignStatus }) {
  const tone = getStudioStatusTone(status)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
        tone === "success" && "bg-[#eef9f1] text-[#0a8f3d]",
        tone === "danger" && "bg-[#fff1f1] text-[#c24141]",
        tone === "default" && "bg-[#f1f5f9] text-[#475569]",
        tone === "muted" && "bg-[#f6f7f9] text-[#667085]",
      )}
    >
      {formatStudioCampaignStatus(status)}
    </span>
  )
}

function CampaignCard({ campaign }: { campaign: StudioCampaignRecord }) {
  const thumbnail = useMemo(() => resolveStudioLibraryThumbnail(campaign), [campaign])
  const initialCoverCandidates = useMemo(() => [thumbnail.src, ...thumbnail.fallbacks], [thumbnail])
  const [coverCandidates, setCoverCandidates] = useState(initialCoverCandidates)
  const coverUrl = coverCandidates[0] ?? null

  useEffect(() => {
    setCoverCandidates(initialCoverCandidates)
  }, [initialCoverCandidates])

  function handleCoverError() {
    setCoverCandidates((current) => (current.length > 1 ? current.slice(1) : current))
  }

  return (
    <Link href={`/corretor/studio-ia/biblioteca/${campaign.id}`} className="min-w-0">
      <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5">
        <div className="relative aspect-[1.25/1] overflow-hidden border-b border-black/[0.05] bg-[linear-gradient(135deg,#f7faf7,#eef6f1)]">
          {coverUrl ? (
            <img src={coverUrl} alt={campaign.title} className="h-full w-full object-cover" onError={handleCoverError} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex size-16 items-center justify-center rounded-[1.5rem] border border-[#009b3a]/12 bg-white/80 text-[#009b3a]">
                <BookOpen className="size-7" />
              </div>
            </div>
          )}
          <div className="absolute top-4 left-4">
            <StatusPill status={campaign.status} />
          </div>
          {isProjectVisualization(campaign) ? <div className="absolute right-4 bottom-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-medium text-[#356047] backdrop-blur">Representação ilustrativa gerada por IA</div> : null}
        </div>

        <CardContent className="grid gap-4 p-5">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#7b8491]">
              <span>{formatStudioCampaignKind(campaign.kind)}</span>
              <span className="h-1 w-1 rounded-full bg-[#c7d0db]" />
              <span>{campaign.assets.length} itens</span>
              {campaign.provider ? <><span className="h-1 w-1 rounded-full bg-[#c7d0db]" /><span>{formatStudioProvider(campaign.provider)}</span></> : null}
            </div>
            <h3 className="line-clamp-2 text-lg font-semibold tracking-tight text-[#050505]">{campaign.title}</h3>
            <p className="line-clamp-2 text-sm leading-6 text-[#667085]">{getCampaignPropertyLabel(campaign)}</p>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-[#7b8491]">
            <span>{formatStudioCampaignDate(campaign.createdAt)}</span>
            <span>v{campaign.version}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function BrokerStudioIaLibraryPage() {
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>("ALL")
  const [page, setPage] = useState(1)
  const [campaigns, setCampaigns] = useState<StudioCampaignRecord[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, activeFilter])

  useEffect(() => {
    let active = true

    async function loadCampaigns() {
      setIsLoading(true)
      setError(null)

      try {
        const query = mapFilterToQuery(activeFilter)
        const result = await studioCampaignsClient.list({
          page,
          limit: 12,
          q: deferredSearch || undefined,
          kind: query.kind,
          status: query.status,
          assetType: query.assetType,
        })

        if (!active) return
        setCampaigns(result.campaigns)
        setPagination(result.pagination)
      } catch (caughtError) {
        if (!active) return
        setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar a Biblioteca.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadCampaigns()

    return () => {
      active = false
    }
  }, [activeFilter, deferredSearch, page])

  const pageItems = useMemo(() => {
    const totalPages = pagination.totalPages
    const current = pagination.page
    const start = Math.max(1, current - 1)
    const end = Math.min(totalPages, current + 1)
    const items: number[] = []
    for (let index = start; index <= end; index += 1) items.push(index)
    return items
  }, [pagination.page, pagination.totalPages])

  return (
    <BrokerPageShell
      title="Biblioteca"
      searchPlaceholder="Pesquisar por título, imóvel ou tipo"
      searchValue={search}
      onSearchChange={setSearch}
    >
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <BookOpen className="size-3.5" />
                Biblioteca
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Histórico permanente do Studio IA</h2>
              <p className="mt-3 text-sm leading-6 text-[#667085]">
                Todas as campanhas, imagens, vídeos e copys gerados pela IA ficam reunidos aqui para consulta, revisão e gestão contínua.
              </p>
            </div>

            <div className="grid gap-2 text-sm text-[#667085] sm:grid-cols-3">
              <Metric label="Campanhas" value={String(pagination.total)} />
              <Metric label="Página" value={`${pagination.page}/${pagination.totalPages}`} />
              <Metric label="Busca" value={deferredSearch ? "Ativa" : "Livre"} />
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-black/[0.06] bg-white/88 p-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const Icon = filter.icon
              const isActive = activeFilter === filter.key
              return (
                <Button
                  key={filter.key}
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveFilter(filter.key)}
                  className={cn(
                    "h-9 rounded-full border px-4 text-sm",
                    isActive
                      ? "border-[#009b3a]/18 bg-[#eef9f1] text-[#0a8f3d] hover:bg-[#e7f6ec]"
                      : "border-black/[0.06] bg-white text-[#667085] hover:bg-[#f8faf8] hover:text-[#050505]",
                  )}
                >
                  <Icon className="size-4" />
                  {filter.label}
                </Button>
              )
            })}
          </div>
        </section>

        <section className="grid gap-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white/88">
                  <div className="aspect-[1.25/1] animate-pulse bg-[#f2f4f7]" />
                  <div className="grid gap-3 p-5">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-[#eef1f5]" />
                    <div className="h-5 w-3/4 animate-pulse rounded-full bg-[#eef1f5]" />
                    <div className="h-4 w-full animate-pulse rounded-full bg-[#f4f6f8]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={Search}
              title="Não foi possível carregar a Biblioteca"
              description={error}
            />
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Nenhuma campanha encontrada"
              description="Ajuste os filtros ou gere novos conteúdos no Studio IA para alimentar a Biblioteca."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[1.5rem] border border-black/[0.06] bg-white/88 px-4 py-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[#667085]">
              Mostrando {campaigns.length} de {pagination.total} campanhas.
            </p>

            <Pagination className="mx-0 w-auto justify-start md:justify-end">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1 || isLoading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-xl border-black/[0.06]"
                  >
                    <ChevronLeft className="size-4" />
                    Anterior
                  </Button>
                </PaginationItem>

                {pageItems.map((item) => (
                  <PaginationItem key={item}>
                    <button
                      type="button"
                      onClick={() => setPage(item)}
                      className={cn(
                        "flex h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-sm font-medium",
                        item === pagination.page
                          ? "border-[#009b3a]/18 bg-[#eef9f1] text-[#0a8f3d]"
                          : "border-black/[0.06] bg-white text-[#667085]",
                      )}
                    >
                      {item}
                    </button>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                    onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                    className="rounded-xl border-black/[0.06]"
                  >
                    Próxima
                    <ChevronRight className="size-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </section>
      </div>
    </BrokerPageShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fcfcfb] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b8491]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[#050505]">{value}</p>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search
  title: string
  description: string
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-black/[0.08] bg-white/78 px-6 py-14 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-[1.25rem] border border-[#009b3a]/12 bg-[#eef9f1] text-[#009b3a]">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight text-[#050505]">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#667085]">{description}</p>
      <Button asChild className="mt-6 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">
        <Link href="/corretor/studio-ia">Voltar ao Studio IA</Link>
      </Button>
    </div>
  )
}
