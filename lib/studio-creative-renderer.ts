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

  switch (format) {
    case "story":
    case "reels_cover":
      return renderStoryCreative(campaign, asset, officialLogoDataUri, format)
    case "feed":
    case "thumbnail":
    case "whatsapp":
    case "catalog":
    default:
      return renderFeedCreative(campaign, asset, officialLogoDataUri, format)
  }
}

function renderFeedCreative(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
  officialLogoDataUri: string,
  format: Exclude<StudioCreativeFormat, "story" | "reels_cover">,
) {
  const dimensions = getFeedDimensions(format)
  const imageUrl = resolveCampaignImage(campaign)
  const badge = resolveCampaignBadge(campaign)
  const category = resolveCategoryLabel(campaign)
  const hero = resolveFeedHero(campaign, asset)
  const heroLayout = fitMultilineText(hero, dimensions.width * 0.6, 168, 92, 2)
  const summary = buildSummaryItems(campaign)
  const price = formatPriceLabel(campaign.property?.price)
  const cta = "AGENDE\nSUA VISITA"
  const ctaFont = fitMultilineText(cta, 190, 38, 28, 2)
  const gradientId = `studio-overlay-${campaign.id}-${asset.id}`
  const waveId = `studio-wave-${campaign.id}-${asset.id}`
  const shadowId = `studio-shadow-${campaign.id}-${asset.id}`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}">`,
    "<defs>",
    `<linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="rgba(2,31,14,0.96)" />`,
    `<stop offset="36%" stop-color="rgba(3,44,18,0.92)" />`,
    `<stop offset="64%" stop-color="rgba(5,22,12,0.42)" />`,
    `<stop offset="100%" stop-color="rgba(5,22,12,0.06)" />`,
    "</linearGradient>",
    `<radialGradient id="${waveId}" cx="80%" cy="100%" r="70%">`,
    `<stop offset="0%" stop-color="rgba(120,255,142,0.92)" />`,
    `<stop offset="34%" stop-color="rgba(49,198,74,0.68)" />`,
    `<stop offset="75%" stop-color="rgba(20,92,34,0.18)" />`,
    `<stop offset="100%" stop-color="rgba(20,92,34,0)" />`,
    "</radialGradient>",
    `<filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">`,
    `<feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="rgba(0,0,0,0.22)" />`,
    "</filter>",
    "</defs>",
    renderBackgroundImage(imageUrl, dimensions.width, dimensions.height),
    `<rect width="${dimensions.width}" height="${dimensions.height}" fill="url(#${gradientId})" />`,
    `<path d="M0 0 H${Math.round(dimensions.width * 0.54)} C${Math.round(dimensions.width * 0.58)} ${Math.round(dimensions.height * 0.26)} ${Math.round(dimensions.width * 0.56)} ${Math.round(dimensions.height * 0.78)} 0 ${dimensions.height} Z" fill="rgba(2,24,12,0.68)" />`,
    renderWaveDecoration(dimensions.width, dimensions.height, waveId),
    renderBadge(badge, 68, 86, 280, 64),
    renderLogo(officialLogoDataUri, dimensions.width - 214, 74, 142, 58),
    renderSingleLineText(category, 86, 360, 24, "700", "#7be23f", 0.32),
    renderMultilineText(heroLayout.lines, 82, 428, heroLayout.fontSize, "800", "#ffffff", heroLayout.lineHeight, 0.01),
    renderDivider(84, 760, 86),
    renderSummaryGrid(summary, 84, 818, dimensions.width - 168),
    renderPriceCtaPanel({
      x: 72,
      y: dimensions.height - 254,
      width: Math.min(650, dimensions.width - 144),
      height: 132,
      price,
      ctaLines: ctaFont.lines,
      ctaFontSize: ctaFont.fontSize,
      ctaLineHeight: ctaFont.lineHeight,
    }),
    "</svg>",
  ].join("")
}

