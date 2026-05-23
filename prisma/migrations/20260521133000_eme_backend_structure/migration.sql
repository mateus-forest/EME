CREATE TABLE IF NOT EXISTS "BrokerEmeConfig" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "whatsApp" TEXT,
  "displayName" TEXT,
  "initialMessage" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_PREPARATION',
  "notes" TEXT,
  "provider" TEXT,
  "phoneNumberId" TEXT,
  "accessTokenEncrypted" TEXT,
  "webhookVerifyToken" TEXT,
  "webhookStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "lastWebhookEventAt" TIMESTAMP(3),
  "integrationRequestedAt" TIMESTAMP(3),
  "integrationActivatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrokerEmeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrokerEmeConfig_brokerId_key" ON "BrokerEmeConfig"("brokerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BrokerEmeConfig_brokerId_fkey') THEN
    ALTER TABLE "BrokerEmeConfig"
    ADD CONSTRAINT "BrokerEmeConfig_brokerId_fkey"
    FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AssessorEmeConfig" (
  "id" TEXT NOT NULL,
  "officialNumber" TEXT,
  "displayName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_PREPARATION',
  "internalInstructions" TEXT,
  "notes" TEXT,
  "provider" TEXT,
  "phoneNumberId" TEXT,
  "webhookVerifyToken" TEXT,
  "webhookStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessorEmeConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmeMessage" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "userId" TEXT,
  "leadId" TEXT,
  "propertyId" TEXT,
  "channel" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "fromPhone" TEXT,
  "customerName" TEXT,
  "message" TEXT NOT NULL,
  "response" TEXT,
  "detectedIntent" TEXT,
  "actionType" TEXT,
  "actionStatus" TEXT,
  "metadata" JSONB,
  "errorMessage" TEXT,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmeMessage_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmeMessage_brokerId_fkey') THEN
    ALTER TABLE "EmeMessage" ADD CONSTRAINT "EmeMessage_brokerId_fkey"
    FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmeMessage_userId_fkey') THEN
    ALTER TABLE "EmeMessage" ADD CONSTRAINT "EmeMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmeMessage_leadId_fkey') THEN
    ALTER TABLE "EmeMessage" ADD CONSTRAINT "EmeMessage_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmeMessage_propertyId_fkey') THEN
    ALTER TABLE "EmeMessage" ADD CONSTRAINT "EmeMessage_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "EmeMessage_brokerId_channel_createdAt_idx" ON "EmeMessage"("brokerId", "channel", "createdAt");
CREATE INDEX IF NOT EXISTS "EmeMessage_leadId_createdAt_idx" ON "EmeMessage"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmeMessage_propertyId_createdAt_idx" ON "EmeMessage"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmeMessage_userId_createdAt_idx" ON "EmeMessage"("userId", "createdAt");

ALTER TABLE "AiAssistantInteraction" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'assessor_eme';
ALTER TABLE "AiAssistantInteraction" ADD COLUMN IF NOT EXISTS "intent" TEXT;
ALTER TABLE "AiAssistantInteraction" ADD COLUMN IF NOT EXISTS "actionStatus" TEXT;
ALTER TABLE "AiAssistantInteraction" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "AiAssistantInteraction" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE "AiAssistantInteraction" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
ALTER TABLE "AiAssistantInteraction" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
CREATE INDEX IF NOT EXISTS "AiAssistantInteraction_channel_createdAt_idx" ON "AiAssistantInteraction"("channel", "createdAt");
CREATE INDEX IF NOT EXISTS "AiAssistantInteraction_leadId_idx" ON "AiAssistantInteraction"("leadId");
CREATE INDEX IF NOT EXISTS "AiAssistantInteraction_propertyId_idx" ON "AiAssistantInteraction"("propertyId");
