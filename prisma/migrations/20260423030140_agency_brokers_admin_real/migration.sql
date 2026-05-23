-- CreateEnum
CREATE TYPE "BrokerAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "status" "BrokerAccountStatus" NOT NULL DEFAULT 'ACTIVE';
