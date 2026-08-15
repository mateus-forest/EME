---
id: capacidades-cos
title: Capacidades do COS
domains: [help, general]
aliases: [acoes do cos, o que o cos faz, registry de capacidades]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [capability]
---

# Capacidades do COS

Este capítulo é sincronizado com o Capability Registry. O comando `npm run cos:knowledge:sync` atualiza a tabela; a validação padrão falha se o conteúdo divergir do Registry.

## Como interpretar

- Consulta não altera dados.
- Execução altera estado persistido.
- Geração produz ou transforma conteúdo.
- Orientação explica o produto ou a capacidade.
- “Confirma” e “seleção” vêm do descriptor oficial.
- A chave do handler é o ID usado no registro de handlers; sua presença é validada pelos invariantes do Registry.

<!-- GENERATED_CAPABILITIES_START -->
## Inventário gerado do Registry

Total: **74 capabilities** com descriptor e handler validados.

| Capability | Action | Domínio | Tipo | Confirma | Seleção | Handler | Superfícies |
|---|---|---|---|---|---|---|---|
| `agenda.cancel` | `CANCEL_AGENDA_EVENT` | agenda | Execução | sim | sim | `agenda.cancel` | portal, cos_home, whatsapp |
| `agenda.complete` | `MARK_AGENDA_DONE` | agenda | Execução | não | não | `agenda.complete` | portal, whatsapp |
| `agenda.create` | `CREATE_AGENDA_EVENT` | agenda | Execução | não | não | `agenda.create` | portal, cos_home, whatsapp |
| `agenda.list` | `LIST_AGENDA_EVENTS` | agenda | Consulta | não | não | `agenda.list` | portal, cos_home, whatsapp |
| `agenda.month` | `LIST_AGENDA_MONTH` | agenda | Consulta | não | não | `agenda.month` | portal, cos_home, whatsapp |
| `agenda.today` | `LIST_AGENDA_TODAY` | agenda | Consulta | não | não | `agenda.today` | portal, cos_home, whatsapp |
| `agenda.update` | `UPDATE_AGENDA_EVENT` | agenda | Execução | não | sim | `agenda.update` | portal, cos_home, whatsapp |
| `agenda.week` | `LIST_AGENDA_WEEK` | agenda | Consulta | não | não | `agenda.week` | portal, cos_home, whatsapp |
| `analytics.leads` | `GET_ANALYTICS_LEADS` | analytics | Consulta | não | não | `analytics.leads` | portal, cos_home, whatsapp |
| `analytics.performance` | `GET_ANALYTICS_PERFORMANCE` | analytics | Consulta | não | não | `analytics.performance` | portal, cos_home, whatsapp |
| `analytics.properties` | `GET_ANALYTICS_PROPERTIES` | analytics | Consulta | não | não | `analytics.properties` | portal, cos_home, whatsapp |
| `analytics.sales` | `GET_ANALYTICS_SALES` | analytics | Consulta | não | não | `analytics.sales` | portal, cos_home, whatsapp |
| `analytics.summary` | `getAnalyticsSummary` | analytics | Consulta | não | não | `analytics.summary` | portal, cos_home, whatsapp |
| `catalog.analyze` | `analyzeCatalog` | catalog | Consulta | não | não | `catalog.analyze` | portal, cos_home, whatsapp, demo |
| `catalog.publish` | `PUBLISH_CATALOG` | catalog | Execução | sim | sim | `catalog.publish` | portal, cos_home, whatsapp |
| `catalog.share` | `SHARE_CATALOG` | catalog | Consulta | não | não | `catalog.share` | portal, cos_home, whatsapp |
| `catalog.stats` | `CATALOG_STATS` | catalog | Consulta | não | não | `catalog.stats` | portal, cos_home, whatsapp |
| `catalog.summary` | `getCatalogSummary` | catalog | Consulta | não | não | `catalog.summary` | portal, cos_home, whatsapp |
| `catalog.unpublish` | `UNPUBLISH_CATALOG` | catalog | Execução | sim | sim | `catalog.unpublish` | portal, cos_home, whatsapp |
| `contract.cancel` | `CANCEL_CONTRACT` | contract | Execução | sim | sim | `contract.cancel` | portal, cos_home, whatsapp |
| `contract.create` | `CREATE_CONTRACT` | contract | Execução | não | sim | `contract.create` | portal, cos_home, whatsapp |
| `contract.download` | `DOWNLOAD_CONTRACT` | contract | Consulta | não | sim | `contract.download` | portal, cos_home, whatsapp |
| `contract.get` | `GET_CONTRACT` | contract | Consulta | não | não | `contract.get` | portal, cos_home, whatsapp |
| `contract.history` | `CONTRACT_HISTORY` | contract | Consulta | não | não | `contract.history` | portal, cos_home, whatsapp |
| `contract.list` | `LIST_CONTRACTS` | contract | Consulta | não | não | `contract.list` | portal, cos_home, whatsapp |
| `contract.preview` | `CONTRACT_PREVIEW` | contract | Consulta | não | sim | `contract.preview` | portal, cos_home, whatsapp |
| `contract.send` | `SEND_CONTRACT` | contract | Execução | sim | sim | `contract.send` | portal, cos_home, whatsapp |
| `contract.sign` | `SIGN_CONTRACT` | contract | Execução | sim | sim | `contract.sign` | portal, cos_home, whatsapp |
| `contract.update` | `UPDATE_CONTRACT` | contract | Execução | não | sim | `contract.update` | portal, cos_home, whatsapp |
| `document.get` | `GET_DOCUMENT` | document | Consulta | não | não | `document.get` | portal, whatsapp |
| `document.list` | `LIST_DOCUMENTS` | document | Consulta | não | não | `document.list` | portal, whatsapp |
| `finance.cashflow` | `GET_FINANCE_CASHFLOW` | finance | Consulta | não | não | `finance.cashflow` | portal, cos_home, whatsapp |
| `finance.commission` | `GET_FINANCE_COMMISSION` | finance | Consulta | não | não | `finance.commission` | portal, cos_home, whatsapp |
| `finance.forecast` | `GET_FINANCE_FORECAST` | finance | Consulta | não | não | `finance.forecast` | portal, cos_home, whatsapp |
| `finance.payable` | `GET_FINANCE_PAYABLE` | finance | Consulta | não | não | `finance.payable` | portal, cos_home, whatsapp |
| `finance.receivable` | `GET_FINANCE_RECEIVABLE` | finance | Consulta | não | não | `finance.receivable` | portal, cos_home, whatsapp |
| `finance.summary` | `getFinancialSummary` | finance | Consulta | não | não | `finance.summary` | portal, cos_home, whatsapp |
| `general.chat` | `general` | general | Orientação | não | não | `general.chat` | portal, cos_home, whatsapp, demo |
| `help.contracts_proposals` | `help_contracts_proposals` | general | Consulta | não | não | `help.contracts_proposals` | portal, cos_home, whatsapp, demo |
| `help.first_steps` | `help_first_steps` | general | Consulta | não | não | `help.first_steps` | portal, cos_home, whatsapp, demo |
| `help.general_question` | `help_general_question` | general | Consulta | não | não | `help.general_question` | portal, cos_home, whatsapp, demo |
| `help.manage_clients` | `help_manage_clients` | general | Consulta | não | não | `help.manage_clients` | portal, cos_home, whatsapp, demo |
| `help.marketing_studio` | `help_marketing_studio` | general | Consulta | não | não | `help.marketing_studio` | portal, cos_home, whatsapp, demo |
| `help.register_properties` | `help_register_properties` | general | Consulta | não | não | `help.register_properties` | portal, cos_home, whatsapp, demo |
| `help.use_cos` | `help_use_cos` | general | Consulta | não | não | `help.use_cos` | portal, cos_home, whatsapp, demo |
| `lead.attach_document` | `ATTACH_LEAD_DOCUMENT` | lead | Execução | não | não | `lead.attach_document` | portal, cos_home, whatsapp |
| `lead.convert` | `CONVERT_LEAD` | lead | Execução | sim | sim | `lead.convert` | portal, cos_home, whatsapp |
| `lead.create` | `createLead` | lead | Execução | não | não | `lead.create` | portal, cos_home, whatsapp |
| `lead.delete` | `DELETE_LEAD` | lead | Execução | sim | não | `lead.delete` | portal, cos_home, whatsapp |
| `lead.find` | `FIND_LEAD` | lead | Consulta | não | não | `lead.find` | portal, cos_home, whatsapp |
| `lead.summarize` | `summarizeLead` | lead | Consulta | não | não | `lead.summarize` | portal, cos_home, whatsapp |
| `lead.summary` | `getLeadsSummary` | lead | Consulta | não | não | `lead.summary` | portal, cos_home, whatsapp |
| `lead.timeline` | `LEAD_TIMELINE` | lead | Consulta | não | sim | `lead.timeline` | portal, cos_home, whatsapp |
| `lead.update` | `UPDATE_LEAD` | lead | Execução | não | sim | `lead.update` | portal, cos_home, whatsapp |
| `operation.summary` | `createInternalNotification` | operation | Consulta | não | não | `operation.summary` | portal, cos_home, whatsapp |
| `property.archive` | `ARCHIVE_PROPERTY` | property | Execução | sim | sim | `property.archive` | portal, cos_home, whatsapp |
| `property.create` | `createPropertyDraft` | property | Execução | não | não | `property.create` | portal, cos_home, whatsapp |
| `property.description.improve` | `improvePropertyDescription` | property | Geração | não | não | `property.description.improve` | portal, whatsapp |
| `property.get` | `GET_PROPERTY` | property | Consulta | não | sim | `property.get` | portal, cos_home |
| `property.media.update` | `UPDATE_PROPERTY_MEDIA` | property | Execução | sim | sim | `property.media.update` | portal, cos_home, whatsapp |
| `property.price.suggest` | `SUGGEST_PROPERTY_PRICE` | property | Consulta | não | sim | `property.price.suggest` | portal, cos_home, whatsapp |
| `property.publish` | `PUBLISH_PROPERTY` | property | Execução | sim | sim | `property.publish` | portal, cos_home, whatsapp |
| `property.search` | `searchProperties` | property | Consulta | não | sim | `property.search` | portal, cos_home, whatsapp, demo |
| `property.unpublish` | `UNPUBLISH_PROPERTY` | property | Execução | sim | sim | `property.unpublish` | portal, cos_home, whatsapp |
| `proposal.create` | `CREATE_PROPOSAL` | proposal | Execução | não | sim | `proposal.create` | portal, cos_home, whatsapp |
| `proposal.summary` | `LIST_PROPOSALS` | proposal | Consulta | não | não | `proposal.summary` | portal, cos_home, whatsapp |
| `studio.generateCampaign` | `STUDIO_GENERATE_CAMPAIGN` | studio | Geração | sim | sim | `studio.generateCampaign` | portal, cos_home, whatsapp |
| `studio.generateDescription` | `STUDIO_GENERATE_DESCRIPTION` | studio | Geração | não | sim | `studio.generateDescription` | portal, cos_home, whatsapp |
| `studio.generateFacebook` | `STUDIO_GENERATE_FACEBOOK` | studio | Geração | sim | sim | `studio.generateFacebook` | portal, cos_home, whatsapp |
| `studio.generateInstagram` | `STUDIO_GENERATE_INSTAGRAM` | studio | Geração | sim | sim | `studio.generateInstagram` | portal, cos_home, whatsapp |
| `studio.generateStory` | `STUDIO_GENERATE_STORY` | studio | Geração | sim | sim | `studio.generateStory` | portal, cos_home, whatsapp |
| `studio.generateVideo` | `STUDIO_GENERATE_VIDEO` | studio | Geração | sim | sim | `studio.generateVideo` | portal, cos_home, whatsapp |
| `studio.improveText` | `STUDIO_IMPROVE_TEXT` | studio | Geração | não | não | `studio.improveText` | portal, cos_home, whatsapp |
| `studio.regenerate` | `STUDIO_REGENERATE` | studio | Geração | sim | não | `studio.regenerate` | portal, cos_home, whatsapp |
<!-- GENERATED_CAPABILITIES_END -->

## Limites

O Registry confirma executabilidade técnica, não disponibilidade de provider, crédito, dados suficientes ou permissão sobre uma entidade específica. Toda execução continua sujeita às validações do handler.
