# Inventário de capabilities e actions do COS

Data da leitura: 14/08/2026. Este inventário descreve o código atual; não é uma especificação desejada.

## Contrato comum

- Entrada dos handlers: `CosCapabilityExecutionInput` (`brokerId`, `userId`, `message`, `action`, `confirm`, `payload`, `context`, `pendingInput`).
- Saída: `CosActionResult` (`response`, `metadata`, `leadId?`, `propertyId?`). O tipo não possui `ok`, `errorCode` ou um discriminador de falha.
- Autorização no portal: a rota exige usuário autenticado com papel `BROKER`, resolve o `brokerId` da sessão e os handlers consultados aplicam esse `brokerId`. No WhatsApp, o corretor é resolvido pelo número configurado.
- Superfícies abreviadas: P = portal, C = `cos_home`, W = WhatsApp, D = demo.
- Confirmação efetiva do Execution Planner: somente `DELETE_LEAD`, `PUBLISH_PROPERTY`, `PUBLISH_CATALOG`, `SEND_CONTRACT`, `CANCEL_CONTRACT` e `CANCEL_AGENDA_EVENT`. Isso diverge dos 25 descriptors marcados com `requiresConfirmation`. `ATTACH_LEAD_DOCUMENT` e exclusão de lead ainda criam confirmação dentro do próprio handler.
- Resultado: salvo indicação em contrário, a função retorna texto pronto para o usuário e metadata técnica; o formatter não transforma esse resultado.

## Atendimento e ajuda

| Capability → action | Função | Operação | Entrada específica → saída | Superfícies |
|---|---|---|---|---|
| `general.chat` → `general` | `generalChatCapability` | orientação/conversa determinística | mensagem/contexto → resposta social e opções | P/C/W/D |
| `help.first_steps` → `help_first_steps` | `helpFirstStepsCapability` | orientação | pergunta + manual `primeiros-passos.md` → resposta/atalhos | P/C/W/D |
| `help.use_cos` → `help_use_cos` | `helpUseCosCapability` | orientação | pergunta + `como-usar-o-cos.md` → resposta | P/C/W/D |
| `help.register_properties` → `help_register_properties` | `helpRegisterPropertiesCapability` | orientação | pergunta + `imoveis.md` → resposta | P/C/W/D |
| `help.manage_clients` → `help_manage_clients` | `helpManageClientsCapability` | orientação | pergunta + `clientes.md` → resposta | P/C/W/D |
| `help.contracts_proposals` → `help_contracts_proposals` | `helpContractsProposalsCapability` | orientação | pergunta + manuais de contratos/propostas → resposta | P/C/W/D |
| `help.marketing_studio` → `help_marketing_studio` | `helpMarketingStudioCapability` | orientação | pergunta + `studio-ia.md` → resposta | P/C/W/D |
| `help.general_question` → `help_general_question` | `helpGeneralQuestionCapability` | orientação | pergunta + todos os 15 manuais → resposta | P/C/W/D |

## Clientes/leads

| Capability → action | Função | Operação | Entrada específica → saída | Confirmação declarada/efetiva |
|---|---|---|---|---|
| `lead.create` → `createLead` | `createLeadCapability` | criação/atualização por telefone | nome e telefone; pending `name`/`phone` → lead + notificação | sim/não |
| `lead.summary` → `getLeadsSummary` | `leadSummaryCapability` | consulta | broker → contagens por status | não/não |
| `lead.summarize` → `summarizeLead` | `leadSummarizeCapability` | consulta | broker → lista/resumo de leads | não/não |
| `lead.update` → `UPDATE_LEAD` | `updateLeadCapability` | edição | referência/id + campos da mensagem → lead atualizado | sim/não |
| `lead.delete` → `DELETE_LEAD` | `deleteLeadCapability` | exclusão permanente | referência/seleção + confirmação → lead excluído | não/sim |
| `lead.find` → `FIND_LEAD` | `findLeadCapability` | consulta | nome parcial → candidatos | não/não |
| `lead.timeline` → `LEAD_TIMELINE` | `leadTimelineCapability` | consulta | lead → mensagens, agenda e documentos | não/não |
| `lead.convert` → `CONVERT_LEAD` | `convertLeadCapability` | edição | lead + status inferido → lead convertido | sim/não |
| `lead.attach_document` → `ATTACH_LEAD_DOCUMENT` | `attachLeadDocumentCapability` | edição | lead + anexo + seleção/confirmação → documento anexado ao lead | não/handler |

## Imóveis

