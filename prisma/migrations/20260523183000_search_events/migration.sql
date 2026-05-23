CREATE TABLE IF NOT EXISTS "SearchEvent" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "filters" JSONB,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SearchEvent_brokerId_fkey') THEN
    ALTER TABLE "SearchEvent"
    ADD CONSTRAINT "SearchEvent_brokerId_fkey"
    FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SearchEvent_brokerId_createdAt_idx" ON "SearchEvent"("brokerId", "createdAt");
CREATE INDEX IF NOT EXISTS "SearchEvent_source_createdAt_idx" ON "SearchEvent"("source", "createdAt");
