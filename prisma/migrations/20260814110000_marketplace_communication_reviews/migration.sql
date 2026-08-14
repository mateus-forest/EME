CREATE TYPE "MarketplaceConversationStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "MarketplaceMessageSender" AS ENUM ('CUSTOMER', 'BROKER');
CREATE TYPE "MarketplaceReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "MarketplaceConversation" (
  "id" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "leadId" TEXT,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "status" "MarketplaceConversationStatus" NOT NULL DEFAULT 'OPEN',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "reviewRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sender" "MarketplaceMessageSender" NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceReview" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "brokerId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "status" "MarketplaceReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "moderatedAt" TIMESTAMP(3),
  "moderatorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceConversation_publicToken_key" ON "MarketplaceConversation"("publicToken");
CREATE INDEX "MarketplaceConversation_brokerId_lastMessageAt_idx" ON "MarketplaceConversation"("brokerId", "lastMessageAt");
CREATE INDEX "MarketplaceConversation_propertyId_lastMessageAt_idx" ON "MarketplaceConversation"("propertyId", "lastMessageAt");
CREATE INDEX "MarketplaceConversation_leadId_idx" ON "MarketplaceConversation"("leadId");
CREATE INDEX "MarketplaceConversation_status_lastMessageAt_idx" ON "MarketplaceConversation"("status", "lastMessageAt");
CREATE INDEX "MarketplaceMessage_conversationId_createdAt_idx" ON "MarketplaceMessage"("conversationId", "createdAt");
CREATE UNIQUE INDEX "MarketplaceReview_conversationId_key" ON "MarketplaceReview"("conversationId");
CREATE INDEX "MarketplaceReview_brokerId_status_createdAt_idx" ON "MarketplaceReview"("brokerId", "status", "createdAt");
CREATE INDEX "MarketplaceReview_status_createdAt_idx" ON "MarketplaceReview"("status", "createdAt");

ALTER TABLE "MarketplaceConversation" ADD CONSTRAINT "MarketplaceConversation_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceConversation" ADD CONSTRAINT "MarketplaceConversation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceConversation" ADD CONSTRAINT "MarketplaceConversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceMessage" ADD CONSTRAINT "MarketplaceMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MarketplaceConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MarketplaceConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