function renderStoryCreative(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
  officialLogoDataUri: string,
  format: "story" | "reels_cover",
) {
  const dimensions = format === "reels_cover" ? { width: 1080, height: 1350 } : { width: 1080, height: 1920 }
  const imageUrl = resolveCampaignImage(campaign)
  const badge = resolveCampaignBadge(campaign)
  const category = resolveCategoryLabel(campaign)
  const hero = resolveStoryHero(campaign, asset)
  const heroLayout = fitMultilineText(hero, 720, 112, 72, 3)
  const summary = buildSummaryItems(campaign).slice(0, 4)
  const price = formatPriceLabel(campaign.property?.price)
  const gradientId = `studio-story-overlay-${campaign.id}-${asset.id}`
  const waveId = `studio-story-wave-${campaign.id}-${asset.id}`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}">`,
    "<defs>",
    `<linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="rgba(1,33,13,0.98)" />`,
    `<stop offset="28%" stop-color="rgba(2,37,14,0.92)" />`,
    `<stop offset="58%" stop-color="rgba(5,22,12,0.48)" />`,
    `<stop offset="100%" stop-color="rgba(0,0,0,0.10)" />`,
    "</linearGradient>",
    `<radialGradient id="${waveId}" cx="82%" cy="100%" r="72%">`,
    `<stop offset="0%" stop-color="rgba(125,255,148,0.98)" />`,
    `<stop offset="38%" stop-color="rgba(42,178,66,0.66)" />`,
    `<stop offset="76%" stop-color="rgba(19,88,34,0.18)" />`,
    `<stop offset="100%" stop-color="rgba(19,88,34,0)" />`,
    "</radialGradient>",
    "</defs>",
    renderBackgroundImage(imageUrl, dimensions.width, dimensions.height),
    `<rect width="${dimensions.width}" height="${dimensions.height}" fill="url(#${gradientId})" />`,
    `<path d="M0 0 H${Math.round(dimensions.width * 0.56)} C${Math.round(dimensions.width * 0.6)} ${Math.round(dimensions.height * 0.24)} ${Math.round(dimensions.width * 0.58)} ${Math.round(dimensions.height * 0.82)} 0 ${dimensions.height} Z" fill="rgba(1,22,10,0.78)" />`,
    renderWaveDecoration(dimensions.width, dimensions.height, waveId),
    renderBadge(badge, 72, 84, 324, 70),
    renderLogo(officialLogoDataUri, dimensions.width - 250, 86, 170, 70),
    renderSingleLineText(category, 84, format === "reels_cover" ? 790 : 810, 22, "700", "#7be23f", 0.34),
    renderMultilineText(heroLayout.lines, 80, format === "reels_cover" ? 872 : 892, heroLayout.fontSize, "800", "#ffffff", heroLayout.lineHeight, 0.01),
    renderDivider(84, format === "reels_cover" ? 1198 : 1218, 92),
    renderStorySummary(summary, 84, format === "reels_cover" ? 1260 : 1288),
    renderStoryPricePanel(78, dimensions.height - 338, 430, 136, price),
    "</svg>",
  ].join("")
}

function renderBackgroundImage(imageUrl: string | null, width: number, height: number) {
  if (!imageUrl) {
    return `<rect width="${width}" height="${height}" fill="#05110a" />`
  }

  return `<image href="${escapeXml(imageUrl)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
}

function renderWaveDecoration(width: number, height: number, waveId: string) {
  const startY = Math.round(height * 0.79)
  const endY = Math.round(height * 0.98)

  return [
    `<path d="M${Math.round(width * 0.52)} ${height} C${Math.round(width * 0.68)} ${Math.round(height * 0.9)} ${Math.round(width * 0.82)} ${startY} ${width} ${endY} L${width} ${height} Z" fill="url(#${waveId})" opacity="0.92" />`,
    `<path d="M${Math.round(width * 0.48)} ${height} C${Math.round(width * 0.67)} ${Math.round(height * 0.88)} ${Math.round(width * 0.84)} ${Math.round(height * 0.82)} ${width} ${Math.round(height * 0.9)}" fill="none" stroke="rgba(123,226,63,0.42)" stroke-width="2.2" />`,
    `<path d="M${Math.round(width * 0.58)} ${height} C${Math.round(width * 0.76)} ${Math.round(height * 0.92)} ${Math.round(width * 0.88)} ${Math.round(height * 0.84)} ${width} ${Math.round(height * 0.94)}" fill="none" stroke="rgba(199,255,210,0.24)" stroke-width="1.4" />`,
    `<path d="M${Math.round(width * 0.66)} ${height} C${Math.round(width * 0.82)} ${Math.round(height * 0.93)} ${Math.round(width * 0.92)} ${Math.round(height * 0.88)} ${width} ${Math.round(height * 0.965)}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1" />`,
  ].join("")
}

function renderBadge(label: string, x: number, y: number, width: number, height: number) {
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect width="${width}" height="${height}" rx="${Math.round(height / 2)}" fill="rgba(30,144,51,0.84)" stroke="rgba(123,226,63,0.9)" stroke-width="2.4" />`,
    `<circle cx="40" cy="${Math.round(height / 2)}" r="18" fill="rgba(255,255,255,0.06)" />`,
    `<path d="M40 ${Math.round(height / 2) - 14} L44 ${Math.round(height / 2) - 4} L54 ${Math.round(height / 2)} L44 ${Math.round(height / 2) + 4} L40 ${Math.round(height / 2) + 14} L36 ${Math.round(height / 2) + 4} L26 ${Math.round(height / 2)} L36 ${Math.round(height / 2) - 4} Z" fill="#ffffff" />`,
    renderSingleLineText(label, 78, Math.round(height / 2) + 10, 22, "700", "#ffffff", 0.06),
    "</g>",
  ].join("")
}

