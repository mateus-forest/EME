CREATE TYPE "CreciValidationStatus" AS ENUM ('VERIFIED', 'REJECTED', 'REVIEW_REQUIRED', 'PENDING');

CREATE TYPE "CreciValidationProvider" AS ENUM ('IMOBISEC');

ALTER TABLE "Broker"
ADD COLUMN "creciUf" TEXT,
ADD COLUMN "creciValidationStatus" "CreciValidationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "creciValidatedAt" TIMESTAMP(3),
ADD COLUMN "creciOfficialName" TEXT,
ADD COLUMN "creciProviderStatus" TEXT,
ADD COLUMN "creciValidationProvider" "CreciValidationProvider",
ADD COLUMN "creciNameMismatch" BOOLEAN NOT NULL DEFAULT false;
