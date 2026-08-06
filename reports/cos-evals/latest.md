# COS Eval Report

Generated at: 2026-08-06T07:50:02.500Z

## Summary

- Total scenarios: 337
- Passed: 279
- Failed: 58
- Success rate: 82.79%

## Metrics

- Intent Accuracy: 85.96%
- Workflow Accuracy: 85.71%
- Capability Accuracy: 85.71%
- Entity Resolution Accuracy: 96.88%
- Average Duration: 0.09 ms
- Average Questions per Operation: 0.75
- Autonomous Executions: 28.49%
- Confirmations: 65.88%
- Ambiguities: 10.68%

## Category Breakdown

- agenda-create: 8/8 (100%)
- agenda-update: 3/8 (37.5%)
- contract-cancel_contract: 3/6 (50%)
- contract-create: 15/15 (100%)
- contract-get_contract: 2/6 (33.33%)
- contract-send_contract: 3/6 (50%)
- contract-sign_contract: 3/6 (50%)
- finance-commission: 7/8 (87.5%)
- hardening-prompt-injection: 9/12 (75%)
- hardening-suspicious-attachment: 6/6 (100%)
- help-help_contracts_proposals: 0/6 (0%)
- help-help_manage_clients: 6/6 (100%)
- help-help_register_properties: 6/6 (100%)
- help-help_use_cos: 6/6 (100%)
- lead-attach-document: 8/8 (100%)
- lead-create: 14/15 (93.33%)
- lead-delete: 8/8 (100%)
- lead-find: 15/15 (100%)
- lead-update: 8/8 (100%)
- navigation: 12/12 (100%)
- property-create-audio: 12/12 (100%)
- property-create-image: 24/24 (100%)
- property-delete: 8/8 (100%)
- property-edit: 3/8 (37.5%)
- property-publish: 4/8 (50%)
- property-search: 16/24 (66.67%)
- property-unpublish: 8/8 (100%)
- proposal-create: 12/12 (100%)
- studio-campaign: 9/12 (75%)
- studio-instagram: 12/12 (100%)
- studio-video: 10/12 (83.33%)
- workflow-context-switch: 1/8 (12.5%)
- workflow-continue-confirmation: 18/18 (100%)

## Top Failures

- property-search-1-1 (property-search)
  Message: Buscar sala comercial em São Paulo.
  - intentAction esperada=searchProperties atual=createPropertyDraft
  - capability esperada=property.search atual=property.create
  - workflow esperado=searchProperties atual=createPropertyDraft
  - confirmacao esperada=false atual=true
- property-search-1-2 (property-search)
  Message: Encontre apartamentos em Porto Alegre.
  - intentAction esperada=searchProperties atual=createPropertyDraft
  - capability esperada=property.search atual=property.create
  - workflow esperado=searchProperties atual=createPropertyDraft
  - confirmacao esperada=false atual=true
- property-search-1-3 (property-search)
  Message: Mostre imóveis de alto padrão.
  - intentAction esperada=searchProperties atual=createPropertyDraft
  - capability esperada=property.search atual=property.create
  - workflow esperado=searchProperties atual=createPropertyDraft
  - confirmacao esperada=false atual=true
- property-search-1-4 (property-search)
  Message: Quero ver terrenos disponíveis.
  - intentAction esperada=searchProperties atual=createPropertyDraft
  - capability esperada=property.search atual=property.create
  - workflow esperado=searchProperties atual=createPropertyDraft
  - confirmacao esperada=false atual=true
- property-search-1-5 (property-search)
  Message: Busque casas com 3 quartos.
  - intentAction esperada=searchProperties atual=createPropertyDraft
  - capability esperada=property.search atual=property.create
  - workflow esperado=searchProperties atual=createPropertyDraft
  - confirmacao esperada=false atual=true
- property-search-1-6 (property-search)
  Message: Localize coberturas publicadas.
  - intentAction esperada=searchProperties atual=createPropertyDraft
  - capability esperada=property.search atual=property.create
  - workflow esperado=searchProperties atual=createPropertyDraft
  - confidence minima=0.7 atual=0.66
  - confirmacao esperada=false atual=true
- property-search-3-6 (property-search)
  Message: Localize coberturas publicadas.
  - intentAction esperada=searchProperties atual=STUDIO_GENERATE_CAMPAIGN
  - capability esperada=property.search atual=studio.generateCampaign
  - workflow esperado=searchProperties atual=STUDIO_GENERATE_CAMPAIGN
  - confidence minima=0.7 atual=0.66
  - confirmacao esperada=false atual=true
- property-search-4-6 (property-search)
  Message: Localize coberturas publicadas.
  - intentAction esperada=searchProperties atual=STUDIO_GENERATE_CAMPAIGN
  - capability esperada=property.search atual=studio.generateCampaign
  - workflow esperado=searchProperties atual=STUDIO_GENERATE_CAMPAIGN
  - confidence minima=0.7 atual=0.58
  - confirmacao esperada=false atual=true
- finance-commission-2-1 (finance-commission)
  Message: Consultar comissão deste imóvel.
  - intentAction esperada=GET_FINANCE_COMMISSION atual=searchProperties
  - capability esperada=finance.commission atual=property.search
  - workflow esperado=GET_FINANCE_COMMISSION atual=searchProperties
