CREATE TABLE "BrokerPropertyCapacityAddon" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "stripePriceId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripeSubscriptionItemId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrokerPropertyCapacityAddon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrokerPropertyCapacityAddon_brokerId_key"
ON "BrokerPropertyCapacityAddon"("brokerId");

CREATE UNIQUE INDEX "BrokerPropertyCapacityAddon_stripeSubscriptionItemId_key"
ON "BrokerPropertyCapacityAddon"("stripeSubscriptionItemId");

CREATE INDEX "BrokerPropertyCapacityAddon_stripeSubscriptionId_idx"
ON "BrokerPropertyCapacityAddon"("stripeSubscriptionId");

CREATE INDEX "BrokerPropertyCapacityAddon_status_idx"
ON "BrokerPropertyCapacityAddon"("status");

ALTER TABLE "BrokerPropertyCapacityAddon"
ADD CONSTRAINT "BrokerPropertyCapacityAddon_brokerId_fkey"
FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