function renderLogo(logoDataUri: string, x: number, y: number, width: number, height: number) {
  return `<image href="${escapeXml(logoDataUri)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMaxYMid meet" />`
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
  return `<rect x="${x}" y="${y}" width="${width}" height="6" rx="3" fill="#73df30" />`
}

function renderSummaryGrid(
  items: Array<{ icon: string; value: string; support?: string }>,
  x: number,
  y: number,
  availableWidth: number,
) {
  const cardWidth = Math.floor(availableWidth / Math.max(items.length, 1))

  return items
    .map((item, index) => {
      const originX = x + index * cardWidth
      const valueLayout = fitMultilineText(`${item.value}${item.support ? `\n${item.support}` : ""}`, cardWidth - 72, 24, 18, item.support ? 2 : 1)

      return [
        `<g transform="translate(${originX} ${y})">`,
        renderFeatureIcon(item.icon, 0, 0, "#73df30"),
        renderMultilineText(valueLayout.lines, 56, 28, valueLayout.fontSize, "500", "#ffffff", valueLayout.lineHeight, 0),
        index < items.length - 1 ? `<rect x="${cardWidth - 20}" y="6" width="1.4" height="104" fill="rgba(255,255,255,0.22)" />` : "",
        "</g>",
      ].join("")
    })
    .join("")
}

function renderStorySummary(items: Array<{ icon: string; value: string; support?: string }>, x: number, y: number) {
  return items
    .map((item, index) => {
      const offsetY = index * 118
      const valueLayout = fitMultilineText(`${item.value}${item.support ? `\n${item.support}` : ""}`, 340, 18, 18, 2)

      return [
        `<g transform="translate(${x} ${y + offsetY})">`,
        renderFeatureIcon(item.icon, 0, 0, "#73df30"),
        renderMultilineText(valueLayout.lines, 96, 22, valueLayout.fontSize, "500", "#ffffff", valueLayout.lineHeight, 0),
        "</g>",
      ].join("")
    })
    .join("")
}

function renderPriceCtaPanel(input: {
  x: number
  y: number
  width: number
  height: number
  price: string
  ctaLines: string[]
  ctaFontSize: number
  ctaLineHeight: number
}) {
  const dividerX = Math.round(input.width * 0.6)

  return [
    `<g transform="translate(${input.x} ${input.y})">`,
    `<rect width="${input.width}" height="${input.height}" rx="34" fill="rgba(0,0,0,0.18)" stroke="rgba(123,226,63,0.62)" stroke-width="2.1" />`,
    renderSingleLineText("PREÇO:", 36, 50, 24, "500", "#ffffff", 0),
    renderSingleLineText(input.price, 36, 96, 52, "800", "#73df30", 0),
    `<rect x="${dividerX}" y="26" width="1.4" height="${input.height - 52}" fill="rgba(255,255,255,0.2)" />`,
    `<g transform="translate(${dividerX + 38} 34)">`,
    renderFeatureIcon("calendar", 0, 0, "#73df30"),
    renderMultilineText(input.ctaLines, 64, 28, input.ctaFontSize, "700", "#ffffff", input.ctaLineHeight, 0),
    "</g>",
    "</g>",
  ].join("")
}