- help-help_contracts_proposals-1-1 (help-help_contracts_proposals)
  Message: Contratos e propostas
  - intentAction esperada=help_contracts_proposals atual=CREATE_PROPOSAL
  - capability esperada=help.contracts_proposals atual=proposal.create
  - workflow esperado=help_contracts_proposals atual=CREATE_PROPOSAL
  - confidence minima=0.72 atual=0.58
  - confirmacao esperada=false atual=true
  - perguntas projetadas max=0 atual=2
- help-help_contracts_proposals-1-2 (help-help_contracts_proposals)
  Message: Contratos e propostas
  - intentAction esperada=help_contracts_proposals atual=CREATE_PROPOSAL
  - capability esperada=help.contracts_proposals atual=proposal.create
  - workflow esperado=help_contracts_proposals atual=CREATE_PROPOSAL
  - confidence minima=0.72 atual=0.58
  - confirmacao esperada=false atual=true
  - perguntas projetadas max=0 atual=2
- help-help_contracts_proposals-1-3 (help-help_contracts_proposals)
  Message: Preciso saber contratos e propostas
  - intentAction esperada=help_contracts_proposals atual=CREATE_PROPOSAL
  - capability esperada=help.contracts_proposals atual=proposal.create
  - workflow esperado=help_contracts_proposals atual=CREATE_PROPOSAL
  - confidence minima=0.72 atual=0.58
  - confirmacao esperada=false atual=true
  - perguntas projetadas max=0 atual=2
- help-help_contracts_proposals-2-1 (help-help_contracts_proposals)
  Message: Contratos e propostas
  - intentAction esperada=help_contracts_proposals atual=CREATE_PROPOSAL
  - capability esperada=help.contracts_proposals atual=proposal.create
  - workflow esperado=help_contracts_proposals atual=CREATE_PROPOSAL
  - confidence minima=0.72 atual=0.58
  - confirmacao esperada=false atual=true
  - perguntas projetadas max=0 atual=2
- help-help_contracts_proposals-2-2 (help-help_contracts_proposals)
  Message: Contratos e propostas
  - intentAction esperada=help_contracts_proposals atual=CREATE_PROPOSAL
  - capability esperada=help.contracts_proposals atual=proposal.create
  - workflow esperado=help_contracts_proposals atual=CREATE_PROPOSAL
  - confidence minima=0.72 atual=0.58
  - confirmacao esperada=false atual=true
  - perguntas projetadas max=0 atual=2
- help-help_contracts_proposals-2-3 (help-help_contracts_proposals)
  Message: Preciso saber contratos e propostas
  - intentAction esperada=help_contracts_proposals atual=CREATE_PROPOSAL
  - capability esperada=help.contracts_proposals atual=proposal.create
  - workflow esperado=help_contracts_proposals atual=CREATE_PROPOSAL
  - confidence minima=0.72 atual=0.58
  - confirmacao esperada=false atual=true
  - perguntas projetadas max=0 atual=2
- property-publish-1-3 (property-publish)
  Message: Anunciar este imóvel.
  - intentAction esperada=PUBLISH_PROPERTY atual=searchProperties
  - capability esperada=property.publish atual=property.search
  - workflow esperado=PUBLISH_PROPERTY atual=searchProperties
  - confirmacao esperada=true atual=false
- property-publish-1-4 (property-publish)
  Message: Coloque este imóvel no catálogo.
  - intentAction esperada=PUBLISH_PROPERTY atual=searchProperties
  - capability esperada=property.publish atual=property.search
  - workflow esperado=PUBLISH_PROPERTY atual=searchProperties
  - confirmacao esperada=true atual=false
- property-publish-2-3 (property-publish)
  Message: Anunciar este imóvel.
  - intentAction esperada=PUBLISH_PROPERTY atual=searchProperties
  - capability esperada=property.publish atual=property.search
  - workflow esperado=PUBLISH_PROPERTY atual=searchProperties
  - confidence minima=0.75 atual=0.72
  - confirmacao esperada=true atual=false
- property-publish-2-4 (property-publish)
  Message: Coloque este imóvel no catálogo.
  - intentAction esperada=PUBLISH_PROPERTY atual=searchProperties
  - capability esperada=property.publish atual=property.search
  - workflow esperado=PUBLISH_PROPERTY atual=searchProperties
  - confidence minima=0.75 atual=0.72
  - confirmacao esperada=true atual=false
- workflow-context-switch-1-1 (workflow-context-switch)
  Message: Agora gerar campanha.
  - perguntas projetadas max=1 atual=2
- workflow-context-switch-1-2 (workflow-context-switch)
  Message: Mudar para contrato.
  - workflowDecision esperado=start_new atual=continue_workflow
  - confidence minima=0.75 atual=0.7
- workflow-context-switch-1-3 (workflow-context-switch)
  Message: Quero criar proposta agora.
  - perguntas projetadas max=1 atual=2
- workflow-context-switch-1-4 (workflow-context-switch)
  Message: Trocar para clientes.
  - workflowDecision esperado=start_new atual=continue_workflow
  - confidence minima=0.75 atual=0.7
- workflow-context-switch-2-1 (workflow-context-switch)
  Message: Agora gerar campanha.
  - workflowDecision esperado=start_new atual=continue_workflow
  - confidence minima=0.75 atual=0.7
- workflow-context-switch-2-2 (workflow-context-switch)
  Message: Mudar para contrato.
  - workflowDecision esperado=start_new atual=continue_workflow
  - confidence minima=0.75 atual=0.7
