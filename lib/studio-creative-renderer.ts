import type { StudioCampaignRecord } from "@/lib/studio-campaigns-client"

type CampaignAssetRecord = StudioCampaignRecord["assets"][number]

export type StudioCreativeFormat =
  | "feed"
  | "story"
  | "reels_cover"
  | "thumbnail"
  | "whatsapp"
  | "catalog"

type StudioTemplateId = "instagram-feed-official" | "instagram-story-official"

type StudioTemplateDefinition = {
  id: StudioTemplateId
  format: StudioCreativeFormat
  width: number
  height: number
  render: (payload: StudioCreativePayload) => string
}

type StudioCreativePayload = {
  width: number
  height: number
  badgeLabel: string
  title: string
  subtitle: string
  description: string
  location: string
  features: string[]
  price: string
  metricLabel: string
  metricSupport: string
  ctaLabel: string
  ctaSupport: string
  footer: string
  propertyImageSrc: string | null
  officialLogoDataUri: string
  gradientId: string
  waveId: string
}

type StudioFeatureItem = {
  icon: "location" | "area" | "bath" | "car" | "bed"
  line1: string
  line2?: string
}

const OFFICIAL_STUDIO_LOGO_PATH = "/images/studio-eme-logo-official.svg"
const STUDIO_RENDER_FONT_FAMILY = "Arial, Helvetica, sans-serif"

const TEMPLATES: Record<StudioTemplateId, StudioTemplateDefinition> = {
  "instagram-feed-official": {
    id: "instagram-feed-official",
    format: "feed",
    width: 1080,
    height: 1080,
    render: renderInstagramFeedTemplate,
  },
  "instagram-story-official": {
    id: "instagram-story-official",
    format: "story",
    width: 1080,
    height: 1920,
    render: renderInstagramStoryTemplate,
  },
}

export function getStudioCreativeRenderPath(campaignId: string, assetId: string) {
  return `/api/studio-ia/campaigns/${encodeURIComponent(campaignId)}/assets/${encodeURIComponent(assetId)}/render`
}

export function getStudioCreativeFilename(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const suffix = resolveStudioCreativeFormat(campaign, asset) ?? asset.assetKey
  return `${sanitizeFileName(`${campaign.title}-${suffix}`)}.png`
}

export function isSyntheticStudioCreative(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  return Boolean(resolveStudioTemplate(campaign, asset))
}

export function getOfficialStudioLogoPath() {
  return OFFICIAL_STUDIO_LOGO_PATH
}

export function resolveStudioCreativeFormat(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
): StudioCreativeFormat | null {
  return resolveStudioTemplate(campaign, asset)?.format ?? null
}

export function renderStudioCreativeSvg(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
  officialLogoDataUri: string,
  propertyImageSrc?: string | null,
) {
  const template = resolveStudioTemplate(campaign, asset)
  if (!template) return null

  const payload = buildStudioCreativePayload({
    campaign,
    asset,
    template,
    officialLogoDataUri,
    propertyImageSrc: propertyImageSrc ?? null,
  })

  return template.render(payload)
}

function resolveStudioTemplate(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const format = readAssetFormat(asset)
  if (format === "feed") return TEMPLATES["instagram-feed-official"]
  if (format === "story") return TEMPLATES["instagram-story-official"]

  if (campaign.kind === "INSTAGRAM" && asset.assetKey === "post_feed") return TEMPLATES["instagram-feed-official"]
  if (campaign.kind === "INSTAGRAM" && asset.assetKey === "story") return TEMPLATES["instagram-story-official"]

  return null
}

