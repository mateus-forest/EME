"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  Copy,
  Download,
  Eye,
  Film,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerPageIntro, BrokerStatusPill, BrokerSurface } from "@/components/broker-portal-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  studioCampaignsClient,
  type StudioCampaignAssetStatus,
  type StudioCampaignRecord,
} from "@/lib/studio-campaigns-client"
import {
  applyEditedStudioAssetFields,
  extractTextFromAsset,
  formatStudioCurrencyInput,
  getAssetActionLabels,
  getAssetDownloadDescriptor,
  getEditableStudioAssetFields,
  getAssetOpenDescriptor,
  getAssetPreviewSource,
  formatStudioCampaignAssetType,
  formatStudioCampaignDate,
  formatStudioDisplayText,
  formatStudioCampaignKind,
  formatStudioCampaignStatus,
  formatStudioProvider,
  getCampaignCoverUrl,
  getCampaignPropertyLabel,
  getStudioCampaignWorkspacePath,
  isPreviewableAsset,
  isTextEditableAsset,
  isVisualAsset,
  getStudioStatusTone,
} from "@/lib/studio-campaigns-ui"
import { getStudioNextActionLinks, isProjectVisualization } from "@/lib/studio-asset-context"
import { cn } from "@/lib/utils"

type AssetRecord = StudioCampaignRecord["assets"][number]

function StatusPill({ status }: { status: StudioCampaignRecord["status"] | StudioCampaignAssetStatus }) {
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

function getAssetDisplayText(asset: AssetRecord) {
  const text = extractTextFromAsset(asset)
  return text || "Sem conteúdo textual adicional."
}

async function copyText(value: string, fallbackMessage: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(fallbackMessage)
  }

  await navigator.clipboard.writeText(normalized)
}

function triggerDownload(href: string, filename?: string) {
  const anchor = document.createElement("a")
  anchor.href = href
  if (filename) anchor.download = filename
  anchor.target = "_blank"
  anchor.rel = "noreferrer"
  anchor.click()
}

function openDescriptor(descriptor: ReturnType<typeof getAssetOpenDescriptor>) {
  if (!descriptor) return
  window.open(descriptor.src, "_blank", "noopener,noreferrer")
}

function isPortraitStudioAsset(asset: AssetRecord) {
  return asset.assetKey === "story" || asset.type === "STORY"
}