| Capability → action | Função | Operação | Entrada específica → saída | Confirmação declarada/efetiva |
|---|---|---|---|---|
| `property.create` → `createPropertyDraft` | `createPropertyDraftCapability` | criação | mensagem/payload extraído → imóvel rascunho | sim/não |
| `property.search` → `searchProperties` | `searchPropertiesCapability` | consulta | filtros textuais/pending → imóvel ou opções | não/não |
| `property.description.improve` → `improvePropertyDescription` | `improvePropertyDescriptionCapability` | análise/geração | imóvel + instrução → descrição sugerida | não/não |
| `property.publish` → `PUBLISH_PROPERTY` | `publishPropertyCapability` | edição | `propertyId` → publicado | sim/sim |
| `property.unpublish` → `UNPUBLISH_PROPERTY` | `unpublishPropertyCapability` | edição | `propertyId` → despublicado | sim/não |
| `property.media.update` → `UPDATE_PROPERTY_MEDIA` | `updatePropertyMediaCapability` | edição | imóvel + URLs/anexos; pending `imageUrls` → mídias atualizadas | sim/não |
| `property.price.suggest` → `SUGGEST_PROPERTY_PRICE` | `suggestPropertyPriceCapability` | análise | imóvel + comparáveis do broker → faixa estimada | não/não |
| `property.archive` → `ARCHIVE_PROPERTY` | `archivePropertyCapability` | exclusão permanente | `propertyId` → registro apagado | sim/não |

## Propostas e documentos

| Capability → action | Função | Operação | Entrada específica → saída | Observação |
|---|---|---|---|---|
| `proposal.summary` → `LIST_DOCUMENTS` | `proposalSummaryCapability` | consulta | broker → resumo de propostas | É o primeiro descriptor desta action e vence a duplicidade. |
| `proposal.create` → `CREATE_PROPOSAL` | `createProposalCapability` | criação | cliente, imóvel, preço; pending de cliente/imóvel → `BrokerDocument` + notificação | Confirmação declarada, não aplicada pelo planner. |
| `document.list` → `LIST_DOCUMENTS` | sem handler | consulta pretendida | não executável como esta capability | Action duplicada; lookup por action devolve `proposal.summary`. |
| `document.get` → `GET_DOCUMENT` | sem handler | consulta pretendida | execução lança `COS_HANDLER_NOT_IMPLEMENTED:document.get` | Única action registrada sem caminho executável. |

## Contratos

| Capability → action | Função | Operação | Entrada específica → saída | Confirmação declarada/efetiva |
|---|---|---|---|---|
| `contract.create` → `CREATE_CONTRACT` | `createContractCapability` | criação | cliente, imóvel e dados do broker; pending cliente/imóvel → `BrokerDocument` + notificação | sim/não |
| `contract.list` → `LIST_CONTRACTS` | `listContractsCapability` | consulta | filtros da mensagem → contratos | não/não |
| `contract.get` → `GET_CONTRACT` | `getContractCapability` | consulta | id/referência → contrato | não/não |
| `contract.preview` → `CONTRACT_PREVIEW` | `previewContractCapability` | consulta | contrato → preview textual | não/não |
| `contract.update` → `UPDATE_CONTRACT` | `updateContractCapability` | edição | contrato + mensagem → conteúdo/status atualizado | sim/não |
| `contract.send` → `SEND_CONTRACT` | `sendContractCapability` | edição | contrato → status `sent` | sim/sim |
| `contract.sign` → `SIGN_CONTRACT` | `signContractCapability` | edição | contrato → status `signed` | sim/não |
| `contract.cancel` → `CANCEL_CONTRACT` | `cancelContractCapability` | edição | contrato → status `cancelled` | sim/sim |
| `contract.download` → `DOWNLOAD_CONTRACT` | `downloadContractCapability` | consulta | contrato → conteúdo/metadata de download | não/não |
| `contract.history` → `CONTRACT_HISTORY` | `contractHistoryCapability` | consulta | broker → histórico recente | não/não |

## Agenda

| Capability → action | Função | Operação | Entrada específica → saída | Confirmação declarada/efetiva |
|---|---|---|---|---|
| `agenda.create` → `CREATE_AGENDA_EVENT` | `createAgendaCapability` | criação | data, hora, título, lead/imóvel; pending `time` → evento + notificação | sim/não |
| `agenda.list` → `LIST_AGENDA_EVENTS` | `listAgendaCapability` | consulta | expressão temporal → eventos | não/não |
| `agenda.complete` → `MARK_AGENDA_DONE` | `completeAgendaCapability` | edição | id ou último pendente → status `done` | não/não |
| `agenda.update` → `UPDATE_AGENDA_EVENT` | `updateAgendaCapability` | edição | id/referência + data/hora → evento atualizado | sim/não |
| `agenda.cancel` → `CANCEL_AGENDA_EVENT` | `cancelAgendaCapability` | edição | id/referência → evento cancelado | sim/sim |
| `agenda.today` → `LIST_AGENDA_TODAY` | `todayAgendaCapability` | consulta | broker → eventos do dia | não/não |
| `agenda.week` → `LIST_AGENDA_WEEK` | `weekAgendaCapability` | consulta | broker → eventos da semana | não/não |
| `agenda.month` → `LIST_AGENDA_MONTH` | `monthAgendaCapability` | consulta | broker → eventos do mês | não/não |

## Financeiro, analytics e catálogo

