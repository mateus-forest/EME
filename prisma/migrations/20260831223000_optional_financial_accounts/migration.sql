-- Optional operational accounts. No bank connection or automated reconciliation.
CREATE TABLE "BrokerFinancialAccount" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "bank" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "initialBalance" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrokerFinancialAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BrokerFinancialEntry" ADD COLUMN "accountId" TEXT;

CREATE INDEX "BrokerFinancialAccount_brokerId_createdAt_idx" ON "BrokerFinancialAccount"("brokerId", "createdAt");
CREATE INDEX "BrokerFinancialEntry_accountId_idx" ON "BrokerFinancialEntry"("accountId");

ALTER TABLE "BrokerFinancialAccount" ADD CONSTRAINT "BrokerFinancialAccount_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialEntry" ADD CONSTRAINT "BrokerFinancialEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BrokerFinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
