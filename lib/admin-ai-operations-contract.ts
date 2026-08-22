export type AdminAiCostState = "recorded" | "unavailable"

export type AdminAiOperationRow = {
  id: string
  provider: string
  model: string
  module: string
  operation: string
  category: "Texto" | "Imagem" | "Vídeo" | "Outro"
  userName: string
  userEmail: string | null
  quantity: number
  credits: number
  costBrl: number | null
  costUsd: number | null
  costState: AdminAiCostState
  status: string
  createdAt: string
}

export type AdminAiBreakdown = {
  label: string
  operations: number
  credits: number
  costBrl: number
  unpricedOperations: number
}

export type AdminAiOperationsReport = {
  generatedAt: string
  periodDays: number
  truncated: boolean
  summary: {
    operations: number
    credits: number
    recordedCostBrl: number
    recordedCostUsd: number
    activeUsers: number
    unpricedOperations: number
  }
  providers: AdminAiBreakdown[]
  categories: AdminAiBreakdown[]
  operations: AdminAiOperationRow[]
}
