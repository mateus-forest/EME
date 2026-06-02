CREATE TABLE "BrokerPlanAccount" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "planKey" TEXT NOT NULL DEFAULT 'free',
  "propertyExtraLimit" INTEGER NOT NULL DEFAULT 0,
  "initialCreditsGrantedAt" TIMESTAMP(3),
  "currentPeriodCreditsGrantedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerPlanAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCreditTransaction" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "actionType" TEXT,
  "description" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiCreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtraPackagePurchase" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "packageKey" TEXT NOT NULL,
  "packageType" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'registered',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExtraPackagePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrokerPlanAccount_brokerId_key" ON "BrokerPlanAccount"("brokerId");
CREATE INDEX "BrokerPlanAccount_planKey_idx" ON "BrokerPlanAccount"("planKey");
CREATE INDEX "AiCreditTransaction_brokerId_createdAt_idx" ON "AiCreditTransaction"("brokerId", "createdAt");
CREATE INDEX "AiCreditTransaction_type_createdAt_idx" ON "AiCreditTransaction"("type", "createdAt");
CREATE INDEX "ExtraPackagePurchase_brokerId_createdAt_idx" ON "ExtraPackagePurchase"("brokerId", "createdAt");
CREATE INDEX "ExtraPackagePurchase_packageKey_idx" ON "ExtraPackagePurchase"("packageKey");
CREATE INDEX "ExtraPackagePurchase_status_idx" ON "ExtraPackagePurchase"("status");

ALTER TABLE "BrokerPlanAccount"
ADD CONSTRAINT "BrokerPlanAccount_brokerId_fkey"
FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiCreditTransaction"
ADD CONSTRAINT "AiCreditTransaction_brokerId_fkey"
FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExtraPackagePurchase"
ADD CONSTRAINT "ExtraPackagePurchase_brokerId_fkey"
FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
