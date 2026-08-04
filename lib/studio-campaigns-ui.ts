import type {
  StudioCampaignAssetStatus,
  StudioCampaignAssetType,
  StudioCampaignKind,
  StudioCampaignRecord,
  StudioCampaignStatus,
} from "@/lib/studio-campaigns-client"
import {
  getStudioCreativeFilename,
  getStudioCreativeRenderPath,
  isSyntheticStudioCreative,
} from "@/lib/studio-creative-renderer"

type CampaignAssetRecord = StudioCampaignRecord["assets"][number]

type VisualAssetDescriptor =
  | { kind: "image"; src: string; filename: string }
  | { kind: "video"; src: string; filename: string }
  | { kind: "synthetic-image"; src: string; filename: string }
  | { kind: "text"; src: string; filename: string }

export type StudioEditableFieldKind = "text" | "textarea" | "tags"

export type StudioEditableField = {
  id: string
  label: string
  kind: StudioEditableFieldKind
  placeholder: string
  value: string
}

type StudioLibraryThumbnailResolution = {
  src: string
  fallbacks: string[]
}

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

function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function createTextDataUrl(text: string) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function formatEditablePrice(value: number | null | undefined) {
  if (!value || value <= 0) return ""
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value / 100)
}

function joinLocationParts(...parts: Array<string | null | undefined>) {
  return parts.map((item) => item?.trim()).filter((item): item is string => Boolean(item)).join(", ")
}

function resolveVisualAssetDescriptor(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
): VisualAssetDescriptor | null {
  if (asset.type === "VIDEO" && asset.fileUrl) {
    return {
      kind: "video",
      src: asset.fileUrl,
      filename: `${getStudioCreativeFilename(campaign, asset).replace(/\.png$/i, "")}.mp4`,
    }
  }

  if (asset.fileUrl) {
    return {
      kind: "image",
      src: asset.thumbnailUrl || asset.fileUrl,
      filename: getStudioCreativeFilename(campaign, asset),
    }
  }

  if (isSyntheticStudioCreative(campaign, asset)) {
    // Cache-busted with the asset's own updatedAt (bumped by Prisma's @updatedAt on every content
    // edit): the render path itself is otherwise a stable URL for the asset's lifetime, so without
    // this an <img> re-rendered with the same src never re-fetches after a text edit — the browser
    // just keeps showing the previously decoded bitmap until a hard reload.
    const versionParam = asset.updatedAt ? `?v=${encodeURIComponent(asset.updatedAt)}` : ""
    return {
      kind: "synthetic-image",
      src: `${getStudioCreativeRenderPath(campaign.id, asset.id)}${versionParam}`,
      filename: getStudioCreativeFilename(campaign, asset),
    }
  }

  const text = extractTextFromAsset(asset)
  if (text) {
    return {
      kind: "text",
      src: createTextDataUrl(text),
      filename: `${getStudioCreativeFilename(campaign, asset).replace(/\.png$/i, "")}.txt`,
    }
  }

  return null
}

function cleanMediaUrl(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function uniqueMediaUrls(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => cleanMediaUrl(value)).filter((value): value is string => Boolean(value))))
}

function getCampaignThumbnailPriority(campaign: StudioCampaignRecord) {
  switch (campaign.kind) {
    case "INSTAGRAM":
      return ["post_feed", "story", "carousel"]
    case "VIDEO":
      return ["preview_image", "video_final", "video_request"]
    case "CONSTRUCTION":
      return ["construction_image"]
    case "SELL_PROPERTY":
      return ["campaign", "caption"]
    case "OWNERS":
      return ["ad_copy", "instagram"]
    case "BUYERS":
      return ["copy", "audience"]
    default:
      return []
  }
}

function collectAssetThumbnailCandidates(campaign: StudioCampaignRecord) {
  const prioritizedKeys = getCampaignThumbnailPriority(campaign)
  const prioritizedAssets = prioritizedKeys.flatMap((assetKey) => campaign.assets.filter((asset) => asset.assetKey === assetKey))
  const remainingAssets = campaign.assets.filter((asset) => !prioritizedKeys.includes(asset.assetKey))
  const orderedAssets = [...prioritizedAssets, ...remainingAssets]

  return orderedAssets.flatMap((asset) => {
    const descriptor = resolveVisualAssetDescriptor(campaign, asset)
    if (descriptor?.kind === "image" || descriptor?.kind === "synthetic-image") return [descriptor.src]

    if (descriptor?.kind === "video") {
      return uniqueMediaUrls([asset.thumbnailUrl, campaign.property?.imageUrls?.[0]])
    }

    return uniqueMediaUrls([asset.thumbnailUrl, asset.fileUrl])
  })
}

export function resolveStudioLibraryThumbnail(campaign: StudioCampaignRecord): StudioLibraryThumbnailResolution {
  const candidates = uniqueMediaUrls([
    ...collectAssetThumbnailCandidates(campaign),
    campaign.primaryAsset?.thumbnailUrl,
    campaign.primaryAsset?.type === "VIDEO" ? null : campaign.primaryAsset?.fileUrl,
    campaign.property?.imageUrls?.[0],
    premiumPlaceholder,
  ])

  return {
    src: candidates[0] ?? premiumPlaceholder,
    fallbacks: candidates.slice(1),
  }
}

