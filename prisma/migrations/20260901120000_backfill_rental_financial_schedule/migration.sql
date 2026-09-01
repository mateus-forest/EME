-- Backfill the financial schedule of active rentals without duplicating
-- competences that were already registered manually.
INSERT INTO "RentalPayment" (
  "id",
  "rentalId",
  "competence",
  "amount",
  "dueDate",
  "status",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  'rental_fin_' || md5(rental."id" || ':' || to_char(months.month_start, 'YYYY-MM')),
  rental."id",
  to_char(months.month_start, 'YYYY-MM'),
  rental."monthlyRent",
  (
    months.month_start
    + (LEAST(
        rental."dueDay",
        EXTRACT(DAY FROM (date_trunc('month', months.month_start) + INTERVAL '1 month - 1 day'))::INTEGER
      ) - 1) * INTERVAL '1 day'
    + INTERVAL '12 hours'
  )::TIMESTAMP(3),
  'PENDING',
  'Previsão gerada automaticamente pela locação.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PropertyRental" AS rental
CROSS JOIN LATERAL generate_series(
  date_trunc('month', rental."startDate"),
  date_trunc('month', COALESCE(rental."endDate", rental."startDate" + INTERVAL '11 months')),
  INTERVAL '1 month'
) AS months(month_start)
WHERE rental."status" = 'ACTIVE'
ON CONFLICT ("rentalId", "competence") DO NOTHING;
