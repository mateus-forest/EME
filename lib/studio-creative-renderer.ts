import type { StudioCampaignRecord } from "@/lib/studio-campaigns-client"

type CampaignAssetRecord = StudioCampaignRecord["assets"][number]

export type StudioCreativeFormat =
  | "feed"
  | "story"
  | "reels_cover"
  | "thumbnail"
  | "whatsapp"
  | "catalog"

const OFFICIAL_STUDIO_LOGO_PATH = "/images/studio-eme-logo-official.svg"

type CreativeLayout = {
  badgeX: number
  badgeY: number
  badgeWidth: number
  badgeHeight: number
  logoX: number
  logoY: number
  logoWidth: number
  logoHeight: number
  categoryX: number
  categoryY: number
  titleX: number
  titleY: number
  titleMaxWidth: number
  dividerX: number
  dividerY: number
  dividerWidth: number
  summaryX: number
  summaryY: number
  summaryWidth: number
  pricePanelX: number
  pricePanelY: number
  pricePanelWidth: number
  pricePanelHeight: number
}

type TextLayout = {
  lines: string[]
  fontSize: number
  lineHeight: number
}

export function getStudioCreativeRenderPath(campaignId: string, assetId: string) {
  return `/api/studio-ia/campaigns/${encodeURIComponent(campaignId)}/assets/${encodeURIComponent(assetId)}/render`
}

export function getStudioCreativeFilename(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const suffix = resolveStudioCreativeFormat(campaign, asset) ?? asset.assetKey
  return `${sanitizeFileName(`${campaign.title}-${suffix}`)}.svg`
}

export function isSyntheticStudioCreative(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  return Boolean(resolveStudioCreativeFormat(campaign, asset))
}

export function getOfficialStudioLogoPath() {
  return OFFICIAL_STUDIO_LOGO_PATH
}

export function resolveStudioCreativeFormat(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
): StudioCreativeFormat | null {
  const format = readAssetFormat(asset)
  if (format) return format

  if (campaign.kind === "INSTAGRAM" && asset.assetKey === "post_feed") return "feed"
  if (campaign.kind === "INSTAGRAM" && asset.assetKey === "story") return "story"
  return null
}

export function renderStudioCreativeSvg(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
  officialLogoDataUri: string,
) {
  const format = resolveStudioCreativeFormat(campaign, asset)
  if (!format) return null

  return renderUnifiedCreative(campaign, asset, officialLogoDataUri, format)
}

function renderUnifiedCreative(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
  officialLogoDataUri: string,
  format: StudioCreativeFormat,
) {
  const dimensions = getCreativeDimensions(format)
  const layout = getCreativeLayout(dimensions.width, dimensions.height)
  const imageUrl = resolveCampaignImage(campaign)
  const badge = resolveCampaignBadge(campaign)
  const category = resolveSupportLabel(campaign, asset)
  const hero = resolvePrimaryHeadline(campaign, asset)
  const heroLayout = fitMultilineText(
    hero,
    layout.titleMaxWidth,
    dimensions.height > dimensions.width ? 112 : 134,
    dimensions.height > dimensions.width ? 60 : 78,
    2,
  )
  const summary = buildSummaryItems(campaign, asset).slice(0, 4)
  const price = resolveDisplayedPrice(campaign, asset)
  const ctaLayout = fitMultilineText(resolveDisplayedCta(asset), Math.max(220, layout.pricePanelWidth * 0.32), 28, 20, 2)
  const gradientId = `studio-overlay-${campaign.id}-${asset.id}`
  const waveId = `studio-wave-${campaign.id}-${asset.id}`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}">`,
    "<defs>",
    `<linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="rgba(3,22,11,0.8)" />`,
    `<stop offset="28%" stop-color="rgba(4,28,13,0.66)" />`,
    `<stop offset="58%" stop-color="rgba(4,20,10,0.22)" />`,
    `<stop offset="100%" stop-color="rgba(0,0,0,0.04)" />`,
    "</linearGradient>",
    `<radialGradient id="${waveId}" cx="82%" cy="100%" r="72%">`,
    `<stop offset="0%" stop-color="rgba(138,255,160,0.72)" />`,
    `<stop offset="38%" stop-color="rgba(42,178,66,0.42)" />`,
    `<stop offset="76%" stop-color="rgba(19,88,34,0.09)" />`,
    `<stop offset="100%" stop-color="rgba(19,88,34,0)" />`,
    "</radialGradient>",
    "</defs>",
    renderBackgroundImage(imageUrl, dimensions.width, dimensions.height),
    `<rect width="${dimensions.width}" height="${dimensions.height}" fill="url(#${gradientId})" />`,
    renderLeftOverlay(dimensions.width, dimensions.height),
    renderWaveDecoration(dimensions.width, dimensions.height, waveId),
    renderBadge(badge, layout.badgeX, layout.badgeY, layout.badgeWidth, layout.badgeHeight),
    renderLogo(officialLogoDataUri, layout.logoX, layout.logoY, layout.logoWidth, layout.logoHeight),
    renderSingleLineText(category, layout.categoryX, layout.categoryY, dimensions.height > dimensions.width ? 22 : 24, "700", "#7be23f", 0.22),
    renderMultilineText(heroLayout.lines, layout.titleX, layout.titleY, heroLayout.fontSize, "800", "#ffffff", heroLayout.lineHeight, 0),
    renderDivider(layout.dividerX, layout.dividerY, layout.dividerWidth),
    renderStorySummary(summary, layout.summaryX, layout.summaryY),
    renderUnifiedPricePanel({
      x: layout.pricePanelX,
      y: layout.pricePanelY,
      width: layout.pricePanelWidth,
      height: layout.pricePanelHeight,
      price,
      ctaLines: ctaLayout.lines,
      ctaFontSize: ctaLayout.fontSize,
      ctaLineHeight: ctaLayout.lineHeight,
    }),
    "</svg>",
  ].join("")
}