function buildStudioCreativePayload(input: {
  campaign: StudioCampaignRecord
  asset: CampaignAssetRecord
  template: StudioTemplateDefinition
  officialLogoDataUri: string
  propertyImageSrc: string | null
}): StudioCreativePayload {
  const content = asRecord(input.asset.content)
  const title = resolveDisplayTitle(input.asset, content, input.campaign)
  const subtitle = resolveDisplaySubtitle(input.asset, content, input.campaign)
  const description = readPreferredString(content, ["description", "support"])
  const location = resolveDisplayLocation(input.campaign, content)
  const features = resolveDisplayFeatures(input.campaign, content)
  const price = resolveDisplayPrice(input.campaign, content)
  const metric = resolveMetric(input.campaign, content, price)
  const ctaSupport = readPreferredString(content, ["cta"]) || "Fale com um corretor"
  const badgeLabel = resolveCampaignBadge(input.campaign)
  const gradientToken = sanitizeFileName(`${input.campaign.id}-${input.asset.id}-${input.template.id}`)

  return {
    width: input.template.width,
    height: input.template.height,
    badgeLabel,
    title,
    subtitle,
    description,
    location,
    features,
    price,
    metricLabel: metric.label,
    metricSupport: metric.support,
    ctaLabel: "AGENDE UMA VISITA",
    ctaSupport,
    footer: "EME • SOLUCOES PARA CORRETORES",
    propertyImageSrc: input.propertyImageSrc || resolveCampaignImage(input.campaign),
    officialLogoDataUri: input.officialLogoDataUri,
    gradientId: `studio-gradient-${gradientToken}`,
    waveId: `studio-wave-${gradientToken}`,
  }
}

function renderInstagramFeedTemplate(payload: StudioCreativePayload) {
  const titleLayout = fitMultilineText(payload.title, 430, 62, 40, 3)
  const subtitleLayout = fitMultilineText(payload.subtitle, 430, 56, 34, 2)
  const locationItem = buildLocationFeature(payload.location)
  const featureItems = [locationItem, ...payload.features.map((feature) => buildFeatureItem(feature))].slice(0, 3)
  const badgeWidth = Math.max(268, Math.min(390, 92 + payload.badgeLabel.length * 16))
  const ctaSecondary = fitMultilineText(payload.ctaSupport, 242, 23, 18, 2)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${payload.width} ${payload.height}" width="${payload.width}" height="${payload.height}">`,
    "<defs>",
    `<linearGradient id="${payload.gradientId}" x1="0" y1="0" x2="0.88" y2="0.82">`,
    `<stop offset="0%" stop-color="rgba(2,14,7,0.92)" />`,
    `<stop offset="36%" stop-color="rgba(3,16,9,0.78)" />`,
    `<stop offset="62%" stop-color="rgba(4,18,10,0.46)" />`,
    `<stop offset="100%" stop-color="rgba(5,18,10,0.04)" />`,
    "</linearGradient>",
    `<radialGradient id="${payload.waveId}" cx="94%" cy="100%" r="68%">`,
    `<stop offset="0%" stop-color="rgba(123,226,63,0.24)" />`,
    `<stop offset="60%" stop-color="rgba(123,226,63,0.08)" />`,
    `<stop offset="100%" stop-color="rgba(123,226,63,0)" />`,
    "</radialGradient>",
    "</defs>",
    renderBackgroundImage(payload.propertyImageSrc, payload.width, payload.height),
    `<rect width="${payload.width}" height="${payload.height}" fill="url(#${payload.gradientId})" />`,
    renderLeftOverlay(payload.width, payload.height, false),
    renderBottomWave(payload.width, payload.height, payload.waveId, false),
    renderBadge(payload.badgeLabel, 68, 58, badgeWidth, 60),
    renderLogo(payload.officialLogoDataUri, 915, 46, 146, 68),
    renderMultilineText(titleLayout.lines, 70, 320, titleLayout.fontSize, "400", "#ffffff", titleLayout.lineHeight, 0),
    renderMultilineText(subtitleLayout.lines, 70, 320 + titleLayout.blockHeight + 24, subtitleLayout.fontSize, "500", "#73df30", subtitleLayout.lineHeight, 0),
    renderDivider(70, 520, 96),
    renderFeatureRow(featureItems, 70, 584, 468),
    renderMetricPanel({
      x: 68,
      y: 905,
      width: 584,
      height: 128,
      metricLabel: payload.metricLabel,
      metricValue: payload.price,
      metricSupport: payload.metricSupport,
      ctaLabel: payload.ctaLabel,
      ctaLines: ctaSecondary.lines,
      ctaFontSize: ctaSecondary.fontSize,
      ctaLineHeight: ctaSecondary.lineHeight,
    }),
    "</svg>",
  ].join("")
}

