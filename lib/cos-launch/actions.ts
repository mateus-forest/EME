import "server-only"
import { normalizeCosActionResult } from "@/lib/cos/action-result"
import { getCosCapabilityDescriptorById, getCosEntityModuleIdByCapabilityId } from "@/lib/cos/capability-catalog"
import { capabilityHandlers } from "@/lib/cos/capability-handlers"
import { mapAttachmentDraftToPendingPropertyData } from "@/lib/cos/attachment-analysis"
import { normalizeCosAttachments, runCosAttachmentPipeline } from "@/lib/cos/attachment-pipeline"
import { canInvokeCosLaunchCapability } from "@/lib/cos/launch-capabilities"
import type { CosCapabilityId, CosRuntimeActionResult } from "@/lib/cos/types"
import type { CosLaunchCard, CosLaunchFormKind } from "@/lib/cos-launch/types"
import { getAgendaCard, getClientCard, getDocumentCard, getPropertyCard } from "@/lib/cos-launch/queries"
import { createCosLaunchFinancialRecord } from "@/lib/cos-launch/finance"
import { consumeBrokerAiCredits, createInsufficientCreditsPayload, getBrokerAiCreditBalance, getCosInteractionCreditCost } from "@/lib/eme-plan-service"

const capabilityByForm: Partial<Record<CosLaunchFormKind, CosCapabilityId>> = { client: "lead.create", property: "property.create", proposal: "proposal.create", contract: "contract.create", agenda: "agenda.create", document: "lead.attach_document" }
const value = (payload: Record<string, unknown>, key: string) => typeof payload[key] === "string" ? (payload[key] as string).trim() : ""
function actionMessage(kind: CosLaunchFormKind, payload: Record<string, unknown>) { if (kind === "client") return `Cadastre o cliente ${value(payload, "name")} com WhatsApp ${value(payload, "phone")}.`; if (kind === "property") return `Crie um rascunho de imóvel com estes detalhes: ${value(payload, "description")}.`; if (kind === "proposal") return `Crie uma proposta para o cliente e imóvel selecionados no valor de ${value(payload, "value")}.`; if (kind === "contract") return `Crie um rascunho de contrato do tipo ${value(payload, "contractType") || "Contrato imobiliário"}.`; if (kind === "agenda") return `Crie o compromisso ${value(payload, "title")} em ${value(payload, "date")} às ${value(payload, "time")}.`; return `Anexe o documento ${value(payload, "fileName") || "selecionado"} ao cliente selecionado.` }
function metadataId(result: CosRuntimeActionResult, keys: string[]) { for (const key of keys) { const candidate = result.metadata[key]; if (typeof candidate === "string" && candidate) return candidate } return null }
async function resultCard(kind: CosLaunchFormKind, brokerId: string, result: CosRuntimeActionResult): Promise<CosLaunchCard | null> { if (kind === "property") { const id = result.propertyId ?? metadataId(result, ["propertyId"]); return id ? getPropertyCard(brokerId, id) : null } if (kind === "client") { const id = result.leadId ?? metadataId(result, ["leadId"]); return id ? getClientCard(brokerId, id) : null } if (kind === "agenda") { const id = metadataId(result, ["agendaEventId", "eventId"]); return id ? getAgendaCard(brokerId, id) : null } const id = metadataId(result, ["documentId", "proposalId", "contractId"]); return id ? getDocumentCard(brokerId, id) : null }

export async function executeCosLaunchAction(input: { kind: CosLaunchFormKind; brokerId: string; userId: string; payload: Record<string, unknown> }) {
  if (input.kind === "financial_income" || input.kind === "financial_expense" || input.kind === "financial_commission") {
    return createCosLaunchFinancialRecord({ ...input, kind: input.kind })
  }
  const capabilityId = capabilityByForm[input.kind]
  if (!capabilityId) return { message: "Ainda não consigo executar essa ação diretamente por aqui.", cards: [] as CosLaunchCard[] }
  const descriptor = getCosCapabilityDescriptorById(capabilityId); const entity = getCosEntityModuleIdByCapabilityId(capabilityId); const handler = capabilityHandlers[capabilityId]
  if (!descriptor || !entity || !handler || !canInvokeCosLaunchCapability(capabilityId)) return { message: "Ainda não consigo executar essa ação diretamente por aqui.", cards: [] as CosLaunchCard[] }
  const cost = getCosInteractionCreditCost([descriptor.action]); const balance = await getBrokerAiCreditBalance(input.brokerId)
  if (cost > 0 && balance.balance < cost) { const blocked = createInsufficientCreditsPayload({ availableCredits: balance.balance, requiredCredits: cost }); return { message: blocked.error, cards: [] as CosLaunchCard[], actions: [{ id: "open:plan", label: blocked.ctaLabel, href: blocked.ctaHref }], credits: { balance: balance.balance, usedThisMonth: balance.usedThisMonth } } }
  let preparedPayload = input.payload
  let preparedMessage = actionMessage(input.kind, input.payload)
  if (input.kind === "property") {
    const attachments = normalizeCosAttachments(input.payload.attachments)
    preparedPayload = { ...input.payload, allowIncompleteDraft: true }
    if (attachments.length > 0) {
      const analysis = await runCosAttachmentPipeline({
        message: preparedMessage,
        requestedAction: descriptor.action,
        attachments,
      })
      if (analysis.primaryPropertyDraft) {
        preparedPayload = {
          ...mapAttachmentDraftToPendingPropertyData(
            analysis.primaryPropertyDraft,
            preparedMessage,
            analysis.imageUrl,
          ),
          ...preparedPayload,
        }
      }
      preparedMessage = analysis.executionMessage
    }
  }
  const raw = await handler({ brokerId: input.brokerId, userId: input.userId, message: preparedMessage, action: descriptor.action, confirm: true, payload: preparedPayload, pendingInput: null, context: null })
  const result = normalizeCosActionResult({ result: raw, action: descriptor.action, entity })
  if (result.status !== "success") return { message: result.response, cards: [] as CosLaunchCard[], credits: { balance: balance.balance, usedThisMonth: balance.usedThisMonth } }
  if (cost > 0 && result.metadata.noCharge !== true) await consumeBrokerAiCredits({ brokerId: input.brokerId, amount: cost, actionType: descriptor.action, description: `COS Launch: ${descriptor.title}`, metadata: { source: "api/cos-launch", capabilityId } })
  const [card, credits] = await Promise.all([resultCard(input.kind, input.brokerId, result), getBrokerAiCreditBalance(input.brokerId)])
  return { message: result.response, cards: card ? [card] : [], credits: { balance: credits.balance, usedThisMonth: credits.usedThisMonth } }
}
