ALTER TABLE "Broker"
ADD COLUMN "catalogBannerUrl" TEXT,
ADD COLUMN "catalogHeadline" TEXT,
ADD COLUMN "catalogBio" TEXT,
ADD COLUMN "catalogExperienceYears" INTEGER,
ADD COLUMN "catalogSoldProperties" INTEGER,
ADD COLUMN "catalogServiceArea" TEXT,
ADD COLUMN "catalogCities" JSONB,
ADD COLUMN "catalogPriceRange" TEXT,
ADD COLUMN "catalogSpecialties" JSONB,
ADD COLUMN "catalogDifferentials" JSONB,
ADD COLUMN "catalogVideoUrl" TEXT;
