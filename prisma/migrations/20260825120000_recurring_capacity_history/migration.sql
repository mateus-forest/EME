CREATE TABLE "BrokerPropertyCapacityEvent" (
    "id" TEXT NOT NULL,
    "brokerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousQuantity" INTEGER,
    "quantity" INTEGER,
    "previousStripePriceId" TEXT,
    "stripePriceId" TEXT,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeSubscriptionItemId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerPropertyCapacityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrokerPropertyCapacityEvent_brokerId_effectiveAt_idx"
ON "BrokerPropertyCapacityEvent"("brokerId", "effectiveAt");

CREATE INDEX "BrokerPropertyCapacityEvent_stripeSubscriptionId_idx"
ON "BrokerPropertyCapacityEvent"("stripeSubscriptionId");

CREATE INDEX "BrokerPropertyCapacityEvent_action_idx"
ON "BrokerPropertyCapacityEvent"("action");

ALTER TABLE "BrokerPropertyCapacityEvent"
ADD CONSTRAINT "BrokerPropertyCapacityEvent_brokerId_fkey"
FOREIGN KEY ("brokerId") REFERENCES "Broker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BrokerPropertyCapacityEvent" (
    "id",
    "brokerId",
    "action",
    "quantity",
    "stripePriceId",
    "stripeSubscriptionId",
    "stripeSubscriptionItemId",
    "effectiveAt"
)
SELECT
    'capacity_initial_' || md5("brokerId" || "stripeSubscriptionId" || "stripeSubscriptionItemId"),
    "brokerId",
    'ACTIVATED',
    "quantity",
    "stripePriceId",
    "stripeSubscriptionId",
    "stripeSubscriptionItemId",
    COALESCE("startedAt", "createdAt")
FROM "BrokerPropertyCapacityAddon"
WHERE "status" = 'ACTIVE';

CREATE OR REPLACE FUNCTION "recordBrokerPropertyCapacityEvent"()
RETURNS TRIGGER AS $$
DECLARE
    event_action TEXT;
BEGIN
    IF TG_OP = 'INSERT' AND NEW."status" = 'ACTIVE' THEN
        event_action := 'ACTIVATED';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD."status" <> 'ACTIVE' AND NEW."status" = 'ACTIVE' THEN
            event_action := 'ACTIVATED';
        ELSIF OLD."status" = 'ACTIVE'
          AND NEW."status" = 'ACTIVE'
          AND (
            OLD."quantity" IS DISTINCT FROM NEW."quantity"
            OR OLD."stripePriceId" IS DISTINCT FROM NEW."stripePriceId"
            OR OLD."stripeSubscriptionItemId" IS DISTINCT FROM NEW."stripeSubscriptionItemId"
          ) THEN
            event_action := 'CHANGED';
        ELSIF OLD."status" = 'ACTIVE' AND NEW."status" <> 'ACTIVE' THEN
            event_action := CASE
                WHEN NEW."status" = 'CANCELED' OR NEW."stripeSubscriptionItemId" IS NULL THEN 'REMOVED'
                ELSE 'SUSPENDED'
            END;
        END IF;
    END IF;

    IF event_action IS NOT NULL THEN
        INSERT INTO "BrokerPropertyCapacityEvent" (
            "id",
            "brokerId",
            "action",
            "previousQuantity",
            "quantity",
            "previousStripePriceId",
            "stripePriceId",
            "stripeSubscriptionId",
            "stripeSubscriptionItemId",
            "effectiveAt"
        ) VALUES (
            'capacity_' || md5(random()::text || clock_timestamp()::text || NEW."brokerId"),
            NEW."brokerId",
            event_action,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD."quantity" ELSE NULL END,
            NEW."quantity",
            CASE WHEN TG_OP = 'UPDATE' THEN OLD."stripePriceId" ELSE NULL END,
            NEW."stripePriceId",
            NEW."stripeSubscriptionId",
            NEW."stripeSubscriptionItemId",
            COALESCE(NEW."endedAt", NEW."updatedAt", CURRENT_TIMESTAMP)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BrokerPropertyCapacityAddon_history_trigger"
AFTER INSERT OR UPDATE ON "BrokerPropertyCapacityAddon"
FOR EACH ROW EXECUTE FUNCTION "recordBrokerPropertyCapacityEvent"();
