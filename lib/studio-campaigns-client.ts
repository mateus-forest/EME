"use client"

export type StudioCampaignKind =
  | "INSTAGRAM"
  | "BUYERS"
  | "OWNERS"
  | "SELL_PROPERTY"
  | "CONSTRUCTION"
  | "PROPERTY_PREPARATION"
  | "VIDEO"

export type StudioCampaignAssetStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "FAILED"

export type StudioCampaignAssetType =
  | "IMAGE"
  | "VIDEO"
  | "CAROUSEL"
  | "STORY"
  | "REEL"
  | "COPY"
  | "THUMBNAIL"

export type StudioCampaignStatus =
  | "DRAFT"
  | "PROCESSING"
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
  status: StudioCampaignStatus
  goal: string | null
  title: string
  visualIdentity: string | null
  version: number
  provider: string | null
  model: string | null
  prompt: string | null
  promptRevised: string | null
  sourceRoute: string | null
  metadata: unknown
  branding: {
    brokerName: string | null
    brokerPhotoUrl: string | null
    brokerCreci: string | null
    agencyName: string | null
    agencyLogoUrl: string | null
    accentColor: string | null
    showAgencyWatermark: boolean
  }
  property: {
    id: string
    title: string
    city: string
    neighborhood: string | null
    description: string | null
    price: number
    bedrooms: number
    bathrooms: number
    parkingSpots: number
    type: string
    purpose: string
    status: string
    legalData: unknown
    imageUrls: string[]
  } | null
  primaryAsset: {
    id: string
    assetKey: string
    type: StudioCampaignAssetType
    fileUrl: string | null
    thumbnailUrl: string | null
    status: StudioCampaignAssetStatus
  } | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  assets: Array<{
    id: string
    assetKey: string
    label: string | null
    type: StudioCampaignAssetType
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
    | {
        campaign?: StudioCampaignRecord | null
        campaigns?: StudioCampaignRecord[]
        pagination?: {
          page: number
          limit: number
          total: number
          totalPages: number
        }
        error?: string
      }
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

  async list(params?: {
    page?: number
    limit?: number
    q?: string
    kind?: StudioCampaignKind
    status?: StudioCampaignStatus
    assetType?: StudioCampaignAssetType
  }) {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.limit) query.set("limit", String(params.limit))
    if (params?.q) query.set("q", params.q)
    if (params?.kind) query.set("kind", params.kind)
    if (params?.status) query.set("status", params.status)
    if (params?.assetType) query.set("assetType", params.assetType)

    const response = await fetch(`/api/studio-ia/campaigns?${query.toString()}`, {
      credentials: "include",
      cache: "no-store",
    })
    const data = await parseCampaignResponse(response)
    return {
      campaigns: data.campaigns ?? [],
      pagination: data.pagination ?? {
        page: 1,
        limit: params?.limit ?? 24,
        total: data.campaigns?.length ?? 0,
        totalPages: 1,
      },
    }
  },

  async getById(campaignId: string) {
    const response = await fetch(`/api/studio-ia/campaigns/${campaignId}`, {
      credentials: "include",
      cache: "no-store",
    })
    const data = await parseCampaignResponse(response)
    if (!data.campaign) {
      throw new Error("Nao foi possivel carregar a campanha.")
    }
    return data.campaign
  },

  async deleteAsset(assetId: string) {
    const response = await fetch(`/api/studio-ia/campaigns/assets/${assetId}`, {
      method: "DELETE",
      credentials: "include",
    })
    const data = await parseCampaignResponse(response)
    if (!data.campaign) {
      throw new Error("Nao foi possivel excluir o asset.")
    }
    return data.campaign
  },

  async updateAssetContent(assetId: string, content: unknown) {
    const response = await fetch(`/api/studio-ia/campaigns/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    })
    const data = await parseCampaignResponse(response)
    if (!data.campaign) {
      throw new Error("Nao foi possivel atualizar o texto do asset.")
    }
    return data.campaign
  },
}
