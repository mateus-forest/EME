import "server-only"

import { unstable_cache } from "next/cache"

import {
  buildLandingActivityMetrics,
  type LandingActivityCounts,
  type LandingActivityResponse,
} from "@/lib/landing-activity"
import { prisma } from "@/lib/prisma"

type AggregateValue = bigint | number | string

type LandingActivityAggregateRow = {
  properties_today: AggregateValue
  properties_seven_days: AggregateValue
  properties_thirty_days: AggregateValue
  properties_total: AggregateValue
  proposals_today: AggregateValue
  proposals_seven_days: AggregateValue
  proposals_thirty_days: AggregateValue
  proposals_total: AggregateValue
  studio_today: AggregateValue
  studio_seven_days: AggregateValue
  studio_thirty_days: AggregateValue
  studio_total: AggregateValue
  cities_today: AggregateValue
  cities_seven_days: AggregateValue
  cities_thirty_days: AggregateValue
  cities_total: AggregateValue
}

function toCount(value: AggregateValue | undefined) {
  const count = Number(value ?? 0)
  return Number.isSafeInteger(count) && count > 0 ? count : 0
}

async function queryLandingActivity(): Promise<LandingActivityResponse> {
  const rows = await prisma.$queryRaw<LandingActivityAggregateRow[]>`
    WITH bounds AS (
      SELECT
        ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo') AS today_start,
        (((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date - 6) AT TIME ZONE 'America/Sao_Paulo') AS seven_start,
        (((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date - 29) AT TIME ZONE 'America/Sao_Paulo') AS thirty_start
    ),
    property_activity AS (
      SELECT
        COUNT(*) FILTER (WHERE p."marketplacePublished" = true AND p."marketplacePublishedAt" >= b.today_start) AS properties_today,
        COUNT(*) FILTER (WHERE p."marketplacePublished" = true AND p."marketplacePublishedAt" >= b.seven_start) AS properties_seven_days,
        COUNT(*) FILTER (WHERE p."marketplacePublished" = true AND p."marketplacePublishedAt" >= b.thirty_start) AS properties_thirty_days,
        COUNT(*) FILTER (WHERE p."published" = true OR p."status" = 'PUBLISHED' OR p."marketplacePublished" = true) AS properties_total,
        COUNT(DISTINCT LOWER(TRIM(p."city"))) FILTER (WHERE p."marketplacePublished" = true AND p."marketplacePublishedAt" >= b.today_start AND TRIM(p."city") <> '') AS cities_today,
        COUNT(DISTINCT LOWER(TRIM(p."city"))) FILTER (WHERE p."marketplacePublished" = true AND p."marketplacePublishedAt" >= b.seven_start AND TRIM(p."city") <> '') AS cities_seven_days,
        COUNT(DISTINCT LOWER(TRIM(p."city"))) FILTER (WHERE p."marketplacePublished" = true AND p."marketplacePublishedAt" >= b.thirty_start AND TRIM(p."city") <> '') AS cities_thirty_days,
        COUNT(DISTINCT LOWER(TRIM(p."city"))) FILTER (WHERE (p."published" = true OR p."status" = 'PUBLISHED' OR p."marketplacePublished" = true) AND TRIM(p."city") <> '') AS cities_total
      FROM "Property" p
      INNER JOIN "Broker" broker ON broker."id" = p."brokerId" AND broker."status" = 'ACTIVE'
      CROSS JOIN bounds b
    ),
    proposal_activity AS (
      SELECT
        COUNT(*) FILTER (WHERE d."createdAt" >= b.today_start) AS proposals_today,
        COUNT(*) FILTER (WHERE d."createdAt" >= b.seven_start) AS proposals_seven_days,
        COUNT(*) FILTER (WHERE d."createdAt" >= b.thirty_start) AS proposals_thirty_days,
        COUNT(*) AS proposals_total
      FROM "BrokerDocument" d
      CROSS JOIN bounds b
      WHERE LOWER(d."type") = 'proposal'
    ),
    studio_activity AS (
      SELECT
        COUNT(*) FILTER (WHERE a."createdAt" >= b.today_start) AS studio_today,
        COUNT(*) FILTER (WHERE a."createdAt" >= b.seven_start) AS studio_seven_days,
        COUNT(*) FILTER (WHERE a."createdAt" >= b.thirty_start) AS studio_thirty_days,
        COUNT(*) AS studio_total
      FROM "StudioCampaignAsset" a
      CROSS JOIN bounds b
      WHERE (a."fileUrl" IS NOT NULL OR a."content" IS NOT NULL)
        AND a."status" <> 'FAILED'
        AND COALESCE(a."content"->>'internalType', '') <> 'idempotency_lock'
    )
    SELECT *
    FROM property_activity
    CROSS JOIN proposal_activity
    CROSS JOIN studio_activity
  `

  const row = rows[0]
  const counts: LandingActivityCounts = {
    properties: {
      today: toCount(row?.properties_today),
      sevenDays: toCount(row?.properties_seven_days),
      thirtyDays: toCount(row?.properties_thirty_days),
      total: toCount(row?.properties_total),
    },
    proposals: {
      today: toCount(row?.proposals_today),
      sevenDays: toCount(row?.proposals_seven_days),
      thirtyDays: toCount(row?.proposals_thirty_days),
      total: toCount(row?.proposals_total),
    },
    studioMaterials: {
      today: toCount(row?.studio_today),
      sevenDays: toCount(row?.studio_seven_days),
      thirtyDays: toCount(row?.studio_thirty_days),
      total: toCount(row?.studio_total),
    },
    cities: {
      today: toCount(row?.cities_today),
      sevenDays: toCount(row?.cities_seven_days),
      thirtyDays: toCount(row?.cities_thirty_days),
      total: toCount(row?.cities_total),
    },
  }

  return {
    metrics: buildLandingActivityMetrics(counts),
    generatedAt: new Date().toISOString(),
  }
}

export const getLandingActivity = unstable_cache(queryLandingActivity, ["landing-activity-v1"], {
  revalidate: 300,
  tags: ["landing-activity"],
})
