CREATE TABLE IF NOT EXISTS "CatalogEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "catalogSlug" TEXT,
  "visitorKey" TEXT,
  "propertyId" TEXT,
  "brokerId" TEXT,
  "agencyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CatalogEvent_propertyId_fkey'
  ) THEN
    ALTER TABLE "CatalogEvent"
    ADD CONSTRAINT "CatalogEvent_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CatalogEvent_brokerId_fkey'
  ) THEN
    ALTER TABLE "CatalogEvent"
    ADD CONSTRAINT "CatalogEvent_brokerId_fkey"
    FOREIGN KEY ("brokerId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CatalogEvent_agencyId_fkey'
  ) THEN
    ALTER TABLE "CatalogEvent"
    ADD CONSTRAINT "CatalogEvent_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CatalogEvent_eventType_createdAt_idx" ON "CatalogEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "CatalogEvent_brokerId_createdAt_idx" ON "CatalogEvent"("brokerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CatalogEvent_agencyId_createdAt_idx" ON "CatalogEvent"("agencyId", "createdAt");
CREATE INDEX IF NOT EXISTS "CatalogEvent_propertyId_createdAt_idx" ON "CatalogEvent"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "CatalogEvent_catalogSlug_createdAt_idx" ON "CatalogEvent"("catalogSlug", "createdAt");
CREATE INDEX IF NOT EXISTS "CatalogEvent_visitorKey_eventType_createdAt_idx" ON "CatalogEvent"("visitorKey", "eventType", "createdAt");
