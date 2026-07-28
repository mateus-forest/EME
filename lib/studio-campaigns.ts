import "server-only"

import type { Prisma } from "@prisma/client"

import { deletePropertyStorageFile } from "@/lib/property-storage"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/prisma-enums"

export type StudioCampaignKind =
  | "INSTAGRAM"
  | "BUYERS"
  | "OWNERS"
  | "SELL_PROPERTY"
  | "CONSTRUCTION"
  | "VIDEO"

export type StudioCampaignStatus =
  | "DRAFT"
  | "PROCESSING"
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

export type StudioCampaignAssetStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "FAILED"

type AuthenticatedStudioUser = {
  id: string
  role: typeof UserRole.BROKER | typeof UserRole.AGENCY | typeof UserRole.ADMIN
  broker?: { id: string } | null
  ownedAgency?: { id: string } | null
}

type WorkspaceRef =
  | { workspaceType: "BROKER"; brokerId: string; agencyId: null }
  | { workspaceType: "AGENCY"; brokerId: null; agencyId: string }

export type StudioCampaignAssetDraft = {
  assetKey: string
  label?: string
  type: StudioCampaignAssetType
  prompt?: string | null
  promptRevised?: string | null
  provider?: string | null
  model?: string | null
  fileUrl?: string | null
  thumbnailUrl?: string | null
  status?: StudioCampaignAssetStatus
  approvedAt?: string | Date | null
  content?: Prisma.InputJsonValue
  metadata?: Prisma.InputJsonValue
}

export type StudioCampaignDraft = {
  kind: StudioCampaignKind
  status?: StudioCampaignStatus
  goal?: string | null
  visualIdentity?: string | null
  version?: number
  provider?: string | null
  model?: string | null
  prompt?: string | null
  promptRevised?: string | null
  sourceRoute?: string | null
  metadata?: Prisma.InputJsonValue
  propertyId?: string | null
  assets: StudioCampaignAssetDraft[]
}