function renderBackgroundImage(imageUrl: string | null, width: number, height: number) {
  if (!imageUrl) {
    return `<rect width="${width}" height="${height}" fill="#05110a" />`
  }

  return `<image href="${escapeXml(imageUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
}

function renderLeftOverlay(width: number, height: number) {
  const portraitBoost = Math.max(0, height / width - 1)
  const widthRatio = 0.52 + portraitBoost * 0.02
  const control1 = 0.18 - portraitBoost * 0.01
  const control2 = 0.54 + portraitBoost * 0.03
  const lowerX = 0.32 - portraitBoost * 0.02
  return `<path d="M0 0 H${Math.round(width * widthRatio)} C${Math.round(width * 0.53)} ${Math.round(height * control1)} ${Math.round(width * 0.56)} ${Math.round(height * control2)} ${Math.round(width * lowerX)} ${Math.round(height * 0.88)} C${Math.round(width * 0.18)} ${Math.round(height * 1.01)} ${Math.round(width * 0.06)} ${Math.round(height * 1.01)} 0 ${height} Z" fill="rgba(3,18,9,0.42)" />`
}

function renderWaveDecoration(width: number, height: number, waveId: string) {
  const endY = Math.round(height * 0.975)

  return [
    `<path d="M${Math.round(width * 0.56)} ${height} C${Math.round(width * 0.69)} ${Math.round(height * 0.93)} ${Math.round(width * 0.82)} ${Math.round(height * 0.8)} ${width} ${endY} L${width} ${height} Z" fill="url(#${waveId})" opacity="0.62" />`,
    `<path d="M${Math.round(width * 0.54)} ${height} C${Math.round(width * 0.7)} ${Math.round(height * 0.91)} ${Math.round(width * 0.84)} ${Math.round(height * 0.83)} ${width} ${Math.round(height * 0.9)}" fill="none" stroke="rgba(123,226,63,0.28)" stroke-width="1.75" />`,
    `<path d="M${Math.round(width * 0.64)} ${height} C${Math.round(width * 0.78)} ${Math.round(height * 0.94)} ${Math.round(width * 0.9)} ${Math.round(height * 0.87)} ${width} ${Math.round(height * 0.944)}" fill="none" stroke="rgba(199,255,210,0.14)" stroke-width="1" />`,
    `<path d="M${Math.round(width * 0.65)} ${height} C${Math.round(width * 0.81)} ${Math.round(height * 0.94)} ${Math.round(width * 0.92)} ${Math.round(height * 0.88)} ${width} ${Math.round(height * 0.962)}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.9" />`,
  ].join("")
}

function renderBadge(label: string, x: number, y: number, width: number, height: number) {
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect width="${width}" height="${height}" rx="${Math.round(height / 2)}" fill="rgba(28,138,50,0.78)" stroke="rgba(123,226,63,0.72)" stroke-width="2" />`,
    `<circle cx="40" cy="${Math.round(height / 2)}" r="17" fill="rgba(255,255,255,0.05)" />`,
    `<path d="M40 ${Math.round(height / 2) - 14} L44 ${Math.round(height / 2) - 4} L54 ${Math.round(height / 2)} L44 ${Math.round(height / 2) + 4} L40 ${Math.round(height / 2) + 14} L36 ${Math.round(height / 2) + 4} L26 ${Math.round(height / 2)} L36 ${Math.round(height / 2) - 4} Z" fill="#ffffff" />`,
    renderSingleLineText(label, 78, Math.round(height / 2) + 9, 21, "700", "#ffffff", 0.045),
    "</g>",
  ].join("")
}

