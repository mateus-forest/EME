/** All metrics come from JourneyEvent. $1/$2 UTC bounds, $3 hour/day, $4 surface, $5 normalized route.
 * Lateral historical reads use sessionId/anonymousId indexes; no event payloads leave the server.
 */
export const ADMIN_TRAFFIC_SQL = `
WITH period_events AS MATERIALIZED (
  SELECT * FROM "JourneyEvent"
  WHERE "occurredAt">=$1::timestamptz AND "occurredAt"<$2::timestamptz
    AND device<>'bot' AND module<>'admin' AND pathname !~ '^/admin(/|$)'
    AND ((producer='browser' AND "eventName" IN ('page_view','marketplace_view','marketplace_search','marketplace_result_opened','catalog_view','catalog_property_opened'))
      OR (producer='server' AND "eventName"='lead_created'))
), classified AS (
  SELECT *, CASE
    WHEN "eventName"='lead_created' AND metadata->>'channel'='marketplace' THEN 'marketplace'
    WHEN "eventName"='lead_created' AND metadata->>'channel'='catalog' THEN 'catalog'
    WHEN "eventName" LIKE 'marketplace_%' OR pathname ~ '^/imoveis(/|$)' THEN 'marketplace'
    WHEN "eventName" IN ('catalog_view','catalog_property_opened') OR pathname ~ '^/catalogo(/|$)' THEN 'catalog'
    WHEN pathname='/' THEN 'landing'
    WHEN pathname ~ '^/(corretor|imobiliaria)(/|$)' AND "userId" IS NOT NULL THEN 'portal'
    ELSE 'other' END AS surface
  FROM period_events
), scope AS MATERIALIZED (
  SELECT * FROM classified WHERE ($4='all' OR surface=$4) AND ($5::text IS NULL OR pathname=$5)
), pages AS MATERIALIZED (
  SELECT * FROM scope WHERE "eventName"='page_view'
), session_edges AS MATERIALIZED (
  SELECT s."sessionId", first_page."eventId" AS first_id, last_page."eventId" AS last_id,
    last_page."occurredAt" AS last_at, first_page.device,
    coalesce(nullif(first_page.referrer,''),'Não informado') AS referrer,
    coalesce(nullif(first_page.metadata->>'utmSource',''),'Não informado') AS source,
    coalesce(nullif(first_page.metadata->>'utmMedium',''),'Não informado') AS medium
  FROM (SELECT DISTINCT "sessionId" FROM pages WHERE "sessionId" IS NOT NULL) s
  CROSS JOIN LATERAL (
    SELECT "eventId",device,referrer,metadata FROM "JourneyEvent" e
    WHERE e."sessionId"=s."sessionId" AND e."eventName"='page_view' AND producer='browser'
      AND device<>'bot' AND module<>'admin' AND pathname !~ '^/admin(/|$)' AND "occurredAt"<$2::timestamptz
    ORDER BY "occurredAt","eventId" LIMIT 1
  ) first_page
  CROSS JOIN LATERAL (
    SELECT "eventId","occurredAt" FROM "JourneyEvent" e
    WHERE e."sessionId"=s."sessionId" AND e."eventName"='page_view' AND producer='browser'
      AND device<>'bot' AND module<>'admin' AND pathname !~ '^/admin(/|$)'
    ORDER BY "occurredAt" DESC,"eventId" DESC LIMIT 1
  ) last_page
), visitors AS MATERIALIZED (
  SELECT v."anonymousId", EXISTS (
    SELECT 1 FROM "JourneyEvent" old WHERE old."anonymousId"=v."anonymousId" AND old."eventName"='page_view'
      AND old.producer='browser' AND old.device<>'bot' AND old.module<>'admin' AND old.pathname !~ '^/admin(/|$)'
      AND old."occurredAt"<$1::timestamptz
  ) AS is_returning
  FROM (SELECT DISTINCT "anonymousId" FROM pages WHERE "anonymousId" IS NOT NULL) v
), page_edges AS MATERIALIZED (
  SELECT p.*, (se.first_id=p."eventId") AS entry,
    (se.last_id=p."eventId" AND se.last_at<=$2::timestamptz - interval '30 minutes') AS exit
  FROM pages p LEFT JOIN session_edges se USING ("sessionId")
), surface_rows AS (
  SELECT surface AS label, count(*)::int AS views, count(DISTINCT "anonymousId")::int AS visitors,
    count(DISTINCT "sessionId")::int AS sessions, count(*) FILTER (WHERE entry)::int AS entries,
    count(*) FILTER (WHERE exit)::int AS exits FROM page_edges GROUP BY surface
), route_rows AS (
  SELECT pathname AS label, count(*)::int AS views, count(DISTINCT "anonymousId")::int AS visitors,
    count(DISTINCT "sessionId")::int AS sessions, count(*) FILTER (WHERE entry)::int AS entries,
    count(*) FILTER (WHERE exit)::int AS exits FROM page_edges GROUP BY pathname
), acquisition_rows AS (
  SELECT source || ' / ' || medium || ' / ' || referrer AS label, source,medium,referrer,count(*)::int AS sessions
  FROM session_edges GROUP BY source,medium,referrer
), searches AS MATERIALIZED (
  SELECT metadata->>'searchId' AS search_id, "sessionId", "anonymousId", min("occurredAt") AS at
  FROM scope WHERE "eventName"='marketplace_search' AND nullif(metadata->>'searchId','') IS NOT NULL
    AND "sessionId" IS NOT NULL AND "anonymousId" IS NOT NULL
  GROUP BY metadata->>'searchId',"sessionId","anonymousId"
), converted AS (
  SELECT s.* FROM searches s WHERE EXISTS (
    SELECT 1 FROM scope o WHERE o."eventName"='marketplace_result_opened' AND o.metadata->>'searchId'=s.search_id
      AND o."sessionId"=s."sessionId" AND o."anonymousId"=s."anonymousId" AND o."occurredAt">=s.at
  )
), catalog_rows AS (
  SELECT "catalogId" AS label,
    count(*) FILTER (WHERE "eventName"='catalog_view')::int AS views,
    count(DISTINCT "anonymousId") FILTER (WHERE "eventName"='catalog_view')::int AS visitors,
    count(DISTINCT "sessionId") FILTER (WHERE "eventName"='catalog_view')::int AS sessions,
    count(*) FILTER (WHERE "eventName"='catalog_property_opened')::int AS opened,
    count(*) FILTER (WHERE "eventName"='lead_created' AND metadata->>'channel'='catalog')::int AS leads,
    NULL::text AS owner, NULL::text AS "ownerType"
  FROM scope WHERE "catalogId" IS NOT NULL AND ("eventName" IN ('catalog_view','catalog_property_opened')
    OR ("eventName"='lead_created' AND metadata->>'channel'='catalog')) GROUP BY "catalogId"
), buckets AS (
  SELECT generate_series(date_trunc($3, $1::timestamptz AT TIME ZONE 'America/Sao_Paulo'),
    date_trunc($3, ($2::timestamptz - interval '1 millisecond') AT TIME ZONE 'America/Sao_Paulo'),
    CASE WHEN $3='hour' THEN interval '1 hour' ELSE interval '1 day' END) AS local_bucket
), series_rows AS (
  SELECT local_bucket AT TIME ZONE 'America/Sao_Paulo' AS bucket, count(p."eventId")::int AS views,
    count(DISTINCT p."anonymousId")::int AS visitors,count(DISTINCT p."sessionId")::int AS sessions
  FROM buckets LEFT JOIN pages p ON date_trunc($3,p."occurredAt" AT TIME ZONE 'America/Sao_Paulo')=local_bucket
  GROUP BY local_bucket
)
SELECT jsonb_build_object(
  'totals',(SELECT jsonb_build_object('views',count(*),'visitors',count(DISTINCT "anonymousId"),'sessions',count(DISTINCT "sessionId"),
    'pagesPerSession',round(count(*) FILTER (WHERE "sessionId" IS NOT NULL)::numeric/nullif(count(DISTINCT "sessionId"),0),2),
    'newVisitors',(SELECT count(*) FROM visitors WHERE NOT is_returning),'returningVisitors',(SELECT count(*) FROM visitors WHERE is_returning),
    'entries',count(*) FILTER (WHERE entry)) FROM page_edges),
  'series',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY bucket) FROM series_rows r),'[]'::jsonb),
  'surfaces',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY views DESC,label) FROM surface_rows r),'[]'::jsonb),
  'routes',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY views DESC,label) FROM (SELECT * FROM route_rows ORDER BY views DESC,label LIMIT 200) r),'[]'::jsonb),
  'devices',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY count DESC,label) FROM (SELECT device AS label,count(*)::int AS count FROM session_edges GROUP BY device) r),'[]'::jsonb),
  'acquisition',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY sessions DESC,label) FROM (SELECT * FROM acquisition_rows ORDER BY sessions DESC,label LIMIT 200) r),'[]'::jsonb),
  'marketplace',(SELECT jsonb_build_object('views',count(*) FILTER (WHERE "eventName"='marketplace_view'),
    'searches',count(*) FILTER (WHERE "eventName"='marketplace_search'),'opened',count(*) FILTER (WHERE "eventName"='marketplace_result_opened'),
    'leads',count(*) FILTER (WHERE "eventName"='lead_created' AND metadata->>'channel'='marketplace'),
    'linkedSearches',(SELECT count(*) FROM searches),'convertedSearches',(SELECT count(*) FROM converted),
    'searchRate',(SELECT round((SELECT count(*) FROM converted)::numeric*100/nullif(count(*),0),1) FROM searches),
    'unlinkedOpens',count(*) FILTER (WHERE "eventName"='marketplace_result_opened' AND NOT EXISTS (
      SELECT 1 FROM searches s WHERE s.search_id=scope.metadata->>'searchId' AND s."sessionId"=scope."sessionId"
        AND s."anonymousId"=scope."anonymousId" AND scope."occurredAt">=s.at))) FROM scope),
  'catalogs',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY views DESC,label) FROM (SELECT * FROM catalog_rows ORDER BY views DESC,label LIMIT 200) r),'[]'::jsonb),
  'catalogTotals',(SELECT jsonb_build_object('views',count(*) FILTER (WHERE "eventName"='catalog_view'),
    'opened',count(*) FILTER (WHERE "eventName"='catalog_property_opened'),
    'leads',count(*) FILTER (WHERE "eventName"='lead_created' AND metadata->>'channel'='catalog')) FROM scope),
  'quality',jsonb_build_object(
    'firstReceivedAt',(SELECT min("receivedAt") FROM "JourneyEvent"), 'lastReceivedAt',(SELECT max("receivedAt") FROM "JourneyEvent"),
    'missingPageIdentity',(SELECT count(*) FROM pages WHERE "anonymousId" IS NULL OR "sessionId" IS NULL),
    'missingCatalogId',(SELECT count(*) FROM scope WHERE "catalogId" IS NULL AND ("eventName" IN ('catalog_view','catalog_property_opened') OR ("eventName"='lead_created' AND metadata->>'channel'='catalog'))),
    'missingSearchIdentity',(SELECT count(*) FROM scope WHERE "eventName"='marketplace_search' AND (nullif(metadata->>'searchId','') IS NULL OR "sessionId" IS NULL OR "anonymousId" IS NULL)),
    'routes',(SELECT count(*) FROM route_rows),'catalogs',(SELECT count(*) FROM catalog_rows),'acquisition',(SELECT count(*) FROM acquisition_rows))
) AS data
`

