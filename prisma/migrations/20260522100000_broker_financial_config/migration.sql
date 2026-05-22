CREATE TABLE IF NOT EXISTS "BrokerFinancialConfig" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 6,
  "calculationType" TEXT NOT NULL DEFAULT 'Todos os imóveis',
  "statusFilter" TEXT NOT NULL DEFAULT 'Todos',
  "typeFilter" TEXT NOT NULL DEFAULT 'Todos',
  "viewMode" TEXT NOT NULL DEFAULT 'Geral',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BrokerFinancialConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrokerFinancialConfig_brokerId_key" ON "BrokerFinancialConfig"("brokerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BrokerFinancialConfig_brokerId_fkey'
  ) THEN
    ALTER TABLE "BrokerFinancialConfig"
    ADD CONSTRAINT "BrokerFinancialConfig_brokerId_fkey"
    FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
