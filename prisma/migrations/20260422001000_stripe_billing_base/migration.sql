-- CreateEnum
CREATE TYPE "BillingPlan" AS ENUM ('NONE', 'BROKER', 'AGENCY');

-- CreateEnum
CREATE TYPE "BillingUserSubscriptionStatus" AS ENUM ('INACTIVE', 'ACTIVE');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "plan" "BillingPlan" NOT NULL DEFAULT 'NONE',
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "subscriptionStatus" "BillingUserSubscriptionStatus" NOT NULL DEFAULT 'INACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_ownerType_ownerId_key" ON "Subscription"("ownerType", "ownerId");