function renderInstagramStoryTemplate(payload: StudioCreativePayload) {
  const titleLayout = fitMultilineText(payload.title, 420, 72, 46, 3)
  const subtitleLayout = fitMultilineText(payload.subtitle, 420, 68, 40, 2)
  const locationItem = buildLocationFeature(payload.location)
  const featureItems = [locationItem, ...payload.features.map((feature) => buildFeatureItem(feature))].slice(0, 3)
  const badgeWidth = Math.max(338, Math.min(468, 124 + payload.badgeLabel.length * 16))
  const ctaSecondary = fitMultilineText(payload.ctaSupport, 334, 28, 22, 2)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${payload.width} ${payload.height}" width="${payload.width}" height="${payload.height}">`,
    "<defs>",
    `<linearGradient id="${payload.gradientId}" x1="0" y1="0" x2="0.92" y2="0.88">`,
    `<stop offset="0%" stop-color="rgba(2,14,7,0.94)" />`,
    `<stop offset="34%" stop-color="rgba(3,16,9,0.82)" />`,
    `<stop offset="62%" stop-color="rgba(4,18,10,0.5)" />`,
    `<stop offset="100%" stop-color="rgba(5,18,10,0.05)" />`,
    "</linearGradient>",
    `<radialGradient id="${payload.waveId}" cx="96%" cy="100%" r="70%">`,
    `<stop offset="0%" stop-color="rgba(123,226,63,0.22)" />`,
    `<stop offset="62%" stop-color="rgba(123,226,63,0.08)" />`,
    `<stop offset="100%" stop-color="rgba(123,226,63,0)" />`,
    "</radialGradient>",
    "</defs>",
    renderBackgroundImage(payload.propertyImageSrc, payload.width, payload.height),
    `<rect width="${payload.width}" height="${payload.height}" fill="url(#${payload.gradientId})" />`,
    renderLeftOverlay(payload.width, payload.height, true),
    renderBottomWave(payload.width, payload.height, payload.waveId, true),
    renderBadge(payload.badgeLabel, 80, 92, badgeWidth, 66),
    renderLogo(payload.officialLogoDataUri, 810, 78, 184, 82),
    renderMultilineText(titleLayout.lines, 82, 440, titleLayout.fontSize, "400", "#ffffff", titleLayout.lineHeight, 0),
    renderMultilineText(subtitleLayout.lines, 82, 440 + titleLayout.blockHeight + 22, subtitleLayout.fontSize, "500", "#73df30", subtitleLayout.lineHeight, 0),
    renderDivider(82, 770, 104),
    renderFeatureStack(featureItems, 82, 842, 360),
    renderMetricPanel({
      x: 80,
      y: 1472,
      width: 916,
      height: 182,
      metricLabel: payload.metricLabel,
      metricValue: payload.price,
      metricSupport: payload.metricSupport,
      ctaLabel: payload.ctaLabel,
      ctaLines: ctaSecondary.lines,
      ctaFontSize: ctaSecondary.fontSize,
      ctaLineHeight: ctaSecondary.lineHeight,
    }),
    renderSingleLineText(payload.footer, 540, 1808, 16, "500", "#f7f7f7", 0.26, "middle"),
    "</svg>",
  ].join("")
}

