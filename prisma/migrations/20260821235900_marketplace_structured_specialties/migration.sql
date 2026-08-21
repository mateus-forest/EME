ALTER TABLE "Broker"
ADD COLUMN "marketplaceSpecialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Broker"
SET "marketplaceSpecialties" = ARRAY(
  SELECT BTRIM(value)
  FROM regexp_split_to_table("Broker"."marketplaceSpecialty", E'[|;\n]+') WITH ORDINALITY AS parts(value, position)
  WHERE BTRIM(value) <> ''
  ORDER BY position
)
WHERE NULLIF(BTRIM(COALESCE("marketplaceSpecialty", '')), '') IS NOT NULL;

ALTER TABLE "Broker"
DROP COLUMN "marketplaceSpecialty";
