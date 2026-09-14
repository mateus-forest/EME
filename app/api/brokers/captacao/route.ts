import { NextRequest } from "next/server"
import { z } from "zod"
import { body, captacaoRoute } from "@/lib/captacao/route"
import { configured, listCaptures, saveCapture } from "@/lib/captacao/service"
export const dynamic = "force-dynamic"
export function GET(req: NextRequest) {
  return captacaoRoute(req, async (brokerId) => ({
    configured: configured(),
    ...(await listCaptures(
      brokerId,
      z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .parse(req.nextUrl.searchParams.get("offset") ?? 0),
    )),
  }))
}
export function POST(req: NextRequest) {
  return captacaoRoute(req, async (brokerId) => ({
    capture: await saveCapture(
      brokerId,
      z
        .object({ receipt: z.string().max(24000) })
        .strict()
        .parse(await body(req)).receipt,
    ),
  }))
}
