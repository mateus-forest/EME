-- Restore only specialties that are demonstrably a truncated prefix of text
-- still preserved in a previous profile source. Values without a source remain
-- untouched so this migration never invents broker data.
WITH specialty_candidates AS (
  SELECT
    broker.id,
    specialty.position,
    specialty.value AS current_value,
    (
      SELECT BTRIM(candidate.value)
      FROM regexp_split_to_table(
        CONCAT_WS(E'\n', NULLIF(broker.description, ''), NULLIF(broker."catalogBio", '')),
        E'[|;\n]+'
      ) WITH ORDINALITY AS candidate(value, position)
      WHERE BTRIM(specialty.value) <> ''
        AND LENGTH(BTRIM(candidate.value)) > LENGTH(BTRIM(specialty.value))
        AND LEFT(BTRIM(candidate.value), LENGTH(BTRIM(specialty.value))) = BTRIM(specialty.value)
        AND SUBSTRING(
          BTRIM(candidate.value)
          FROM LENGTH(BTRIM(specialty.value)) + 1
          FOR 1
        ) !~ E'\s'
      ORDER BY candidate.position
      LIMIT 1
    ) AS recovered_value
  FROM "Broker" AS broker
  CROSS JOIN LATERAL unnest(broker."marketplaceSpecialties")
    WITH ORDINALITY AS specialty(value, position)
), rebuilt_specialties AS (
  SELECT
    id,
    array_agg(COALESCE(recovered_value, current_value) ORDER BY position) AS specialties,
    bool_or(recovered_value IS NOT NULL) AS changed
  FROM specialty_candidates
  GROUP BY id
)
UPDATE "Broker" AS broker
SET "marketplaceSpecialties" = rebuilt.specialties
FROM rebuilt_specialties AS rebuilt
WHERE broker.id = rebuilt.id
  AND rebuilt.changed;