const studioCampaignInclude = {
  property: {
    select: {
      id: true,
      title: true,
      city: true,
      neighborhood: true,
      imageUrls: true,
    },
  },
  assets: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.StudioCampaignInclude

function resolveWorkspace(user: AuthenticatedStudioUser): WorkspaceRef {
  if (user.role === UserRole.BROKER && user.broker?.id) {
    return {
      workspaceType: "BROKER",
      brokerId: user.broker.id,
      agencyId: null,
    }
  }

  if (user.role === UserRole.AGENCY && user.ownedAgency?.id) {
    return {
      workspaceType: "AGENCY",
      brokerId: null,
      agencyId: user.ownedAgency.id,
    }
  }

  throw new Error("STUDIO_WORKSPACE_NOT_FOUND")
}

function toNullableString(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseStringArray(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function normalizeAssetStatus(value?: StudioCampaignAssetStatus): StudioCampaignAssetStatus {
  return value ?? "PENDING_REVIEW"
}

function deriveCampaignStatus(assets: Array<{ status: StudioCampaignAssetStatus }>): StudioCampaignStatus {
  if (assets.length === 0) return "DRAFT"
  if (assets.some((asset) => asset.status === "FAILED")) return "FAILED"
  if (assets.every((asset) => asset.status === "PUBLISHED")) return "PUBLISHED"
  if (assets.every((asset) => asset.status === "APPROVED" || asset.status === "PUBLISHED")) return "APPROVED"
  if (assets.some((asset) => asset.status === "REJECTED") && assets.every((asset) => asset.status !== "PENDING_REVIEW")) {
    return "REJECTED"
  }
  if (assets.some((asset) => asset.status === "PENDING_REVIEW")) return "PENDING_REVIEW"
  return "DRAFT"
}

function formatCampaignKindLabel(kind: StudioCampaignKind) {
  const labels: Record<StudioCampaignKind, string> = {
    INSTAGRAM: "Instagram",
    BUYERS: "Atrair compradores",
    OWNERS: "Captacao",
    SELL_PROPERTY: "Venda",
    CONSTRUCTION: "Construcao",
    VIDEO: "Video",
  }

  return labels[kind]
}

function readKindFromSearch(value: string): StudioCampaignKind | undefined {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined

  if (normalized.includes("instagram")) return "INSTAGRAM"
  if (normalized.includes("video")) return "VIDEO"
  if (normalized.includes("comprador")) return "BUYERS"
  if (normalized.includes("capta")) return "OWNERS"
  if (normalized.includes("venda")) return "SELL_PROPERTY"
  if (normalized.includes("constru") || normalized.includes("obra")) return "CONSTRUCTION"
  return undefined
}

function deriveCampaignTitle(
  campaign: Pick<Prisma.StudioCampaignGetPayload<{ include: typeof studioCampaignInclude }>, "kind" | "goal" | "property" | "assets">,
) {
  const explicitGoal = campaign.goal?.trim()
  if (explicitGoal) return explicitGoal

  const firstLabeledAsset = campaign.assets.find((asset) => asset.label?.trim())
  if (firstLabeledAsset?.label) return firstLabeledAsset.label

  const propertyTitle = campaign.property?.title?.trim()
  if (propertyTitle) {
    return `${formatCampaignKindLabel(campaign.kind)} | ${propertyTitle}`
  }

  return formatCampaignKindLabel(campaign.kind)
}

function serializeCampaign(
  campaign: Prisma.StudioCampaignGetPayload<{ include: typeof studioCampaignInclude }>,
) {
  const primaryAsset =
    campaign.assets.find((asset) => asset.assetKey === "post_feed") ??
    campaign.assets.find((asset) => asset.assetKey === "story") ??
    campaign.assets.find((asset) => asset.thumbnailUrl || asset.fileUrl) ??
    campaign.assets[0] ??
    null

  return {
    id: campaign.id,
    workspaceType: campaign.workspaceType,
    brokerId: campaign.brokerId,
    agencyId: campaign.agencyId,
    propertyId: campaign.propertyId,
    kind: campaign.kind,
    status: campaign.status,
    goal: campaign.goal,
    title: deriveCampaignTitle(campaign),
    visualIdentity: campaign.visualIdentity,
    version: campaign.version,
    provider: campaign.provider,
    model: campaign.model,
    prompt: campaign.prompt,
    promptRevised: campaign.promptRevised,
    sourceRoute: campaign.sourceRoute,
    metadata: campaign.metadata,
    property: campaign.property
      ? {
          id: campaign.property.id,
          title: campaign.property.title,
          city: campaign.property.city,
          neighborhood: campaign.property.neighborhood,
          imageUrls: parseStringArray(campaign.property.imageUrls as Prisma.JsonValue | null),
        }
      : null,
    primaryAsset: primaryAsset
      ? {
          id: primaryAsset.id,
          assetKey: primaryAsset.assetKey,
          type: primaryAsset.type,
          fileUrl: primaryAsset.fileUrl,
          thumbnailUrl: primaryAsset.thumbnailUrl,
          status: primaryAsset.status,
        }
      : null,
    createdByUserId: campaign.createdByUserId,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    assets: campaign.assets.map((asset) => ({
      id: asset.id,
      assetKey: asset.assetKey,
      label: asset.label,
      type: asset.type,
      prompt: asset.prompt,
      promptRevised: asset.promptRevised,
      provider: asset.provider,
      model: asset.model,
      fileUrl: asset.fileUrl,
      thumbnailUrl: asset.thumbnailUrl,
      status: asset.status,
      approvedAt: asset.approvedAt?.toISOString() ?? null,
      content: asset.content,
      metadata: asset.metadata,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    })),
  }
}

export async function createStudioCampaign(user: AuthenticatedStudioUser, draft: StudioCampaignDraft) {
  const workspace = resolveWorkspace(user)
  const campaign = await prisma.studioCampaign.create({
    data: {
      workspaceType: workspace.workspaceType,
      brokerId: workspace.brokerId,
      agencyId: workspace.agencyId,
      propertyId: draft.propertyId ?? null,
      kind: draft.kind,
      status: draft.status ?? deriveCampaignStatus(draft.assets.map((asset) => ({ status: normalizeAssetStatus(asset.status) }))),
      goal: toNullableString(draft.goal),
      visualIdentity: toNullableString(draft.visualIdentity),
      version: draft.version ?? 1,
      provider: toNullableString(draft.provider),
      model: toNullableString(draft.model),
      prompt: toNullableString(draft.prompt),
      promptRevised: toNullableString(draft.promptRevised),
      sourceRoute: toNullableString(draft.sourceRoute),
      metadata: draft.metadata,
      createdByUserId: user.id,
      assets: {
        create: draft.assets.map((asset) => ({
          assetKey: asset.assetKey,
          label: toNullableString(asset.label),
          type: asset.type,
          prompt: toNullableString(asset.prompt),
          promptRevised: toNullableString(asset.promptRevised),
          provider: toNullableString(asset.provider),
          model: toNullableString(asset.model),
          fileUrl: toNullableString(asset.fileUrl),
          thumbnailUrl: toNullableString(asset.thumbnailUrl),
          status: normalizeAssetStatus(asset.status),
          approvedAt: asset.approvedAt ? new Date(asset.approvedAt) : null,
          content: asset.content,
          metadata: asset.metadata,
        })),
      },
    },
    include: studioCampaignInclude,
  })

  return serializeCampaign(campaign)
}

export async function getLatestStudioCampaign(
  user: AuthenticatedStudioUser,
  filters: { kind: StudioCampaignKind; propertyId?: string | null },
) {
  const workspace = resolveWorkspace(user)
  const campaign = await prisma.studioCampaign.findFirst({
    where: {
      kind: filters.kind,
      propertyId: filters.propertyId ?? undefined,
      brokerId: workspace.brokerId ?? undefined,
      agencyId: workspace.agencyId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    include: studioCampaignInclude,
  })

  return campaign ? serializeCampaign(campaign) : null
}

export async function listStudioCampaigns(
  user: AuthenticatedStudioUser,
  filters?: {
    kind?: StudioCampaignKind
    propertyId?: string | null
    status?: StudioCampaignStatus
    assetType?: StudioCampaignAssetType
    query?: string | null
    page?: number
    limit?: number
  },
) {
  const workspace = resolveWorkspace(user)
  const normalizedQuery = filters?.query?.trim()
  const inferredKind = normalizedQuery ? readKindFromSearch(normalizedQuery) : undefined
  const where: Prisma.StudioCampaignWhereInput = {
    kind: filters?.kind,
    status: filters?.status,
    propertyId: filters?.propertyId ?? undefined,
    brokerId: workspace.brokerId ?? undefined,
    agencyId: workspace.agencyId ?? undefined,
    assets: filters?.assetType
      ? {
          some: {
            type: filters.assetType,
          },
        }
      : undefined,
    OR: normalizedQuery
      ? [
          {
            goal: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
          {
            property: {
              is: {
                title: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
            },
          },
          inferredKind
            ? {
                kind: inferredKind,
              }
            : undefined,
        ].filter(Boolean) as Prisma.StudioCampaignWhereInput[]
      : undefined,
  }

  const take = filters?.limit ?? 24
  const page = Math.max(1, filters?.page ?? 1)
  const skip = (page - 1) * take

  const [campaigns, total] = await prisma.$transaction([
    prisma.studioCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: studioCampaignInclude,
    }),
    prisma.studioCampaign.count({ where }),
  ])

  return {
    campaigns: campaigns.map(serializeCampaign),
    pagination: {
      page,
      limit: take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  }
}

export async function getStudioCampaignById(user: AuthenticatedStudioUser, campaignId: string) {
  const workspace = resolveWorkspace(user)
  const campaign = await prisma.studioCampaign.findFirst({
    where: {
      id: campaignId,
      brokerId: workspace.brokerId ?? undefined,
      agencyId: workspace.agencyId ?? undefined,
    },
    include: studioCampaignInclude,
  })

  return campaign ? serializeCampaign(campaign) : null
}

export async function updateStudioCampaignAssetStatus(
  user: AuthenticatedStudioUser,
  assetId: string,
  status: StudioCampaignAssetStatus,
) {
  const workspace = resolveWorkspace(user)
  const asset = await prisma.studioCampaignAsset.findFirst({
    where: {
      id: assetId,
      campaign: {
        brokerId: workspace.brokerId ?? undefined,
        agencyId: workspace.agencyId ?? undefined,
      },
    },
  })

  if (!asset) {
    throw new Error("STUDIO_CAMPAIGN_ASSET_NOT_FOUND")
  }

  const updatedAsset = await prisma.studioCampaignAsset.update({
    where: { id: assetId },
    data: {
      status,
      approvedAt: status === "APPROVED" || status === "PUBLISHED" ? new Date() : null,
    },
  })

  const refreshedCampaign = await prisma.studioCampaign.findUniqueOrThrow({
    where: { id: asset.campaignId },
    include: studioCampaignInclude,
  })

  const nextStatus = deriveCampaignStatus(
    refreshedCampaign.assets.map((item) => ({
      status: item.id === updatedAsset.id ? status : item.status,
    })),
  )

  const savedCampaign = await prisma.studioCampaign.update({
    where: { id: refreshedCampaign.id },
    data: {
      status: nextStatus,
    },
    include: studioCampaignInclude,
  })

  return serializeCampaign(savedCampaign)
}

export async function deleteStudioCampaignAsset(user: AuthenticatedStudioUser, assetId: string) {
  const workspace = resolveWorkspace(user)
  const asset = await prisma.studioCampaignAsset.findFirst({
    where: {
      id: assetId,
      campaign: {
        brokerId: workspace.brokerId ?? undefined,
        agencyId: workspace.agencyId ?? undefined,
      },
    },
  })

  if (!asset) {
    throw new Error("STUDIO_CAMPAIGN_ASSET_NOT_FOUND")
  }

  if (asset.fileUrl) {
    await deletePropertyStorageFile(asset.fileUrl)
  }

  if (asset.thumbnailUrl && asset.thumbnailUrl !== asset.fileUrl) {
    await deletePropertyStorageFile(asset.thumbnailUrl)
  }

  await prisma.studioCampaignAsset.delete({
    where: { id: assetId },
  })

  const refreshedCampaign = await prisma.studioCampaign.findUniqueOrThrow({
    where: { id: asset.campaignId },
    include: studioCampaignInclude,
  })

  const nextStatus = deriveCampaignStatus(refreshedCampaign.assets.map((item) => ({ status: item.status })))
  const savedCampaign = await prisma.studioCampaign.update({
    where: { id: asset.campaignId },
    data: {
      status: nextStatus,
    },
    include: studioCampaignInclude,
  })

  return serializeCampaign(savedCampaign)
}

export async function approveStudioCampaign(user: AuthenticatedStudioUser, campaignId: string) {
  const workspace = resolveWorkspace(user)
  const campaign = await prisma.studioCampaign.findFirst({
    where: {
      id: campaignId,
      brokerId: workspace.brokerId ?? undefined,
      agencyId: workspace.agencyId ?? undefined,
    },
    include: studioCampaignInclude,
  })

  if (!campaign) {
    throw new Error("STUDIO_CAMPAIGN_NOT_FOUND")
  }

  await prisma.studioCampaignAsset.updateMany({
    where: {
      campaignId,
      status: {
        in: ["DRAFT", "PENDING_REVIEW"],
      },
    },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
    },
  })

  const savedCampaign = await prisma.studioCampaign.update({
    where: { id: campaignId },
    data: { status: "APPROVED" },
    include: studioCampaignInclude,
  })

  return serializeCampaign(savedCampaign)
}

export async function upsertStudioCampaignAssetByKey(input: {
  campaignId: string
  asset: StudioCampaignAssetDraft
  campaignStatus?: StudioCampaignStatus
}) {
  await prisma.studioCampaignAsset.upsert({
    where: {
      campaignId_assetKey: {
        campaignId: input.campaignId,
        assetKey: input.asset.assetKey,
      },
    },
    create: {
      campaignId: input.campaignId,
      assetKey: input.asset.assetKey,
      label: toNullableString(input.asset.label),
      type: input.asset.type,
      prompt: toNullableString(input.asset.prompt),
      promptRevised: toNullableString(input.asset.promptRevised),
      provider: toNullableString(input.asset.provider),
      model: toNullableString(input.asset.model),
      fileUrl: toNullableString(input.asset.fileUrl),
      thumbnailUrl: toNullableString(input.asset.thumbnailUrl),
      status: normalizeAssetStatus(input.asset.status),
      approvedAt: input.asset.approvedAt ? new Date(input.asset.approvedAt) : null,
      content: input.asset.content,
      metadata: input.asset.metadata,
    },
    update: {
      label: toNullableString(input.asset.label),
      type: input.asset.type,
      prompt: toNullableString(input.asset.prompt),
      promptRevised: toNullableString(input.asset.promptRevised),
      provider: toNullableString(input.asset.provider),
      model: toNullableString(input.asset.model),
      fileUrl: toNullableString(input.asset.fileUrl),
      thumbnailUrl: toNullableString(input.asset.thumbnailUrl),
      status: normalizeAssetStatus(input.asset.status),
      approvedAt: input.asset.approvedAt ? new Date(input.asset.approvedAt) : null,
      content: input.asset.content,
      metadata: input.asset.metadata,
    },
  })

  const campaign = await prisma.studioCampaign.findUniqueOrThrow({
    where: { id: input.campaignId },
    include: studioCampaignInclude,
  })

  const nextStatus = input.campaignStatus ?? deriveCampaignStatus(campaign.assets.map((asset) => ({ status: asset.status })))
  const savedCampaign = await prisma.studioCampaign.update({
    where: { id: input.campaignId },
    data: { status: nextStatus },
    include: studioCampaignInclude,
  })

  return serializeCampaign(savedCampaign)
}

export async function updateStudioCampaignById(input: {
  campaignId: string
  status?: StudioCampaignStatus
  provider?: string | null
  model?: string | null
  prompt?: string | null
  promptRevised?: string | null
  metadata?: Prisma.InputJsonValue
}) {
  const savedCampaign = await prisma.studioCampaign.update({
    where: { id: input.campaignId },
    data: {
      status: input.status,
      provider: input.provider === undefined ? undefined : toNullableString(input.provider),
      model: input.model === undefined ? undefined : toNullableString(input.model),
      prompt: input.prompt === undefined ? undefined : toNullableString(input.prompt),
      promptRevised: input.promptRevised === undefined ? undefined : toNullableString(input.promptRevised),
      metadata: input.metadata,
    },
    include: studioCampaignInclude,
  })

  return serializeCampaign(savedCampaign)
}
