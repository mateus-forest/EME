import { getBrokerFinancialSnapshot } from "@/lib/broker-finance"
import { formatAssessorPropertyPrice } from "@/lib/eme-backend"

import type { CosCapabilityHandler } from "@/lib/cos/types"

export const financialSummaryCapability: CosCapabilityHandler = async ({ brokerId }) => {
  const snapshot = await getBrokerFinancialSnapshot(brokerId)
  const { portfolio, summary } = snapshot

  return {
    response: `Resumo financeiro operacional:\n\n• Valor da carteira: ${formatAssessorPropertyPrice(summary.portfolioValue)} (${portfolio.totalProperties} imóveis)\n• Recebido neste mês: ${formatAssessorPropertyPrice(summary.receivedThisMonth)}\n• Gasto neste mês: ${formatAssessorPropertyPrice(summary.expensesThisMonth)}\n• Resultado do mês: ${formatAssessorPropertyPrice(summary.monthResult)}\n• A receber: ${formatAssessorPropertyPrice(summary.receivable)}\n• Atrasado: ${formatAssessorPropertyPrice(summary.overdue)}\n\nO valor da carteira é um indicador operacional e não entra no resultado.`,
    metadata: { ...summary, ...portfolio },
  }
}
