-- Additive operational records only; no billing or account changes.
CREATE TABLE "PartnerReferral" (
  "id" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "company" TEXT NOT NULL DEFAULT '',
  "offer" TEXT NOT NULL,
  "seats" INTEGER NOT NULL DEFAULT 1,
  "stage" TEXT NOT NULL DEFAULT 'NEW',
  "notes" TEXT NOT NULL DEFAULT '',
  "nextAction" TEXT NOT NULL DEFAULT '',
  "followUpAt" TIMESTAMP(3),
  "doNotContact" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "termsVersion" TEXT NOT NULL DEFAULT '2026-09-21',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PartnerReferralActivity" (
  "id" TEXT NOT NULL,
  "referralId" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerReferralActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerReferral_brokerId_email_key" ON "PartnerReferral"("brokerId", "email");
CREATE UNIQUE INDEX "PartnerReferral_brokerId_operationKey_key" ON "PartnerReferral"("brokerId", "operationKey");
CREATE INDEX "PartnerReferral_brokerId_stage_updatedAt_idx" ON "PartnerReferral"("brokerId", "stage", "updatedAt");
CREATE INDEX "PartnerReferral_brokerId_followUpAt_idx" ON "PartnerReferral"("brokerId", "followUpAt");
CREATE UNIQUE INDEX "PartnerReferralActivity_referralId_operationKey_key" ON "PartnerReferralActivity"("referralId", "operationKey");
CREATE INDEX "PartnerReferralActivity_referralId_createdAt_idx" ON "PartnerReferralActivity"("referralId", "createdAt");
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerReferralActivity" ADD CONSTRAINT "PartnerReferralActivity_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "PartnerReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
