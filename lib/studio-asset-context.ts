import type { StudioCampaignRecord } from "@/lib/studio-campaigns-client"

type Asset = StudioCampaignRecord["assets"][number]

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function url(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && /^https:\/\//.test(value)) ?? null
}

export function getStudioSourceImageUrl(campaign: StudioCampaignRecord, asset: Asset) {
  return url(
    record(asset.metadata).sourceImageUrl,
    record(asset.content).sourceImageUrl,
    record(campaign.metadata).sourceImageUrl,
  )
}

export function isProjectVisualization(campaign: StudioCampaignRecord, asset?: Asset) {
  return record(asset?.metadata).illustrative === true
    || record(campaign.metadata).illustrative === true
    || record(campaign.metadata).category === "project_visualization"
}

export function getApprovedStudioPipelineAssets(campaigns: StudioCampaignRecord[]) {
  return campaigns.flatMap((campaign) => {
    if (campaign.kind !== "PROPERTY_PREPARATION" && campaign.kind !== "CONSTRUCTION") return []
    return campaign.assets.flatMap((asset) => {
      const originalUrl = getStudioSourceImageUrl(campaign, asset)
      if (asset.type !== "IMAGE" || asset.status !== "APPROVED" || !asset.fileUrl || !originalUrl) return []
      return [{ campaign, asset, originalUrl, resultUrl: asset.fileUrl, illustrative: isProjectVisualization(campaign, asset) }]
    })
  })
}

export function getStudioNextActionLinks(campaign: StudioCampaignRecord, asset: Asset) {
  if (asset.status !== "APPROVED") return []
  if ((campaign.kind === "PROPERTY_PREPARATION" || campaign.kind === "CONSTRUCTION") && asset.type === "IMAGE" && getStudioSourceImageUrl(campaign, asset)) {
    return [
      { label: "Criar vídeo", href: `/corretor/studio-ia/criar-video-do-imovel?sourceAssetId=${encodeURIComponent(asset.id)}` },
      { label: "Criar anúncio", href: `/corretor/studio-ia/atrair-compradores?sourceAssetId=${encodeURIComponent(asset.id)}` },
    ]
  }
  if (campaign.kind === "VIDEO" && asset.type === "VIDEO") {
    return [{ label: "Criar anúncio", href: `/corretor/studio-ia/atrair-compradores?sourceAssetId=${encodeURIComponent(asset.id)}` }]
  }
  return []
}
