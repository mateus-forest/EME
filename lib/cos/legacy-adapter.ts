export type CosLegacyDependencyInventoryItem = {
  area: "decision" | "execution" | "response" | "pending_context"
  dependency: "inferAssessorAction" | "runLegacyAssessorAction" | "generateAssessorText" | "getPendingAssessorContext"
  status: "migrated" | "residual"
  callers: string[]
  migrationTarget: string
  note: string
  remainingWork: string | null
}

const COS_LEGACY_DEPENDENCY_INVENTORY: CosLegacyDependencyInventoryItem[] = [
  {
    area: "decision",
    dependency: "inferAssessorAction",
    status: "migrated",
    callers: [],
    migrationTarget: "Intent Resolver -> Planner -> Execution Planner",
    note: "A decisão oficial do COS agora depende apenas do pipeline novo.",
    remainingWork: null,
  },
  {
    area: "execution",
    dependency: "runLegacyAssessorAction",
    status: "migrated",
    callers: [],
    migrationTarget: "Workflow Engine -> Capability Handlers -> Executor",
    note: "O executor não possui mais fallback operacional para o motor legado.",
    remainingWork: null,
  },
  {
    area: "pending_context",
    dependency: "getPendingAssessorContext",
    status: "migrated",
    callers: [],
    migrationTarget: "workflow persistido + pendingInput + conversation memory",
    note: "A continuidade passou a ser controlada apenas pelo estado persistido do workflow.",
    remainingWork: null,
  },
  {
    area: "response",
    dependency: "generateAssessorText",
    status: "migrated",
    callers: [],
    migrationTarget: "Response Formatter + handlers do novo engine",
    note: "As respostas finais não utilizam mais a camada textual legada.",
    remainingWork: null,
  },
]

export function getCosLegacyDependencyInventory() {
  return COS_LEGACY_DEPENDENCY_INVENTORY.map((item) => ({
    ...item,
    callers: [...item.callers],
  }))
}
