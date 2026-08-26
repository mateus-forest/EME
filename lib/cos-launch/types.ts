export type CosLaunchIntent =
  | "list_properties" | "list_clients" | "list_contracts" | "list_proposals" | "list_documents" | "agenda_today"
  | "create_property" | "create_client" | "create_contract" | "create_proposal" | "create_agenda" | "attach_document"
  | "help_properties" | "help_clients" | "help_contracts" | "help_proposals" | "help_studio" | "help_catalog"
  | "help_marketplace" | "help_plan_account" | "help_cos" | "new_conversation" | "unknown"

export type CosLaunchCardKind = "property" | "client" | "contract" | "proposal" | "document" | "agenda"
export type CosLaunchCard = {
  kind: CosLaunchCardKind
  id: string
  title: string
  subtitle?: string
  imageUrl?: string
  status?: string
  meta: Array<{ label: string; value: string }>
  href: string
  ctaLabel: string
}
export type CosLaunchOption = { id: string; label: string; subtitle?: string }
export type CosLaunchFormKind = "property" | "client" | "proposal" | "contract" | "agenda" | "document"
export type CosLaunchForm = {
  kind: CosLaunchFormKind
  title: string
  description: string
  submitLabel: string
  clients?: CosLaunchOption[]
  properties?: CosLaunchOption[]
}
export type CosLaunchAction = { id: string; label: string; href?: string }
export type CosLaunchResponse = {
  message: string
  cards?: CosLaunchCard[]
  form?: CosLaunchForm
  actions?: CosLaunchAction[]
  elapsedMs?: number
  credits?: { balance: number; usedThisMonth: number }
}
export type CosLaunchRequest = { message?: string; action?: string; payload?: Record<string, unknown> }
