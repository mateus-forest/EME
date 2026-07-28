import type {
  StudioCampaignAssetStatus,
  StudioCampaignAssetType,
  StudioCampaignKind,
  StudioCampaignRecord,
  StudioCampaignStatus,
} from "@/lib/studio-campaigns-client"

export function formatStudioCampaignKind(kind: StudioCampaignKind) {
  const labels: Record<StudioCampaignKind, string> = {
    INSTAGRAM: "Instagram",
    BUYERS: "Compradores",
    OWNERS: "Captacao",
    SELL_PROPERTY: "Venda",
    CONSTRUCTION: "Construcao",
    VIDEO: "Video",
  }

  return labels[kind]
}

export function formatStudioCampaignStatus(status: StudioCampaignStatus | StudioCampaignAssetStatus) {
  const labels: Record<StudioCampaignStatus | StudioCampaignAssetStatus, string> = {
    DRAFT: "Rascunho",
    PROCESSING: "Processando",
    PENDING_REVIEW: "Pendente",
    APPROVED: "Aprovada",
    REJECTED: "Rejeitada",
    PUBLISHED: "Publicada",
    FAILED: "Falhou",
  }

  return labels[status]
}

export function formatStudioCampaignAssetType(type: StudioCampaignAssetType) {
  const labels: Record<StudioCampaignAssetType, string> = {
    IMAGE: "Imagem",
    VIDEO: "Video",
    CAROUSEL: "Carrossel",
    STORY: "Story",
    REEL: "Reel",
    COPY: "Copy",
    THUMBNAIL: "Thumbnail",
  }

  return labels[type]
}

export function getStudioStatusTone(status: StudioCampaignStatus | StudioCampaignAssetStatus) {
  switch (status) {
    case "APPROVED":
    case "PUBLISHED":
      return "success"
    case "FAILED":
    case "REJECTED":
      return "danger"
    case "PROCESSING":
      return "default"
    default:
      return "muted"
  }
}

function collectStrings(value: unknown, bucket: string[]) {
  if (typeof value === "string") {
    const normalized = value.trim()
    if (normalized) bucket.push(normalized)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, bucket))
    return
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, bucket))
  }
}

export function extractTextFromAsset(asset: StudioCampaignRecord["assets"][number]) {
  const values: string[] = []
  collectStrings(asset.content, values)
  collectStrings(asset.metadata, values)

  if (asset.label) values.unshift(asset.label)
  if (asset.promptRevised) values.unshift(asset.promptRevised)
  if (asset.prompt) values.unshift(asset.prompt)

  const unique = Array.from(new Set(values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean)))
  return unique.join("\n\n")
}

export function formatStudioCampaignDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function getCampaignCoverUrl(campaign: StudioCampaignRecord) {
  return campaign.primaryAsset?.thumbnailUrl || campaign.primaryAsset?.fileUrl || null
}

export function getCampaignPropertyLabel(campaign: StudioCampaignRecord) {
  if (!campaign.property) return "Sem imovel relacionado"
  return [campaign.property.title, campaign.property.neighborhood, campaign.property.city].filter(Boolean).join(" | ")
}
