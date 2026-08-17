import { NextResponse } from "next/server"

import { getLandingActivity } from "@/lib/landing-activity.server"

export const revalidate = 300

export async function GET() {
  try {
    const activity = await getLandingActivity()

    return NextResponse.json(activity, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    })
  } catch (error) {
    console.error("[landing-activity] Não foi possível carregar as métricas agregadas.", error)
    return NextResponse.json(
      { metrics: [], generatedAt: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
