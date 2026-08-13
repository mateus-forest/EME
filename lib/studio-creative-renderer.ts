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
  render: (payload: StudioCreativePayload, measure: StudioTextMeasurer) => Promise<StudioCreativeRenderResult>
}

export type StudioCreativeRenderResult = {
  svg: string
  textRuns: StudioTextRun[]
}

export type StudioCreativeBranding = {
  brokerName: string | null
  brokerPhotoDataUri: string | null
  brokerCreci: string | null
  agencyName: string | null
  agencyLogoDataUri: string | null
  accentColor: string | null
  showAgencyWatermark: boolean
}

type StudioCreativePayload = {
  width: number
  height: number
  badgeLabel: string
  eyebrow: string
  title: string
  location: string
  areaLabel: string | null
  features: string[]
  price: string
  metricLabel: string
  metricSupport: string
  ctaLabel: string
  propertyImageSrc: string | null
  gradientId: string
  waveId: string
  accentColor: string
  brokerName: string | null
  brokerPhotoDataUri: string | null
  brokerCreci: string | null
  agencyName: string | null
  agencyLogoDataUri: string | null
  showAgencyWatermark: boolean
}

type StudioFeatureItem = {
  icon: "location" | "area" | "bath" | "car" | "bed"
  line1: string
  line2?: string
}

export type StudioFontWeight = "400" | "500" | "700"

export type StudioTextRun = {
  x: number
  y: number
  lines: string[]
  fontSize: number
  fontWeight: StudioFontWeight
  color: string
  letterSpacingEm: number
  lineHeight: number
  anchor: "start" | "middle" | "end"
}

// Real ink-bbox measurement of a single line, via the same sharp text rasterizer used to draw it
// (see lib/studio-text-metrics.server.ts) — implemented outside this file and injected here so
// this module (also imported by client bundles through lib/studio-campaigns-ui.ts) never touches
// sharp/fs directly. Container sizing below uses this for WIDTH only; height stays derived from
// the fixed ascent/descent ratios so it doesn't jitter per-string based on which glyphs happen to
// have descenders.
export type StudioTextMeasurer = (
  text: string,
  fontSize: number,
  fontWeight: StudioFontWeight,
  letterSpacingEm?: number,
) => Promise<{ width: number; height: number }>

// Fallback accent when neither the acting broker nor their agency has configured a brand color —
// matches the lime-green this renderer always used before the color became configurable, so
// existing brokers/campaigns keep the exact same look with zero setup.
export const DEFAULT_STUDIO_ACCENT_COLOR = "#73df30"

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

