export type FinancialAccountBalanceEntry = {
  accountId: string | null
  direction: string
  status: string
  amount: number
  occurredAt: Date | null
}

export function calculateFinancialAccountBalance(
  accountId: string,
  initialBalance: number,
  entries: FinancialAccountBalanceEntry[],
) {
  return entries.reduce((balance, entry) => {
    if (entry.accountId !== accountId) return balance
    if (entry.direction === "INCOME" && (entry.status === "RECEIVED" || entry.occurredAt)) return balance + entry.amount
    if (entry.direction === "EXPENSE" && (entry.status === "PAID" || entry.occurredAt)) return balance - entry.amount
    return balance
  }, initialBalance)
}
