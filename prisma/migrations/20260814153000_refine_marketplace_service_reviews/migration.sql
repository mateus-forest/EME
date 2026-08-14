-- CreateEnum
CREATE TYPE "MarketplaceMessageKind" AS ENUM ('TEXT', 'PROPERTY', 'PROPOSAL');

-- CreateEnum
CREATE TYPE "MarketplaceReviewOrigin" AS ENUM ('POST_CHAT', 'PUBLIC_PROFILE');

-- AlterTable
ALTER TABLE "MarketplaceMessage"
ADD COLUMN "kind" "MarketplaceMessageKind" NOT NULL DEFAULT 'TEXT',
ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "MarketplaceReview"
ALTER COLUMN "conversationId" DROP NOT NULL,
ADD COLUMN "leadId" TEXT,
ADD COLUMN "authorPhone" TEXT,
ADD COLUMN "origin" "MarketplaceReviewOrigin" NOT NULL DEFAULT 'PUBLIC_PROFILE',
ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "attendanceConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rejectionReason" TEXT;

-- Existing reviews were submitted from a closed Marketplace conversation.
UPDATE "MarketplaceReview" AS review
SET
  "authorPhone" = conversation."customerPhone",
  "leadId" = conversation."leadId",
  "origin" = 'POST_CHAT',
  "verified" = true,
  "attendanceConfirmed" = true
FROM "MarketplaceConversation" AS conversation
WHERE review."conversationId" = conversation."id";

-- Replace the cascading conversation relation so approved reviews can retain their moderation history.
ALTER TABLE "MarketplaceReview" DROP CONSTRAINT IF EXISTS "MarketplaceReview_conversationId_fkey";
ALTER TABLE "MarketplaceReview"
ADD CONSTRAINT "MarketplaceReview_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "MarketplaceConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceReview"
ADD CONSTRAINT "MarketplaceReview_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "MarketplaceReview_brokerId_authorPhone_createdAt_idx"
ON "MarketplaceReview"("brokerId", "authorPhone", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceReview_leadId_idx" ON "MarketplaceReview"("leadId");

-- CreateTable
CREATE TABLE "MarketplaceRegionMedia" (
  "slug" TEXT NOT NULL,
  "displayName" TEXT,
  "imageUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceRegionMedia_pkey" PRIMARY KEY ("slug")
);
