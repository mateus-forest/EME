import type {
  StudioCampaignAssetStatus,
  StudioCampaignAssetType,
  StudioCampaignKind,
  StudioCampaignRecord,
  StudioCampaignStatus,
} from "@/lib/studio-campaigns-client"

type CampaignAssetRecord = StudioCampaignRecord["assets"][number]

type VisualAssetDescriptor =
  | { kind: "image"; src: string; filename: string }
  | { kind: "video"; src: string; filename: string }
  | { kind: "synthetic-image"; src: string; filename: string }
  | { kind: "text"; src: string; filename: string }

const premiumPlaceholder = encodeSvg(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f9fcf9"/>
        <stop offset="100%" stop-color="#edf6ef"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#bg)"/>
    <circle cx="600" cy="360" r="140" fill="#dfe9e2"/>
    <rect x="350" y="560" width="500" height="180" rx="90" fill="#e7f1e9"/>
    <text x="600" y="820" fill="#1f3b2d" font-family="Arial, sans-serif" font-size="44" text-anchor="middle">EME Studio IA</text>
  </svg>`,
)

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

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "studio-ia"
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function buildBackgroundLayer(imageUrl: string | null, width: number, height: number) {
  if (!imageUrl) {
    return `<rect width="${width}" height="${height}" fill="#f2f7f3" />`
  }

  return [
    `<image href="${escapeXml(imageUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`,
    `<rect width="${width}" height="${height}" fill="url(#overlayGradient)" />`,
  ].join("")
}

function buildInstagramPostSvg(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = (asset.content ?? {}) as Record<string, unknown>
  const title = typeof content.title === "string" ? content.title : campaign.title
  const highlight = typeof content.highlight === "string" ? content.highlight : campaign.goal ?? ""
  const support = typeof content.support === "string" ? content.support : getCampaignPropertyLabel(campaign)
  const badge = campaign.goal || "EME Studio IA"
  const backgroundImage = campaign.property?.imageUrls?.[0] ?? null
  const width = 1200
  const height = 1200

  return encodeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="overlayGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(5,5,5,0.05)"/>
          <stop offset="100%" stop-color="rgba(5,5,5,0.82)"/>
        </linearGradient>
      </defs>
      ${buildBackgroundLayer(backgroundImage, width, height)}
      <rect x="64" y="68" width="180" height="48" rx="24" fill="rgba(255,255,255,0.92)" />
      <text x="154" y="99" fill="#0a8f3d" font-family="Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle">${escapeXml(badge)}</text>
      <text x="72" y="920" fill="#ffffff" font-family="Arial, sans-serif" font-size="72" font-weight="700">${escapeXml(title)}</text>
      <text x="72" y="990" fill="#e7efe9" font-family="Arial, sans-serif" font-size="34">${escapeXml(highlight)}</text>
      <text x="72" y="1056" fill="#d9e5dd" font-family="Arial, sans-serif" font-size="28">${escapeXml(support)}</text>
      <text x="72" y="1134" fill="#ffffff" font-family="Arial, sans-serif" font-size="30">eme</text>
    </svg>`,
  )
}

function buildInstagramStorySvg(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = (asset.content ?? {}) as Record<string, unknown>
  const kicker = typeof content.kicker === "string" ? content.kicker : campaign.goal ?? "Story"
  const line1 = typeof content.line1 === "string" ? content.line1 : campaign.title
  const line2 = typeof content.line2 === "string" ? content.line2 : getCampaignPropertyLabel(campaign)
  const backgroundImage = campaign.property?.imageUrls?.[0] ?? null
  const width = 1080
  const height = 1920

  return encodeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="overlayGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(5,5,5,0.18)"/>
          <stop offset="100%" stop-color="rgba(5,5,5,0.86)"/>
        </linearGradient>
      </defs>
      ${buildBackgroundLayer(backgroundImage, width, height)}
      <rect x="64" y="88" width="260" height="56" rx="28" fill="rgba(255,255,255,0.9)" />
      <text x="194" y="124" fill="#0a8f3d" font-family="Arial, sans-serif" font-size="26" font-weight="700" text-anchor="middle">${escapeXml(kicker)}</text>
      <text x="76" y="1280" fill="#ffffff" font-family="Arial, sans-serif" font-size="84" font-weight="700">${escapeXml(line1)}</text>
      <text x="76" y="1388" fill="#eef4f0" font-family="Arial, sans-serif" font-size="42">${escapeXml(line2)}</text>
      <rect x="76" y="1710" width="320" height="74" rx="37" fill="rgba(255,255,255,0.16)" />
      <text x="236" y="1758" fill="#ffffff" font-family="Arial, sans-serif" font-size="30" text-anchor="middle">Arraste e descubra</text>
    </svg>`,
  )
}

