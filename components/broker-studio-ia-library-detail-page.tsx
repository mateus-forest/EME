"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  Download,
  Eye,
  Film,
  ImageIcon,
  Pencil,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  getAssetActionLabels,
  getAssetDownloadDescriptor,
  getEditableStudioAssetFields,
  getAssetOpenDescriptor,
  getAssetPreviewSource,
  formatStudioCampaignAssetType,
  formatStudioCampaignDate,
  formatStudioCampaignKind,
  formatStudioCampaignStatus,
  getCampaignCoverUrl,
  getCampaignPropertyLabel,
  getStudioCampaignWorkspacePath,
  isPreviewableAsset,
  isTextEditableAsset,
  isVisualAsset,
  getStudioStatusTone,
} from "@/lib/studio-campaigns-ui"
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
    return campaign.promptRevised || campaign.prompt || "Prompt não informado."
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
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/92 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" className="h-8 rounded-full border border-black/[0.06] px-3 text-[#667085]">
                  <Link href="/corretor/studio-ia/biblioteca">Voltar para Biblioteca</Link>
                </Button>
                {campaign ? <StatusPill status={campaign.status} /> : null}
              </div>

              {isLoading ? (
                <div className="mt-5 grid gap-3">
                  <div className="h-8 w-56 animate-pulse rounded-full bg-[#eef1f5]" />
                  <div className="h-4 w-80 animate-pulse rounded-full bg-[#f4f6f8]" />
                </div>
              ) : error ? (
                <div className="mt-5">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#050505]">Campanha indisponível</h2>
                  <p className="mt-3 text-sm leading-6 text-[#c24141]">{error}</p>
                </div>
              ) : campaign ? (
                <>
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[#050505]">{campaign.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[#667085]">
                    {formatStudioCampaignKind(campaign.kind)} | {getCampaignPropertyLabel(campaign)}
                  </p>
                </>
              ) : null}
            </div>

            {campaign ? (
              <div className="grid gap-2 text-sm text-[#667085] sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Assets" value={String(campaign.assets.length)} />
                <Metric label="Criada em" value={formatStudioCampaignDate(campaign.createdAt)} />
                <Metric label="Provider" value={campaign.provider || "Não informado"} />
                <Metric label="Modelo" value={campaign.model || "Não informado"} />
              </div>
            ) : null}
          </div>
        </section>

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
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <Card className="overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/92 py-0">
                <div className="relative aspect-[1.85/1] overflow-hidden border-b border-black/[0.05] bg-[linear-gradient(135deg,#f7faf7,#eef6f1)]">
                  <img src={getCampaignCoverUrl(campaign)} alt={campaign.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-6 py-6 text-white">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/78">{formatStudioCampaignKind(campaign.kind)}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">{campaign.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm text-white/82">{getCampaignPropertyLabel(campaign)}</p>
                  </div>
                </div>
                <CardContent className="grid gap-4 p-5">
                  <div className="flex flex-wrap gap-2">
                    {["Versões", "Histórico", "Prompts", "Downloads", "Biblioteca", "Coleções"].map((item) => (
                      <span key={item} className="rounded-full border border-black/[0.06] bg-[#f9fafb] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7b8491]">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoBlock label="Tipo" value={formatStudioCampaignKind(campaign.kind)} />
                    <InfoBlock label="Status" value={formatStudioCampaignStatus(campaign.status)} />
                    <InfoBlock label="Imóvel" value={getCampaignPropertyLabel(campaign)} />
                    <InfoBlock label="Assets" value={`${campaign.assets.length} salvos`} />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/92 py-0">
                  <CardContent className="grid gap-4 p-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b8491]">Prompt utilizado</p>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#44505f]">{campaignPrompt}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/92 py-0">
                  <CardContent className="grid gap-3 p-5">
                    <InfoBlock label="Provider" value={campaign.provider || "Não informado"} />
                    <InfoBlock label="Modelo" value={campaign.model || "Não informado"} />
                    <InfoBlock label="Rota" value={campaign.sourceRoute || "Não informada"} />
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-[#050505]">Assets da campanha</h3>
                  <p className="mt-2 text-sm text-[#667085]">Assets organizados como biblioteca premium, com visualização, abertura, download e ações por tipo.</p>
                </div>
              </div>

              {campaign.assets.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-black/[0.08] bg-white/80 px-6 py-14 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-[1.25rem] border border-[#009b3a]/12 bg-[#eef9f1] text-[#009b3a]">
                    <BookOpen className="size-6" />
                  </div>
                  <h4 className="mt-5 text-xl font-semibold tracking-tight text-[#050505]">Nenhum asset disponível</h4>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#667085]">
                    Esta campanha permanece no histórico, mas no momento não possui assets ativos.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
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
                      onCopyPrompt={() => handleCopyPrompt(asset)}
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
                  <video src={previewAsset.fileUrl} controls className="max-h-[60vh] w-full rounded-[1.25rem] bg-black" />
                ) : (
                  <img
                    src={getAssetPreviewSource(campaign, previewAsset) || ""}
                    alt={previewAsset.label || "Asset"}
                    className="max-h-[60vh] w-full rounded-[1.25rem] object-contain bg-[#f8faf8]"
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
                      {field.kind === "textarea" || field.kind === "tags" ? (
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fcfcfb] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b8491]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#050505]">{value}</p>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fcfcfb] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b8491]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#44505f]">{value}</p>
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
  onCopyPrompt,
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
  onCopyPrompt: () => void
}) {
  const textPreview = getAssetDisplayText(asset)
  const previewSrc = getAssetPreviewSource(campaign, asset)
  const actionLabels = getAssetActionLabels(asset)
  const canPreview = isPreviewableAsset(campaign, asset)
  const canOpen = Boolean(getAssetOpenDescriptor(campaign, asset))
  const canDownload = Boolean(getAssetDownloadDescriptor(campaign, asset)) && asset.type !== "COPY" && asset.type !== "CAROUSEL"
  const canCopyText = Boolean(textPreview.trim())
  const canCopyPrompt = Boolean((asset.promptRevised || asset.prompt || "").trim())
  const canEdit = ["APPROVED", "PUBLISHED"].includes(campaign.status) && isTextEditableAsset(campaign, asset)
  const regenerateBasePath = getStudioCampaignWorkspacePath(campaign.kind)
  const regenerateHref = regenerateBasePath
    ? `${regenerateBasePath}?propertyId=${encodeURIComponent(campaign.propertyId ?? "")}&campaignId=${encodeURIComponent(campaign.id)}&assetKey=${encodeURIComponent(asset.assetKey)}`
    : null

  return (
    <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/92 py-0">
      <div className="border-b border-black/[0.05] bg-[linear-gradient(135deg,#f7faf7,#eef6f1)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-black/[0.06] bg-white/80 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#7b8491]">
                {formatStudioCampaignAssetType(asset.type)}
              </span>
              <StatusPill status={asset.status} />
            </div>
            <h4 className="mt-3 text-lg font-semibold tracking-tight text-[#050505]">
              {asset.label || formatStudioCampaignAssetType(asset.type)}
            </h4>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{formatStudioCampaignDate(asset.createdAt)}</p>
          </div>

          <div className="flex size-11 items-center justify-center rounded-2xl border border-[#009b3a]/12 bg-white/80 text-[#009b3a]">
            {asset.type === "VIDEO" ? <Film className="size-5" /> : <ImageIcon className="size-5" />}
          </div>
        </div>
      </div>

      <CardContent className="grid gap-4 p-5">
        {isVisualAsset(campaign, asset) && previewSrc ? (
          <button
            type="button"
            onClick={onPreview}
            className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-[#f9faf9] text-left"
          >
            {asset.type === "VIDEO" && asset.fileUrl ? (
              <div className="relative flex aspect-[1.5/1] items-center justify-center bg-[#111111] text-white">
                {asset.thumbnailUrl ? (
                  <img src={asset.thumbnailUrl} alt={asset.label || "Preview do asset"} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                ) : null}
                <div className="relative z-10 flex size-14 items-center justify-center rounded-full bg-white/18 backdrop-blur">
                  <Film className="size-6" />
                </div>
              </div>
            ) : (
              <img src={previewSrc} alt={asset.label || "Preview do asset"} className="aspect-[1.5/1] w-full object-cover" />
            )}
          </button>
        ) : (
          <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbfa] p-4 text-sm leading-6 whitespace-pre-wrap text-[#44505f]">
            {textPreview.slice(0, 420)}
            {textPreview.length > 420 ? "..." : ""}
          </div>
        )}

        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={Eye} label="Visualizar" onClick={onPreview} disabled={!canPreview} tone="primary" />
            <ActionButton icon={Download} label={actionLabels.download} onClick={onDownload} disabled={!canDownload} tone="primary" />
            <ActionButton icon={Pencil} label="Editar texto" onClick={onEdit} disabled={!canEdit} tone="primary" />
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton icon={ArrowUpRight} label={actionLabels.open} onClick={onOpen} disabled={!canOpen} tone="secondary" />
            <ActionButton icon={Copy} label={actionLabels.copy} onClick={onCopyCaption} disabled={!canCopyText} tone="secondary" />
            <ActionButton icon={Copy} label={actionLabels.prompt} onClick={onCopyPrompt} disabled={!canCopyPrompt} tone="secondary" />
            {regenerateHref ? (
              <ActionLink icon={RefreshCcw} label="Regenerar" href={regenerateHref} tone="secondary" />
            ) : (
              <ActionButton icon={RefreshCcw} label="Regenerar" onClick={() => undefined} disabled tone="secondary" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">
          <Button
            type="button"
            onClick={onApprove}
            disabled={isUpdating}
            className="h-8.5 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,155,58,0.16)] hover:bg-[#008633] hover:shadow-[0_12px_28px_rgba(0,155,58,0.2)]"
          >
            <Check className="size-4" />
            Aprovar
          </Button>
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

function ActionLink({
  icon: Icon,
  label,
  href,
  disabled,
  download,
  tone = "secondary",
}: {
  icon: typeof Eye
  label: string
  href?: string | null
  disabled?: boolean
  download?: boolean
  tone?: "primary" | "secondary"
}) {
  if (!href || disabled) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className={cn(
          "h-8 rounded-xl border px-3 text-sm text-[#98a2b3]",
          tone === "primary" ? "border-[#009b3a]/10 bg-[#f7fbf8]" : "border-black/[0.06] bg-white/72",
        )}
      >
        <Icon className="size-4" />
        {label}
      </Button>
    )
  }

  return (
    <Button
      asChild
      type="button"
      variant="outline"
      className={cn(
        "h-8 rounded-xl px-3 text-sm transition-colors",
        tone === "primary" &&
          "border border-[#009b3a]/14 bg-[#f7fbf8] text-[#174c2f] shadow-[0_8px_20px_rgba(15,23,42,0.04)] hover:border-[#009b3a]/24 hover:bg-[#eef9f1] hover:text-[#0a8f3d]",
        tone === "secondary" &&
          "border border-black/[0.06] bg-white/72 text-[#44505f] hover:border-[#009b3a]/16 hover:bg-[#f5faf6] hover:text-[#0a8f3d]",
      )}
    >
      <a href={href} target="_blank" rel="noreferrer" download={download}>
        <Icon className="size-4" />
        {label}
      </a>
    </Button>
  )
}
