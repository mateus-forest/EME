-- Add initial credit controls for Corretor M.
ALTER TABLE "Broker"
ADD COLUMN "aiCreditsBalance" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "aiCreditsUsedThisMonth" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AiAssistantInteraction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "creditsUsed" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiAssistantInteraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiAssistantInteraction_brokerId_createdAt_idx" ON "AiAssistantInteraction"("brokerId", "createdAt");
CREATE INDEX "AiAssistantInteraction_userId_createdAt_idx" ON "AiAssistantInteraction"("userId", "createdAt");

ALTER TABLE "AiAssistantInteraction"
ADD CONSTRAINT "AiAssistantInteraction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiAssistantInteraction"
ADD CONSTRAINT "AiAssistantInteraction_brokerId_fkey"
FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