function createTextDataUrl(text: string) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
}

function getPreferredCampaignAsset(campaign: StudioCampaignRecord) {
  return (
    campaign.assets.find((asset) => asset.assetKey === "post_feed") ??
    campaign.assets.find((asset) => asset.assetKey === "story") ??
    campaign.assets.find((asset) => asset.thumbnailUrl || asset.fileUrl) ??
    campaign.assets[0] ??
    null
  )
}

function resolveVisualAssetDescriptor(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
): VisualAssetDescriptor | null {
  const baseName = sanitizeFileName(`${campaign.title}-${asset.assetKey}`)

  if (asset.type === "VIDEO" && asset.fileUrl) {
    return {
      kind: "video",
      src: asset.fileUrl,
      filename: `${baseName}.mp4`,
    }
  }

  if (asset.fileUrl) {
    return {
      kind: "image",
      src: asset.thumbnailUrl || asset.fileUrl,
      filename: `${baseName}.png`,
    }
  }

  if (campaign.kind === "INSTAGRAM" && asset.assetKey === "post_feed") {
    return {
      kind: "synthetic-image",
      src: buildInstagramPostSvg(campaign, asset),
      filename: `${baseName}.svg`,
    }
  }

  if (campaign.kind === "INSTAGRAM" && asset.assetKey === "story") {
    return {
      kind: "synthetic-image",
      src: buildInstagramStorySvg(campaign, asset),
      filename: `${baseName}.svg`,
    }
  }

  const text = extractTextFromAsset(asset)
  if (text) {
    return {
      kind: "text",
      src: createTextDataUrl(text),
      filename: `${baseName}.txt`,
    }
  }

  return null
}

export function getCampaignCoverUrl(campaign: StudioCampaignRecord) {
  const preferredAsset = getPreferredCampaignAsset(campaign)
  if (preferredAsset) {
    const descriptor = resolveVisualAssetDescriptor(campaign, preferredAsset)
    if (descriptor && descriptor.kind !== "text") return descriptor.src
  }

  return campaign.property?.imageUrls?.[0] || premiumPlaceholder
}

export function getCampaignPropertyLabel(campaign: StudioCampaignRecord) {
  if (!campaign.property) return "Sem imovel relacionado"
  return [campaign.property.title, campaign.property.neighborhood, campaign.property.city].filter(Boolean).join(" | ")
}

export function getStudioCampaignWorkspacePath(kind: StudioCampaignKind) {
  switch (kind) {
    case "INSTAGRAM":
      return "/corretor/studio-ia/criar-campanha-instagram"
    case "BUYERS":
      return "/corretor/studio-ia/atrair-compradores"
    case "OWNERS":
      return "/corretor/studio-ia/captar-proprietarios"
    case "SELL_PROPERTY":
      return "/corretor/studio-ia/vender-este-imovel"
    case "CONSTRUCTION":
      return "/corretor/studio-ia/transformar-obra-em-imovel-pronto"
    case "VIDEO":
      return "/corretor/studio-ia/criar-video-do-imovel"
  }
}

export function getAssetPreviewSource(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const descriptor = resolveVisualAssetDescriptor(campaign, asset)
  if (!descriptor || descriptor.kind === "text") return null
  return descriptor.src
}

export function isPreviewableAsset(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  return Boolean(resolveVisualAssetDescriptor(campaign, asset) || extractTextFromAsset(asset))
}

export function isVisualAsset(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const descriptor = resolveVisualAssetDescriptor(campaign, asset)
  return Boolean(descriptor && descriptor.kind !== "text")
}

export function getAssetOpenDescriptor(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  return resolveVisualAssetDescriptor(campaign, asset)
}

export function getAssetDownloadDescriptor(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  return resolveVisualAssetDescriptor(campaign, asset)
}

export function getAssetActionLabels(asset: CampaignAssetRecord) {
  if (asset.assetKey === "caption") {
    return { copy: "Copiar legenda", open: "Abrir", download: "Baixar", prompt: "Copiar prompt" }
  }

  if (asset.assetKey === "hashtags") {
    return { copy: "Copiar hashtags", open: "Abrir", download: "Baixar", prompt: "Copiar prompt" }
  }

  if (asset.assetKey === "cta") {
    return { copy: "Copiar CTA", open: "Abrir", download: "Baixar", prompt: "Copiar prompt" }
  }

  return { copy: "Copiar conteudo", open: "Abrir", download: "Baixar", prompt: "Copiar prompt" }
}
