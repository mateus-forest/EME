ALTER TABLE "Broker"
ADD COLUMN "marketplaceSpecialty" TEXT,
ADD COLUMN "marketplaceRegion" TEXT,
ADD COLUMN "marketplaceTransactions" TEXT DEFAULT 'BOTH',
ADD COLUMN "marketplaceAbout" TEXT,
ADD COLUMN "marketplaceFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketplaceRating" DECIMAL(2,1),
ADD COLUMN "marketplaceReviewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Property"
ADD COLUMN "marketplacePublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketplacePublishedAt" TIMESTAMP(3),
ADD COLUMN "marketplaceSlug" TEXT;

CREATE UNIQUE INDEX "Property_marketplaceSlug_key" ON "Property"("marketplaceSlug");
CREATE INDEX "Property_marketplacePublished_marketplacePublishedAt_idx"
ON "Property"("marketplacePublished", "marketplacePublishedAt");
