ALTER TABLE "CatalogEvent"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'catalog';

CREATE INDEX "CatalogEvent_source_createdAt_idx" ON "CatalogEvent"("source", "createdAt");
