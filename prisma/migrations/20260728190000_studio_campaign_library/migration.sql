-- CreateEnum
CREATE TYPE "StudioCampaignWorkspaceType" AS ENUM ('BROKER', 'AGENCY');

-- CreateEnum
CREATE TYPE "StudioCampaignKind" AS ENUM ('INSTAGRAM', 'BUYERS', 'OWNERS', 'SELL_PROPERTY', 'CONSTRUCTION', 'VIDEO');

-- CreateEnum
CREATE TYPE "StudioCampaignStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "StudioCampaignAssetType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL', 'STORY', 'REEL', 'COPY', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "StudioCampaignAssetStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "StudioCampaign" (
    "id" TEXT NOT NULL,
    "workspaceType" "StudioCampaignWorkspaceType" NOT NULL,
    "kind" "StudioCampaignKind" NOT NULL,
    "status" "StudioCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "goal" TEXT,
    "visualIdentity" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT,
    "model" TEXT,
    "prompt" TEXT,
    "promptRevised" TEXT,
    "sourceRoute" TEXT,
    "metadata" JSONB,
    "brokerId" TEXT,
    "agencyId" TEXT,
    "propertyId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioCampaignAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "label" TEXT,
    "type" "StudioCampaignAssetType" NOT NULL,
    "prompt" TEXT,
    "promptRevised" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "fileUrl" TEXT,
    "thumbnailUrl" TEXT,
    "status" "StudioCampaignAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "content" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioCampaignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioCampaign_brokerId_kind_createdAt_idx" ON "StudioCampaign"("brokerId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "StudioCampaign_agencyId_kind_createdAt_idx" ON "StudioCampaign"("agencyId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "StudioCampaign_propertyId_kind_createdAt_idx" ON "StudioCampaign"("propertyId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "StudioCampaign_createdByUserId_createdAt_idx" ON "StudioCampaign"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StudioCampaign_workspaceType_kind_createdAt_idx" ON "StudioCampaign"("workspaceType", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioCampaignAsset_campaignId_assetKey_key" ON "StudioCampaignAsset"("campaignId", "assetKey");

-- CreateIndex
CREATE INDEX "StudioCampaignAsset_campaignId_status_idx" ON "StudioCampaignAsset"("campaignId", "status");

-- CreateIndex
CREATE INDEX "StudioCampaignAsset_type_createdAt_idx" ON "StudioCampaignAsset"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "StudioCampaign" ADD CONSTRAINT "StudioCampaign_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioCampaign" ADD CONSTRAINT "StudioCampaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioCampaign" ADD CONSTRAINT "StudioCampaign_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioCampaign" ADD CONSTRAINT "StudioCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioCampaignAsset" ADD CONSTRAINT "StudioCampaignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "StudioCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