function renderStoryPricePanel(x: number, y: number, width: number, height: number, price: string) {
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect width="${width}" height="${height}" rx="28" fill="rgba(5,20,10,0.48)" stroke="rgba(123,226,63,0.56)" stroke-width="1.8" />`,
    renderSingleLineText("PREÇO", 34, 44, 21, "500", "#ffffff", 0),
    renderSingleLineText(price, 34, 108, 54, "800", "#73df30", 0),
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

function resolveCategoryLabel(campaign: StudioCampaignRecord) {
  return mapPropertyTypeLabel(campaign.property?.type).toUpperCase()
}

function resolveFeedHero(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = asRecord(asset.content)
  const preferred = readString(content.highlight) || readString(content.title)
  if (preferred) return preferred.toUpperCase()

  return buildDefaultHeadline(campaign).toUpperCase()
}

function resolveStoryHero(campaign: StudioCampaignRecord, asset: CampaignAssetRecord) {
  const content = asRecord(asset.content)
  const line1 = readString(content.line1) || readString(content.highlight)
  const line2 = readString(content.line2)
  if (line1 && line2) return `${line1}\n${line2}`.toUpperCase()
  if (line1) return line1.toUpperCase()
  return buildDefaultHeadline(campaign).toUpperCase()
}

function buildDefaultHeadline(campaign: StudioCampaignRecord) {
  const purpose = mapPurposeHeadline(campaign.property?.purpose)
  const neighborhood = campaign.property?.neighborhood?.trim()
  const city = campaign.property?.city?.trim()

  if (neighborhood) {
    return `${purpose}\n${prependLocationPreposition(neighborhood)}`
  }

  if (city) {
    return `${purpose}\nEM ${city}`
  }

  return purpose
}

function prependLocationPreposition(value: string) {
  const normalized = value.trim()
  const upper = normalized.toUpperCase()
  if (!upper) return "EM DESTAQUE"
  if (upper.startsWith("JARDINS")) return `NOS ${upper}`
  if (upper.startsWith("CENTRO")) return `NO ${upper}`
  return `EM ${upper}`
}

function buildSummaryItems(campaign: StudioCampaignRecord) {
  const area = readAreaLabel(campaign)
  const location = [campaign.property?.neighborhood, campaign.property?.city].filter(Boolean).join("\n")
  const items: Array<{ icon: string; value: string; support?: string }> = []

  if (location) {
    const [headline, support] = location.split("\n")
    items.push({ icon: "location", value: headline || "", support: support || undefined })
  }

  if (area) {
    items.push({ icon: "area", value: area, support: "Área útil" })
  } else if ((campaign.property?.bedrooms ?? 0) > 0) {
    items.push({ icon: "bed", value: `${campaign.property?.bedrooms} dormitório${campaign.property?.bedrooms === 1 ? "" : "s"}` })
  }

  if ((campaign.property?.bathrooms ?? 0) > 0) {
    items.push({ icon: "bath", value: `${campaign.property?.bathrooms} banheiro${campaign.property?.bathrooms === 1 ? "" : "s"}` })
  }

  if ((campaign.property?.parkingSpots ?? 0) > 0) {
    items.push({ icon: "car", value: `${campaign.property?.parkingSpots} vaga${campaign.property?.parkingSpots === 1 ? "" : "s"}` })
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
        lineHeight: Math.round(fontSize * 0.96),
      }
    }
  }

  return {
    lines: wrapText(normalized, Math.max(6, Math.floor(maxWidth / (minFontSize * 0.58))), maxLines),
    fontSize: minFontSize,
    lineHeight: Math.round(minFontSize * 0.96),
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
      return "Escritório"
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
  return "À VENDA"
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

function getFeedDimensions(format: Exclude<StudioCreativeFormat, "story" | "reels_cover">) {
  switch (format) {
    case "thumbnail":
      return { width: 1200, height: 1200 }
    case "whatsapp":
      return { width: 1200, height: 1200 }
    case "catalog":
      return { width: 1600, height: 900 }
    case "feed":
    default:
      return { width: 1254, height: 1254 }
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
