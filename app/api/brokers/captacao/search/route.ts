import { NextRequest } from "next/server"
import { searchSchema, possibleDuplicates } from "@/lib/captacao/contract"
import { body, captacaoRoute } from "@/lib/captacao/route"
import { configured, runQuery } from "@/lib/captacao/service"
import { ProviderError } from "@/lib/captacao/gecko"
export const maxDuration = 60
export function POST(req: NextRequest) {
  return captacaoRoute(req, async (brokerId) => {
    const input = searchSchema.parse(await body(req))
    if (!configured())
      throw new ProviderError(
        "NOT_CONFIGURED",
        "Integração não configurada. Configure a chave GeckoAPI no servidor para buscar anúncios reais.",
      )
    const results = await Promise.all(
      [...new Set(input.sources)].map(async (source) => {
        try {
          return {
            status: "ok" as const,
            ...(await runQuery(brokerId, source, input.filters, input.page)),
          }
        } catch (e) {
          return {
            source,
            status: "error" as const,
            code: e instanceof ProviderError ? e.code : "SOURCE_UNAVAILABLE",
            error:
              e instanceof ProviderError
                ? e.message
                : "Não foi possível consultar esta fonte.",
          }
        }
      }),
    )
    const items = possibleDuplicates(
      results.flatMap((r) => (r.status === "ok" ? r.items : [])),
    )
    return {
      results,
      items,
      partial: results.some((r) => r.status === "error"),
      coverage:
        "Resultados das páginas consultadas; não representam todos os imóveis da região.",
    }
  })
}
