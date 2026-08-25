-- Additive rental-management MVP. This migration preserves existing properties,
-- clients, contracts and documents.
ALTER TABLE "Property"
ADD COLUMN "rentalAvailable" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PropertyRental" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tenantLeadId" TEXT NOT NULL,
  "ownerLeadId" TEXT,
  "ownerName" TEXT,
  "contractDocumentId" TEXT,
  "monthlyRent" INTEGER NOT NULL,
  "dueDay" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "adjustmentIndex" TEXT NOT NULL,
  "adjustmentOther" TEXT,
  "guaranteeType" TEXT NOT NULL,
  "guaranteeOther" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "nextAdjustmentDate" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyRental_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalPayment" (
  "id" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "competence" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "receiptData" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalAdjustment" (
  "id" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "previousAmount" INTEGER NOT NULL,
  "percentage" DECIMAL(8,4),
  "indexLabel" TEXT,
  "newAmount" INTEGER NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalIssue" (
  "id" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "eventDate" TIMESTAMP(3) NOT NULL,
  "attachmentsData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyRental_brokerId_status_idx" ON "PropertyRental"("brokerId", "status");
CREATE INDEX "PropertyRental_propertyId_createdAt_idx" ON "PropertyRental"("propertyId", "createdAt");
CREATE INDEX "PropertyRental_tenantLeadId_idx" ON "PropertyRental"("tenantLeadId");
CREATE INDEX "PropertyRental_ownerLeadId_idx" ON "PropertyRental"("ownerLeadId");
CREATE INDEX "PropertyRental_contractDocumentId_idx" ON "PropertyRental"("contractDocumentId");
CREATE UNIQUE INDEX "PropertyRental_one_active_per_property_idx" ON "PropertyRental"("propertyId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "RentalPayment_rentalId_competence_key" ON "RentalPayment"("rentalId", "competence");
CREATE INDEX "RentalPayment_rentalId_dueDate_idx" ON "RentalPayment"("rentalId", "dueDate");
CREATE INDEX "RentalPayment_status_dueDate_idx" ON "RentalPayment"("status", "dueDate");
CREATE INDEX "RentalAdjustment_rentalId_effectiveDate_idx" ON "RentalAdjustment"("rentalId", "effectiveDate");
CREATE INDEX "RentalIssue_rentalId_status_idx" ON "RentalIssue"("rentalId", "status");
CREATE INDEX "RentalIssue_rentalId_eventDate_idx" ON "RentalIssue"("rentalId", "eventDate");

ALTER TABLE "PropertyRental" ADD CONSTRAINT "PropertyRental_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyRental" ADD CONSTRAINT "PropertyRental_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyRental" ADD CONSTRAINT "PropertyRental_tenantLeadId_fkey" FOREIGN KEY ("tenantLeadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyRental" ADD CONSTRAINT "PropertyRental_ownerLeadId_fkey" FOREIGN KEY ("ownerLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyRental" ADD CONSTRAINT "PropertyRental_contractDocumentId_fkey" FOREIGN KEY ("contractDocumentId") REFERENCES "BrokerDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalPayment" ADD CONSTRAINT "RentalPayment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "PropertyRental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalAdjustment" ADD CONSTRAINT "RentalAdjustment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "PropertyRental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalIssue" ADD CONSTRAINT "RentalIssue_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "PropertyRental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
