ALTER TABLE "Broker" ADD COLUMN IF NOT EXISTS "assistantCredits" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Broker" ADD COLUMN IF NOT EXISTS "assistantEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Broker"
SET "assistantCredits" = "aiCreditsBalance"
WHERE "assistantCredits" = 10
  AND "aiCreditsBalance" IS NOT NULL;
