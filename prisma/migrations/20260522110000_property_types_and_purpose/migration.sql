DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LAND' AND enumtypid = '"PropertyType"'::regtype) THEN
    ALTER TYPE "PropertyType" ADD VALUE 'LAND';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OFFICE' AND enumtypid = '"PropertyType"'::regtype) THEN
    ALTER TYPE "PropertyType" ADD VALUE 'OFFICE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STORE' AND enumtypid = '"PropertyType"'::regtype) THEN
    ALTER TYPE "PropertyType" ADD VALUE 'STORE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENTHOUSE' AND enumtypid = '"PropertyType"'::regtype) THEN
    ALTER TYPE "PropertyType" ADD VALUE 'PENTHOUSE';
  END IF;
END $$;

ALTER TABLE "Property"
ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'SALE';
