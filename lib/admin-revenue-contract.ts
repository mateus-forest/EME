export type AdminChargeType = "Assinatura" | "Créditos IA" | "Expansão da Carteira" | "Pacote extra"

export type AdminBillingCharge = {
  id: string
  userName: string
  userEmail: string
  description: string
  type: AdminChargeType
  amountCents: number
  currency: string
  createdAt: string
  status: string
  stripeReference: string
  receiptUrl: string | null
  quantity: number | null
}

export type AdminRevenueReport = {
  generatedAt: string
  overview: {
    monthlyRevenueCents: number
    recurringRevenueCents: number
    oneOffRevenueCents: number
    creditsSold: number
    expansionsSold: number
    averageTicketCents: number
  }
  charges: AdminBillingCharge[]
}