/** Descriptive enrichment only: never read CatalogEvent, billing, or owner activity. Slugs are the current Journey catalog identifiers. */
export const ADMIN_TRAFFIC_OWNERS_SQL = `
WITH owner_refs AS (
  SELECT slug,"ownerId","ownerType"::text AS kind FROM "Catalog" WHERE slug=ANY($1::text[])
  UNION ALL
  SELECT b."catalogSlug",b.id,'BROKER' FROM "Broker" b WHERE b."catalogSlug"=ANY($1::text[])
    AND NOT EXISTS (SELECT 1 FROM "Catalog" c WHERE c.slug=b."catalogSlug" AND c."ownerType"='BROKER')
  UNION ALL
  SELECT a."catalogSlug",a.id,'AGENCY' FROM "Agency" a WHERE a."catalogSlug"=ANY($1::text[])
    AND NOT EXISTS (SELECT 1 FROM "Catalog" c WHERE c.slug=a."catalogSlug" AND c."ownerType"='AGENCY')
)
SELECT r.slug,u.name AS owner,'BROKER' AS "ownerType"
FROM owner_refs r JOIN "Broker" b ON b.id=r."ownerId" AND r.kind='BROKER' JOIN "User" u ON u.id=b."userId"
UNION ALL
SELECT r.slug,a.name AS owner,'AGENCY' AS "ownerType"
FROM owner_refs r JOIN "Agency" a ON a.id=r."ownerId" AND r.kind='AGENCY'
`
