import {
  getCosLaunchCapabilityStatus,
  type CosLaunchCapabilityStatus,
} from "@/lib/cos/launch-capabilities"
import type { CosCapabilityId } from "@/lib/cos/types"

export type CosLaunchMenuGroupId = "skills" | "queries" | "help"

export type CosLaunchMenuSelection = {
  id: string
  groupId: CosLaunchMenuGroupId
  capabilityId: CosCapabilityId
  label: string
  message: string
  action: string
  creditCostPreview?: number
}

export type CosLaunchAttachmentOption = {
  id: "document"
  label: string
  accept: string
  multiple: false
}

const GROUPS: Array<{
  id: CosLaunchMenuGroupId
  label: string
  status: CosLaunchCapabilityStatus
}> = [
  { id: "skills", label: "Habilidades", status: "SUPPORTED" },
  { id: "queries", label: "Consultas", status: "READ_ONLY" },
  { id: "help", label: "Ajuda", status: "GUIDANCE_ONLY" },
]

const MENU_SELECTIONS: CosLaunchMenuSelection[] = [
  { id: "register_client", groupId: "skills", capabilityId: "lead.create", label: "Cadastrar cliente", message: "Quero cadastrar um cliente.", action: "createLead", creditCostPreview: 1 },
  { id: "create_property", groupId: "skills", capabilityId: "property.create", label: "Criar imóvel", message: "Quero criar um imóvel.", action: "createPropertyDraft", creditCostPreview: 3 },
  { id: "create_proposal", groupId: "skills", capabilityId: "proposal.create", label: "Criar proposta", message: "Quero criar uma proposta.", action: "CREATE_PROPOSAL", creditCostPreview: 2 },
  { id: "create_appointment", groupId: "skills", capabilityId: "agenda.create", label: "Criar compromisso", message: "Quero criar um compromisso.", action: "CREATE_AGENDA_EVENT", creditCostPreview: 1 },
  { id: "create_campaign", groupId: "skills", capabilityId: "studio.generateInstagram", label: "Criar campanha", message: "Quero criar uma campanha para Instagram.", action: "STUDIO_GENERATE_INSTAGRAM", creditCostPreview: 10 },
  { id: "search_property", groupId: "queries", capabilityId: "property.search", label: "Buscar imóvel", message: "Quero buscar um imóvel.", action: "searchProperties", creditCostPreview: 1 },
  { id: "find_client", groupId: "queries", capabilityId: "lead.find", label: "Localizar cliente", message: "Quero localizar um cliente.", action: "FIND_LEAD", creditCostPreview: 1 },
  { id: "today_agenda", groupId: "queries", capabilityId: "agenda.today", label: "Agenda de hoje", message: "Mostre minha agenda de hoje.", action: "LIST_AGENDA_TODAY", creditCostPreview: 1 },
  { id: "proposals", groupId: "queries", capabilityId: "proposal.summary", label: "Consultar propostas", message: "Mostre minhas propostas.", action: "LIST_PROPOSALS", creditCostPreview: 1 },
  { id: "contracts", groupId: "queries", capabilityId: "contract.list", label: "Consultar contratos", message: "Mostre meus contratos.", action: "LIST_CONTRACTS", creditCostPreview: 1 },
  { id: "performance_summary", groupId: "queries", capabilityId: "analytics.summary", label: "Resumo de desempenho", message: "Mostre um resumo do meu desempenho.", action: "getAnalyticsSummary", creditCostPreview: 1 },
  { id: "help_first_steps", groupId: "help", capabilityId: "help.first_steps", label: "Primeiros passos", message: "Quais são os primeiros passos para começar a usar o EME?", action: "help_first_steps", creditCostPreview: 0 },
  { id: "help_use_cos", groupId: "help", capabilityId: "help.use_cos", label: "Como usar o COS", message: "Como posso usar melhor o COS no dia a dia?", action: "help_use_cos", creditCostPreview: 0 },
  { id: "help_register_properties", groupId: "help", capabilityId: "help.register_properties", label: "Imóveis", message: "Como cadastrar e gerenciar imóveis no EME?", action: "help_register_properties", creditCostPreview: 0 },
  { id: "help_manage_clients", groupId: "help", capabilityId: "help.manage_clients", label: "Clientes", message: "Como gerenciar meus clientes no EME?", action: "help_manage_clients", creditCostPreview: 0 },
  { id: "help_contracts_proposals", groupId: "help", capabilityId: "help.contracts_proposals", label: "Contratos e propostas", message: "Como funcionam contratos e propostas no EME?", action: "help_contracts_proposals", creditCostPreview: 0 },
  { id: "help_marketing_studio", groupId: "help", capabilityId: "help.marketing_studio", label: "Studio IA", message: "Como usar o Studio IA do EME?", action: "help_marketing_studio", creditCostPreview: 0 },
  { id: "help_general_question", groupId: "help", capabilityId: "help.general_question", label: "Dúvidas sobre o EME", message: "Preciso de ajuda para entender uma funcionalidade do EME.", action: "help_general_question", creditCostPreview: 0 },
]

function isSelectionAvailable(selection: CosLaunchMenuSelection) {
  const group = GROUPS.find((item) => item.id === selection.groupId)
  return Boolean(group && getCosLaunchCapabilityStatus(selection.capabilityId) === group.status)
}

export function getCosLaunchMenuGroups() {
  return GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: MENU_SELECTIONS
      .filter((selection) => selection.groupId === group.id && isSelectionAvailable(selection))
      .map(({ id, label }) => ({ id, label })),
  })).filter((group) => group.items.length > 0)
}

export function getCosLaunchMenuSelection(id: string) {
  const selection = MENU_SELECTIONS.find((item) => item.id === id)
  return selection && isSelectionAvailable(selection) ? selection : null
}

export function getCosLaunchAttachmentOptions(): CosLaunchAttachmentOption[] {
  if (getCosLaunchCapabilityStatus("lead.attach_document") !== "SUPPORTED") return []
  return [{ id: "document", label: "Documento", accept: "application/pdf,.pdf", multiple: false }]
}
