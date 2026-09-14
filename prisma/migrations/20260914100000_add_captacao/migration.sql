-- CreateEnum
CREATE TYPE "CaptacaoStage" AS ENUM ('SAVED', 'CONTACTED', 'CONVERSATION', 'VISIT', 'CONFIRMED', 'DISCARDED');

-- CreateTable
CREATE TABLE "Captacao" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "listing" JSONB NOT NULL,
    "stage" "CaptacaoStage" NOT NULL DEFAULT 'SAVED',
    "notes" TEXT NOT NULL DEFAULT '',
    "nextAction" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3),
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "advertiserKind" TEXT,
    "identityEvidence" TEXT NOT NULL DEFAULT '',
    "agendaEventId" TEXT,
    "leadId" TEXT,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Captacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptacaoActivity" (
    "id" TEXT NOT NULL,
    "captacaoId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptacaoActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptacaoQuery" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "response" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CaptacaoQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Captacao_agendaEventId_key" ON "Captacao"("agendaEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Captacao_propertyId_key" ON "Captacao"("propertyId");

-- CreateIndex
CREATE INDEX "Captacao_brokerId_stage_updatedAt_idx" ON "Captacao"("brokerId", "stage", "updatedAt");

-- CreateIndex
CREATE INDEX "Captacao_brokerId_dueAt_idx" ON "Captacao"("brokerId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Captacao_brokerId_sourceKey_key" ON "Captacao"("brokerId", "sourceKey");

-- CreateIndex
CREATE INDEX "CaptacaoActivity_captacaoId_createdAt_idx" ON "CaptacaoActivity"("captacaoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaptacaoActivity_captacaoId_operationKey_key" ON "CaptacaoActivity"("captacaoId", "operationKey");

-- CreateIndex
CREATE INDEX "CaptacaoQuery_brokerId_fingerprint_createdAt_idx" ON "CaptacaoQuery"("brokerId", "fingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "CaptacaoQuery_createdAt_idx" ON "CaptacaoQuery"("createdAt");

-- AddForeignKey
ALTER TABLE "Captacao" ADD CONSTRAINT "Captacao_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Captacao" ADD CONSTRAINT "Captacao_agendaEventId_fkey" FOREIGN KEY ("agendaEventId") REFERENCES "AgendaEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Captacao" ADD CONSTRAINT "Captacao_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Captacao" ADD CONSTRAINT "Captacao_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptacaoActivity" ADD CONSTRAINT "CaptacaoActivity_captacaoId_fkey" FOREIGN KEY ("captacaoId") REFERENCES "Captacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptacaoQuery" ADD CONSTRAINT "CaptacaoQuery_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
