import { NextRequest } from "next/server"
import { body, captacaoRoute } from "@/lib/captacao/route"
import { inventoryCandidates, mutateCapture } from "@/lib/captacao/service"
type Context = { params: Promise<{ id: string }> }
export function GET(req: NextRequest, ctx: Context) {
  return captacaoRoute(req, async (brokerId) =>
    inventoryCandidates(brokerId, (await ctx.params).id),
  )
}
export function PATCH(req: NextRequest, ctx: Context) {
  return captacaoRoute(req, async (brokerId) => ({
    capture: await mutateCapture(
      brokerId,
      (await ctx.params).id,
      await body(req),
    ),
  }))
}
