CREATE TABLE "AiOperationTelemetry" (
    "id" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "capability" TEXT,
    "handler" TEXT,
    "route" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "source" TEXT,
    "workflowId" TEXT,
    "conversationId" TEXT,
    "userId" TEXT,
    "brokerId" TEXT,
    "agencyId" TEXT,
    "planKey" TEXT,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "totalTokens" INTEGER,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "audioCount" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" INTEGER,
    "durationMs" INTEGER,
    "costUsd" DECIMAL(12,6),
    "costBrl" DECIMAL(12,6),
    "creditsConsumed" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiOperationTelemetry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiOperationTelemetry_operationKey_createdAt_idx" ON "AiOperationTelemetry"("operationKey", "createdAt");
CREATE INDEX "AiOperationTelemetry_provider_createdAt_idx" ON "AiOperationTelemetry"("provider", "createdAt");
CREATE INDEX "AiOperationTelemetry_brokerId_createdAt_idx" ON "AiOperationTelemetry"("brokerId", "createdAt");
CREATE INDEX "AiOperationTelemetry_userId_createdAt_idx" ON "AiOperationTelemetry"("userId", "createdAt");
CREATE INDEX "AiOperationTelemetry_planKey_createdAt_idx" ON "AiOperationTelemetry"("planKey", "createdAt");
CREATE INDEX "AiOperationTelemetry_status_createdAt_idx" ON "AiOperationTelemetry"("status", "createdAt");
