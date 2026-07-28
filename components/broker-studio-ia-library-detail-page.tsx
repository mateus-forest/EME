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
import {
  studioCampaignsClient,
  type StudioCampaignAssetStatus,
  type StudioCampaignRecord,
} from "@/lib/studio-campaigns-client"
import {
  extractTextFromAsset,
  formatStudioCampaignAssetType,
  formatStudioCampaignDate,
  formatStudioCampaignKind,
  formatStudioCampaignStatus,
  getCampaignCoverUrl,
  getCampaignPropertyLabel,
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

function isVisualAsset(asset: AssetRecord) {
  return Boolean(asset.fileUrl) && (asset.type === "IMAGE" || asset.type === "THUMBNAIL" || asset.type === "VIDEO")
}

function getAssetDisplayText(asset: AssetRecord) {
  const text = extractTextFromAsset(asset)
  return text || "Sem conteudo textual adicional."
}

async function copyText(value: string, fallbackMessage: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(fallbackMessage)
  }

  await navigator.clipboard.writeText(normalized)
}

export function BrokerStudioIaLibraryDetailPage({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [previewAsset, setPreviewAsset] = useState<AssetRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
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
        setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel carregar a campanha.")
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
    return campaign.promptRevised || campaign.prompt || "Prompt nao informado."
  }, [campaign])

  async function handleAssetStatus(assetId: string, status: StudioCampaignAssetStatus) {
    try {
      setIsUpdating(assetId)
      setNotice(null)
      const updated = await studioCampaignsClient.updateAssetStatus(assetId, status)
      setCampaign(updated)
      setNotice(`Asset marcado como ${formatStudioCampaignStatus(status)}.`)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel atualizar o asset.")
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
      setNotice("Asset excluido da campanha.")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel excluir o asset.")
    } finally {
      setIsUpdating(null)
    }
  }

  async function handleCopyCaption(asset: AssetRecord) {
    try {
      await copyText(getAssetDisplayText(asset), "Nao ha legenda disponivel para copiar.")
      setNotice("Conteudo copiado.")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel copiar o conteudo.")
    }
  }

  async function handleCopyPrompt(asset: AssetRecord) {
    try {
      await copyText(asset.promptRevised || asset.prompt || "", "Nao ha prompt disponivel para copiar.")
      setNotice("Prompt copiado.")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel copiar o prompt.")
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
                  <h2 className="text-2xl font-semibold tracking-tight text-[#050505]">Campanha indisponivel</h2>
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
                <Metric label="Provider" value={campaign.provider || "Nao informado"} />
                <Metric label="Modelo" value={campaign.model || "Nao informado"} />
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
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
              <Card className="overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/92 py-0">
                <div className="aspect-[1.9/1] overflow-hidden border-b border-black/[0.05] bg-[linear-gradient(135deg,#f7faf7,#eef6f1)]">
                  {getCampaignCoverUrl(campaign) ? (
                    <img src={getCampaignCoverUrl(campaign)!} alt={campaign.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex size-18 items-center justify-center rounded-[1.75rem] border border-[#009b3a]/12 bg-white/80 text-[#009b3a]">
                        <BookOpen className="size-8" />
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="grid gap-4 p-5">
                  <div className="flex flex-wrap gap-2">
                    {["Versoes", "Historico", "Publicacao", "Favoritos", "Compartilhamento", "Colecoes"].map((item) => (
                      <span key={item} className="rounded-full border border-black/[0.06] bg-[#f9fafb] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7b8491]">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoBlock label="Tipo" value={formatStudioCampaignKind(campaign.kind)} />
                    <InfoBlock label="Status" value={formatStudioCampaignStatus(campaign.status)} />
                    <InfoBlock label="Imovel" value={getCampaignPropertyLabel(campaign)} />
                    <InfoBlock label="Rota" value={campaign.sourceRoute || "Nao informada"} />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/92 py-0">
                <CardContent className="grid gap-4 p-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#7b8491]">Prompt utilizado</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#44505f]">{campaignPrompt}</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-[#050505]">Assets da campanha</h3>
                  <p className="mt-2 text-sm text-[#667085]">Cada asset pode ser revisado, aprovado individualmente e mantido no historico do Studio IA.</p>
                </div>
              </div>

              {campaign.assets.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-black/[0.08] bg-white/80 px-6 py-14 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-[1.25rem] border border-[#009b3a]/12 bg-[#eef9f1] text-[#009b3a]">
                    <BookOpen className="size-6" />
                  </div>
                  <h4 className="mt-5 text-xl font-semibold tracking-tight text-[#050505]">Nenhum asset disponivel</h4>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#667085]">
                    Esta campanha permanece no historico, mas no momento nao possui assets ativos.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {campaign.assets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isUpdating={isUpdating === asset.id}
                      onPreview={() => setPreviewAsset(asset)}
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

              {previewAsset.fileUrl ? (
                previewAsset.type === "VIDEO" ? (
                  <video src={previewAsset.fileUrl} controls className="max-h-[60vh] w-full rounded-[1.25rem] bg-black" />
                ) : (
                  <img src={previewAsset.fileUrl} alt={previewAsset.label || "Asset"} className="max-h-[60vh] w-full rounded-[1.25rem] object-contain bg-[#f8faf8]" />
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
  isUpdating,
  onPreview,
  onApprove,
  onReject,
  onDelete,
  onCopyCaption,
  onCopyPrompt,
}: {
  asset: AssetRecord
  isUpdating: boolean
  onPreview: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onCopyCaption: () => void
  onCopyPrompt: () => void
}) {
  const textPreview = getAssetDisplayText(asset)

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
        {isVisualAsset(asset) ? (
          <button
            type="button"
            onClick={onPreview}
            className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-[#f9faf9] text-left"
          >
            {asset.type === "VIDEO" ? (
              <div className="relative flex aspect-[1.5/1] items-center justify-center bg-[#111111] text-white">
                {asset.thumbnailUrl ? (
                  <img src={asset.thumbnailUrl} alt={asset.label || "Preview do asset"} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                ) : null}
                <div className="relative z-10 flex size-14 items-center justify-center rounded-full bg-white/18 backdrop-blur">
                  <Film className="size-6" />
                </div>
              </div>
            ) : (
              <img src={asset.thumbnailUrl || asset.fileUrl || ""} alt={asset.label || "Preview do asset"} className="aspect-[1.5/1] w-full object-cover" />
            )}
          </button>
        ) : (
          <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbfa] p-4 text-sm leading-6 whitespace-pre-wrap text-[#44505f]">
            {textPreview.slice(0, 420)}
            {textPreview.length > 420 ? "..." : ""}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <ActionButton icon={Eye} label="Visualizar" onClick={onPreview} />
          <ActionLink icon={ArrowUpRight} label="Abrir" href={asset.fileUrl} disabled={!asset.fileUrl} />
          <ActionLink icon={Download} label="Baixar" href={asset.fileUrl} disabled={!asset.fileUrl} download />
          <ActionButton icon={Copy} label="Copiar legenda" onClick={onCopyCaption} />
          <ActionButton icon={Copy} label="Copiar prompt" onClick={onCopyPrompt} />
          <ActionButton icon={RefreshCcw} label="Regenerar" onClick={() => undefined} disabled />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={onApprove}
            disabled={isUpdating}
            className="h-9 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]"
          >
            <Check className="size-4" />
            Aprovar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onReject}
            disabled={isUpdating}
            className="h-9 rounded-xl border-black/[0.08] text-[#44505f]"
          >
            <X className="size-4" />
            Rejeitar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={isUpdating}
            className="h-9 rounded-xl border-[#f3d0d0] text-[#c24141] hover:bg-[#fff5f5] hover:text-[#c24141]"
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
}: {
  icon: typeof Eye
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="h-9 justify-start rounded-xl border-black/[0.06] text-[#44505f]"
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
}: {
  icon: typeof Eye
  label: string
  href?: string | null
  disabled?: boolean
  download?: boolean
}) {
  if (!href || disabled) {
    return (
      <Button type="button" variant="outline" disabled className="h-9 justify-start rounded-xl border-black/[0.06] text-[#98a2b3]">
        <Icon className="size-4" />
        {label}
      </Button>
    )
  }

  return (
    <Button asChild type="button" variant="outline" className="h-9 justify-start rounded-xl border-black/[0.06] text-[#44505f]">
      <a href={href} target="_blank" rel="noreferrer" download={download}>
        <Icon className="size-4" />
        {label}
      </a>
    </Button>
  )
}
