import type { CosCapabilityId } from "@/lib/cos/types"

export type CosLaunchCapabilityStatus =
  | "SUPPORTED"
  | "READ_ONLY"
  | "GUIDANCE_ONLY"
  | "NOT_AVAILABLE"

export const COS_LAUNCH_CAPABILITY_IDS = {
  SUPPORTED: [
    "agenda.cancel",
    "agenda.complete",
    "agenda.create",
    "agenda.update",
    "catalog.unpublish",
    "contract.cancel",
    "contract.create",
    "contract.sign",
    "contract.update",
    "lead.attach_document",
    "lead.convert",
    "lead.create",
    "lead.delete",
    "lead.update",
    "property.create",
    "property.media.update",
    "property.publish",
    "property.unpublish",
    "proposal.create",
    "studio.generateCampaign",
    "studio.generateInstagram",
    "studio.regenerate",
  ],
  READ_ONLY: [
    "agenda.list",
    "agenda.month",
    "agenda.today",
    "agenda.week",
    "analytics.leads",
    "analytics.performance",
    "analytics.properties",
    "analytics.sales",
    "analytics.summary",
    "catalog.analyze",
    "catalog.share",
    "catalog.stats",
    "catalog.summary",
    "contract.download",
    "contract.get",
    "contract.history",
    "contract.list",
    "contract.preview",
    "document.get",
    "document.list",
    "lead.find",
    "lead.summarize",
    "lead.summary",
    "lead.timeline",
    "operation.summary",
    "property.get",
    "property.price.suggest",
    "property.search",
    "proposal.summary",
    "studio.generateDescription",
    "studio.generateStory",
  ],
  GUIDANCE_ONLY: [
    "general.chat",
    "help.contracts_proposals",
    "help.first_steps",
    "help.general_question",
    "help.manage_clients",
    "help.marketing_studio",
    "help.register_properties",
    "help.use_cos",
  ],
  NOT_AVAILABLE: [
    "catalog.publish",
    "contract.send",
    "finance.cashflow",
    "finance.commission",
    "finance.forecast",
    "finance.payable",
    "finance.receivable",
    "finance.summary",
    "property.archive",
    "property.description.improve",
    "studio.generateFacebook",
    "studio.generateVideo",
    "studio.improveText",
  ],
} as const satisfies Record<CosLaunchCapabilityStatus, readonly CosCapabilityId[]>

const STATUS_BY_CAPABILITY = new Map<CosCapabilityId, CosLaunchCapabilityStatus>()

for (const [status, capabilityIds] of Object.entries(COS_LAUNCH_CAPABILITY_IDS) as Array<
  [CosLaunchCapabilityStatus, readonly CosCapabilityId[]]
>) {
  for (const capabilityId of capabilityIds) STATUS_BY_CAPABILITY.set(capabilityId, status)
}

export const COS_LAUNCH_NOT_AVAILABLE_MESSAGE =
  "Ainda não consigo executar essa ação diretamente por aqui. Posso te orientar sobre como fazer no EME."

export function getCosLaunchCapabilityStatus(capabilityId: CosCapabilityId | string): CosLaunchCapabilityStatus {
  return STATUS_BY_CAPABILITY.get(capabilityId as CosCapabilityId) ?? "NOT_AVAILABLE"
}

export function canInvokeCosLaunchCapability(capabilityId: CosCapabilityId | string) {
  return getCosLaunchCapabilityStatus(capabilityId) !== "NOT_AVAILABLE"
}

export function listCosLaunchCapabilityIds() {
  return Array.from(STATUS_BY_CAPABILITY.keys())
}
