import "server-only"
import { getCosLaunchFinancialFormOptions } from "@/lib/cos-launch/finance"
import type { CosLaunchForm, CosLaunchFormKind } from "@/lib/cos-launch/types"
import { getFormOptions } from "@/lib/cos-launch/queries"

const copy: Record<CosLaunchFormKind, Pick<CosLaunchForm, "title" | "description" | "submitLabel">> = {
  property: { title: "Cadastrar imóvel", description: "Envie as fotos e conte os principais detalhes por texto ou áudio. O COS cria o rascunho e você pode completar as informações depois.", submitLabel: "Criar rascunho" },
  client: { title: "Cadastrar cliente", description: "Registre o contato e, se quiser, relacione um imóvel da carteira.", submitLabel: "Cadastrar cliente" },
  proposal: { title: "Criar proposta", description: "Selecione cliente e imóvel e informe as condições principais.", submitLabel: "Criar proposta" },
  contract: { title: "Criar contrato", description: "O COS criará um rascunho para revisão no EME.", submitLabel: "Criar contrato" },
  agenda: { title: "Criar compromisso", description: "Registre data, horário e vínculos opcionais na agenda interna.", submitLabel: "Criar compromisso" },
  document: { title: "Anexar documento", description: "Nesta versão, o COS anexa documentos PDF a clientes cadastrados.", submitLabel: "Anexar documento" },
  financial_income: { title: "Novo recebimento", description: "Registre um recebimento operacional com vínculos opcionais a cliente, imóvel e conta.", submitLabel: "Registrar recebimento" },
  financial_expense: { title: "Nova despesa", description: "Registre uma despesa operacional com vínculos opcionais a cliente, imóvel e conta.", submitLabel: "Registrar despesa" },
  financial_commission: { title: "Nova comissão", description: "Selecione cliente e imóvel. O valor da comissão será calculado automaticamente.", submitLabel: "Registrar comissão" },
}
export async function buildCosLaunchForm(brokerId: string, kind: CosLaunchFormKind): Promise<CosLaunchForm> {
  if (["financial_income", "financial_expense", "financial_commission"].includes(kind)) {
    const options = await getCosLaunchFinancialFormOptions(brokerId)
    return {
      kind,
      ...copy[kind],
      clients: options.clients,
      properties: options.properties,
      accounts: kind === "financial_commission" ? undefined : options.accounts,
      defaults: {
        status: kind === "financial_expense" ? "PENDING" : "EXPECTED",
        ...(kind === "financial_commission"
          ? { commissionPercent: String(options.commissionPercent) }
          : {}),
      },
    }
  }

  const options = kind === "property"
    ? { clients: [], properties: [] }
    : await getFormOptions(brokerId)
  return {
    kind,
    ...copy[kind],
    clients: kind === "client" || kind === "property" ? undefined : options.clients,
    properties: kind === "document" || kind === "property" ? undefined : options.properties,
  }
}