function renderBackgroundImage(imageSrc: string | null, width: number, height: number) {
  if (!imageSrc) {
    return `<rect width="${width}" height="${height}" fill="#06110a" />`
  }

  return `<image href="${escapeXml(imageSrc)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
}

function renderLeftOverlay(width: number, height: number, portrait: boolean) {
  if (portrait) {
    return `<path d="M0 0 H560 C612 272 600 766 482 1162 C412 1410 208 1718 0 ${height} Z" fill="rgba(2,12,7,0.38)" />`
  }

  return `<path d="M0 0 H534 C594 210 604 506 542 784 C482 960 288 1046 0 ${height} Z" fill="rgba(2,12,7,0.38)" />`
}

function renderBottomWave(width: number, height: number, waveId: string, portrait: boolean) {
  if (portrait) {
    return [
      `<path d="M628 ${height} C756 ${height - 146} 898 ${height - 218} ${width} ${height - 168} L${width} ${height} Z" fill="url(#${waveId})" />`,
      `<path d="M628 ${height} C760 ${height - 150} 908 ${height - 222} ${width} ${height - 176}" fill="none" stroke="rgba(123,226,63,0.72)" stroke-width="2.2" />`,
    ].join("")
  }

  return [
    `<path d="M820 ${height} C928 ${height - 120} 1012 ${height - 136} ${width} ${height - 102} L${width} ${height} Z" fill="url(#${waveId})" />`,
    `<path d="M818 ${height} C926 ${height - 124} 1018 ${height - 142} ${width} ${height - 108}" fill="none" stroke="rgba(123,226,63,0.72)" stroke-width="2" />`,
  ].join("")
}

function renderBadge(label: string, x: number, y: number, width: number, height: number) {
  const centerY = Math.round(height / 2)
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect width="${width}" height="${height}" rx="${Math.round(height / 2)}" fill="rgba(25,116,44,0.74)" stroke="rgba(123,226,63,0.88)" stroke-width="2.1" />`,
    renderFeatureIcon("badge", 22, centerY - 18, "#ffffff"),
    renderSingleLineText(label, 82, centerY + 9, 22, "500", "#ffffff", 0.01),
    "</g>",
  ].join("")
}

function renderLogo(logoDataUri: string, x: number, y: number, width: number, height: number) {
  return `<image href="${escapeXml(logoDataUri)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`
}

function renderDivider(x: number, y: number, width: number) {
  return `<rect x="${x}" y="${y}" width="${width}" height="4" rx="2" fill="#73df30" />`
}

function renderFeatureRow(items: StudioFeatureItem[], x: number, y: number, width: number) {
  const columnWidth = Math.floor(width / Math.max(items.length, 1))

  return items
    .map((item, index) => {
      const originX = x + index * columnWidth
      const lines = [item.line1, item.line2].filter(Boolean) as string[]
      const textLayout = fitMultilineText(lines.join("\n"), columnWidth - 70, 18, 14, 3)

      return [
        `<g transform="translate(${originX} ${y})">`,
        renderFeatureIcon(item.icon, 0, 0, "#73df30"),
        renderMultilineText(textLayout.lines, 0, 112, textLayout.fontSize, "400", "#ffffff", textLayout.lineHeight, 0),
        index < items.length - 1
          ? `<rect x="${columnWidth - 26}" y="6" width="1.2" height="124" fill="rgba(255,255,255,0.22)" />`
          : "",
        "</g>",
      ].join("")
    })
    .join("")
}

function renderFeatureStack(items: StudioFeatureItem[], x: number, y: number, width: number) {
  return items
    .map((item, index) => {
      const offsetY = index * 184
      const textLayout = fitMultilineText([item.line1, item.line2].filter(Boolean).join("\n"), width - 132, 20, 16, 3)

      return [
        `<g transform="translate(${x} ${y + offsetY})">`,
        renderFeatureIcon(item.icon, 0, 6, "#73df30"),
        renderMultilineText(textLayout.lines, 136, 46, textLayout.fontSize, "400", "#ffffff", textLayout.lineHeight, 0),
        index < items.length - 1 ? `<rect x="0" y="130" width="${width}" height="1.2" fill="rgba(255,255,255,0.22)" />` : "",
        "</g>",
      ].join("")
    })
    .join("")
}

