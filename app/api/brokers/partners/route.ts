import { NextRequest } from "next/server"
import { z } from "zod"
import { partnerRoute, partnerBody } from "@/lib/partners/route"
import { createReferral, listReferrals } from "@/lib/partners/service"
export const dynamic = "force-dynamic"
export function GET(req: NextRequest) {
  return partnerRoute(req, brokerId => listReferrals(brokerId,
    z.coerce.number().int().min(0).max(100000).parse(req.nextUrl.searchParams.get("offset") ?? 0)))
}
export function POST(req: NextRequest) {
  return partnerRoute(req, async brokerId => ({ referral: await createReferral(brokerId, await partnerBody(req)) }))
}
