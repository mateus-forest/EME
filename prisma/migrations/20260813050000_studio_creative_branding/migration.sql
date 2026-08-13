-- Studio IA creative branding: broker/agency accent color + agency footer watermark toggle
ALTER TABLE "Broker" ADD COLUMN "brandColor" TEXT;
ALTER TABLE "Broker" ADD COLUMN "showAgencyWatermark" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Agency" ADD COLUMN "brandColor" TEXT;
