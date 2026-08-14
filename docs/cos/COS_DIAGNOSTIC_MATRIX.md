# Matriz diagnóstica conversacional do COS

Data: 14/08/2026. Esta matriz preserva a evidência da auditoria e registra o comportamento determinístico após as Etapas 2A, 2B e 2C.

## Cenários A–J — antes e depois da 2C

| Cenário | Antes da 2C | Depois da 2C | Estado |
| --- | --- | --- | --- |
| A — criação simples | `createLead`, `start_new` | `execute` + `lead` + `createLead` | Mantido |
| B — Marina + telefone + email | o email podia virar proposta | telefone é `provide_input`; email usa a Marina ativa e `UPDATE_LEAD` | Corrigido |
| C — proposta 900 → 850 | abandonava a proposta e iniciava listagem | `correct`, mantém `CREATE_PROPOSAL` e o workflow atual | Corrigido |
| D — lista + segundo + ele | ordinal só no pending; pronome virava analytics | `select` resolve o segundo item; `query/property` usa `GET_PROPERTY` | Corrigido |
| E — agenda → leads | “Tenho compromisso amanhã?” virava criação | `query/agenda` usa `LIST_AGENDA_EVENTS`; leads troca o tópico sem virar input da agenda | Corrigido |
| F — imóveis → clientes → voltar | lista/tópico anterior eram perdidos | `return_topic` recupera a selection set e abre o primeiro imóvel | Corrigido |
| G — Catálogo x Marketplace | `SHARE_CATALOG` | `explain`, domínios `catalog + marketplace`, `help.general_question` | Corrigido no roteamento; conhecimento completo fica para Etapas 3/4 |
| H — “você consegue cadastrar?” | iniciava `createLead` | `capability_question`, responde via `general.chat`, sem mutação | Corrigido |
| I — “manda aquele” sem contexto | fallback geral imprevisível | `select` sem referente, `needsClarification`, nenhuma action operacional | Corrigido de forma segura |
| J — localização | literais corrompidos e termos internos alcançáveis | inalterado por escopo | Etapa 5 |

Os testes de regressão A–J estão em `tests/e2e/cos-audit-diagnostics.spec.ts`. Os testes estruturais A–O da Decision Layer estão em `tests/e2e/cos-conversational-decision.spec.ts`.

## Distinções estruturais validadas

| Entrada | Dialogue act | Domínio | Resultado |
| --- | --- | --- | --- |
| “Cadastre o cliente João.” | `execute` | `lead` | `createLead` |
| “Você consegue cadastrar um cliente?” | `capability_question` | `lead` | resposta de capacidade; não executa |
| “Tenho compromisso amanhã?” | `query` | `agenda` | `LIST_AGENDA_EVENTS` |
| “Crie um compromisso amanhã.” | `execute` | `agenda` | `CREATE_AGENDA_EVENT` |
| “Qual a diferença entre catálogo e Marketplace?” | `explain` | `catalog + marketplace` | ajuda/manual; não compartilha catálogo |
| “Não.” com confirmação pendente | `reject` | domínio do pending | rejeita com segurança |
| “Não, o valor é 850 mil.” | `correct` | domínio do workflow | preserva e corrige o workflow |
| “O segundo.” após uma lista | `select` | domínio da selection set | resolve o item estruturado |
| “Quantos metros ele tem?” com imóvel ativo | `query` | `property` | `GET_PROPERTY`, não analytics |
| “54 99999-9999” com telefone pendente | `provide_input` | `lead` | continua o workflow |
| “Quantos imóveis tenho publicados?” com telefone pendente | `switch_topic` | `property + analytics` | não usa a pergunta como telefone |

## Agenda

Cobertura determinística adicionada:

- hoje → `LIST_AGENDA_TODAY`;
- amanhã/próximo compromisso → `LIST_AGENDA_EVENTS`;
- semana → `LIST_AGENDA_WEEK`;
- criar → `CREATE_AGENDA_EVENT`;
- alterar/reagendar → `UPDATE_AGENDA_EVENT`;
- cancelar compromisso → `CANCEL_AGENDA_EVENT`;
- concluir → `MARK_AGENDA_DONE`.

## Cobertura do catálogo

Antes da 2C, o `Intent Resolver` mantinha 38 actions candidatas em uma lista paralela. Depois da 2C, a Decision Layer deriva 73 capabilities/actions roteáveis na surface `portal` diretamente dos descriptors validados. `operation.summary` permanece interna por ser um agregador de recipe, não uma intenção final do usuário.

Entre as capabilities antes ausentes e agora candidatas estão agenda hoje/semana/mês, fluxo de caixa/previsões financeiras, preview de contrato e detalhe de imóvel.

## Limites

- Os testes determinísticos não substituem autenticação, banco e execução real dos handlers.
- O Livro do EME e Knowledge Retrieval ainda não existem; perguntas de produto usam os manuais atuais.
- A localização central e a limpeza dos literais antigos permanecem fora da 2C.
- Ambiguidade sem evidência não é adivinhada: a rota pede o contexto mínimo necessário.
