ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "whatsapp" TEXT,
ADD COLUMN IF NOT EXISTS "catalogSlug" TEXT,
ADD COLUMN IF NOT EXISTS "searchTerm" TEXT,
ADD COLUMN IF NOT EXISTS "intent" TEXT,
ADD COLUMN IF NOT EXISTS "legalData" JSONB,
ADD COLUMN IF NOT EXISTS "addressData" JSONB,
ADD COLUMN IF NOT EXISTS "documentsData" JSONB;

ALTER TABLE "Property"
ADD COLUMN IF NOT EXISTS "publicCode" INTEGER,
ADD COLUMN IF NOT EXISTS "ownerName" TEXT,
ADD COLUMN IF NOT EXISTS "legalData" JSONB,
ADD COLUMN IF NOT EXISTS "documentsData" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Property_brokerId_publicCode_key"
ON "Property"("brokerId", "publicCode");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudioCampaignWorkspaceType') THEN
    CREATE TYPE "StudioCampaignWorkspaceType" AS ENUM ('BROKER', 'AGENCY');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudioCampaignKind') THEN
    CREATE TYPE "StudioCampaignKind" AS ENUM ('INSTAGRAM', 'BUYERS', 'OWNERS', 'SELL_PROPERTY', 'CONSTRUCTION', 'VIDEO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudioCampaignStatus') THEN
    CREATE TYPE "StudioCampaignStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudioCampaignAssetType') THEN
    CREATE TYPE "StudioCampaignAssetType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL', 'STORY', 'REEL', 'COPY', 'THUMBNAIL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudioCampaignAssetStatus') THEN
    CREATE TYPE "StudioCampaignAssetStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StudioCampaign" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudioCampaignAsset" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioCampaignAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioCampaign_brokerId_kind_createdAt_idx" ON "StudioCampaign"("brokerId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioCampaign_agencyId_kind_createdAt_idx" ON "StudioCampaign"("agencyId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioCampaign_propertyId_kind_createdAt_idx" ON "StudioCampaign"("propertyId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioCampaign_createdByUserId_createdAt_idx" ON "StudioCampaign"("createdByUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioCampaign_workspaceType_kind_createdAt_idx" ON "StudioCampaign"("workspaceType", "kind", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "StudioCampaignAsset_campaignId_assetKey_key"
ON "StudioCampaignAsset"("campaignId", "assetKey");
CREATE INDEX IF NOT EXISTS "StudioCampaignAsset_campaignId_status_idx" ON "StudioCampaignAsset"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "StudioCampaignAsset_type_createdAt_idx" ON "StudioCampaignAsset"("type", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudioCampaign_brokerId_fkey') THEN
    ALTER TABLE "StudioCampaign"
    ADD CONSTRAINT "StudioCampaign_brokerId_fkey"
    FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudioCampaign_agencyId_fkey') THEN
    ALTER TABLE "StudioCampaign"
    ADD CONSTRAINT "StudioCampaign_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudioCampaign_propertyId_fkey') THEN
    ALTER TABLE "StudioCampaign"
    ADD CONSTRAINT "StudioCampaign_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudioCampaign_createdByUserId_fkey') THEN
    ALTER TABLE "StudioCampaign"
    ADD CONSTRAINT "StudioCampaign_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudioCampaignAsset_campaignId_fkey') THEN
    ALTER TABLE "StudioCampaignAsset"
    ADD CONSTRAINT "StudioCampaignAsset_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "StudioCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