function renderMetricPanel(input: {
  x: number
  y: number
  width: number
  height: number
  metricLabel: string
  metricValue: string
  metricSupport: string
  ctaLabel: string
  ctaLines: string[]
  ctaFontSize: number
  ctaLineHeight: number
}) {
  const dividerX = Math.round(input.width * 0.41)
  return [
    `<g transform="translate(${input.x} ${input.y})">`,
    `<rect width="${input.width}" height="${input.height}" rx="30" fill="rgba(5,14,8,0.42)" stroke="rgba(123,226,63,0.72)" stroke-width="1.6" />`,
    renderSingleLineText(input.metricLabel, 34, 40, 20, "500", "#ffffff", 0.01),
    renderSingleLineText(input.metricValue, 34, 94, input.width > 700 ? 44 : 38, "700", "#73df30", 0),
    input.metricSupport ? renderSingleLineText(input.metricSupport, 34, 128, 18, "400", "#ffffff", 0) : "",
    `<rect x="${dividerX}" y="26" width="1.2" height="${input.height - 52}" fill="rgba(255,255,255,0.24)" />`,
    renderFeatureIcon("calendar", dividerX + 28, Math.round((input.height - 62) / 2), "#73df30"),
    renderSingleLineText(input.ctaLabel, dividerX + 140, 72, 18, "500", "#ffffff", 0.01),
    renderMultilineText(input.ctaLines, dividerX + 140, 118, input.ctaFontSize, "500", "#73df30", input.ctaLineHeight, 0),
    "</g>",
  ].join("")
}

