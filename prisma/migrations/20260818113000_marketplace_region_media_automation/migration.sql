-- Extend the existing region media cache with official locality and Pexels provenance.
ALTER TABLE "MarketplaceRegionMedia"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "ibgeCode" TEXT,
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'eme',
  ADD COLUMN "pexelsPhotoId" TEXT,
  ADD COLUMN "originalUrl" TEXT,
  ADD COLUMN "photoPageUrl" TEXT,
  ADD COLUMN "photographer" TEXT,
  ADD COLUMN "photographerUrl" TEXT,
  ADD COLUMN "query" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'automatic',
  ADD COLUMN "manualImageUrl" TEXT;

-- Rows created before automation are intentional Master choices and remain overrides.
UPDATE "MarketplaceRegionMedia"
SET
  "provider" = 'manual',
  "source" = 'manual',
  "manualImageUrl" = "imageUrl",
  "resolvedAt" = "updatedAt";

CREATE UNIQUE INDEX "MarketplaceRegionMedia_ibgeCode_key"
ON "MarketplaceRegionMedia"("ibgeCode");

CREATE INDEX "MarketplaceRegionMedia_state_city_idx"
ON "MarketplaceRegionMedia"("state", "city");
