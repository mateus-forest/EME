ALTER TABLE "ExtraPackagePurchase"
ADD COLUMN "stripeCheckoutSessionId" TEXT,
ADD COLUMN "stripePaymentIntentId" TEXT,
ADD COLUMN "stripeFulfilledEventId" TEXT;

UPDATE "ExtraPackagePurchase"
SET
  "stripeCheckoutSessionId" = NULLIF("metadata" ->> 'checkoutSessionId', ''),
  "stripePaymentIntentId" = NULLIF("metadata" ->> 'stripePaymentIntentId', '')
WHERE "metadata" IS NOT NULL;

CREATE UNIQUE INDEX "ExtraPackagePurchase_stripeCheckoutSessionId_key"
ON "ExtraPackagePurchase"("stripeCheckoutSessionId");

CREATE UNIQUE INDEX "ExtraPackagePurchase_stripePaymentIntentId_key"
ON "ExtraPackagePurchase"("stripePaymentIntentId");

CREATE UNIQUE INDEX "ExtraPackagePurchase_stripeFulfilledEventId_key"
ON "ExtraPackagePurchase"("stripeFulfilledEventId");
