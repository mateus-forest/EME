export type FinancialHealthInput = {
  receipts: Array<{
    id: string
    source: string
    status: string
  }>
  expenses: Array<{
    id: string
    status: string
  }>
  commissions: Array<{
    id: string
    client: unknown | null
    property: unknown | null
  }>
  activeRentals: Array<{
    id: string
    paymentCount: number
  }>
}

export type FinancialHealthResult = {
  score: number
  trackedRecords: number
  expectedReceipts: number
  overdueReceipts: number
  pendingExpenses: number
  incompleteRecords: number
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}

export function calculateFinancialOperationHealth(input: FinancialHealthInput): FinancialHealthResult {
  const expectedReceipts = input.receipts.filter((receipt) => receipt.status === "EXPECTED").length
  const overdueReceipts = input.receipts.filter((receipt) => receipt.status === "OVERDUE").length
  const pendingExpenses = input.expenses.filter((expense) => expense.status === "PENDING").length
  const incompleteCommissions = input.commissions.filter(
    (commission) => !commission.client || !commission.property,
  )
  const rentalsWithoutSchedule = input.activeRentals.filter((rental) => rental.paymentCount === 0)
  const attentionKeys = new Set<string>()

  input.receipts.forEach((receipt) => {
    if (receipt.status === "OVERDUE") attentionKeys.add(`receipt:${receipt.source}:${receipt.id}`)
  })
  input.expenses.forEach((expense) => {
    if (expense.status === "PENDING") attentionKeys.add(`expense:${expense.id}`)
  })
  incompleteCommissions.forEach((commission) => {
    attentionKeys.add(`receipt:COMMISSION:${commission.id}`)
  })
  rentalsWithoutSchedule.forEach((rental) => {
    attentionKeys.add(`rental:${rental.id}`)
  })

  const trackedRecords = input.receipts.length + input.expenses.length
  const evaluatedRecords = trackedRecords + rentalsWithoutSchedule.length
  const score = evaluatedRecords === 0
    ? 100
    : clampScore(Math.round(((evaluatedRecords - attentionKeys.size) / evaluatedRecords) * 100))

  return {
    score,
    trackedRecords,
    expectedReceipts,
    overdueReceipts,
    pendingExpenses,
    incompleteRecords: incompleteCommissions.length + rentalsWithoutSchedule.length,
  }
}
