-- Additive migration: existing BrokerDocument rows and legacy contracts are preserved.
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ANALYZING',
    "sourceHash" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ANALYZING',
    "sourceFileName" TEXT NOT NULL,
    "sourceStoragePath" TEXT,
    "sourceMimeType" TEXT NOT NULL,
    "sourceFileSize" INTEGER,
    "originalText" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "analysisMetadata" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractTemplateInstance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "brokerDocumentId" TEXT,
    "leadId" TEXT,
    "propertyId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "values" JSONB NOT NULL,
    "additionalParties" JSONB NOT NULL,
    "readiness" INTEGER NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMP(3),
    "signatureNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractTemplateInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractTemplate_workspaceId_sourceHash_key" ON "ContractTemplate"("workspaceId", "sourceHash");
CREATE INDEX "ContractTemplate_brokerId_status_updatedAt_idx" ON "ContractTemplate"("brokerId", "status", "updatedAt");
CREATE UNIQUE INDEX "ContractTemplateVersion_templateId_version_key" ON "ContractTemplateVersion"("templateId", "version");
CREATE INDEX "ContractTemplateVersion_templateId_status_idx" ON "ContractTemplateVersion"("templateId", "status");
CREATE UNIQUE INDEX "ContractTemplateInstance_brokerDocumentId_key" ON "ContractTemplateInstance"("brokerDocumentId");
CREATE INDEX "ContractTemplateInstance_brokerId_status_updatedAt_idx" ON "ContractTemplateInstance"("brokerId", "status", "updatedAt");
CREATE INDEX "ContractTemplateInstance_templateId_createdAt_idx" ON "ContractTemplateInstance"("templateId", "createdAt");
CREATE INDEX "ContractTemplateInstance_leadId_idx" ON "ContractTemplateInstance"("leadId");
CREATE INDEX "ContractTemplateInstance_propertyId_idx" ON "ContractTemplateInstance"("propertyId");

ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractTemplateVersion" ADD CONSTRAINT "ContractTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractTemplateInstance" ADD CONSTRAINT "ContractTemplateInstance_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractTemplateInstance" ADD CONSTRAINT "ContractTemplateInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractTemplateInstance" ADD CONSTRAINT "ContractTemplateInstance_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ContractTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractTemplateInstance" ADD CONSTRAINT "ContractTemplateInstance_brokerDocumentId_fkey" FOREIGN KEY ("brokerDocumentId") REFERENCES "BrokerDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractTemplateInstance" ADD CONSTRAINT "ContractTemplateInstance_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractTemplateInstance" ADD CONSTRAINT "ContractTemplateInstance_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
