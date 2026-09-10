-- CreateTable
CREATE TABLE "JourneyEvent" (
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "producer" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "sessionId" TEXT,
    "pathname" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "referrer" TEXT,
    "device" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "step" TEXT,
    "outcome" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "brokerId" TEXT,
    "propertyId" TEXT,
    "catalogId" TEXT,
    "errorCode" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "JourneyEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "JourneyIdentityLink" (
    "anonymousId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authenticatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "JourneyIdentityLink_pkey" PRIMARY KEY ("anonymousId","sessionId","userId")
);

-- CreateIndex
CREATE INDEX "JourneyEvent_eventName_occurredAt_idx" ON "JourneyEvent"("eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_userId_occurredAt_idx" ON "JourneyEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_sessionId_occurredAt_idx" ON "JourneyEvent"("sessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_anonymousId_occurredAt_idx" ON "JourneyEvent"("anonymousId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_module_occurredAt_idx" ON "JourneyEvent"("module", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_catalogId_occurredAt_idx" ON "JourneyEvent"("catalogId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyEvent_correlationId_idx" ON "JourneyEvent"("correlationId");

-- CreateIndex
CREATE INDEX "JourneyIdentityLink_userId_authenticatedAt_idx" ON "JourneyIdentityLink"("userId", "authenticatedAt");
