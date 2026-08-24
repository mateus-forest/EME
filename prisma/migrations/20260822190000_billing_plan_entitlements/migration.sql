ALTER TABLE "Broker"
ALTER COLUMN "aiCreditsBalance" SET DEFAULT 30;

ALTER TABLE "BrokerPlanAccount"
ADD COLUMN "currentStripeSubscriptionId" TEXT,
ADD COLUMN "currentStripePeriodStart" TIMESTAMP(3),
ADD COLUMN "currentStripePeriodEnd" TIMESTAMP(3),
ADD COLUMN "currentPeriodGrantedCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentPeriodGrantPlanKey" TEXT;

UPDATE "BrokerPlanAccount"
SET
  "currentStripePeriodStart" = "currentPeriodCreditsGrantedAt",
  "currentStripePeriodEnd" = CASE
    WHEN "currentPeriodCreditsGrantedAt" IS NULL THEN NULL
    ELSE "currentPeriodCreditsGrantedAt" + INTERVAL '1 month'
  END,
  "currentPeriodGrantedCredits" = CASE "planKey"
    WHEN 'scale' THEN 2000
    WHEN 'pro' THEN 500
    ELSE 30
  END,
  "currentPeriodGrantPlanKey" = "planKey";

UPDATE "BrokerPlanAccount" AS account
SET
  "currentStripeSubscriptionId" = app_user."stripeSubscriptionId",
  "currentStripePeriodStart" = subscription."nextBillingAt" - INTERVAL '1 month',
  "currentStripePeriodEnd" = subscription."nextBillingAt"
FROM "Broker" AS broker
JOIN "User" AS app_user ON app_user."id" = broker."userId"
JOIN "Subscription" AS subscription
  ON subscription."ownerType" = 'BROKER'
  AND subscription."ownerId" = broker."id"
WHERE account."brokerId" = broker."id"
  AND account."planKey" IN ('pro', 'scale')
  AND app_user."stripeSubscriptionId" IS NOT NULL
  AND subscription."nextBillingAt" IS NOT NULL;

ALTER TABLE "AiCreditTransaction"
ADD COLUMN "grantKey" TEXT;

CREATE UNIQUE INDEX "AiCreditTransaction_grantKey_key"
ON "AiCreditTransaction"("grantKey");