function renderLogo(logoDataUri: string, x: number, y: number, width: number, height: number) {
  return `<image href="${escapeXml(logoDataUri)}" x="${x}" y="${y}" width="${Math.round(width * 1.15)}" height="${Math.round(height * 1.15)}" preserveAspectRatio="xMaxYMid meet" />`
}

function renderSingleLineText(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontWeight: string,
  color: string,
  letterSpacingEm = 0,
) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Geist, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacingEm}em">${escapeXml(text)}</text>`
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
    `<text x="${x}" y="${y}" fill="${color}" font-family="Geist, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacingEm}em">`,
    ...lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`),
    "</text>",
  ].join("")
}

function renderDivider(x: number, y: number, width: number) {
  return `<rect x="${x}" y="${y}" width="${width}" height="5" rx="2.5" fill="#73df30" />`
}

function renderSummaryGrid(
  items: Array<{ icon: string; value: string; support?: string }>,
  x: number,
  y: number,
  availableWidth: number,
) {
  const count = Math.max(items.length, 1)
  const cardWidth = Math.floor(availableWidth / count)

  return items
    .map((item, index) => {
      const originX = x + index * cardWidth
      const valueLayout = fitMultilineText(
        `${item.value}${item.support ? `\n${item.support}` : ""}`,
        cardWidth - 86,
        23,
        17,
        item.support ? 2 : 1,
      )

      return [
        `<g transform="translate(${originX} ${y})">`,
        renderFeatureIcon(item.icon, 0, 8, "#73df30"),
        renderMultilineText(valueLayout.lines, 62, 34, valueLayout.fontSize, "500", "#ffffff", valueLayout.lineHeight, 0),
        index < items.length - 1 ? `<rect x="${cardWidth - 24}" y="10" width="1.2" height="96" fill="rgba(255,255,255,0.16)" />` : "",
        "</g>",
      ].join("")
    })
    .join("")
}

function renderStorySummary(items: Array<{ icon: string; value: string; support?: string }>, x: number, y: number) {
  return items
    .map((item, index) => {
      const offsetY = index * 104
      const valueLayout = fitMultilineText(`${item.value}${item.support ? `\n${item.support}` : ""}`, 340, 20, 17, 2)

      return [
        `<g transform="translate(${x} ${y + offsetY})">`,
        renderFeatureIcon(item.icon, 0, 4, "#73df30"),
        renderMultilineText(valueLayout.lines, 84, 26, valueLayout.fontSize, "500", "#ffffff", valueLayout.lineHeight, 0),
        "</g>",
      ].join("")
    })
    .join("")
}

function renderUnifiedPricePanel(input: {
  x: number
  y: number
  width: number
  height: number
  price: string
  ctaLines: string[]
  ctaFontSize: number
  ctaLineHeight: number
}) {
  const dividerX = Math.round(input.width * 0.58)
  const ctaWidth = input.width - dividerX - 42

  return [
    `<g transform="translate(${input.x} ${input.y})">`,
    `<rect width="${input.width}" height="${input.height}" rx="28" fill="rgba(3,15,8,0.3)" stroke="rgba(123,226,63,0.36)" stroke-width="1.35" />`,
    renderSingleLineText("PRECO", 34, 40, 20, "500", "#ffffff", 0.02),
    renderSingleLineText(input.price, 34, 94, 46, "800", "#73df30", 0),
    `<rect x="${dividerX}" y="22" width="1" height="${input.height - 44}" fill="rgba(255,255,255,0.14)" />`,
    `<g transform="translate(${dividerX + 24} 22)">`,
    `<rect width="${ctaWidth}" height="${input.height - 44}" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`,
    renderFeatureIcon("calendar", 18, 14, "#73df30"),
    renderMultilineText(input.ctaLines, 78, 34, input.ctaFontSize, "700", "#ffffff", input.ctaLineHeight, 0.01),
    "</g>",
    "</g>",
  ].join("")
}

function renderFeatureIcon(type: string, x: number, y: number, color: string) {
  switch (type) {
    case "location":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 54 C16 37 10 28 10 19 C10 8 18 0 28 0 C38 0 46 8 46 19 C46 28 40 37 28 54 Z" /><circle cx="28" cy="19" r="8" /></g>`
    case "area":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="40" height="40" rx="3" /><path d="M18 6 V46 M34 6 V46 M6 18 H46 M6 34 H46" /></g>`
    case "bath":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6 H42 V26 C42 37 35 44 28 44 C21 44 14 37 14 26 Z" /><path d="M10 26 H46" /><path d="M18 44 V54" /><path d="M38 44 V54" /></g>`
    case "car":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 32 L16 16 H40 L46 32 V42 H10 Z" /><circle cx="18" cy="42" r="6" /><circle cx="38" cy="42" r="6" /><path d="M10 32 H46" /></g>`
    case "bed":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 30 V14 H20 C26 14 30 18 30 24 V30" /><path d="M10 30 H46 V50" /><path d="M10 50 V24 H46 V50" /></g>`
    case "calendar":
      return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="10" width="40" height="38" rx="6" /><path d="M18 2 V16 M38 2 V16 M8 20 H48 M18 28 H20 M28 28 H30 M38 28 H40 M18 38 H20 M28 38 H30" /><path d="M34 50 L50 34" /><path d="M50 40 V34 H44" /></g>`
    default:
      return `<g transform="translate(${x} ${y})"><circle cx="28" cy="28" r="10" fill="${color}" /></g>`
  }
}

function resolveCampaignImage(campaign: StudioCampaignRecord) {
  return campaign.property?.imageUrls?.find((image) => typeof image === "string" && image.trim()) ?? null
}

function resolveCampaignBadge(campaign: StudioCampaignRecord) {
  const goal = campaign.goal?.trim()
  if (!goal) return "DESTAQUE"
  return goal.toUpperCase()
}

function resolveSupportLabel(_campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = asRecord(asset.content)
  const preferred =
    readString(content.subtitle) ||
    readString(content.category) ||
    readString(content.highlight) ||
    readString(content.kicker)
  if (preferred) return preferred.toUpperCase()

  return "OPORTUNIDADE PREMIUM"
}

function resolvePrimaryHeadline(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = asRecord(asset.content)
  const preferred = readString(content.title) || [readString(content.line1), readString(content.line2)].filter(Boolean).join("\n")
  if (preferred) return preferred.toUpperCase()

  return buildDefaultHeadline(campaign).toUpperCase()
}

function buildDefaultHeadline(campaign: StudioCampaignRecord) {
  const typeLabel = mapPropertyTypeLabel(campaign.property?.type).toUpperCase()
  return `${typeLabel}\nDISPONIVEL`
}

function buildSummaryItems(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = asRecord(asset.content)
  const area = readString(content.area) || readAreaLabel(campaign)
  const locationOverride = readString(content.location)
  const location = locationOverride || [readString(content.neighborhood) || campaign.property?.neighborhood, readString(content.city) || campaign.property?.city].filter(Boolean).join("\n")
  const items: Array<{ icon: string; value: string; support?: string }> = []

  if (location) {
    const [headline, support] = location.split("\n")
    items.push({ icon: "location", value: headline || "", support: support || undefined })
  }

  if (area) {
    items.push({ icon: "area", value: area, support: "AREA UTIL" })
  } else if ((campaign.property?.bedrooms ?? 0) > 0) {
    items.push({ icon: "bed", value: `${campaign.property?.bedrooms} DORM${campaign.property?.bedrooms === 1 ? "" : "S"}` })
  }

  if ((campaign.property?.bathrooms ?? 0) > 0) {
    items.push({ icon: "bath", value: `${campaign.property?.bathrooms} BANHEIRO${campaign.property?.bathrooms === 1 ? "" : "S"}` })
  }

  if ((campaign.property?.parkingSpots ?? 0) > 0) {
    items.push({ icon: "car", value: `${campaign.property?.parkingSpots} VAGA${campaign.property?.parkingSpots === 1 ? "" : "S"}` })
  }

  return items.slice(0, 4)
}

function fitMultilineText(text: string, maxWidth: number, maxFontSize: number, minFontSize: number, maxLines: number) {
  const normalized = text.replace(/\s+/g, " ").trim()

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 4) {
    const capacity = Math.max(6, Math.floor(maxWidth / (fontSize * 0.58)))
    const lines = wrapText(normalized, capacity, maxLines)
    if (lines.length <= maxLines) {
      return {
        lines,
        fontSize,
        lineHeight: Math.round(fontSize * 0.94),
      }
    }
  }

  return {
    lines: wrapText(normalized, Math.max(6, Math.floor(maxWidth / (minFontSize * 0.58))), maxLines),
    fontSize: minFontSize,
    lineHeight: Math.round(minFontSize * 0.94),
  }
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number) {
  const sourceLines = text.split("\n").map((item) => item.trim()).filter(Boolean)
  const words = (sourceLines.length ? sourceLines : [text]).flatMap((line) => line.split(/\s+/).filter(Boolean))
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
  if (normalized.includes("RENT") || normalized.includes("LOC")) return "PARA ALUGAR"
  return "A VENDA"
}

function readAreaLabel(campaign: StudioCampaignRecord) {
  const legal = asRecord(campaign.property?.legalData)
  const area = readString(legal.privateArea) || readString(legal.totalArea)
  if (!area) return null
  return /\d\s*m/i.test(area) ? area : `${area} m²`
}

function formatPriceLabel(value: number | null | undefined) {
  if (!value || value <= 0) return "CONSULTE"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value / 100)
}

function resolveDisplayedPrice(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = asRecord(asset.content)
  return readString(content.price) || formatPriceLabel(campaign.property?.price)
}

function resolveDisplayedCta(asset: CampaignAssetRecord) {
  const content = asRecord(asset.content)
  return readString(content.cta) || "AGENDE SUA VISITA"
}

function readAssetFormat(asset: CampaignAssetRecord): StudioCreativeFormat | null {
  const metadata = asRecord(asset.metadata)
  const format = readString(metadata.format)

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

function getCreativeDimensions(format: StudioCreativeFormat) {
  switch (format) {
    case "story":
      return { width: 1080, height: 1920 }
    case "reels_cover":
      return { width: 1080, height: 1350 }
    case "thumbnail":
      return { width: 1080, height: 1080 }
    case "whatsapp":
      return { width: 1080, height: 1080 }
    case "catalog":
      return { width: 1600, height: 900 }
    case "feed":
    default:
      return { width: 1080, height: 1080 }
  }
}

function getCreativeLayout(width: number, height: number): CreativeLayout {
  const portraitBoost = Math.max(0, height / width - 1)
  return {
    badgeX: Math.round(width * 0.06),
    badgeY: Math.round(height * (0.058 - portraitBoost * 0.012)),
    badgeWidth: Math.round(width * (0.23 + portraitBoost * 0.055)),
    badgeHeight: Math.round(height * Math.max(0.037, 0.048 - portraitBoost * 0.01)),
    logoX: width - Math.round(width * 0.197),
    logoY: Math.round(height * (0.056 - portraitBoost * 0.01)),
    logoWidth: Math.round(width * 0.13),
    logoHeight: Math.round(height * Math.max(0.036, 0.05 - portraitBoost * 0.01)),
    categoryX: Math.round(width * 0.068),
    categoryY: Math.round(height * (0.26 + portraitBoost * 0.17)),
    titleX: Math.round(width * 0.065),
    titleY: Math.round(height * (0.318 + portraitBoost * 0.16)),
    titleMaxWidth: Math.round(width * (0.44 + portraitBoost * 0.12)),
    dividerX: Math.round(width * 0.067),
    dividerY: Math.round(height * (0.476 + portraitBoost * 0.14)),
    dividerWidth: Math.round(width * 0.078),
    summaryX: Math.round(width * 0.067),
    summaryY: Math.round(height * (0.515 + portraitBoost * 0.145)),
    summaryWidth: Math.round(width * (0.34 + portraitBoost * 0.1)),
    pricePanelX: Math.round(width * 0.058),
    pricePanelY: height - Math.round(height * (0.145 + portraitBoost * 0.01)),
    pricePanelWidth: Math.min(Math.round(width * (0.58 + portraitBoost * 0.12)), width - Math.round(width * 0.116)),
    pricePanelHeight: Math.round(height * Math.max(0.082, 0.1 - portraitBoost * 0.015)),
  }
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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}
