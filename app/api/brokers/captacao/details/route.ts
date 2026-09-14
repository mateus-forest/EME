import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { z } from "zod"
import { body, captacaoRoute } from "@/lib/captacao/route"
import {
  readReceipt,
  runQuery,
  getCapture,
  receipt,
} from "@/lib/captacao/service"
import type { Listing } from "@/lib/captacao/contract"
export const maxDuration = 60
export function POST(req: NextRequest) {
  return captacaoRoute(req, async (brokerId) => {
    const data = z
      .object({
        receipt: z.string().max(24000).optional(),
        captureId: z.string().max(120).optional(),
        refresh: z.boolean().default(false),
      })
      .strict()
      .parse(await body(req))
    const listing = data.captureId
      ? ((await getCapture(brokerId, data.captureId))
          .listing as unknown as Listing)
      : readReceipt(data.receipt, brokerId)
    const saved = await prisma.captacao.findUnique({
      where: { brokerId_sourceKey: { brokerId, sourceKey: listing.key } },
    })
    const capture = saved ? await getCapture(brokerId, saved.id) : null
    if (!data.refresh)
      return {
        listing: { ...listing, receipt: receipt(listing, brokerId) },
        capture,
      }
    return {
      listing: (await runQuery(brokerId, listing.source, undefined, 1, listing))
        .items[0],
    }
  })
}
