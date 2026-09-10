/** Static, parameterized SELECT. $1=start UTC inclusive; $2=end UTC exclusive; $3=hour/day. */
export const ADMIN_JOURNEY_SQL = `
WITH scope AS MATERIALIZED (
  SELECT * FROM "JourneyEvent"
  WHERE "occurredAt" >= $1::timestamptz AND "occurredAt" < $2::timestamptz
    AND device <> 'bot' AND module <> 'admin' AND pathname !~ '^/admin(/|$)'
), pages AS (SELECT * FROM scope WHERE "eventName"='page_view' AND producer='browser'),
session_entries AS (
  SELECT DISTINCT ON ("sessionId") * FROM pages WHERE "sessionId" IS NOT NULL ORDER BY "sessionId","occurredAt","eventId"
), business AS (
  SELECT * FROM scope WHERE producer='server' AND "eventName" IN ('lead_created','property_created','property_published','proposal_created','contract_generated','cos_message_sent','cos_action_completed','studio_generation_completed','checkout_completed')
), product AS (
  SELECT * FROM scope WHERE "userId" IS NOT NULL AND module NOT IN ('admin','auth','landing')
    AND ("eventName"='page_view' OR "eventId" IN (SELECT "eventId" FROM business))
    AND (pathname ~ '^/(corretor|imobiliaria)(/|$)' OR (producer='server' AND route ~ '^/api/(brokers|agencies|properties|assistant|cos-launch|studio-ia|stripe)(/|$)'))
), error_events AS (SELECT * FROM scope WHERE "eventName"='error_occurred'),
f_landing AS (SELECT "sessionId",MIN("occurredAt") AS reached FROM scope WHERE "eventName"='landing_view' AND "sessionId" IS NOT NULL GROUP BY 1),
f_signup AS (SELECT f."sessionId",MIN(e."occurredAt") AS reached FROM f_landing f JOIN scope e ON e."sessionId"=f."sessionId" AND e."eventName"='signup_started' AND e."occurredAt">=f.reached GROUP BY 1),
f_registered AS (SELECT f."sessionId",MIN(e."occurredAt") AS reached FROM f_signup f JOIN scope e ON e."sessionId"=f."sessionId" AND e."eventName"='signup_completed' AND e.producer='server' AND e."userId" IS NOT NULL AND e."occurredAt">=f.reached GROUP BY 1),
f_checkout AS (SELECT f."sessionId",MIN(e."occurredAt") AS reached FROM f_registered f JOIN scope e ON e."sessionId"=f."sessionId" AND e."eventName"='checkout_started' AND e.producer='server' AND e."occurredAt">=f.reached GROUP BY 1),
f_paid AS (SELECT f."sessionId",MIN(e."occurredAt") AS reached FROM f_checkout f JOIN scope e ON e."sessionId"=f."sessionId" AND e."eventName"='checkout_completed' AND e.producer='server' AND e."occurredAt">=f.reached GROUP BY 1),
funnel AS (
 SELECT 1 AS position,'landing_view' AS event,count(*)::int AS count FROM f_landing UNION ALL
 SELECT 2,'signup_started',count(*)::int FROM f_signup UNION ALL SELECT 3,'signup_completed',count(*)::int FROM f_registered UNION ALL
 SELECT 4,'checkout_started',count(*)::int FROM f_checkout UNION ALL SELECT 5,'checkout_completed',count(*)::int FROM f_paid
), event_counts AS (SELECT "eventName" AS event,count(*)::int AS count FROM scope GROUP BY 1),
buckets AS (
  SELECT generate_series(date_trunc($3, $1::timestamptz AT TIME ZONE 'America/Sao_Paulo'), date_trunc($3, ($2::timestamptz - interval '1 millisecond') AT TIME ZONE 'America/Sao_Paulo'), CASE WHEN $3='hour' THEN interval '1 hour' ELSE interval '1 day' END) AS bucket
), series AS (
  SELECT date_trunc($3,"occurredAt" AT TIME ZONE 'America/Sao_Paulo') AS bucket,count(*)::int AS views,count(DISTINCT "anonymousId")::int AS visitors,count(DISTINCT "sessionId")::int AS sessions FROM pages GROUP BY 1
)
SELECT jsonb_build_object(
 'totals',jsonb_build_object(
   'visitors',(SELECT count(DISTINCT "anonymousId")::int FROM pages),'sessions',(SELECT count(DISTINCT "sessionId")::int FROM pages),'pageViews',(SELECT count(*)::int FROM pages),
   'signupStarted',(SELECT count(DISTINCT "sessionId")::int FROM scope WHERE "eventName"='signup_started'),
   'signupCompleted',(SELECT count(DISTINCT "userId")::int FROM scope WHERE "eventName"='signup_completed' AND producer='server'),
   'landingViews',COALESCE((SELECT count FROM event_counts WHERE event='landing_view'),0),
   'marketplaceViews',COALESCE((SELECT count FROM event_counts WHERE event='marketplace_view'),0),
   'catalogViews',COALESCE((SELECT count FROM event_counts WHERE event='catalog_view'),0),
   'leads',(SELECT count(*)::int FROM business WHERE "eventName"='lead_created'),'errors',(SELECT count(*)::int FROM error_events)),
 'sources',COALESCE((SELECT jsonb_agg(r ORDER BY count DESC,label) FROM (SELECT CASE WHEN metadata->>'utmSource' NOT IN ('direct','other') THEN metadata->>'utmSource' ELSE COALESCE(referrer,'Direto / não informado') END AS label,count(*)::int AS count FROM session_entries GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 6) r),'[]'::jsonb),
 'devices',COALESCE((SELECT jsonb_agg(r ORDER BY count DESC,label) FROM (SELECT device AS label,count(*)::int AS count FROM session_entries GROUP BY 1) r),'[]'::jsonb),
 'funnel',(SELECT jsonb_agg(jsonb_build_object('event',f.event,'count',f.count,'total',COALESCE(e.count,0)) ORDER BY position) FROM funnel f LEFT JOIN event_counts e USING(event)),
 'modules',COALESCE((SELECT jsonb_agg(r ORDER BY count DESC,label) FROM (SELECT module AS label,count(*)::int AS count,count(DISTINCT "userId")::int AS users FROM product GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 12) r),'[]'::jsonb),
 'actions',COALESCE((SELECT jsonb_agg(r ORDER BY count DESC,label) FROM (SELECT "eventName" AS label,count(*)::int AS count FROM business WHERE "userId" IS NOT NULL AND "eventId" IN (SELECT "eventId" FROM product) GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 10) r),'[]'::jsonb),
 'commerce',(SELECT jsonb_agg(jsonb_build_object('label',name,'count',COALESCE(e.count,0)) ORDER BY position) FROM unnest(ARRAY['marketplace_view','marketplace_search','marketplace_result_opened','catalog_view','catalog_property_opened','lead_created']) WITH ORDINALITY AS names(name,position) LEFT JOIN event_counts e ON e.event=names.name),
 'errors',jsonb_build_object('users',(SELECT count(DISTINCT "userId")::int FROM error_events),'sessions',(SELECT count(DISTINCT "sessionId")::int FROM error_events),'latest',(SELECT max("occurredAt") FROM error_events),
   'codes',COALESCE((SELECT jsonb_agg(r ORDER BY count DESC,label) FROM (SELECT COALESCE("errorCode",'SEM_CODIGO') AS label,count(*)::int AS count FROM error_events GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 5) r),'[]'::jsonb),
   'routes',COALESCE((SELECT jsonb_agg(r ORDER BY count DESC,label) FROM (SELECT route AS label,count(*)::int AS count FROM error_events GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 5) r),'[]'::jsonb)),
 'routes',COALESCE((SELECT jsonb_agg(r ORDER BY count DESC,label) FROM (SELECT pathname AS label,count(*)::int AS count,count(DISTINCT "anonymousId")::int AS visitors,count(DISTINCT "sessionId")::int AS sessions FROM pages GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 12) r),'[]'::jsonb),
 'series',(SELECT jsonb_agg(jsonb_build_object('bucket',b.bucket AT TIME ZONE 'America/Sao_Paulo','views',COALESCE(s.views,0),'visitors',COALESCE(s.visitors,0),'sessions',COALESCE(s.sessions,0)) ORDER BY b.bucket) FROM buckets b LEFT JOIN series s USING(bucket)),
 'quality',jsonb_build_object('firstReceivedAt',(SELECT min("receivedAt") FROM "JourneyEvent"),'lastReceivedAt',(SELECT max("receivedAt") FROM "JourneyEvent"),
   'missingPageIdentity',(SELECT count(*)::int FROM pages WHERE "anonymousId" IS NULL OR "sessionId" IS NULL),
   'unlinkedConversions',(SELECT count(*)::int FROM scope WHERE "eventName" IN ('signup_completed','checkout_completed') AND "sessionId" IS NULL))
) AS data`