export function BrokerStudioIaLibraryDetailPage({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [previewAsset, setPreviewAsset] = useState<AssetRecord | null>(null)
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadCampaign() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await studioCampaignsClient.getById(campaignId)
        if (!active) return
        setCampaign(result)
      } catch (caughtError) {
        if (!active) return
        setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar a campanha.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadCampaign()

    return () => {
      active = false
    }
  }, [campaignId])

  const campaignPrompt = useMemo(() => {
    if (!campaign) return ""
    return formatStudioDisplayText(campaign.promptRevised || campaign.prompt || "Prompt não informado.")
  }, [campaign])

  const editableFields = useMemo(() => {
    if (!campaign || !editingAsset) return []
    return getEditableStudioAssetFields(campaign, editingAsset)
  }, [campaign, editingAsset])

  useEffect(() => {
    if (!editingAsset || !campaign) {
      setEditValues({})
      return
    }

    const nextValues = Object.fromEntries(
      getEditableStudioAssetFields(campaign, editingAsset).map((field) => [field.id, field.value]),
    )
    setEditValues(nextValues)
  }, [campaign, editingAsset])

  async function handleAssetStatus(assetId: string, status: StudioCampaignAssetStatus) {
    try {
      setIsUpdating(assetId)
      setNotice(null)
      const updated = await studioCampaignsClient.updateAssetStatus(assetId, status)
      setCampaign(updated)
      setNotice(`Asset marcado como ${formatStudioCampaignStatus(status)}.`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o asset.")
    } finally {
      setIsUpdating(null)
    }
  }

  async function handleDeleteAsset(asset: AssetRecord) {
    const confirmed = window.confirm("Excluir este asset da Biblioteca?")
    if (!confirmed) return

    try {
      setIsUpdating(asset.id)
      setNotice(null)
      const updated = await studioCampaignsClient.deleteAsset(asset.id)
      setCampaign(updated)
      setPreviewAsset((current) => (current?.id === asset.id ? null : current))
      setNotice("Asset excluído da campanha.")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o asset.")
    } finally {
      setIsUpdating(null)
    }
  }

  async function handleCopyCaption(asset: AssetRecord) {
    try {
      await copyText(getAssetDisplayText(asset), "Não há legenda disponível para copiar.")
      setNotice("Conteúdo copiado.")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível copiar o conteúdo.")
    }
  }

  async function handleCopyPrompt(asset: AssetRecord) {
    try {
      await copyText(asset.promptRevised || asset.prompt || "", "Não há prompt disponível para copiar.")
      setNotice("Prompt copiado.")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível copiar o prompt.")
    }
  }

  function handleOpenAsset(asset: AssetRecord) {
    if (!campaign) return
    openDescriptor(getAssetOpenDescriptor(campaign, asset))
  }

  function handleDownloadAsset(asset: AssetRecord) {
    if (!campaign) return
    const descriptor = getAssetDownloadDescriptor(campaign, asset)
    if (!descriptor) return
    triggerDownload(descriptor.src, descriptor.filename)
  }

  async function handleSaveEdit() {
    if (!campaign || !editingAsset) return

    try {
      setIsSavingEdit(true)
      setNotice(null)
      setError(null)
      const content = applyEditedStudioAssetFields(editingAsset, editValues)
      const updated = await studioCampaignsClient.updateAssetContent(editingAsset.id, content)
      setCampaign(updated)
      setNotice("Conteúdo textual atualizado. O preview e a exportação usam a mesma renderização oficial.")
      setEditingAsset(null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar a edição do asset.")
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <BrokerPageShell title="Biblioteca">
      <div className="grid gap-5">
        <BrokerPageIntro
          eyebrow="Biblioteca"
          title={isLoading ? "Carregando campanha..." : error ? "Campanha indisponível" : campaign ? formatStudioDisplayText(campaign.title) : "Campanha"}
          description={campaign
            ? `${formatStudioCampaignKind(campaign.kind)} · ${getCampaignPropertyLabel(campaign)}`
            : error ?? "Conteúdos, revisões e arquivos desta geração."}
          actions={(
            <>
              <Button asChild variant="outline" className="h-8 rounded-lg border-[var(--broker-border)] px-3 text-xs text-[var(--broker-muted)]">
                <Link href="/corretor/studio-ia/biblioteca">
                  <ChevronLeft className="size-3.5" />
                  Voltar
                </Link>
              </Button>
              {campaign ? <StatusPill status={campaign.status} /> : null}
            </>
          )}
        />

        {campaign ? (
          <div className="flex min-w-0 flex-wrap gap-2">
            <BrokerStatusPill tone="positive">{campaign.assets.length} itens</BrokerStatusPill>
            <BrokerStatusPill>Criada em {formatStudioCampaignDate(campaign.createdAt)}</BrokerStatusPill>
            <BrokerStatusPill>IA · {formatStudioProvider(campaign.provider)}</BrokerStatusPill>
          </div>
        ) : null}

        {notice ? (
          <section className="rounded-[1.25rem] border border-[#009b3a]/16 bg-[#eef9f1] px-4 py-3 text-sm text-[#0a8f3d]">
            {notice}
          </section>
        ) : null}

        {error && !isLoading ? (
          <section className="rounded-[1.25rem] border border-[#f2caca] bg-[#fff5f5] px-4 py-3 text-sm text-[#c24141]">
            {error}
          </section>
        ) : null}

        {campaign ? (
          <>
            <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
              <Card className="overflow-hidden rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
                <div className="relative aspect-[4/3] overflow-hidden border-b border-[var(--broker-border)] bg-[linear-gradient(135deg,#f7faf7,#eef6f1)] sm:aspect-[1.85/1]">
                  <img src={getCampaignCoverUrl(campaign)} alt={formatStudioDisplayText(campaign.title)} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-4 py-4 text-white sm:px-5 sm:py-5">
                    <p className="text-[9px] uppercase tracking-[0.16em] text-white/78">{formatStudioCampaignKind(campaign.kind)}</p>
                    <h3 className="mt-1.5 line-clamp-2 text-lg font-semibold tracking-tight sm:text-xl">{formatStudioDisplayText(campaign.title)}</h3>
                    <p className="mt-1.5 line-clamp-1 text-xs text-white/82">{getCampaignPropertyLabel(campaign)}</p>
                  </div>
                </div>
                <CardContent className="grid gap-3 p-3.5 sm:p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InfoBlock label="Tipo" value={formatStudioCampaignKind(campaign.kind)} />
                    <InfoBlock label="Status" value={formatStudioCampaignStatus(campaign.status)} />
                    <InfoBlock label="Imóvel" value={getCampaignPropertyLabel(campaign)} />
                    <InfoBlock label="Itens" value={`${campaign.assets.length} salvos`} />
                  </div>
                </CardContent>
              </Card>

              <div className="grid content-start gap-3">
                <BrokerSurface padding="compact">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--broker-muted-soft)]">Orientação da criação</p>
                      <p className="eme-subtle-scrollbar mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-6 text-[var(--broker-muted)]">{campaignPrompt}</p>
                    </div>
                </BrokerSurface>
                <BrokerSurface padding="compact">
                  <InfoBlock label="IA utilizada" value={formatStudioProvider(campaign.provider)} />
                </BrokerSurface>
              </div>
            </section>

            <section className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-[var(--broker-ink)]">Conteúdos da campanha</h3>
                  <p className="mt-1 text-sm text-[var(--broker-muted)]">Visualize, revise, baixe ou reaproveite cada material.</p>
                </div>
              </div>

              {campaign.assets.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-black/[0.08] bg-white/80 px-6 py-14 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-[1.25rem] border border-[#009b3a]/12 bg-[#eef9f1] text-[#009b3a]">
                    <BookOpen className="size-6" />
                  </div>
                  <h4 className="mt-5 text-xl font-semibold tracking-tight text-[#050505]">Nenhum conteúdo disponível</h4>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#667085]">
                    Esta campanha permanece no histórico, mas no momento não possui conteúdos ativos.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 min-[1600px]:grid-cols-4">
                  {campaign.assets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      campaign={campaign}
                      isUpdating={isUpdating === asset.id}
                      onPreview={() => setPreviewAsset(asset)}
                      onOpen={() => handleOpenAsset(asset)}
                      onDownload={() => handleDownloadAsset(asset)}
                      onEdit={() => setEditingAsset(asset)}
                      onApprove={() => handleAssetStatus(asset.id, "APPROVED")}
                      onReject={() => handleAssetStatus(asset.id, "REJECTED")}
                      onDelete={() => handleDeleteAsset(asset)}
                      onCopyCaption={() => handleCopyCaption(asset)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      <Dialog open={Boolean(previewAsset)} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-white text-[#050505]">
          {previewAsset ? (
            <>
              <DialogHeader>
                <DialogTitle>{previewAsset.label || formatStudioCampaignAssetType(previewAsset.type)}</DialogTitle>
                <DialogDescription className="text-[#667085]">
                  {formatStudioCampaignAssetType(previewAsset.type)} | {formatStudioCampaignStatus(previewAsset.status)}
                </DialogDescription>
              </DialogHeader>

              {campaign && getAssetPreviewSource(campaign, previewAsset) ? (
                previewAsset.type === "VIDEO" && previewAsset.fileUrl ? (
                  <video src={previewAsset.fileUrl} controls preload="metadata" className="max-h-[60vh] w-full rounded-[1.25rem] bg-black" />
                ) : (
                  <img
                    src={getAssetPreviewSource(campaign, previewAsset) || ""}
                    alt={previewAsset.label || "Asset"}
                    className={cn(
                      "rounded-[1.25rem] object-contain bg-[#f8faf8]",
                      isPortraitStudioAsset(previewAsset) ? "mx-auto max-h-[72vh] w-auto max-w-full" : "max-h-[60vh] w-full",
                    )}
                  />
                )
              ) : (
                <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbfa] p-4 text-sm leading-6 whitespace-pre-wrap text-[#44505f]">
                  {getAssetDisplayText(previewAsset)}
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingAsset)} onOpenChange={(open) => !open && !isSavingEdit && setEditingAsset(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-[1.75rem] border-black/[0.06] bg-white text-[#050505]">
          {editingAsset ? (
            <>
              <DialogHeader>
                <DialogTitle>Editar conteúdos textuais</DialogTitle>
                <DialogDescription className="text-[#667085]">
                  Ajuste somente os textos. A identidade visual, o grid e a renderização oficial permanecem preservados.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                {editableFields.length > 0 ? (
                  editableFields.map((field) => (
                    <label key={field.id} className="grid gap-2">
                      <span className="text-sm font-medium text-[#44505f]">{field.label}</span>
                      {field.kind === "select" ? (
                        <select
                          value={editValues[field.id] ?? ""}
                          onChange={(event) => setEditValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-[#101828] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">{field.placeholder}</option>
                          {(field.options ?? []).map((option) => {
                            const selectedInAnotherField = Object.entries(editValues).some(
                              ([key, value]) => key !== field.id && /^feature[1-4]$/.test(key) && value === option.value,
                            )
                            return (
                              <option key={option.value} value={option.value} disabled={selectedInAnotherField}>
                                {option.label}
                              </option>
                            )
                          })}
                        </select>
                      ) : field.kind === "textarea" || field.kind === "tags" ? (
                        <Textarea
                          value={editValues[field.id] ?? ""}
                          onChange={(event) => setEditValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          placeholder={field.placeholder}
                          rows={field.kind === "tags" ? 5 : 4}
                        />
                      ) : (
                        <Input
                          value={editValues[field.id] ?? ""}
                          onChange={(event) => setEditValues((current) => ({ ...current, [field.id]: event.target.value }))}
                          onBlur={() => {
                            if (field.kind !== "currency") return
                            setEditValues((current) => ({
                              ...current,
                              [field.id]: formatStudioCurrencyInput(current[field.id] ?? ""),
                            }))
                          }}
                          inputMode={field.kind === "currency" ? "numeric" : undefined}
                          placeholder={field.placeholder}
                        />
                      )}
                    </label>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-black/[0.08] bg-[#fbfbfa] px-4 py-5 text-sm text-[#667085]">
                    Este asset não possui campos textuais editáveis nesta etapa.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAsset(null)}
                  disabled={isSavingEdit}
                  className="h-9 rounded-xl border-black/[0.08] px-4 text-[#44505f]"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit || editableFields.length === 0}
                  className="h-9 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]"
                >
                  {isSavingEdit ? "Salvando..." : "Salvar textos"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </BrokerPageShell>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--broker-muted-soft)]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--broker-muted)]">{value}</p>
    </div>
  )
}

function AssetCard({
  asset,
  campaign,
  isUpdating,
  onPreview,
  onOpen,
  onDownload,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  onCopyCaption,
}: {
  asset: AssetRecord
  campaign: StudioCampaignRecord
  isUpdating: boolean
  onPreview: () => void
  onOpen: () => void
  onDownload: () => void
  onEdit: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onCopyCaption: () => void
}) {
  const textPreview = getAssetDisplayText(asset)
  const previewSrc = getAssetPreviewSource(campaign, asset)
  const actionLabels = getAssetActionLabels(asset)
  const canPreview = isPreviewableAsset(campaign, asset)
  const canOpen = Boolean(getAssetOpenDescriptor(campaign, asset))
  const canDownload = Boolean(getAssetDownloadDescriptor(campaign, asset)) && asset.type !== "COPY" && asset.type !== "CAROUSEL"
  const canCopyText = Boolean(textPreview.trim())
  // Previously gated to APPROVED/PUBLISHED only, which left "Editar texto" disabled on every
  // campaign right after generation (campaigns start at PENDING_REVIEW) — exactly when a broker
  // is most likely to want to fix a typo before approving. Editing text pre-approval doesn't
  // publish anything by itself, so there's no reason to block it; only REJECTED/FAILED (nothing
  // left to usefully edit) and DRAFT (no generated content yet) stay disabled.
  const canEdit = ["PENDING_REVIEW", "APPROVED", "PUBLISHED"].includes(campaign.status) && isTextEditableAsset(campaign, asset)
  const isPortrait = isPortraitStudioAsset(asset)
  const regenerateBasePath = getStudioCampaignWorkspacePath(campaign.kind)
  const regenerateHref = regenerateBasePath
    ? `${regenerateBasePath}?propertyId=${encodeURIComponent(campaign.propertyId ?? "")}&campaignId=${encodeURIComponent(campaign.id)}&assetKey=${encodeURIComponent(asset.assetKey)}`
    : null
  const nextActions = getStudioNextActionLinks(campaign, asset)
  const illustrative = isProjectVisualization(campaign, asset)

  return (
    <Card className="overflow-hidden rounded-[var(--broker-radius-md)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow-xs)]">
      <div className="border-b border-[var(--broker-border)] bg-[linear-gradient(135deg,#f7faf7,#eef6f1)] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-black/[0.06] bg-white/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#7b8491]">
                {formatStudioCampaignAssetType(asset.type)}
              </span>
              <StatusPill status={asset.status} />
            </div>
            <h4 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 tracking-tight text-[var(--broker-ink)] sm:text-[15px]">
              {asset.label || formatStudioCampaignAssetType(asset.type)}
            </h4>
            <p className="mt-1 text-[10px] leading-5 text-[var(--broker-muted-soft)]">{formatStudioCampaignDate(asset.createdAt)}</p>
          </div>

          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#009b3a]/12 bg-white/80 text-[#009b3a]">
            {asset.type === "VIDEO" ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
          </div>
        </div>
      </div>

      <CardContent className="grid gap-3 p-3.5">
        {illustrative ? <div className="rounded-xl border border-[#009b3a]/14 bg-[#f4fbf6] px-3 py-2 text-xs text-[#356047]">Representação ilustrativa gerada por IA</div> : null}
        {isVisualAsset(campaign, asset) && previewSrc ? (
          <button
            type="button"
            onClick={onPreview}
            className={cn(
              "overflow-hidden rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[#f9faf9] text-left",
              isPortrait && "mx-auto w-full max-w-[13rem]",
            )}
          >
            {asset.type === "VIDEO" && asset.fileUrl ? (
                <div className="relative flex aspect-[4/3] items-center justify-center bg-[#111111] text-white">
                {asset.thumbnailUrl ? (
                  <img src={asset.thumbnailUrl} alt={asset.label || "Preview do asset"} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                ) : null}
                <div className="relative z-10 flex size-14 items-center justify-center rounded-full bg-white/18 backdrop-blur">
                  <Film className="size-6" />
                </div>
              </div>
            ) : (
              <img
                src={previewSrc}
                alt={asset.label || "Preview do asset"}
                className={cn(
                  "w-full bg-[#f8faf8]",
                  isPortrait ? "aspect-[9/16] object-contain" : "aspect-[4/3] object-cover",
                )}
              />
            )}
          </button>
        ) : (
          <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbfa] p-4 text-sm leading-6 whitespace-pre-wrap text-[#44505f]">
            {textPreview.slice(0, 280)}
            {textPreview.length > 280 ? "..." : ""}
          </div>
        )}

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton icon={Eye} label="Visualizar" onClick={onPreview} disabled={!canPreview} tone="primary" />
            <ActionButton icon={Download} label={actionLabels.download} onClick={onDownload} disabled={!canDownload} tone="primary" />
            <ActionButton icon={Pencil} label="Editar texto" onClick={onEdit} disabled={!canEdit} tone="primary" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-xl border-black/[0.06] bg-white/72 px-3 text-sm text-[#44505f] transition-colors hover:border-[#009b3a]/16 hover:bg-[#f5faf6] hover:text-[#0a8f3d]"
                >
                  <MoreHorizontal className="size-4" />
                  Mais
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border-black/[0.06] bg-white/95 p-2 text-[#050505] shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl"
              >
                <DropdownMenuItem
                  onSelect={canOpen ? onOpen : undefined}
                  disabled={!canOpen}
                  className="rounded-xl text-[#44505f] focus:bg-[#f5faf6] focus:text-[#0a8f3d]"
                >
                  <ArrowUpRight className="size-4 text-[#7b8491]" />
                  {actionLabels.open}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={canCopyText ? onCopyCaption : undefined}
                  disabled={!canCopyText}
                  className="rounded-xl text-[#44505f] focus:bg-[#f5faf6] focus:text-[#0a8f3d]"
                >
                  <Copy className="size-4 text-[#7b8491]" />
                  {actionLabels.copy}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={regenerateHref ? () => {
                    window.location.href = regenerateHref
                  } : undefined}
                  disabled={!regenerateHref}
                  className="rounded-xl text-[#44505f] focus:bg-[#f5faf6] focus:text-[#0a8f3d]"
                >
                  <RefreshCcw className="size-4 text-[#7b8491]" />
                  Regenerar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-[var(--broker-border)] pt-3">
          <Button
            type="button"
            onClick={onApprove}
            disabled={isUpdating || asset.status === "APPROVED"}
            className="h-8.5 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,155,58,0.16)] hover:bg-[#008633] hover:shadow-[0_12px_28px_rgba(0,155,58,0.2)]"
          >
            <Check className="size-4" />
            {asset.status === "APPROVED" ? "Aprovado" : "Aprovar"}
          </Button>
          {nextActions.map((action) => <Button key={action.href} asChild variant="outline" className="h-8 rounded-xl border-[#009b3a]/18 bg-[#f7fbf8] px-3 text-sm text-[#174c2f]"><Link href={action.href}>{action.label}<ArrowUpRight className="size-4" /></Link></Button>)}
          <Button
            type="button"
            variant="outline"
            onClick={onReject}
            disabled={isUpdating}
            className="h-8 rounded-xl border-black/[0.08] bg-white/70 px-3 text-sm text-[#44505f] hover:border-[#009b3a]/18 hover:bg-[#eef9f1] hover:text-[#0a8f3d]"
          >
            <X className="size-4" />
            Rejeitar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={isUpdating}
            className="h-8 rounded-xl border-[#f3d0d0] bg-white/70 px-3 text-sm text-[#c24141] hover:border-[#e8b5b5] hover:bg-[#fff5f5] hover:text-[#c24141]"
          >
            <Trash2 className="size-4" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "secondary",
}: {
  icon: typeof Eye
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: "primary" | "secondary"
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 rounded-xl px-3 text-sm transition-colors",
        tone === "primary" &&
          "border border-[#009b3a]/14 bg-[#f7fbf8] text-[#174c2f] shadow-[0_8px_20px_rgba(15,23,42,0.04)] hover:border-[#009b3a]/24 hover:bg-[#eef9f1] hover:text-[#0a8f3d]",
        tone === "secondary" &&
          "border border-black/[0.06] bg-white/72 text-[#44505f] hover:border-[#009b3a]/16 hover:bg-[#f5faf6] hover:text-[#0a8f3d]",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Button>
  )
}