function resolveAccentColor(value: string | null | undefined) {
  const normalized = value?.trim() ?? ""
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : DEFAULT_STUDIO_ACCENT_COLOR
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const normalized = HEX_COLOR_PATTERN.test(hex) ? hex : DEFAULT_STUDIO_ACCENT_COLOR
  const int = parseInt(normalized.slice(1), 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

// Same accent hex used for every "colored" element in the template (icons, divider, price,
// badge/panel borders, wave), just re-expressed at whatever alpha that particular element used
// to hardcode against the old fixed lime green — so recoloring stays a single source of truth
// instead of independently-tinted elements drifting out of sync with each other.
function accentRgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgbTuple(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Embedded directly (public/fonts/geist/*.ttf) and rasterized per text run via sharp's native
// text renderer with an explicit `fontfile`, instead of a CSS font-family resolved through the
// render environment's fontconfig/SVG @font-face support — neither is reliably available in
// production (SVG <text> there rendered as tofu boxes). The family name is only a label; the
// file is what actually selects the glyphs, so there is no dependency on server font config.
export const STUDIO_FONT_FALLBACK = "Arial, sans-serif"
export const STUDIO_FONT_ASSETS: Record<StudioFontWeight, { file: string; family: string }> = {
  "400": { file: "Geist-Regular.ttf", family: `Geist, ${STUDIO_FONT_FALLBACK}` },
  "500": { file: "Geist-Medium.ttf", family: `Geist Medium, ${STUDIO_FONT_FALLBACK}` },
  "700": { file: "Geist-Bold.ttf", family: `Geist Bold, ${STUDIO_FONT_FALLBACK}` },
}
export const STUDIO_FONT_DIR = "/fonts/geist"

// Measured from the embedded Geist TTFs' `hhea` table (ascender 1005 / unitsPerEm 1000). sharp's
// text rasterizer ink-crops each run to its glyphs, so the returned buffer carries no baseline
// metadata; this ratio converts the baseline-anchored `y` coordinates used throughout this file
// (SVG <text> semantics) into a top-left compositing offset.
export const STUDIO_FONT_ASCENT_RATIO = 1.005

// Same source as above (hhea descender -295 / unitsPerEm 1000). Used to compute how far a text
// block's ink actually extends below its baseline, so a following block can be placed with a real
// gap instead of guessing — the block-height helpers below only account for line-to-line spacing
// within a single multiline run, not the last line's own descent.
export const STUDIO_FONT_DESCENT_RATIO = 0.295

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

export function resolveStudioCreativeFormat(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
): StudioCreativeFormat | null {
  return resolveStudioTemplate(campaign, asset)?.format ?? null
}

export async function renderStudioCreativeLayers(
  campaign: StudioCampaignRecord,
  asset: CampaignAssetRecord,
  branding: StudioCreativeBranding,
  propertyImageSrc: string | null | undefined,
  measure: StudioTextMeasurer,
): Promise<StudioCreativeRenderResult | null> {
  const template = resolveStudioTemplate(campaign, asset)
  if (!template) return null

  const payload = buildStudioCreativePayload({
    campaign,
    asset,
    template,
    branding,
    propertyImageSrc: propertyImageSrc ?? null,
  })

  return template.render(payload, measure)
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
  branding: StudioCreativeBranding
  propertyImageSrc: string | null
}): StudioCreativePayload {
  const content = asRecord(input.asset.content)
  const eyebrow = mapPropertyTypeLabel(input.campaign.property?.type).toUpperCase()
  const title = resolveDisplayTitle(input.campaign, content)
  const location = resolveDisplayLocation(input.campaign, content)
  const areaLabel = readAreaLabel(input.campaign)
  const features = resolveDisplayFeatures(input.campaign, content)
  const price = resolveDisplayPrice(input.campaign, content)
  const metric = resolveMetric(content)
  const badgeLabel = resolveCampaignBadge(input.campaign)
  const ctaLabel = resolveDisplayCta(content)
  const gradientToken = sanitizeFileName(`${input.campaign.id}-${input.asset.id}-${input.template.id}`)

  return {
    width: input.template.width,
    height: input.template.height,
    badgeLabel,
    eyebrow,
    title,
    location,
    areaLabel,
    features,
    price,
    metricLabel: metric.label,
    metricSupport: metric.support,
    ctaLabel,
    propertyImageSrc: input.propertyImageSrc || resolveCampaignImage(input.campaign),
    gradientId: `studio-gradient-${gradientToken}`,
    waveId: `studio-wave-${gradientToken}`,
    accentColor: resolveAccentColor(input.branding.accentColor),
    brokerName: input.branding.brokerName,
    brokerPhotoDataUri: input.branding.brokerPhotoDataUri,
    brokerCreci: input.branding.brokerCreci,
    agencyName: input.branding.agencyName,
    agencyLogoDataUri: input.branding.agencyLogoDataUri,
    showAgencyWatermark: input.branding.showAgencyWatermark,
  }
}

async function renderInstagramFeedTemplate(
  payload: StudioCreativePayload,
  measure: StudioTextMeasurer,
): Promise<StudioCreativeRenderResult> {
  const textRuns: StudioTextRun[] = []
  const eyebrowFontSize = 20
  const eyebrowY = 270
  const titleLayout = fitMultilineText(payload.title, 500, 64, 44, 2)
  const locationItem = buildLocationFeature(payload.location)
  const areaItem = buildAreaFeature(payload.areaLabel)
  const featureItems = [locationItem, areaItem, ...payload.features.map((feature) => buildFeatureItem(feature))]
    .filter((item): item is StudioFeatureItem => Boolean(item))
    .slice(0, 4)

  const ctaLayout = fitMultilineText(payload.ctaLabel, CTA_MAX_WIDTH, CTA_MAX_FONT_SIZE, CTA_MIN_FONT_SIZE, CTA_MAX_LINES)
  const ctaConfig = { lines: ctaLayout.lines, fontSize: ctaLayout.fontSize, lineHeight: ctaLayout.lineHeight }

  const [badgeBox, metricPanelBox] = await Promise.all([
    computeBadgeBox(measure, payload.badgeLabel),
    computeMetricPanelBox(measure, {
      metricLabel: payload.metricLabel,
      metricValue: payload.price,
      metricValueFontSize: 38,
      metricSupport: payload.metricSupport,
      cta: ctaConfig,
    }),
  ])

  const titleY = stackTextBlockY(eyebrowY, 0, eyebrowFontSize, 10, titleLayout.fontSize)
  const titleBottom = titleY + titleLayout.blockHeight + titleLayout.fontSize * STUDIO_FONT_DESCENT_RATIO
  const dividerY = Math.max(500, Math.round(titleBottom + 28))

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${payload.width} ${payload.height}" width="${payload.width}" height="${payload.height}">`,
    "<defs>",
    `<linearGradient id="${payload.gradientId}" x1="0" y1="0" x2="0.88" y2="0.82">`,
    `<stop offset="0%" stop-color="rgba(2,14,7,0.92)" />`,
    `<stop offset="36%" stop-color="rgba(3,16,9,0.78)" />`,
    `<stop offset="62%" stop-color="rgba(4,18,10,0.46)" />`,
    `<stop offset="100%" stop-color="rgba(5,18,10,0.04)" />`,
    "</linearGradient>",
    `<radialGradient id="${payload.waveId}" cx="94%" cy="100%" r="68%">`,
    `<stop offset="0%" stop-color="${accentRgba(payload.accentColor, 0.24)}" />`,
    `<stop offset="60%" stop-color="${accentRgba(payload.accentColor, 0.08)}" />`,
    `<stop offset="100%" stop-color="${accentRgba(payload.accentColor, 0)}" />`,
    "</radialGradient>",
    "</defs>",
    renderBackgroundImage(payload.propertyImageSrc, payload.width, payload.height),
    `<rect width="${payload.width}" height="${payload.height}" fill="url(#${payload.gradientId})" />`,
    renderLeftOverlay(payload.width, payload.height, false),
    renderBottomWave(payload.width, payload.height, payload.waveId, false, payload.accentColor),
    renderBadge(textRuns, payload.badgeLabel, 68, 58, badgeBox.width, badgeBox.height, payload.accentColor),
    renderBrokerHeader(textRuns, {
      rightX: 1010,
      topY: 40,
      avatarRadius: 40,
      nameFontSize: 23,
      detailFontSize: 15,
      photoDataUri: payload.brokerPhotoDataUri,
      name: payload.brokerName,
      agencyName: payload.agencyName,
      creci: payload.brokerCreci,
      accentColor: payload.accentColor,
    }),
    renderSingleLineText(textRuns, payload.eyebrow, 70, eyebrowY, eyebrowFontSize, "700", payload.accentColor, 0.16),
    renderMultilineText(textRuns, titleLayout.lines, 70, titleY, titleLayout.fontSize, "700", "#ffffff", titleLayout.lineHeight, 0),
    renderDivider(70, dividerY, 96, payload.accentColor),
    renderFeatureRow(textRuns, featureItems, 70, dividerY + 64, 235, payload.accentColor),
    renderMetricPanel(textRuns, {
      x: 68,
      y: 905,
      width: metricPanelBox.width,
      height: metricPanelBox.height,
      stackColumnWidth: metricPanelBox.stackColumnWidth,
      metricLabel: payload.metricLabel,
      metricValue: payload.price,
      metricValueFontSize: 38,
      metricSupport: payload.metricSupport,
      cta: ctaConfig,
      accentColor: payload.accentColor,
    }),
    payload.showAgencyWatermark && payload.agencyName
      ? renderAgencyWatermark(textRuns, {
          rightX: 1010,
          bottomY: 1010,
          boxWidth: 108,
          boxHeight: 86,
          logoDataUri: payload.agencyLogoDataUri,
          agencyName: payload.agencyName,
          creci: payload.brokerCreci,
          accentColor: payload.accentColor,
        })
      : "",
    "</svg>",
  ].join("")

  return { svg, textRuns }
}

async function renderInstagramStoryTemplate(
  payload: StudioCreativePayload,
  measure: StudioTextMeasurer,
): Promise<StudioCreativeRenderResult> {
  const textRuns: StudioTextRun[] = []
  const eyebrowFontSize = 22
  const eyebrowY = 390
  const titleLayout = fitMultilineText(payload.title, 420, 72, 50, 2)
  const locationItem = buildLocationFeature(payload.location)
  const areaItem = buildAreaFeature(payload.areaLabel)
  const featureItems = [locationItem, areaItem, ...payload.features.map((feature) => buildFeatureItem(feature))]
    .filter((item): item is StudioFeatureItem => Boolean(item))
    .slice(0, 4)

  const [badgeBox, metricPanelBox] = await Promise.all([
    computeBadgeBox(measure, payload.badgeLabel),
    computeMetricPanelBox(measure, {
      metricLabel: payload.metricLabel,
      metricValue: payload.price,
      metricValueFontSize: 40,
      metricSupport: payload.metricSupport,
    }),
  ])

  const titleY = stackTextBlockY(eyebrowY, 0, eyebrowFontSize, 12, titleLayout.fontSize)
  const titleBottom = titleY + titleLayout.blockHeight + titleLayout.fontSize * STUDIO_FONT_DESCENT_RATIO
  const dividerY = Math.max(720, Math.round(titleBottom + 32))
  const featureSpacing = featureItems.length > 3 ? 160 : 184

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${payload.width} ${payload.height}" width="${payload.width}" height="${payload.height}">`,
    "<defs>",
    `<linearGradient id="${payload.gradientId}" x1="0" y1="0" x2="0.92" y2="0.88">`,
    `<stop offset="0%" stop-color="rgba(2,14,7,0.94)" />`,
    `<stop offset="34%" stop-color="rgba(3,16,9,0.82)" />`,
    `<stop offset="62%" stop-color="rgba(4,18,10,0.5)" />`,
    `<stop offset="100%" stop-color="rgba(5,18,10,0.05)" />`,
    "</linearGradient>",
    `<radialGradient id="${payload.waveId}" cx="96%" cy="100%" r="70%">`,
    `<stop offset="0%" stop-color="${accentRgba(payload.accentColor, 0.22)}" />`,
    `<stop offset="62%" stop-color="${accentRgba(payload.accentColor, 0.08)}" />`,
    `<stop offset="100%" stop-color="${accentRgba(payload.accentColor, 0)}" />`,
    "</radialGradient>",
    "</defs>",
    renderBackgroundImage(payload.propertyImageSrc, payload.width, payload.height),
    `<rect width="${payload.width}" height="${payload.height}" fill="url(#${payload.gradientId})" />`,
    renderLeftOverlay(payload.width, payload.height, true),
    renderBottomWave(payload.width, payload.height, payload.waveId, true, payload.accentColor),
    renderBadge(textRuns, payload.badgeLabel, 80, 92, badgeBox.width, badgeBox.height, payload.accentColor),
    renderBrokerHeader(textRuns, {
      rightX: 998,
      topY: 50,
      avatarRadius: 54,
      nameFontSize: 28,
      detailFontSize: 18,
      photoDataUri: payload.brokerPhotoDataUri,
      name: payload.brokerName,
      agencyName: payload.agencyName,
      creci: payload.brokerCreci,
      accentColor: payload.accentColor,
    }),
    renderSingleLineText(textRuns, payload.eyebrow, 82, eyebrowY, eyebrowFontSize, "700", payload.accentColor, 0.16),
    renderMultilineText(textRuns, titleLayout.lines, 82, titleY, titleLayout.fontSize, "700", "#ffffff", titleLayout.lineHeight, 0),
    renderDivider(82, dividerY, 104, payload.accentColor),
    renderFeatureStack(textRuns, featureItems, 82, dividerY + 72, 360, payload.accentColor, featureSpacing),
    renderMetricPanel(textRuns, {
      x: 80,
      y: 1560,
      width: metricPanelBox.width,
      height: metricPanelBox.height,
      stackColumnWidth: metricPanelBox.stackColumnWidth,
      metricLabel: payload.metricLabel,
      metricValue: payload.price,
      metricValueFontSize: 40,
      metricSupport: payload.metricSupport,
      accentColor: payload.accentColor,
    }),
    payload.showAgencyWatermark && payload.agencyName
      ? renderAgencyWatermark(textRuns, {
          rightX: 998,
          bottomY: 1850,
          boxWidth: 150,
          boxHeight: 118,
          logoDataUri: payload.agencyLogoDataUri,
          agencyName: payload.agencyName,
          creci: payload.brokerCreci,
          accentColor: payload.accentColor,
        })
      : "",
    "</svg>",
  ].join("")

  return { svg, textRuns }
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

function renderBottomWave(width: number, height: number, waveId: string, portrait: boolean, accentColor: string) {
  if (portrait) {
    return [
      `<path d="M628 ${height} C756 ${height - 146} 898 ${height - 218} ${width} ${height - 168} L${width} ${height} Z" fill="url(#${waveId})" />`,
      `<path d="M628 ${height} C760 ${height - 150} 908 ${height - 222} ${width} ${height - 176}" fill="none" stroke="${accentRgba(accentColor, 0.72)}" stroke-width="2.2" />`,
    ].join("")
  }

  return [
    `<path d="M820 ${height} C928 ${height - 120} 1012 ${height - 136} ${width} ${height - 102} L${width} ${height} Z" fill="url(#${waveId})" />`,
    `<path d="M818 ${height} C926 ${height - 124} 1018 ${height - 142} ${width} ${height - 108}" fill="none" stroke="${accentRgba(accentColor, 0.72)}" stroke-width="2" />`,
  ].join("")
}

const BADGE_ICON_LEFT_PAD = 22
const BADGE_ICON_WIDTH = 38
const BADGE_ICON_TEXT_GAP = 22
const BADGE_FONT_SIZE = 22
const BADGE_VERTICAL_PADDING = 14
// Local SVG-path bounds of the "badge" icon in renderFeatureIcon (a star spanning y 0-38, no
// top offset) and the "calendar" icon (y 2-51, so a 2px top offset before its own 49px height) —
// needed to center each icon by its actual ink, not an eyeballed height.
const BADGE_ICON_HEIGHT = 38
const CALENDAR_ICON_TOP = 2
const CALENDAR_ICON_HEIGHT = 49
// Horizontal ink bounds of the "calendar" icon path (rect x 8-50, arrow reaching ~x54) — same
// role as BADGE_ICON_WIDTH: a fixed glyph-art size, not a text-content measurement.
const CALENDAR_ICON_WIDTH = 54

const PANEL_PADDING_X = 34
const PANEL_VERTICAL_PADDING = 28
const PANEL_DIVIDER_GAP = 30
const PANEL_ICON_TEXT_GAP = 26

// CTA text wrap budget (Feed only — Story's price panel has no CTA column). A max width bounds how
// wide a single unwrapped line can get before wrapText breaks it, so a long custom CTA can't blow
// up the panel width unboundedly; 2 lines with a shrink-then-truncate-with-ellipsis fallback mirror
// the same protection already used for the title (fitMultilineText, see resolveDisplayTitle).
const CTA_MAX_WIDTH = 170
const CTA_MAX_FONT_SIZE = 20
const CTA_MIN_FONT_SIZE = 16
const CTA_MAX_LINES = 2

// Container = measured content + fixed padding, never a fixed total size. Width comes from a real
// glyph-ink measurement of the label (via `measure`, backed by the same sharp text rasterizer that
// actually draws it — see StudioTextMeasurer); height comes from the icon/text ascent+descent
// metrics already established for this renderer, so it doesn't jitter per-string based on which
// glyphs happen to have descenders.
async function computeBadgeBox(measure: StudioTextMeasurer, label: string) {
  const { width: textWidth } = await measure(label, BADGE_FONT_SIZE, "500", 0.01)
  const textInkHeight = BADGE_FONT_SIZE * (STUDIO_FONT_ASCENT_RATIO + STUDIO_FONT_DESCENT_RATIO)

  const width = BADGE_ICON_LEFT_PAD + BADGE_ICON_WIDTH + BADGE_ICON_TEXT_GAP + Math.ceil(textWidth) + BADGE_ICON_LEFT_PAD
  const height = Math.round(Math.max(BADGE_ICON_HEIGHT, textInkHeight) + BADGE_VERTICAL_PADDING * 2)

  return { width, height }
}

// Same principle as computeBadgeBox, for the price panel (both the Feed variant, with a CTA
// column right of a divider, and the Story variant, which is just the label+value(+support) stack
// with no CTA/divider at all). `stackColumnWidth` is returned alongside width/height so the drawing
// function below can place the divider and CTA column at the exact edge of the real content
// instead of a fraction of a fixed panel width.
async function computeMetricPanelBox(
  measure: StudioTextMeasurer,
  input: {
    metricLabel: string
    metricValue: string
    metricValueFontSize: number
    metricSupport: string
    cta?: { lines: string[]; fontSize: number; lineHeight: number }
  },
) {
  const labelFontSize = 20
  const supportFontSize = 18
  const stackGap = 12

  const [labelBox, valueBox, supportBox] = await Promise.all([
    measure(input.metricLabel, labelFontSize, "500", 0.01),
    measure(input.metricValue, input.metricValueFontSize, "700", 0),
    measure(input.metricSupport, supportFontSize, "400", 0),
  ])
  const stackColumnWidth = Math.ceil(Math.max(labelBox.width, valueBox.width, supportBox.width))

  const relativeLabelY = Math.round(labelFontSize * STUDIO_FONT_ASCENT_RATIO)
  const relativeValueY = stackTextBlockY(relativeLabelY, 0, labelFontSize, stackGap, input.metricValueFontSize)
  const relativeSupportY = input.metricSupport
    ? stackTextBlockY(relativeValueY, 0, input.metricValueFontSize, stackGap - 4, supportFontSize)
    : null
  const stackBottomFontSize = relativeSupportY !== null ? supportFontSize : input.metricValueFontSize
  const stackHeight = (relativeSupportY ?? relativeValueY) + stackBottomFontSize * STUDIO_FONT_DESCENT_RATIO

  let ctaColumnWidth = 0
  let ctaHeight = 0
  if (input.cta) {
    const ctaBoxes = await Promise.all(input.cta.lines.map((line) => measure(line, input.cta!.fontSize, "700", 0)))
    ctaColumnWidth = Math.ceil(Math.max(...ctaBoxes.map((box) => box.width)))
    ctaHeight =
      Math.max(0, input.cta.lines.length - 1) * input.cta.lineHeight +
      input.cta.fontSize * (STUDIO_FONT_ASCENT_RATIO + STUDIO_FONT_DESCENT_RATIO)
  }

  const contentHeight = Math.max(stackHeight, ctaHeight, input.cta ? CALENDAR_ICON_HEIGHT : 0)
  const height = Math.round(contentHeight + PANEL_VERTICAL_PADDING * 2)

  const width = input.cta
    ? PANEL_PADDING_X +
      stackColumnWidth +
      PANEL_DIVIDER_GAP * 2 +
      CALENDAR_ICON_WIDTH +
      PANEL_ICON_TEXT_GAP +
      ctaColumnWidth +
      PANEL_PADDING_X
    : PANEL_PADDING_X * 2 + stackColumnWidth

  return { width: Math.round(width), height, stackColumnWidth }
}

function renderBadge(runs: StudioTextRun[], label: string, x: number, y: number, width: number, height: number, accentColor: string) {
  return [
    `<g transform="translate(${x} ${y})">`,
    `<rect width="${width}" height="${height}" rx="${Math.round(height / 2)}" fill="rgba(25,116,44,0.74)" stroke="${accentRgba(accentColor, 0.88)}" stroke-width="2.1" />`,
    renderFeatureIcon("badge", BADGE_ICON_LEFT_PAD, centerIconY(height, 0, BADGE_ICON_HEIGHT), "#ffffff"),
    "</g>",
    renderSingleLineText(
      runs,
      label,
      x + BADGE_ICON_LEFT_PAD + BADGE_ICON_WIDTH + BADGE_ICON_TEXT_GAP,
      y + centerTextBlockY(height, BADGE_FONT_SIZE, 0, 1),
      BADGE_FONT_SIZE,
      "500",
      "#ffffff",
      0.01,
    ),
  ].join("")
}

function renderLogo(logoDataUri: string, x: number, y: number, width: number, height: number) {
  return `<image href="${escapeXml(logoDataUri)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />`
}

// Mirrors the "MC"/"EP" initials fallback already used in the broker/agency account settings
// pages whenever no photo/logo is on file — same rule (first letter of up to the first 2 words).
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "EM"
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "EM"
}

// Top-right identity block that replaced the old fixed EME "M" mark: broker photo (or initials
// when none on file) plus name, then agency name + CRECI on the line below — or just CRECI when
// the broker has no agency (never blank: falls back to "Corretor EME" if even the name is
// missing, since this is the one thing the creative uses to say "who to contact").
// Right-anchored at a fixed x so it never needs a text-width measurement pass: this stays
// correctly positioned regardless of how long the broker/agency name is, unlike the
// badge/metric-panel boxes elsewhere in this file which size themselves from real glyph ink.
function renderBrokerHeader(
  runs: StudioTextRun[],
  input: {
    rightX: number
    topY: number
    avatarRadius: number
    nameFontSize: number
    detailFontSize: number
    photoDataUri: string | null
    name: string | null
    agencyName: string | null
    creci: string | null
    accentColor: string
  },
) {
  const avatarCx = input.rightX - input.avatarRadius
  const avatarCy = input.topY + input.avatarRadius
  const diameter = input.avatarRadius * 2
  const clipId = `studio-avatar-clip-${Math.round(avatarCx)}-${Math.round(avatarCy)}`
  const displayName = input.name?.trim() || "Corretor EME"

  const avatarContent = input.photoDataUri
    ? [
        `<clipPath id="${clipId}"><circle cx="${avatarCx}" cy="${avatarCy}" r="${input.avatarRadius}" /></clipPath>`,
        `<image href="${escapeXml(input.photoDataUri)}" x="${avatarCx - input.avatarRadius}" y="${avatarCy - input.avatarRadius}" width="${diameter}" height="${diameter}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`,
      ].join("")
    : [
        `<circle cx="${avatarCx}" cy="${avatarCy}" r="${input.avatarRadius}" fill="rgba(6,17,10,0.62)" />`,
        renderSingleLineText(
          runs,
          getInitials(displayName),
          avatarCx,
          avatarCy - input.avatarRadius + centerTextBlockY(diameter, Math.round(input.avatarRadius * 0.8), 0, 1),
          Math.round(input.avatarRadius * 0.8),
          "700",
          "#ffffff",
          0,
          "middle",
        ),
      ].join("")

  const nameY = avatarCy + input.avatarRadius + Math.round(input.nameFontSize * 1.35)
  const detailY = nameY + Math.round(input.detailFontSize * 1.5)
  const detailText = input.agencyName
    ? `${input.agencyName} | CRECI ${input.creci || "-"}`
    : input.creci
      ? `CRECI ${input.creci}`
      : ""

  return [
    `<circle cx="${avatarCx}" cy="${avatarCy}" r="${input.avatarRadius + 3}" fill="none" stroke="${input.accentColor}" stroke-width="3" />`,
    avatarContent,
    renderSingleLineText(runs, displayName, input.rightX, nameY, input.nameFontSize, "700", "#ffffff", 0, "end"),
    detailText
      ? renderSingleLineText(runs, detailText, input.rightX, detailY, input.detailFontSize, "500", "#e6e6e6", 0, "end")
      : "",
  ].join("")
}

// Bottom-right agency co-branding watermark — the agency's own uploaded logo when present,
// otherwise a generated initials mark (same fallback idea as renderBrokerHeader/the account
// settings pages) plus "IMÓVEIS", with the broker's CRECI printed just below. Only ever called
// when payload.showAgencyWatermark && payload.agencyName are both truthy (see call sites).
function renderAgencyWatermark(
  runs: StudioTextRun[],
  input: {
    rightX: number
    bottomY: number
    boxWidth: number
    boxHeight: number
    logoDataUri: string | null
    agencyName: string
    creci: string | null
    accentColor: string
  },
) {
  const boxX = input.rightX - input.boxWidth
  const boxTop = input.bottomY - input.boxHeight
  const boxCenterX = boxX + input.boxWidth / 2

  const mark = input.logoDataUri
    ? renderLogo(input.logoDataUri, boxX + 10, boxTop + 10, input.boxWidth - 20, input.boxHeight - 20)
    : [
        renderSingleLineText(
          runs,
          getInitials(input.agencyName),
          boxCenterX,
          boxTop + input.boxHeight * 0.56,
          Math.round(input.boxHeight * 0.42),
          "700",
          input.accentColor,
          0,
          "middle",
        ),
        renderSingleLineText(
          runs,
          "IMÓVEIS",
          boxCenterX,
          boxTop + input.boxHeight * 0.82,
          Math.round(input.boxHeight * 0.14),
          "700",
          "#e6e6e6",
          0.12,
          "middle",
        ),
      ].join("")

  const creciText = input.creci ? `CRECI ${input.creci}` : ""
  const creciY = input.bottomY + Math.round(input.boxHeight * 0.32)

  return [
    `<rect x="${boxX}" y="${boxTop}" width="${input.boxWidth}" height="${input.boxHeight}" rx="14" fill="rgba(6,17,10,0.5)" stroke="${accentRgba(input.accentColor, 0.55)}" stroke-width="1.6" />`,
    mark,
    creciText
      ? renderSingleLineText(runs, creciText, boxCenterX, creciY, Math.round(input.boxHeight * 0.16), "500", "#dcdcdc", 0, "middle")
      : "",
  ].join("")
}

function renderDivider(x: number, y: number, width: number, accentColor: string) {
  return `<rect x="${x}" y="${y}" width="${width}" height="4" rx="2" fill="${accentColor}" />`
}

// columnWidth is a fixed per-item budget, not a total row width divided by item count: with a
// fixed total, fewer items (e.g. 3 instead of 4 when the property has no area on file) stretched
// each column wider, leaving uneven leftover space after each item's actual (shorter) text before
// hitting the next divider — items *looked* unevenly spaced even though the column boundaries
// were mathematically even. A constant column width keeps the same visual rhythm regardless of
// how many items are actually present; the row is simply shorter with fewer of them.
function renderFeatureRow(runs: StudioTextRun[], items: StudioFeatureItem[], x: number, y: number, columnWidth: number, accentColor: string) {
  return items
    .map((item, index) => {
      const originX = x + index * columnWidth
      const lines = [item.line1, item.line2].filter(Boolean) as string[]
      const textLayout = fitMultilineText(lines.join("\n"), columnWidth - 70, 18, 14, 3)

      return [
        `<g transform="translate(${originX} ${y})">`,
        renderFeatureIcon(item.icon, 0, 0, accentColor),
        index < items.length - 1
          ? `<rect x="${columnWidth - 26}" y="6" width="1.2" height="124" fill="rgba(255,255,255,0.22)" />`
          : "",
        "</g>",
        renderMultilineText(runs, textLayout.lines, originX, y + 112, textLayout.fontSize, "400", "#ffffff", textLayout.lineHeight, 0),
      ].join("")
    })
    .join("")
}

function renderFeatureStack(
  runs: StudioTextRun[],
  items: StudioFeatureItem[],
  x: number,
  y: number,
  width: number,
  accentColor: string,
  spacing = 184,
) {
  const dividerY = spacing - 30

  return items
    .map((item, index) => {
      const offsetY = index * spacing
      const groupY = y + offsetY
      const textLayout = fitMultilineText([item.line1, item.line2].filter(Boolean).join("\n"), width - 132, 20, 16, 3)

      return [
        `<g transform="translate(${x} ${groupY})">`,
        renderFeatureIcon(item.icon, 0, 6, accentColor),
        index < items.length - 1 ? `<rect x="0" y="${dividerY}" width="${width}" height="1.2" fill="rgba(255,255,255,0.22)" />` : "",
        "</g>",
        renderMultilineText(runs, textLayout.lines, x + 136, groupY + 46, textLayout.fontSize, "400", "#ffffff", textLayout.lineHeight, 0),
      ].join("")
    })
    .join("")
}

function renderMetricPanel(runs: StudioTextRun[], input: {
  x: number
  y: number
  width: number
  height: number
  // Real measured width of the label/value/support text stack (see computeMetricPanelBox) — the
  // divider and CTA column are placed at the exact edge of that content, with a fixed gap on each
  // side, instead of a fraction of the panel's total width.
  stackColumnWidth: number
  metricLabel: string
  metricValue: string
  metricValueFontSize: number
  metricSupport: string
  // Story's panel has no calendar/CTA section at all (see the two approved reference images side
  // by side) — omit entirely rather than rendering an empty divider.
  cta?: { lines: string[]; fontSize: number; lineHeight: number }
  accentColor: string
}) {
  const dividerX = input.cta ? Math.round(PANEL_PADDING_X + input.stackColumnWidth + PANEL_DIVIDER_GAP) : 0
  const iconX = dividerX + PANEL_DIVIDER_GAP
  const panelPaddingX = PANEL_PADDING_X
  const labelFontSize = 20
  const supportFontSize = 18
  const stackGap = 12

  // Relative positions first (as if the label/value/support stack started at y=0), then shift
  // the whole stack so it's vertically centered in the panel. Anchoring from a fixed top padding
  // instead left a large asymmetric gap under the content whenever the panel was taller than the
  // text stack (Story's CTA-less, single-column panel especially) — this centers it against the
  // panel's actual height instead.
  const relativeLabelY = Math.round(labelFontSize * STUDIO_FONT_ASCENT_RATIO)
  const relativeValueY = stackTextBlockY(relativeLabelY, 0, labelFontSize, stackGap, input.metricValueFontSize)
  const relativeSupportY = input.metricSupport
    ? stackTextBlockY(relativeValueY, 0, input.metricValueFontSize, stackGap - 4, supportFontSize)
    : null
  const stackBottomFontSize = relativeSupportY !== null ? supportFontSize : input.metricValueFontSize
  const stackBottom = (relativeSupportY ?? relativeValueY) + stackBottomFontSize * STUDIO_FONT_DESCENT_RATIO
  const stackOffset = Math.round((input.height - stackBottom) / 2)

  const labelY = relativeLabelY + stackOffset
  const valueY = relativeValueY + stackOffset
  const supportY = relativeSupportY !== null ? relativeSupportY + stackOffset : null

  const ctaIconY = input.cta ? centerIconY(input.height, CALENDAR_ICON_TOP, CALENDAR_ICON_HEIGHT) : 0
  const ctaTextY = input.cta ? centerTextBlockY(input.height, input.cta.fontSize, input.cta.lineHeight, input.cta.lines.length) : 0

  return [
    `<g transform="translate(${input.x} ${input.y})">`,
    `<rect width="${input.width}" height="${input.height}" rx="30" fill="rgba(5,14,8,0.42)" stroke="${accentRgba(input.accentColor, 0.72)}" stroke-width="1.6" />`,
    input.cta
      ? [
          `<rect x="${dividerX}" y="26" width="1.2" height="${input.height - 52}" fill="rgba(255,255,255,0.24)" />`,
          renderFeatureIcon("calendar", iconX, ctaIconY, input.accentColor),
        ].join("")
      : "",
    "</g>",
    renderSingleLineText(runs, input.metricLabel, input.x + panelPaddingX, input.y + labelY, labelFontSize, "500", "#ffffff", 0.01),
    renderSingleLineText(runs, input.metricValue, input.x + panelPaddingX, input.y + valueY, input.metricValueFontSize, "700", input.accentColor, 0),
    supportY !== null
      ? renderSingleLineText(runs, input.metricSupport, input.x + panelPaddingX, input.y + supportY, supportFontSize, "400", "#ffffff", 0)
      : "",
    input.cta
      ? renderMultilineText(
          runs,
          input.cta.lines,
          input.x + iconX + CALENDAR_ICON_WIDTH + PANEL_ICON_TEXT_GAP,
          input.y + ctaTextY,
          input.cta.fontSize,
          "700",
          "#ffffff",
          input.cta.lineHeight,
          0,
        )
      : "",
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

  if (normalized === "LANCAMENTO") return "LANÇAMENTO"
  return normalizeStudioText(goal.toUpperCase())
}

// A broker-edited content.title (from the campaign's text-edit form) takes priority when present;
// otherwise falls back to the deterministic short, bold "ACTION + LOCATION" heading (e.g.
// "À VENDA • JARDINS") built from structured property fields — unchanged default behavior for
// campaigns that never touched the title field. Either way the result is just a plain string fed
// into the same fitMultilineText/stackTextBlockY pipeline as before (2-line cap, shrink-then-
// truncate-with-ellipsis), so a long custom title degrades the same safe way the AI-generated
// free text that caused the original overlap/truncation bugs was made to.
function resolveDisplayTitle(campaign: StudioCampaignRecord, content: Record<string, unknown>) {
  const custom = readPreferredString(content, ["title"])
  if (custom) return custom.toUpperCase()

  const action = mapPropertyAction(campaign.property?.purpose)
  const location = campaign.property?.neighborhood?.trim() || campaign.property?.city?.trim()
  if (!location) return action

  return `${action} • ${normalizeStudioText(location).toUpperCase()}`
}

// Same idea as resolveDisplayTitle: broker-edited content.cta wins, falling back to the design's
// original default line when the field was never touched. Uppercased to match the template's
// bold-caps CTA styling either way. The actual line-wrapping/shrink/truncation happens where this
// is consumed (renderInstagramFeedTemplate), via the same fitMultilineText used for title/features.
function resolveDisplayCta(content: Record<string, unknown>) {
  const custom = readPreferredString(content, ["cta"])
  return (custom || "Agende sua visita").toUpperCase()
}

// Uppercase, bold action word for the new title. A grammatically correct Portuguese preposition
// ("NOS Jardins" vs "NO Centro" vs "NA Vila Madalena") depends on the location name's gender and
// number, which isn't data we have — using "•" as a separator avoids guessing wrong on properties
// outside the one this was designed against.
function mapPropertyAction(value: string | null | undefined) {
  const normalized = (value || "").toUpperCase()
  if (normalized.includes("RENT") || normalized.includes("LOC")) return "PARA LOCAÇÃO"
  if (normalized.includes("SALE") || normalized.includes("VEND")) return "À VENDA"
  return "EM DESTAQUE"
}

function resolveDisplayLocation(campaign: StudioCampaignRecord, content: Record<string, unknown>) {
  return readPreferredString(content, ["location"]) || [campaign.property?.neighborhood, campaign.property?.city].filter(Boolean).join("\n")
}

// Area is intentionally not derived here anymore — it has its own dedicated spec slot
// (buildAreaFeature, from readAreaLabel) between location and these, matching the approved
// design's 4-item order (location, area, bathrooms, parking). Kept to 2 here so that slot plus
// location plus these never exceed the template's 4-item budget.
function resolveDisplayFeatures(campaign: StudioCampaignRecord, content: Record<string, unknown>) {
  const explicit = normalizeStringList(content.features)
  if (explicit.length > 0) return explicit.slice(0, 2)

  const derived: string[] = []
  if ((campaign.property?.bathrooms ?? 0) > 0) {
    derived.push(`${campaign.property?.bathrooms} banheiro${campaign.property?.bathrooms === 1 ? "" : "s"}`)
  }
  if ((campaign.property?.parkingSpots ?? 0) > 0) {
    derived.push(`${campaign.property?.parkingSpots} vaga${campaign.property?.parkingSpots === 1 ? "" : "s"}`)
  }
  if (derived.length < 2 && (campaign.property?.bedrooms ?? 0) > 0) {
    derived.push(`${campaign.property?.bedrooms} dormitório${campaign.property?.bedrooms === 1 ? "" : "s"}`)
  }

  return derived.slice(0, 2)
}

function resolveDisplayPrice(campaign: StudioCampaignRecord, content: Record<string, unknown>) {
  return readPreferredString(content, ["price"]) || formatPriceLabel(campaign.property?.price)
}

function resolveMetric(content: Record<string, unknown>) {
  // "support" deliberately excluded here: it's the Instagram post's general marketing caption
  // (up to 220 chars, e.g. "R$ 1.780.000 • 7 banheiros • 8 vagas"), not a short label for this
  // single-line slot under the metric value — using it here overflowed the price panel. The area
  // label isn't used as a fallback either anymore: it now has its own dedicated spec item (see
  // buildAreaFeature), and repeating it here duplicated it under the price in the approved design.
  return {
    label: readPreferredString(content, ["metricLabel"]) || "PREÇO",
    support: readPreferredString(content, ["metricSupport"]) || "",
  }
}

function buildLocationFeature(location: string): StudioFeatureItem {
  const [line1, line2] = location
    .split(/\n|,\s*/)
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    icon: "location",
    line1: line1 || "Localização",
    line2: line2 || undefined,
  }
}

// Only added when the property actually has an area on file (lib/property "legalData"
// privateArea/totalArea) — no fabricated placeholder when that data isn't available.
function buildAreaFeature(areaLabel: string | null): StudioFeatureItem | null {
  if (!areaLabel) return null
  return { icon: "area", line1: areaLabel, line2: "Área útil" }
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

// Places a text block's baseline so it never overlaps the block stacked above it, using real
// font metrics instead of a fixed guess. `previousBlockHeight` only covers the gap *between*
// the previous block's own lines (see fitMultilineText's blockHeight) — it says nothing about
// how far that block's last line dips below its own baseline (descent) or how far the next
// block's first line reaches above its baseline (ascent), which is what previously let the two
// blocks' ink touch or overlap whenever a title wrapped to more than one line.
function stackTextBlockY(
  previousBaselineY: number,
  previousBlockHeight: number,
  previousFontSize: number,
  gap: number,
  nextFontSize: number,
) {
  return Math.round(
    previousBaselineY +
      previousBlockHeight +
      previousFontSize * STUDIO_FONT_DESCENT_RATIO +
      gap +
      nextFontSize * STUDIO_FONT_ASCENT_RATIO,
  )
}

// Baseline that vertically centers a `lineCount`-line block (line 1's baseline) inside a
// container of `containerHeight`, using the same ascent/descent metrics as stackTextBlockY. With
// lineCount 1 this centers a single line by its real ink metrics instead of a fixed guess (badge
// label, or any other single-line container content).
function centerTextBlockY(containerHeight: number, fontSize: number, lineHeight: number, lineCount: number) {
  const blockHeight = Math.max(0, lineCount - 1) * lineHeight + fontSize * (STUDIO_FONT_ASCENT_RATIO + STUDIO_FONT_DESCENT_RATIO)
  const topY = (containerHeight - blockHeight) / 2
  return Math.round(topY + fontSize * STUDIO_FONT_ASCENT_RATIO)
}

// Top-left y that vertically centers an icon of known local-path bounds [iconTop, iconTop +
// iconHeight] inside a container of containerHeight — mirrors centerTextBlockY but for the fixed
// SVG icon shapes in renderFeatureIcon, whose bounds aren't all flush with y=0 (e.g. "calendar"
// starts 2px down).
function centerIconY(containerHeight: number, iconTop: number, iconHeight: number) {
  return Math.round(containerHeight / 2 - iconTop - iconHeight / 2)
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
  let hasOverflow = false

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate
      continue
    }

    lines.push(current)
    current = word

    if (lines.length >= maxLines) {
      hasOverflow = true
      break
    }
  }

  if (!hasOverflow && current) lines.push(current)

  const result = lines.slice(0, maxLines)
  return hasOverflow ? markLastLineTruncated(result, maxCharsPerLine) : result
}