function renderFeatureIcon(type: "location" | "area" | "bath" | "car" | "bed" | "calendar" | "badge", x: number, y: number, color: string) {
  switch (type) {
    case "location":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M26 54 C15 38 10 29 10 20 C10 9 18 0 28 0 C38 0 46 9 46 20 C46 29 41 38 30 54 Z" /><circle cx="28" cy="20" r="8" /></g>`
    case "area":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="38" height="38" rx="2" /><path d="M8 28 H46 M27 8 V46" /></g>`
    case "bath":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8 H42 V26 C42 38 35 46 28 46 C21 46 14 38 14 26 Z" /><path d="M10 26 H46" /><path d="M20 46 V56" /><path d="M36 46 V56" /></g>`
    case "car":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 34 L17 16 H39 L46 34 V43 H10 Z" /><circle cx="18" cy="43" r="6" /><circle cx="38" cy="43" r="6" /><path d="M10 34 H46" /></g>`
    case "bed":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 34 V18 H22 C27 18 30 21 30 26 V34" /><path d="M10 34 H46 V50" /><path d="M10 50 V28 H46 V50" /></g>`
    case "calendar":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="10" width="42" height="40" rx="7" /><path d="M18 2 V16 M40 2 V16 M8 20 H50 M18 30 H20 M29 30 H31 M40 30 H42 M18 40 H20 M29 40 H31" /><path d="M35 51 L52 34" /><path d="M52 40 V34 H46" /></g>`
    case "badge":
      return `<g transform="translate(${x} ${y})"><path d="M18 0 L24 12 L38 18 L24 24 L18 38 L12 24 L0 18 L12 12 Z" fill="${color}" /></g>`
  }
}

function resolveCampaignImage(campaign: StudioCampaignRecord) {
  return campaign.property?.imageUrls?.find((image) => typeof image === "string" && image.trim()) ?? null
}

function resolveCampaignBadge(campaign: StudioCampaignRecord) {
  const goal = campaign.goal?.trim()
  if (!goal) return "OPORTUNIDADE"

  const normalized = goal
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()

  if (normalized === "LANCAMENTO") return "LANCAMENTO"
  return goal.toUpperCase()
}

function resolveDisplayTitle(asset: CampaignAssetRecord, content: Record<string, unknown>, campaign: StudioCampaignRecord) {
  return (
    readPreferredString(content, ["title"]) ||
    [readPreferredString(content, ["line1"]), readPreferredString(content, ["line2"])].filter(Boolean).join(" ") ||
    buildDefaultHeadline(campaign)
  )
}

function resolveDisplaySubtitle(asset: CampaignAssetRecord, content: Record<string, unknown>, campaign: StudioCampaignRecord) {
  return (
    readPreferredString(content, ["subtitle", "highlight", "kicker"]) ||
    (asset.assetKey === "story" ? "Seu proximo endereco comercial" : "Pronto para destacar este imovel")
  )
}

function resolveDisplayLocation(campaign: StudioCampaignRecord, content: Record<string, unknown>) {
  return readPreferredString(content, ["location"]) || [campaign.property?.neighborhood, campaign.property?.city].filter(Boolean).join("\n")
}

function resolveDisplayFeatures(campaign: StudioCampaignRecord, content: Record<string, unknown>) {
  const explicit = normalizeStringList(content.features)
  if (explicit.length > 0) return explicit.slice(0, 3)

  const derived: string[] = []
  const area = readAreaLabel(campaign)
  if (area) derived.push(`${area} | Area privativa`)
  if ((campaign.property?.bathrooms ?? 0) > 0) {
    derived.push(`${campaign.property?.bathrooms} banheiro${campaign.property?.bathrooms === 1 ? "" : "s"}`)
  }
  if ((campaign.property?.parkingSpots ?? 0) > 0) {
    derived.push(`${campaign.property?.parkingSpots} vaga${campaign.property?.parkingSpots === 1 ? "" : "s"}`)
  }
  if (derived.length < 3 && (campaign.property?.bedrooms ?? 0) > 0) {
    derived.push(`${campaign.property?.bedrooms} dormitorio${campaign.property?.bedrooms === 1 ? "" : "s"}`)
  }

  return derived.slice(0, 3)
}

function resolveDisplayPrice(campaign: StudioCampaignRecord, content: Record<string, unknown>) {
  return readPreferredString(content, ["price"]) || formatPriceLabel(campaign.property?.price)
}

function resolveMetric(campaign: StudioCampaignRecord, content: Record<string, unknown>, price: string) {
  const areaLabel = readAreaLabel(campaign)
  const description = readPreferredString(content, ["description", "support"])

  return {
    label: readPreferredString(content, ["metricLabel"]) || "PRECO",
    support: readPreferredString(content, ["metricSupport"]) || description || areaLabel || "",
    value: price,
  }
}

function buildLocationFeature(location: string): StudioFeatureItem {
  const [line1, line2] = location
    .split(/\n|,\s*/)
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    icon: "location",
    line1: line1 || "Localizacao",
    line2: line2 || undefined,
  }
}

function buildFeatureItem(feature: string): StudioFeatureItem {
  const normalized = feature.trim()
  const [line1, line2] = normalized.includes("|")
    ? normalized.split("|").map((item) => item.trim())
    : splitFeatureLines(normalized)

  return {
    icon: inferFeatureIcon(normalized),
    line1,
    line2: line2 || undefined,
  }
}

function splitFeatureLines(value: string) {
  const parts = value.split(/\n/).map((item) => item.trim()).filter(Boolean)
  if (parts.length > 1) return [parts[0], parts.slice(1).join(" ")]

  const words = value.split(/\s+/)
  if (words.length <= 2) return [value, ""]

  const middle = Math.ceil(words.length / 2)
  return [words.slice(0, middle).join(" "), words.slice(middle).join(" ")]
}

function inferFeatureIcon(value: string): StudioFeatureItem["icon"] {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (normalized.includes("banh")) return "bath"
  if (normalized.includes("vaga") || normalized.includes("garag") || normalized.includes("estacion")) return "car"
  if (normalized.includes("dorm") || normalized.includes("suite") || normalized.includes("quarto")) return "bed"
  if (normalized.includes("m2") || normalized.includes("m²") || normalized.includes("area")) return "area"
  return "area"
}

function fitMultilineText(text: string, maxWidth: number, maxFontSize: number, minFontSize: number, maxLines: number) {
  const sourceLines = text
    .split("\n")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  if (sourceLines.length > 1) {
    for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
      const capacity = Math.max(5, Math.floor(maxWidth / (fontSize * 0.56)))
      const lines = sourceLines.flatMap((line) => wrapText(line, capacity, 2))
      if (lines.length <= maxLines) {
        const lineHeight = Math.round(fontSize * 0.94)
        return { lines, fontSize, lineHeight, blockHeight: lineHeight * Math.max(lines.length - 1, 0) }
      }
    }
  }

  const normalized = sourceLines.length ? sourceLines.join(" ") : text.replace(/\s+/g, " ").trim()

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    const capacity = Math.max(5, Math.floor(maxWidth / (fontSize * 0.56)))
    const lines = wrapText(normalized, capacity, maxLines)
    if (lines.length <= maxLines) {
      const lineHeight = Math.round(fontSize * 0.94)
      return { lines, fontSize, lineHeight, blockHeight: lineHeight * Math.max(lines.length - 1, 0) }
    }
  }

  const fallbackCapacity = Math.max(5, Math.floor(maxWidth / (minFontSize * 0.56)))
  const fallbackLines = wrapText(normalized, fallbackCapacity, maxLines)
  const fallbackLineHeight = Math.round(minFontSize * 0.94)
  return {
    lines: fallbackLines,
    fontSize: minFontSize,
    lineHeight: fallbackLineHeight,
    blockHeight: fallbackLineHeight * Math.max(fallbackLines.length - 1, 0),
  }
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate
      continue
    }

    lines.push(current)
    current = word
    if (lines.length >= maxLines) return lines.slice(0, maxLines)
  }

  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

function buildDefaultHeadline(campaign: StudioCampaignRecord) {
  const propertyTitle = campaign.property?.title?.trim()
  if (propertyTitle) return propertyTitle

  const typeLabel = mapPropertyTypeLabel(campaign.property?.type)
  const purposeLabel = mapPurposeHeadline(campaign.property?.purpose)
  return `${typeLabel} ${purposeLabel}`.trim()
}

function mapPropertyTypeLabel(value: string | null | undefined) {
  switch ((value || "").toUpperCase()) {
    case "HOUSE":
      return "Casa"
    case "COMMERCIAL":
      return "Sala comercial"
    case "LAND":
      return "Terreno"
    case "OFFICE":
      return "Escritorio"
    case "STORE":
      return "Loja"
    case "PENTHOUSE":
      return "Cobertura"
    default:
      return "Apartamento"
  }
}

function mapPurposeHeadline(value: string | null | undefined) {
  const normalized = (value || "").toUpperCase()
  if (normalized.includes("RENT") || normalized.includes("LOC")) return "para locacao"
  return "em destaque"
}

function readAreaLabel(campaign: StudioCampaignRecord) {
  const legal = asRecord(campaign.property?.legalData)
  const area = readPreferredString(legal, ["privateArea", "totalArea"])
  if (!area) return null

  const normalized = area.replace(/m(?:2|²)?/gi, "m²").trim()
  return /\d\s*m²/i.test(normalized) ? normalized : `${normalized} m²`
}

function formatPriceLabel(value: number | null | undefined) {
  if (!value || value <= 0) return "CONSULTE"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value / 100)
}

function readAssetFormat(asset: CampaignAssetRecord): StudioCreativeFormat | null {
  const metadata = asRecord(asset.metadata)
  const format = readPreferredString(metadata, ["format"])

  switch (format) {
    case "instagram_post_feed":
      return "feed"
    case "instagram_story":
      return "story"
    case "reels_cover":
      return "reels_cover"
    case "thumbnail":
      return "thumbnail"
    case "whatsapp":
      return "whatsapp"
    case "catalog":
      return "catalog"
    default:
      return null
  }
}

function renderSingleLineText(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontWeight: string,
  color: string,
  letterSpacingEm = 0,
  anchor: "start" | "middle" | "end" = "start",
) {
  return `<text x="${x}" y="${y}" fill="${color}" text-anchor="${anchor}" font-family="${STUDIO_RENDER_FONT_FAMILY}" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacingEm}em">${escapeXml(text)}</text>`
}

function renderMultilineText(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  fontWeight: string,
  color: string,
  lineHeight: number,
  letterSpacingEm = 0,
) {
  return [
    `<text x="${x}" y="${y}" fill="${color}" font-family="${STUDIO_RENDER_FONT_FAMILY}" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacingEm}em">`,
    ...lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`),
    "</text>",
  ].join("")
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "studio-eme"
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function readPreferredString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  return ""
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}
