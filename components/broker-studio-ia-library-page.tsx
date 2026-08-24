"use client"

import { useDeferredValue, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, ChevronLeft, ChevronRight, Film, Grid2X2, ImageIcon, Megaphone, Search, Sparkles } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerPageIntro, BrokerStatusPill, BrokerToolbar } from "@/components/broker-portal-ui"
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
  formatStudioDisplayText,
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
      <Card className="min-w-0 overflow-hidden rounded-[var(--broker-radius-md)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--broker-shadow-sm)]">
        <div className="relative aspect-[16/10] overflow-hidden border-b border-[var(--broker-border)] bg-[linear-gradient(135deg,#f7faf7,#eef6f1)]">
          {coverUrl ? (
            <img src={coverUrl} alt={formatStudioDisplayText(campaign.title)} className="h-full w-full object-cover" onError={handleCoverError} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex size-16 items-center justify-center rounded-[1.5rem] border border-[#009b3a]/12 bg-white/80 text-[#009b3a]">
                <BookOpen className="size-7" />
              </div>
            </div>
          )}
          <div className="absolute top-2.5 left-2.5">
            <StatusPill status={campaign.status} />
          </div>
          {isProjectVisualization(campaign) ? <div className="absolute right-2.5 bottom-2.5 max-w-[80%] truncate rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-medium text-[#356047] backdrop-blur">Representação ilustrativa gerada por IA</div> : null}
        </div>

        <CardContent className="grid gap-2 p-3">
          <div className="grid gap-1">
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--broker-muted-soft)]">
              <span>{formatStudioCampaignKind(campaign.kind)}</span>
              <span className="h-1 w-1 rounded-full bg-[#c7d0db]" />
              <span>{campaign.assets.length} itens</span>
              {campaign.provider ? <><span className="h-1 w-1 shrink-0 rounded-full bg-[#c7d0db]" /><span className="truncate">{formatStudioProvider(campaign.provider)}</span></> : null}
            </div>
            <h3 className="line-clamp-1 text-sm font-semibold leading-5 tracking-tight text-[var(--broker-ink)]">{formatStudioDisplayText(campaign.title)}</h3>
            <p className="line-clamp-1 text-[11px] leading-4 text-[var(--broker-muted)]">{getCampaignPropertyLabel(campaign)}</p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--broker-border)] pt-2 text-[10px] text-[var(--broker-muted-soft)]">
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
      <div className="grid gap-3.5">
        <BrokerPageIntro
          eyebrow="Biblioteca"
          title="Acervo do Studio IA"
          description="Campanhas, imagens, vídeos e textos reunidos para consulta, revisão e reaproveitamento."
          actions={(
            <>
              <BrokerStatusPill tone="positive">{pagination.total} materiais</BrokerStatusPill>
              <BrokerStatusPill>Página {pagination.page} de {pagination.totalPages}</BrokerStatusPill>
              {deferredSearch ? <BrokerStatusPill tone="info">Busca ativa</BrokerStatusPill> : null}
            </>
          )}
        />

        <BrokerToolbar
          className="overflow-hidden"
          start={(
            <div className="eme-subtle-scrollbar -m-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-1">
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
                    "h-8 shrink-0 rounded-full border px-3 text-xs",
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
          )}
        />

        <section className="grid gap-3">
          {isLoading ? (
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 min-[1440px]:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface)]">
                  <div className="aspect-[16/10] animate-pulse bg-[#f2f4f7]" />
                  <div className="grid gap-2 p-3">
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
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 min-[1440px]:grid-cols-5">
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface)] px-3 py-2.5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-[#667085]">
              Mostrando {campaigns.length} de {pagination.total} campanhas.
            </p>

            <Pagination className="mx-0 max-w-full justify-start overflow-x-auto md:w-auto md:justify-end">
              <PaginationContent className="min-w-max">
                <PaginationItem>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Página anterior"
                    disabled={pagination.page <= 1 || isLoading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-xl border-black/[0.06]"
                  >
                    <ChevronLeft className="size-4" />
                    <span className="hidden sm:inline">Anterior</span>
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
                    aria-label="Próxima página"
                    disabled={pagination.page >= pagination.totalPages || isLoading}
                    onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                    className="rounded-xl border-black/[0.06]"
                  >
                    <span className="hidden sm:inline">Próxima</span>
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
