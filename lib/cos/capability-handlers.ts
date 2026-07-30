import "server-only"

import { analyticsSummaryCapability } from "@/lib/cos/capabilities/analytics/summary"
import { completeAgendaCapability } from "@/lib/cos/capabilities/agenda/complete"
import { listAgendaCapability } from "@/lib/cos/capabilities/agenda/list"
import {
  cancelAgendaCapability,
  monthAgendaCapability,
  todayAgendaCapability,
  updateAgendaCapability,
  weekAgendaCapability,
} from "@/lib/cos/capabilities/agenda/manage"
import {
  contractHistoryCapability,
  downloadContractCapability,
  previewContractCapability,
  sendContractCapability,
  signContractCapability,
  updateContractCapability,
  cancelContractCapability,
} from "@/lib/cos/capabilities/contract/manage"
import { financialSummaryCapability } from "@/lib/cos/capabilities/finance/summary"
import { leadSummaryCapability } from "@/lib/cos/capabilities/lead/summary"
import {
  analyticsLeadsCapability,
  analyticsPerformanceCapability,
  analyticsPropertiesCapability,
  analyticsSalesCapability,
  catalogStatsCapability,
  financeCashflowCapability,
  financeCommissionCapability,
  financeForecastCapability,
  financePayableCapability,
  financeReceivableCapability,
  publishCatalogCapability,
  shareCatalogCapability,
  unpublishCatalogCapability,
} from "@/lib/cos/capabilities/insights/manage"
import {
  convertLeadCapability,
  deleteLeadCapability,
  findLeadCapability,
  leadTimelineCapability,
  updateLeadCapability,
} from "@/lib/cos/capabilities/lead/manage"
import { operationSummaryCapability } from "@/lib/cos/capabilities/operation/summary"
import {
  archivePropertyCapability,
  publishPropertyCapability,
  suggestPropertyPriceCapability,
  unpublishPropertyCapability,
  updatePropertyMediaCapability,
} from "@/lib/cos/capabilities/property/manage"
import {
  studioGenerateCampaignCapability,
  studioGenerateDescriptionCapability,
  studioGenerateFacebookCapability,
  studioGenerateInstagramCapability,
  studioGenerateStoryCapability,
  studioGenerateVideoCapability,
  studioImproveTextCapability,
  studioRegenerateCapability,
} from "@/lib/cos/capabilities/studio/manage"
import type { CosCapabilityHandler, CosCapabilityId } from "@/lib/cos/types"

export const capabilityHandlers: Partial<Record<CosCapabilityId, CosCapabilityHandler>> = {
  "lead.summary": leadSummaryCapability,
  "operation.summary": operationSummaryCapability,
  "finance.summary": financialSummaryCapability,
  "analytics.summary": analyticsSummaryCapability,
  "catalog.summary": analyticsSummaryCapability,
  "catalog.analyze": analyticsSummaryCapability,
  "catalog.publish": publishCatalogCapability,
  "catalog.unpublish": unpublishCatalogCapability,
  "catalog.share": shareCatalogCapability,
  "catalog.stats": catalogStatsCapability,
  "agenda.list": listAgendaCapability,
  "agenda.complete": completeAgendaCapability,
  "agenda.update": updateAgendaCapability,
  "agenda.cancel": cancelAgendaCapability,
  "agenda.today": todayAgendaCapability,
  "agenda.week": weekAgendaCapability,
  "agenda.month": monthAgendaCapability,
  "contract.preview": previewContractCapability,
  "contract.update": updateContractCapability,
  "contract.send": sendContractCapability,
  "contract.sign": signContractCapability,
  "contract.cancel": cancelContractCapability,
  "contract.download": downloadContractCapability,
  "contract.history": contractHistoryCapability,
  "property.publish": publishPropertyCapability,
  "property.unpublish": unpublishPropertyCapability,
  "property.media.update": updatePropertyMediaCapability,
  "property.price.suggest": suggestPropertyPriceCapability,
  "property.archive": archivePropertyCapability,
  "lead.update": updateLeadCapability,
  "lead.delete": deleteLeadCapability,
  "lead.find": findLeadCapability,
  "lead.timeline": leadTimelineCapability,
  "lead.convert": convertLeadCapability,
  "finance.receivable": financeReceivableCapability,
  "finance.payable": financePayableCapability,
  "finance.forecast": financeForecastCapability,
  "finance.commission": financeCommissionCapability,
  "finance.cashflow": financeCashflowCapability,
  "analytics.performance": analyticsPerformanceCapability,
  "analytics.sales": analyticsSalesCapability,
  "analytics.properties": analyticsPropertiesCapability,
  "analytics.leads": analyticsLeadsCapability,
  "studio.generateDescription": studioGenerateDescriptionCapability,
  "studio.generateCampaign": studioGenerateCampaignCapability,
  "studio.generateInstagram": studioGenerateInstagramCapability,
  "studio.generateFacebook": studioGenerateFacebookCapability,
  "studio.generateVideo": studioGenerateVideoCapability,
  "studio.generateStory": studioGenerateStoryCapability,
  "studio.improveText": studioImproveTextCapability,
  "studio.regenerate": studioRegenerateCapability,
}
