import "server-only"
import { executeCosLaunchAction } from "@/lib/cos-launch/actions"
import { buildCosLaunchForm } from "@/lib/cos-launch/forms"
import { getCosLaunchHelp } from "@/lib/cos-launch/help"
import { resolveCosLaunchIntent } from "@/lib/cos-launch/intent"
import { routeGuidedCosLaunchQuery } from "@/lib/cos-launch/queries"
import type { CosLaunchFormKind, CosLaunchIntent, CosLaunchRequest, CosLaunchResponse } from "@/lib/cos-launch/types"

const formByIntent: Partial<Record<CosLaunchIntent, CosLaunchFormKind>> = { create_property: "property", create_client: "client", create_contract: "contract", create_proposal: "proposal", create_agenda: "agenda", attach_document: "document" }
async function query(intent: CosLaunchIntent, brokerId: string): Promise<CosLaunchResponse | null> { const actionByIntent: Partial<Record<CosLaunchIntent, string>> = { list_properties: "query:properties", list_clients: "query:clients", list_contracts: "query:contracts", list_proposals: "query:proposals", list_documents: "query:documents", agenda_today: "query:agenda" }; const action = actionByIntent[intent]; return action ? routeGuidedCosLaunchQuery(action, brokerId) : null }
function intentFromAction(action: string): CosLaunchIntent | null { const map: Record<string, CosLaunchIntent> = { "query:properties": "list_properties", "query:clients": "list_clients", "query:contracts": "list_contracts", "query:proposals": "list_proposals", "query:documents": "list_documents", "query:agenda": "agenda_today", "form:property": "create_property", "form:client": "create_client", "form:contract": "create_contract", "form:proposal": "create_proposal", "form:agenda": "create_agenda", "form:document": "attach_document", "help:properties": "help_properties", "help:clients": "help_clients", "help:contracts": "help_contracts", "help:proposals": "help_proposals", "help:studio": "help_studio", "help:catalog": "help_catalog", "help:marketplace": "help_marketplace", "help:plan-account": "help_plan_account", "help:cos": "help_cos", "conversation:new": "new_conversation" }; return map[action] ?? null }

export async function routeCosLaunch(input: { brokerId: string; userId: string; request: CosLaunchRequest }): Promise<CosLaunchResponse> {
  const startedAt = Date.now(); const action = input.request.action?.trim() ?? ""
  if (action.startsWith("submit:")) { const kind = action.slice(7) as CosLaunchFormKind; const allowed: CosLaunchFormKind[] = ["property", "client", "proposal", "contract", "agenda", "document"]; if (!allowed.includes(kind)) return { message: "Esta ação não está disponível." }; const response = await executeCosLaunchAction({ kind, brokerId: input.brokerId, userId: input.userId, payload: input.request.payload ?? {} }); return { ...response, elapsedMs: Date.now() - startedAt } }
  const intent = intentFromAction(action) ?? resolveCosLaunchIntent(input.request.message ?? "")
  if (intent === "new_conversation") return { message: "Nova conversa iniciada.", elapsedMs: Date.now() - startedAt }
  const guided = action ? await routeGuidedCosLaunchQuery(action, input.brokerId) : null
  if (guided) return { ...guided, elapsedMs: Date.now() - startedAt }
  const found = await query(intent, input.brokerId); if (found) return { ...found, elapsedMs: Date.now() - startedAt }
  const kind = formByIntent[intent]; if (kind) return { message: "Preencha os campos abaixo para continuar.", form: await buildCosLaunchForm(input.brokerId, kind), elapsedMs: Date.now() - startedAt }
  return { ...getCosLaunchHelp(intent), elapsedMs: Date.now() - startedAt }
}