// AI-generated copy (e.g. the "highlight"/"support" fields from the Instagram content prompt)
// is only bounded by a generous character ceiling meant for validation, not by what actually
// fits in these fixed 1-3 line slots. When wrapText above has to drop trailing words to respect
// maxLines, that previously left a bare word fragment with no visual indicator anything was cut
// (e.g. "Alto padrão exclusivo" -> "Alto"). Mark it instead.
function markLastLineTruncated(lines: string[], maxCharsPerLine: number) {
  if (!lines.length) return lines
  const lastIndex = lines.length - 1
  const lastLine = lines[lastIndex]
  const budget = Math.max(1, maxCharsPerLine - 1)
  const trimmed = lastLine.length > budget ? lastLine.slice(0, budget).trimEnd() : lastLine
  return [...lines.slice(0, lastIndex), `${trimmed}…`]
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
  runs: StudioTextRun[],
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontWeight: StudioFontWeight,
  color: string,
  letterSpacingEm = 0,
  anchor: "start" | "middle" | "end" = "start",
) {
  if (!text) return ""

  runs.push({
    x,
    y,
    lines: [truncateSingleLine(normalizeStudioText(text))],
    fontSize,
    fontWeight,
    color,
    letterSpacingEm,
    lineHeight: 0,
    anchor,
  })

  return ""
}

