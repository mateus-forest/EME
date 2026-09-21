import { NextRequest } from "next/server"
import { z } from "zod"
import { partnerRoute, partnerBody } from "@/lib/partners/route"
import { updateReferral } from "@/lib/partners/service"
export const dynamic = "force-dynamic"
export function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return partnerRoute(req, async brokerId => ({ referral: await updateReferral(brokerId,
    z.string().min(1).max(100).parse((await context.params).id), await partnerBody(req)) }))
}