| Capability → action | Função | Operação | Entrada específica → saída | Confirmação declarada/efetiva |
|---|---|---|---|---|
| `finance.summary` → `getFinancialSummary` | `financialSummaryCapability` | análise | imóveis do broker → estimativas financeiras | não/não |
| `finance.receivable` → `GET_FINANCE_RECEIVABLE` | `financeReceivableCapability` | consulta | broker → recebíveis estimados | não/não |
| `finance.payable` → `GET_FINANCE_PAYABLE` | `financePayableCapability` | consulta | broker → pagamentos estimados | não/não |
| `finance.forecast` → `GET_FINANCE_FORECAST` | `financeForecastCapability` | análise | broker → previsão | não/não |
| `finance.commission` → `GET_FINANCE_COMMISSION` | `financeCommissionCapability` | análise | broker → comissão estimada | não/não |
| `finance.cashflow` → `GET_FINANCE_CASHFLOW` | `financeCashflowCapability` | análise | broker → fluxo estimado | não/não |
| `analytics.summary` → `getAnalyticsSummary` | `analyticsSummaryCapability` | consulta | broker/action → resumo de buscas | não/não |
| `catalog.summary` → `getCatalogSummary` | `analyticsSummaryCapability` | consulta | broker/action → resumo | não/não |
| `catalog.analyze` → `analyzeCatalog` | `analyticsSummaryCapability` | análise | broker/action → análise | não/não |
| `catalog.publish` → `PUBLISH_CATALOG` | `publishCatalogCapability` | edição | `propertyId` → imóvel publicado no catálogo | sim/sim |
| `catalog.unpublish` → `UNPUBLISH_CATALOG` | `unpublishCatalogCapability` | edição | `propertyId` → imóvel retirado | sim/não |
| `catalog.share` → `SHARE_CATALOG` | `shareCatalogCapability` | consulta/orientação | broker → URL pública | não/não |
| `catalog.stats` → `CATALOG_STATS` | `catalogStatsCapability` | consulta | broker → eventos do catálogo | não/não |
| `analytics.performance` → `GET_ANALYTICS_PERFORMANCE` | `analyticsPerformanceCapability` | análise | broker → métricas agregadas | não/não |
| `analytics.sales` → `GET_ANALYTICS_SALES` | `analyticsSalesCapability` | análise | broker → métricas de vendas | não/não |
| `analytics.properties` → `GET_ANALYTICS_PROPERTIES` | `analyticsPropertiesCapability` | análise | broker → métricas de imóveis | não/não |
| `analytics.leads` → `GET_ANALYTICS_LEADS` | `analyticsLeadsCapability` | análise | broker → métricas de leads | não/não |

## Studio IA

| Capability → action | Função | Operação | Entrada específica → saída | Confirmação declarada/efetiva |
|---|---|---|---|---|
| `studio.generateDescription` → `STUDIO_GENERATE_DESCRIPTION` | `studioGenerateDescriptionCapability` | geração | imóvel/instrução → descrição | não/não |
| `studio.generateCampaign` → `STUDIO_GENERATE_CAMPAIGN` | `studioGenerateCampaignCapability` | criação/geração | imóvel + provider → campanha | sim/não |
| `studio.generateInstagram` → `STUDIO_GENERATE_INSTAGRAM` | `studioGenerateInstagramCapability` | criação/geração | imóvel → peça Instagram | sim/não |
| `studio.generateFacebook` → `STUDIO_GENERATE_FACEBOOK` | `studioGenerateFacebookCapability` | criação/geração | imóvel → peça Facebook | sim/não |
| `studio.generateVideo` → `STUDIO_GENERATE_VIDEO` | `studioGenerateVideoCapability` | criação/geração | imóvel → job/vídeo | sim/não |
| `studio.generateStory` → `STUDIO_GENERATE_STORY` | `studioGenerateStoryCapability` | criação/geração | imóvel → story | sim/não |
| `studio.improveText` → `STUDIO_IMPROVE_TEXT` | `studioImproveTextCapability` | geração | texto/instrução → texto melhorado | não/não |
| `studio.regenerate` → `STUDIO_REGENERATE` | `studioRegenerateCapability` | edição/geração | `campaignId` → nova geração | sim/não |

## Operação

| Capability → action | Função | Operação | Entrada específica → saída | Observação |
|---|---|---|---|---|
| `operation.summary` → `createInternalNotification` | `operationSummaryCapability` | análise | broker → pendências operacionais agregadas | O nome da action sugere mutação, mas o handler apenas consulta. |

## Contagens confirmadas

- 10 módulos de entidade.
- 73 descriptors de capability.
- 72 nomes de action únicos (`LIST_DOCUMENTS` é duplicada).
- 71 mappings de handler.
- 71 actions únicas executáveis; `GET_DOCUMENT` não possui handler.
- 28 descriptors marcados como mutação.
- 25 descriptors marcados como exigindo confirmação.
- 27 descriptors marcados como exigindo seleção.
- 2 descriptors com `source: legacy`.
