-- Operational broker finance. This is intentionally separate from EME billing.
CREATE TABLE "BrokerFinancialEntry" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "leadId" TEXT,
  "propertyId" TEXT,
  "brokerDocumentId" TEXT,
  "propertyRentalId" TEXT,
  "amount" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrokerFinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrokerFinancialCommission" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "leadId" TEXT,
  "propertyId" TEXT,
  "brokerDocumentId" TEXT,
  "propertyRentalId" TEXT,
  "operationAmount" INTEGER NOT NULL,
  "commissionPercent" DECIMAL(7,4) NOT NULL,
  "commissionAmount" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'EXPECTED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrokerFinancialCommission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrokerFinancialEntry_brokerId_direction_dueDate_idx" ON "BrokerFinancialEntry"("brokerId", "direction", "dueDate");
CREATE INDEX "BrokerFinancialEntry_brokerId_status_dueDate_idx" ON "BrokerFinancialEntry"("brokerId", "status", "dueDate");
CREATE INDEX "BrokerFinancialEntry_leadId_idx" ON "BrokerFinancialEntry"("leadId");
CREATE INDEX "BrokerFinancialEntry_propertyId_idx" ON "BrokerFinancialEntry"("propertyId");
CREATE INDEX "BrokerFinancialEntry_brokerDocumentId_idx" ON "BrokerFinancialEntry"("brokerDocumentId");
CREATE INDEX "BrokerFinancialEntry_propertyRentalId_idx" ON "BrokerFinancialEntry"("propertyRentalId");
CREATE INDEX "BrokerFinancialCommission_brokerId_status_dueDate_idx" ON "BrokerFinancialCommission"("brokerId", "status", "dueDate");
CREATE INDEX "BrokerFinancialCommission_leadId_idx" ON "BrokerFinancialCommission"("leadId");
CREATE INDEX "BrokerFinancialCommission_propertyId_idx" ON "BrokerFinancialCommission"("propertyId");
CREATE INDEX "BrokerFinancialCommission_brokerDocumentId_idx" ON "BrokerFinancialCommission"("brokerDocumentId");
CREATE INDEX "BrokerFinancialCommission_propertyRentalId_idx" ON "BrokerFinancialCommission"("propertyRentalId");

ALTER TABLE "BrokerFinancialEntry" ADD CONSTRAINT "BrokerFinancialEntry_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialEntry" ADD CONSTRAINT "BrokerFinancialEntry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialEntry" ADD CONSTRAINT "BrokerFinancialEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialEntry" ADD CONSTRAINT "BrokerFinancialEntry_brokerDocumentId_fkey" FOREIGN KEY ("brokerDocumentId") REFERENCES "BrokerDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialEntry" ADD CONSTRAINT "BrokerFinancialEntry_propertyRentalId_fkey" FOREIGN KEY ("propertyRentalId") REFERENCES "PropertyRental"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialCommission" ADD CONSTRAINT "BrokerFinancialCommission_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialCommission" ADD CONSTRAINT "BrokerFinancialCommission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialCommission" ADD CONSTRAINT "BrokerFinancialCommission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialCommission" ADD CONSTRAINT "BrokerFinancialCommission_brokerDocumentId_fkey" FOREIGN KEY ("brokerDocumentId") REFERENCES "BrokerDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrokerFinancialCommission" ADD CONSTRAINT "BrokerFinancialCommission_propertyRentalId_fkey" FOREIGN KEY ("propertyRentalId") REFERENCES "PropertyRental"("id") ON DELETE SET NULL ON UPDATE CASCADE;
