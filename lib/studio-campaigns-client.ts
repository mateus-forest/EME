"use client"

export type StudioCampaignKind =
  | "INSTAGRAM"
  | "BUYERS"
  | "OWNERS"
  | "SELL_PROPERTY"
  | "CONSTRUCTION"
  | "VIDEO"

export type StudioCampaignAssetStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "FAILED"

export type StudioCampaignRecord = {
  id: string
  workspaceType: "BROKER" | "AGENCY"
  brokerId: string | null
  agencyId: string | null
  propertyId: string | null
  kind: StudioCampaignKind
  status: string
  goal: string | null
  visualIdentity: string | null
  version: number
  provider: string | null
  model: string | null
  prompt: string | null
  promptRevised: string | null
  sourceRoute: string | null
  metadata: unknown
  createdByUserId: string
  createdAt: string
  updatedAt: string
  assets: Array<{
    id: string
    assetKey: string
    label: string | null
    type: string
    prompt: string | null
    promptRevised: string | null
    provider: string | null
    model: string | null
    fileUrl: string | null
    thumbnailUrl: string | null
    status: StudioCampaignAssetStatus
    approvedAt: string | null
    content: unknown
    metadata: unknown
    createdAt: string
    updatedAt: string
  }>
}

async function parseCampaignResponse(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { campaign?: StudioCampaignRecord | null; campaigns?: StudioCampaignRecord[]; error?: string }
    | null

  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel carregar as campanhas do Studio IA.")
  }

  return data ?? {}
}

export const studioCampaignsClient = {
  async getLatest(kind: StudioCampaignKind, propertyId?: string | null) {
    const params = new URLSearchParams({ kind, latest: "1" })
    if (propertyId) params.set("propertyId", propertyId)
    const response = await fetch(`/api/studio-ia/campaigns?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    })
    const data = await parseCampaignResponse(response)
    return data.campaign ?? null
  },

  async approveCampaign(campaignId: string) {
    const response = await fetch(`/api/studio-ia/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "approve" }),
    })
    const data = await parseCampaignResponse(response)
    if (!data.campaign) {
      throw new Error("Nao foi possivel aprovar a campanha.")
    }
    return data.campaign
  },

  async updateAssetStatus(assetId: string, status: StudioCampaignAssetStatus) {
    const response = await fetch(`/api/studio-ia/campaigns/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    })
    const data = await parseCampaignResponse(response)
    if (!data.campaign) {
      throw new Error("Nao foi possivel atualizar o asset.")
    }
    return data.campaign
  },
}