export function getCampaignCoverUrl(campaign: StudioCampaignRecord) {
  return resolveStudioLibraryThumbnail(campaign).src
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
  const descriptor = resolveVisualAssetDescriptor(campaign, asset)
  if (!descriptor || descriptor.kind !== "synthetic-image") return descriptor

  return {
    ...descriptor,
    src: `${descriptor.src}${descriptor.src.includes("?") ? "&" : "?"}download=1`,
  }
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

export function isTextEditableAsset(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  return Boolean(getEditableStudioAssetFields(campaign, asset).length)
}

export function getEditableStudioAssetFields(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
): StudioEditableField[] {
  const content = asRecord(asset.content)

  if (asset.assetKey === "post_feed") {
    return [
      {
        id: "title",
        label: "Titulo principal",
        kind: "text",
        placeholder: "Deixe em branco para usar o padrao automatico (acao + localizacao)",
        value: readString(content.title),
      },
      {
        id: "location",
        label: "Localizacao",
        kind: "text",
        placeholder: joinLocationParts(campaign.property?.neighborhood, campaign.property?.city) || "Jardins, Sao Paulo - SP",
        value: readString(content.location),
      },
      {
        id: "features",
        label: "Caracteristicas",
        kind: "tags",
        placeholder: "Area privativa\n3 banheiros\n2 vagas",
        value: Array.isArray(content.features)
          ? content.features.filter((item): item is string => typeof item === "string" && item.trim().length > 0).join("\n")
          : "",
      },
      {
        id: "price",
        label: "Preco",
        kind: "text",
        placeholder: formatEditablePrice(campaign.property?.price) || "R$ 1.780.000",
        value: readString(content.price),
      },
      {
        id: "cta",
        label: "CTA",
        kind: "text",
        placeholder: "Agende sua visita",
        value: readString(content.cta),
      },
    ]
  }

  if (asset.assetKey === "story") {
    // No "cta" field here: the Story template has no CTA/calendar section in its price panel
    // (see lib/studio-creative-renderer.ts renderInstagramStoryTemplate) — offering it would
    // resurrect exactly the "field with no renderer effect" problem this cleanup exists to fix.
    return [
      {
        id: "title",
        label: "Titulo principal",
        kind: "text",
        placeholder: "Deixe em branco para usar o padrao automatico (acao + localizacao)",
        value: readString(content.title) || [readString(content.line1), readString(content.line2)].filter(Boolean).join(" "),
      },
      {
        id: "location",
        label: "Localizacao",
        kind: "text",
        placeholder: joinLocationParts(campaign.property?.neighborhood, campaign.property?.city) || "Jardins, Sao Paulo - SP",
        value: readString(content.location),
      },
      {
        id: "features",
        label: "Caracteristicas",
        kind: "tags",
        placeholder: "Area privativa\n3 banheiros\n2 vagas",
        value: Array.isArray(content.features)
          ? content.features.filter((item): item is string => typeof item === "string" && item.trim().length > 0).join("\n")
          : "",
      },
      {
        id: "price",
        label: "Preco",
        kind: "text",
        placeholder: formatEditablePrice(campaign.property?.price) || "R$ 1.780.000",
        value: readString(content.price),
      },
    ]
  }

  if (asset.assetKey === "caption") {
    return [
      {
        id: "body",
        label: "Legenda",
        kind: "textarea",
        placeholder: "Legenda da campanha",
        value: typeof asset.content === "string" ? asset.content : extractTextFromAsset(asset),
      },
    ]
  }

  if (asset.assetKey === "cta") {
    return [
      {
        id: "body",
        label: "CTA",
        kind: "text",
        placeholder: "Agende sua visita",
        value: typeof asset.content === "string" ? asset.content : extractTextFromAsset(asset),
      },
    ]
  }

  if (asset.assetKey === "hashtags") {
    const hashtagValue = Array.isArray(asset.content)
      ? asset.content.filter((item): item is string => typeof item === "string" && item.trim().length > 0).join("\n")
      : extractTextFromAsset(asset)

    return [
      {
        id: "body",
        label: "Hashtags",
        kind: "tags",
        placeholder: "#eme\n#imoveis\n#altopadrao",
        value: hashtagValue,
      },
    ]
  }

  if (asset.type === "COPY") {
    return [
      {
        id: "body",
        label: asset.label || "Conteudo",
        kind: "textarea",
        placeholder: "Conteudo textual",
        value: typeof asset.content === "string" ? asset.content : extractTextFromAsset(asset),
      },
    ]
  }

  return []
}

export function applyEditedStudioAssetFields(
  asset: CampaignAssetRecord,
  values: Record<string, string>,
): unknown {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()]),
  )
  const current = asRecord(asset.content)

  if (asset.assetKey === "hashtags") {
    return normalized.body
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (item.startsWith("#") ? item : `#${item.replace(/^#+/, "")}`))
  }

  if (asset.assetKey === "post_feed" || asset.assetKey === "story") {
    const nextContent = {
      ...current,
      ...normalized,
    } as Record<string, unknown>

    if (typeof normalized.features === "string") {
      nextContent.features = normalized.features
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    }

    return nextContent
  }

  if (asset.assetKey === "caption" || asset.assetKey === "cta" || asset.type === "COPY") {
    return normalized.body || ""
  }

  return {
    ...current,
    ...normalized,
  }
}