// Single-line runs (badge label, metric label/value, CTA label, metric support) have no wrapping
// at all, so any free-text value long enough to bypass its usual short-label source ends up
// drawn past its box with nothing to stop it — this is what put an AI-generated caption string
// across the bottom of the price panel. A generous but finite cap keeps that failure mode from
// ever overflowing arbitrarily far, without touching the legitimately short labels this renders
// day to day.
const STUDIO_SINGLE_LINE_MAX_CHARS = 80

function truncateSingleLine(text: string) {
  if (text.length <= STUDIO_SINGLE_LINE_MAX_CHARS) return text
  return `${text.slice(0, STUDIO_SINGLE_LINE_MAX_CHARS - 1).trimEnd()}…`
}

function renderMultilineText(
  runs: StudioTextRun[],
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  fontWeight: StudioFontWeight,
  color: string,
  lineHeight: number,
  letterSpacingEm = 0,
) {
  const normalizedLines = lines.filter(Boolean).map(normalizeStudioText)
  if (!normalizedLines.length) return ""

  runs.push({
    x,
    y,
    lines: normalizedLines,
    fontSize,
    fontWeight,
    color,
    letterSpacingEm,
    lineHeight,
    anchor: "start",
  })

  return ""
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "studio-eme"
}

export function escapeXml(value: string) {
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
    if (typeof value === "string" && value.trim()) return normalizeStudioText(value.trim())
  }

  return ""
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeStudioText(item.trim()))
    .filter(Boolean)
}

function normalizeStudioText(value: string) {
  let normalized = value
  const replacements: Array<[string, string]> = [
    ["Ã¡", "á"],
    ["Ã ", "à"],
    ["Ã¢", "â"],
    ["Ã£", "ã"],
    ["Ã¤", "ä"],
    ["Ã©", "é"],
    ["Ãª", "ê"],
    ["Ã­", "í"],
    ["Ã³", "ó"],
    ["Ã´", "ô"],
    ["Ãµ", "õ"],
    ["Ãº", "ú"],
    ["Ã§", "ç"],
    ["Ã‰", "É"],
    ["ÃŠ", "Ê"],
    ["Ã“", "Ó"],
    ["Ã”", "Ô"],
    ["Ãš", "Ú"],
    ["Ã‡", "Ç"],
    ["Â²", "²"],
    ["â€¢", "•"],
    ["â€“", "–"],
    ["â€”", "—"],
    ["â€˜", "‘"],
    ["â€™", "’"],
    ["â€œ", "“"],
    ["â€\u009d", "”"],
    ["\uFFFD", ""],
  ]

  for (const [search, replacement] of replacements) {
    normalized = normalized.replaceAll(search, replacement)
  }

  return normalized
}
