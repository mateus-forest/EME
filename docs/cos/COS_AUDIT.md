# Auditoria técnica do COS — Etapa 1

Data da auditoria: 14/08/2026
Escopo: runtime conversacional do COS no portal, `cos_home`, WhatsApp e demo; integrações apenas na medida necessária para entender o COS.
Natureza: leitura de código, caracterização determinística e documentação. Nenhum comportamento, prompt, modelo, banco ou UI foi alterado.

## 1. Resumo executivo

O COS atual é um conjunto de pipelines parcialmente sobrepostos, não um sistema conversacional único. No portal, a rota possui boas peças isoladas — catálogo de capabilities, workflow persistido, handlers broker-scoped, telemetria de IA e execução multi-step —, porém elas são conectadas por decisões prematuras e por um estado conversacional insuficiente. O histórico completo existe para exibição, mas não entra no Intent Resolver nem nos modelos. O runtime decide com a mensagem atual, workspace, um único workflow ativo e uma memória compacta que guarda principalmente IDs e o último resultado.

Essa arquitetura explica o comportamento de “chatbot pouco confiável”: regexes e scores escolhem uma action antes de haver contexto suficiente; o Planner geralmente apenas ratifica essa escolha; o Entity Resolver só entra depois, dentro dos handlers; e o Response Formatter devolve quase literalmente a resposta de cada handler. A IA não é o cérebro conversacional padrão: ela aparece como planner condicional, ajuda baseada em manuais e extração de anexos. Continuidade, correção, pronome, ordinal e retorno de tópico são majoritariamente regras determinísticas.

Os cinco maiores problemas são:

1. O histórico mostrado ao usuário não é consumido nas decisões; não há resumo, topic stack nem lista de resultados anteriores.
2. A confirmação declarada no catálogo não é a confirmação aplicada pelo Execution Planner: 25 descriptors declaram confirmação, mas só seis actions estão no conjunto efetivo.
3. `CosActionResult` não diferencia sucesso de falha; handlers podem devolver texto de erro e ainda produzir status técnico de sucesso.
4. Portal, WhatsApp, demo e fast actions do cliente executam pipelines diferentes, com capacidades de contexto e observabilidade distintas.
5. Intent Resolver, Planner, recipes, AI Planner, Workflow e handlers competem pela mesma decisão sem uma fonte única de verdade.

Contagens confirmadas:

- 13 intents operacionais grossas; 7 intents sociais; 38 actions candidatas hardcoded no Intent Resolver.
- 73 descriptors, 72 nomes de action únicos e 71 actions únicas executáveis.
- 7 recipes de workflow registradas; workflows single/AI são criados dinamicamente.
- 10 módulos de entidade; 5 famílias de entidade com resolver dedicado (`lead`, `property`, `contract`, `agenda`, `campaign`).
- 3 call sites de LLM alcançáveis pelo COS, compostos por 6 templates/instruções relevantes.
- 15 documentos de ajuda, 27.219 bytes, consumidos apenas após o roteamento para uma capability de ajuda; não há RAG, embeddings ou busca semântica.

Conclusão: a maior fonte de erros conversacionais é a combinação de memória curta com roteamento heurístico anterior à resolução contextual. A maior fonte de erros de execução é a divergência entre contrato declarativo, confirmação efetiva e resultado sem discriminador de sucesso. Tradução e texto corrompido vêm de literais com encoding inconsistente, enums técnicos e ausência de localização central.

## 2. Arquitetura real

### 2.1 Portal e `cos_home`

O caminho realmente executado é:

```text
Usuário
  -> components/use-cos-conversations.ts
     -> normaliza mensagem/anexos e deriva workspace da URL
     -> resolveFastCosAction no cliente
        -> navegação: executa no cliente e NÃO chega à API
        -> demais casos: POST /api/assistant/eme
  -> app/api/assistant/eme/route.ts
     -> autentica usuário e exige BROKER
     -> resolve broker, plano/créditos e body normalizado
     -> cria/abre BrokerDocument(type=cos_conversation)
     -> lê SOMENTE workflow + memory de BrokerDocument.content
     -> cria CosNormalizedContext da mensagem atual
     -> resolveFastCosAction novamente no servidor
     -> trata social/cancelamento/detalhes de workflow
     -> resolveCosIntent (determinístico)
     -> decide continuar workflow ou iniciar nova action
     -> pendingInput = null para planejamento novo
     -> planCosExecution
        -> planCosCapability (determinístico)
        -> recipe estática OU AI Orchestrator condicional OU plano single
     -> crédito/confirmação
     -> createWorkflowFromExecutionPlan ou rebuild do workflow persistido
     -> executeCosExecutionPlan / resumeWorkflowExecution
        -> registry -> handler
        -> Entity Resolver dentro do handler, quando usado
        -> Prisma/provedor/ferramenta
     -> updateWorkflowFromExecutionResult
     -> formatCosExecutionPlanResponse
     -> atualiza BrokerDocument.content
     -> grava AiAssistantInteraction + EmeMessage + créditos/notificação
     -> JSON para UI
```

Desvios relevantes em relação ao fluxo conceitual esperado:

- O histórico de `EmeMessage` é carregado pela API de detalhe apenas para renderização; não é recuperado na rota de execução.
- O Entity Resolver não precede o Planner. Ele é chamado seletivamente pelos handlers após action e workflow já terem sido escolhidos.
- O Response Formatter não gera linguagem natural: ele concatena ou repassa strings dos handlers.
- `pendingInput` é explicitamente `null` na linha 1107 da rota quando um plano novo é construído. Pending só influencia de verdade quando um workflow ativo é retomado.
- Navegações reconhecidas no cliente não geram interação de servidor, trace ou decisão persistida.

### 2.2 WhatsApp

`app/api/whatsapp/webhook/route.ts` usa outro pipeline:

```text
Webhook -> valida mensagem/broker -> pendingInput = null
        -> planCosCapability -> executeCosCapability
        -> infere status por metadata/texto -> persiste -> responde
```

Não usa `resolveCosIntent`, recipes, AI Orchestrator, Workflow Engine, memória da conversa nem histórico. Cada mensagem é essencialmente isolada. Isso torna “mesma capability” diferente conforme a superfície.

### 2.3 Demo

`app/api/assistant/eme-demo/route.ts` planeja de forma determinística e monta uma resposta demonstrativa. Não executa handlers, não consulta o banco e não representa a confiabilidade operacional do portal.

### 2.4 Persistência

O estado central da conversa é reutilizado em `BrokerDocument`:

- `type = cos_conversation`;
- `content` = string JSON com `{ workflow, memory }`;
- `status` = active/archived.

Cada turno também é duplicado em:

- `EmeMessage`: mensagem, resposta, intent, action, status, metadata, erro, créditos;
- `AiAssistantInteraction`: prompt, resposta, action, status e metadata semelhante;
- `AiOperationTelemetry`: somente chamadas instrumentadas a provedores/modelos.

As gravações do turno usam operações paralelas, mas não uma transação única. É possível atualizar uma parte e falhar em outra.

## 3. Mapa de arquivos

| Arquivo | Responsabilidade real | Quem chama | Retorno | Decisões tomadas |
|---|---|---|---|---|
| `components/use-cos-conversations.ts` | Estado da UI, cache, mensagem otimista, fast action cliente, request e pending visual | telas do COS/portal | estado React + chamadas API | navegação local, supressão de confirmação, custo prévio |
| `app/api/assistant/eme/route.ts` | Orquestrador principal do portal | hook do COS | JSON de resposta/workflow/créditos | auth, conversa, fast action, intent, continuidade, plano, confirmação, execução, persistência |
| `app/api/assistant/eme/conversations/route.ts` | lista/cria conversas | hook/histórico | summaries | categoria, paginação, criação de `BrokerDocument` |
| `app/api/assistant/eme/conversations/[id]/route.ts` | abre/renomeia/exclui conversa | hook/histórico | mensagens e pending visual | reconstrói `pendingConfirmation` por status de `EmeMessage` |
| `app/api/whatsapp/webhook/route.ts` | runtime WhatsApp | Meta webhook | resposta WhatsApp | planner simples, crédito e status por heurística |
| `app/api/assistant/eme-demo/route.ts` | simulação pública | demo | resposta demonstrativa | planeja, mas não executa |
| `lib/cos/context.ts` | monta `CosNormalizedContext` | rota | contexto normalizado | seleciona IDs de workspace/memória |
| `lib/cos/workspace-context.ts` | deriva página/entidade da URL | cliente/rota | `CosWorkspaceContext` | infere entidade ativa por segmentos da rota |
| `lib/cos/fast-action-resolver.ts` | atalhos/navigation/workflow details | cliente e servidor | fast action | regex/aliases com ação imediata |
| `lib/cos/operational-intent.ts` | classificador verbal grosso | Intent Resolver | 13-class resolution | prioridade fixa de keywords |
| `lib/cos/intent-resolver.ts` | action e continuidade | rota | `CosIntentResolution` | scores hardcoded, thresholds e workflow switch |
| `lib/cos/planner.ts` | classifica contra catálogo | Execution Planner/WhatsApp | `CosCapabilityPlan` | aliases, tokens, workspace, fallback `general.chat` |
| `lib/cos/execution-recipes.ts` | 7 planos multi-step estáticos | Execution Planner | recipe ou null | matching por frases/keywords |
| `lib/cos/ai-orchestrator.ts` | plano estruturado por LLM | Execution Planner | plano aceito/audit ou fallback | gatilho, validação de capability/dependência |
| `lib/cos/execution-planner.ts` | monta plano single/recipe/AI | rota | `CosExecutionPlan` | fonte do plano e confirmação efetiva |
| `lib/cos/workflow-engine.ts` | serializa, cria, retoma e atualiza workflow | rota | workflow/plano/execução | payload de pending, estado e progresso |
| `lib/cos/workflow-recovery.ts` | retomada/retry | rota/workflow | workflow retomável | retry só explícito e read-only após falha |
| `lib/cos/pending-input.ts` | tipo/metadata/detecção pending | handlers/executor/workflow | pending ou boolean | infere tipo por field e também por texto da resposta |
| `lib/cos/entity-resolver.ts` | resolve 5 famílias de entidade | handlers | record/opções/parsedData | id, nome parcial, query ou registro mais recente |
| `lib/cos/entity-extraction.ts` | regex de nomes/referências | handlers/runtime | campos extraídos | parsing determinístico |
| `lib/cos/runtime-helpers.ts` | parsing e queries auxiliares | handlers/resolvers | filtros/candidatos | busca progressivamente relaxada e ordinais limitados |
| `lib/cos/entities/*.ts` | descriptors por domínio | catálogo | módulos/descriptors | capability, action, aliases, flags e superfícies |
| `lib/cos/capability-catalog.ts` | catálogo sem handlers | planner/intent/workflow | descriptors | primeiro descriptor vence lookup por action |
| `lib/cos/capability-handlers.ts` | mapa capability -> função | registry | handler | cobertura executável |
| `lib/cos/capability-registry.ts` | anexa handler ao descriptor | executor | capability completa | lookup por action |
| `lib/cos/executor.ts` | executa steps/dependências | workflow/rota | `CosExecutionPlanResult` | interrupção, propagação de IDs e falha por exceção |
| `lib/cos/response-formatter.ts` | resposta final | rota | string | passthrough, concatenação e erro genérico |
| `lib/cos/conversation.ts` | conversa social | rota/general handler | string/opções | 7 regexes sociais e respostas canned |
| `lib/cos/attachment-pipeline.ts` | normaliza/encaminha anexos | rota | análise/payload | categoria e limites |
| `lib/cos/attachment-analysis.ts` | extração de imóvel/anexo | pipeline | draft/imagem | chama OpenAI e engole falhas com log |
| `lib/cos/capabilities/**` | operações reais | executor | `CosActionResult` | validação, pending, Prisma/provedor e texto final |
| `lib/cos/evals/**` | eval sintético | script de eval | resultados/relatório | testa resolver/fast action com plano simplificado |
| `prisma/schema.prisma` | modelos persistidos | Prisma | tabelas | sem schema específico/versionado para estado COS |

O inventário completo action → função → entidade → permissão → entrada → saída está em `docs/cos/COS_ACTION_INVENTORY.md`.

## 4. Mapa de decisões

| Decisão | Dono atual | Tipo de decisão | Contexto disponível | Risco principal |
|---|---|---|---|---|
| Fast action/navegação | cliente e rota | regex/alias determinístico | mensagem + workspace; no cliente, memória/workflow nulos | decisão antes do servidor; sem trace para navegação |
| Intent operacional grossa | `operational-intent.ts` | keyword/substring + prioridade fixa | mensagem normalizada + página | palavras genéricas (“como”, “quantos”) dominam |
| Action principal | `intent-resolver.ts` | heurística + score + ordem | mensagem atual, workspace, sparse memory, workflow | 38 candidates hardcoded para 72 actions |
| Continuidade/troca | `intent-resolver.ts` | heurística/threshold | workflow atual + tamanho da resposta + domínio | até 4 palavras tende a continuar; “agora” tende a trocar |
| Nova classificação | `planner.ts` | alias/token/score | mensagem, pending opcional, workspace | geralmente ratifica action já escolhida |
| Plano multi-step | recipes/AI Orchestrator | keyword ou LLM estruturado | mensagem atual, catálogo, workspace, resumo do workflow | sem histórico; regras podem sobrepor intent |
| Confirmação | `execution-planner.ts` | set hardcoded de seis actions | action/intent confidence | ignora 25 flags do catálogo |
| Entidade | handlers + `entity-resolver.ts` | ID/banco/regex/fallback | payload, pending, mensagem | resolução tarde; fallback para “mais recente” |
| Informação faltante | handler | regra determinística | payload/pending/registro | implementações heterogêneas por handler |
| Awaiting input | `pending-input.ts` + executor | metadata ou substring da resposta | resultado do handler | texto natural vira sinal de controle |
| Ferramenta | registry | lookup por action/capability | plano escolhido | duplicidade e handler ausente |
| Sucesso/falha | executor + rota | exceção/shape | `CosActionResult` | texto de erro sem exceção conta como sucesso |
| Resposta final | handler + formatter | template/passthrough | respostas dos steps | sem NLG central, localização ou contrato de erro |
| Persistência | rota | regras por branch | resultado/workflow/memory | múltiplas fontes e escrita não atômica |

A decisão prematura mais relevante ocorre em `resolveCosIntent`: a action é escolhida antes de recuperar histórico ou resolver a entidade. O Planner recebe essa action e tende a tratá-la como solicitada, reduzindo seu papel a ratificação.

## 5. Inventário de intents

### 5.1 Intents operacionais grossas

`consult`, `create`, `edit`, `delete`, `share`, `publish`, `unpublish`, `navigate`, `statistics`, `help`, `analysis`, `search`, `unknown`.

São 13 classes determinadas por keywords com prioridade fixa. Por exemplo, qualquer ocorrência de linguagem de ajuda é testada antes de exclusão/compartilhamento; contagem antecede análise/busca/criação; listagem só é avaliada ao final.

### 5.2 Catálogo hardcoded do Intent Resolver

Há 38 actions possíveis no `buildIntentCandidates`:

`createPropertyDraft`, `UPDATE_PROPERTY_MEDIA`, `improvePropertyDescription`, `searchProperties`, `PUBLISH_PROPERTY`, `UNPUBLISH_PROPERTY`, `ARCHIVE_PROPERTY`, `GET_ANALYTICS_PROPERTIES`, `PUBLISH_CATALOG`, `SHARE_CATALOG`, `createLead`, `FIND_LEAD`, `UPDATE_LEAD`, `DELETE_LEAD`, `ATTACH_LEAD_DOCUMENT`, `getLeadsSummary`, `CREATE_PROPOSAL`, `LIST_DOCUMENTS`, `CREATE_CONTRACT`, `SEND_CONTRACT`, `SIGN_CONTRACT`, `CANCEL_CONTRACT`, `GET_CONTRACT`, `CONTRACT_HISTORY`, `LIST_CONTRACTS`, `STUDIO_GENERATE_INSTAGRAM`, `STUDIO_GENERATE_CAMPAIGN`, `STUDIO_GENERATE_VIDEO`, `STUDIO_IMPROVE_TEXT`, `CREATE_AGENDA_EVENT`, `MARK_AGENDA_DONE`, `UPDATE_AGENDA_EVENT`, `GET_FINANCE_COMMISSION`, `help_use_cos`, `help_register_properties`, `help_manage_clients`, `help_contracts_proposals`, `help_general_question`.

Não é derivado do catálogo de 72 actions. Actions registradas como `LIST_AGENDA_EVENTS`, `LIST_AGENDA_TODAY`, `GET_FINANCE_CASHFLOW`, `CONTRACT_PREVIEW`, `STUDIO_GENERATE_STORY` etc. não têm candidatura direta aqui.

### 5.3 Score, thresholds e desempate

- Cada candidato recebe soma de keywords, intent grossa, workspace, memória e domínio do workflow.
- A confiança usa fórmula customizada baseada no score e margem para o segundo colocado, limitada entre 0,35 e 0,98.
- Empates preservam a ordem dos `pushCandidate`; por isso “pode criar” escolhe imóvel antes de lead.
- Workflow: afirmativa/cancelamento exatos = 0,99; seleção reconhecida = 0,96; anexo esperado = 0,94; mensagem de até quatro palavras = 0,70; demais = 0,42; “agora” reduz a 0,18.
- Nova intent concorrente precisa tipicamente de 0,78 e margem de 0,12 sobre continuidade; com sinal de troca, 0,72.
- A rota só pede esclarecimento em confiança abaixo de 0,60 quando existem pelo menos duas opções únicas; um palpite único e fraco pode seguir.
- `requestedAction` enviada pela interface recebe confiança 1,0 e bypassa classificação.

### 5.4 Intents sociais

São 7 regexes exatas: `greeting`, `check_in`, `gratitude`, `capabilities`, `identity`, `farewell`, `acknowledgement`. Mensagens operacionais misturadas não devem ser capturadas, mas a resposta é determinística e não usa histórico além de `lastUserMessage` como seed de variação.

### 5.5 Conflitos concretos

- Consulta de agenda (“Tenho compromisso amanhã?”) só encontra candidato de criação.
- “agora uma proposta” pontua `LIST_DOCUMENTS` acima de `CREATE_PROPOSAL`.
- “Qual a diferença entre catálogo e Marketplace?” pontua compartilhamento de catálogo, não ajuda.
- “Quantos metros ele tem?” usa `quantos` + contexto de imóvel para analytics.
- Pergunta sobre capacidade com verbo de cadastro inicia execução.
- Nomes de actions, aliases do catálogo e candidatos do resolver são três vocabulários parcialmente divergentes.

A matriz completa das frases solicitadas está em `docs/cos/COS_DIAGNOSTIC_MATRIX.md`.

## 6. Inventário de workflows

### 6.1 Recipes registradas

| Recipe | Sinal | Steps/ferramentas | Dados/pending possíveis | Resultado/persistência |
|---|---|---|---|---|
| `lead_proposal_agenda` | cadastro + proposta + agenda | `lead.create` → `proposal.create` → `agenda.create` | nome/telefone; cliente/imóvel; horário | IDs propagados, steps em `BrokerDocument.content` |
| `lead_create_then_proposal` | cadastro + proposta | `lead.create` → `proposal.create` | nome/telefone; cliente/imóvel | lead e proposta persistidos |
| `proposal_then_agenda` | proposta + compromisso | `proposal.create` → `agenda.create` | cliente/imóvel; horário | proposta e evento |
| `contract_create_then_send` | criar + enviar contrato | `contract.create` → `contract.send` | cliente/imóvel | contrato e status enviado |
| `operation_analysis` | “analise minha operação/carteira” | `lead.summary` → `finance.summary` → `analytics.summary` → `operation.summary` | sem pending esperado | quatro leituras agregadas |
| `property_sale_preparation` | workspace de imóvel + vender/anúncio | `property.description.improve` → `catalog.publish` → `studio.generateCampaign` | imóvel/campanha | descrição, publicação, campanha |
| `catalog_publish_then_campaign` | catálogo + publicar/campanha | `catalog.publish` → `studio.generateCampaign` | imóvel | publicação e campanha |

As recipes são escolhidas por substrings; não são workflows declarativos por intent. Elas podem substituir a capability primária quando a action não veio de fast action explícita.

### 6.2 Workflows dinâmicos

Qualquer plano single ou AI vira `CosWorkflow` dinâmico. O estado contém steps serializados, step atual, pending e timestamps. Não há registry de todos os workflows dinâmicos, TTL, versão de schema, migração ou pilha de workflows anteriores.

### 6.3 Fluxos prioritários

- Cliente criar: suporta pending de nome e telefone; pode atualizar registro existente pelo telefone.
- Cliente editar: resolve ID/nome, mas pode cair no lead mais recente quando não há referência clara.
- Imóvel criar: parsing determinístico/anexo e criação de draft; descriptor pede confirmação, planner não.
- Imóvel buscar: filtros, relaxamento de busca e pending de seleção; lista se perde após conclusão.
- Proposta criar: cliente + imóvel; não há Entity Resolver próprio para proposta depois de criada.
- Contrato criar/listar/consultar: cria `BrokerDocument`, resolve cliente/imóvel; resolver de contrato por texto inteiro ou mais recente.
- Compromisso criar: data/hora, cliente/imóvel opcionais; pending de hora.
- Leads/consultas: contagens e resumos diretos em Prisma.
- Orientação: manual parcial, só após intent help.

## 7. Estado conversacional

### 7.1 O que é considerado

O portal considera:

- mensagem atual;
- workspace derivado da URL e seleção explícita;
- workflow ativo único;
- memória compacta com `lastAction`, `lastUserMessage`, `lastResult`, IDs selecionados, anexos e entidades extraídas.

Não considera:

- sequência das mensagens anteriores;
- resumo conversacional;
- lista ordenada de resultados;
- tópicos anteriores;
- correções de slots;
- último tool call estruturado;
- referências temporais gerais;
- entidade discursiva com gênero/menção.

O histórico completo pode ser recuperado de `EmeMessage`, porém é usado só para UI.

### 7.2 Onde o contexto desaparece

- Ao concluir um workflow, as opções do pending deixam de estar disponíveis.
- Ao iniciar outra intent, o `BrokerDocument.content` passa a representar o novo workflow; não há stack.
- A memória preserva IDs, mas `contractId` e `proposalId` são derivados do mesmo `documentId`, criando ambiguidade entre tipos.
- `lastResult` é texto, não dado estruturado reutilizável.
- WhatsApp não carrega nem mesmo essa memória.

### 7.3 Referências

- “o segundo”: funciona quando existe pending `selection`, com resolução numérica/primeiro/segundo/terceiro.
- “ele”, “ela”, “esse”, “aquele”: não existe resolver semântico. IDs ativos podem influenciar score, mas não resolvem o referente.
- “o último”: handlers de contrato/agenda/lead podem usar o registro mais recente como fallback, o que não equivale ao último mencionado.
- “o de ontem”: apenas parsers específicos de agenda entendem algumas datas; não há referência temporal conversacional geral.
- dois nomes iguais: lead/property podem retornar opções; contrato/agenda não têm desambiguação equivalente.

### 7.4 Pending Input

O pending nasce em `createPendingInputMetadata` dentro dos handlers, é detectado pelo executor, convertido em `workflow.pendingInput` e persistido em `BrokerDocument.content`.

Tipos: `text`, `phone`, `currency`, `time`, `selection`, `confirmation`.

Não há validade, expiração, versionamento ou migração. Existem quatro representações concorrentes:

1. `workflow.pendingInput`;
2. flags/IDs `pendingAction`, `pendingEntity`, `awaiting*` em memory;
3. `metadata.pendingInput` no resultado/mensagem;
4. `pendingConfirmation` reconstruído na UI a partir de `EmeMessage.actionStatus`.

Além da metadata, `isAwaitingInputResult` procura substrings como “Qual ” e “Pode confirmar” na resposta. Portanto, linguagem de apresentação controla estado operacional.

Riscos confirmados:

- pending antigo pode capturar uma resposta curta não relacionada;
- “não” recebe score de continuidade 0,99, mas só o flag `cancel` da UI cancela explicitamente;
- iniciar nova intent sobrescreve a única trilha ativa;
- uma correção de preço pode ser classificada como listagem e abandonar o fluxo;
- parsers específicos preservam alguns campos e outros não, levando a perguntas repetidas.

## 8. Planner e Execution Planner

### 8.1 Planner

`planCosCapability` é um classificador de uma capability, não um planejador de objetivos. Ele pontua actions/aliases/tokens/workspace, retorna uma capability e usa `general.chat` como fallback. Se recebe action explícita ou pending, prioriza o mapeamento direto.

### 8.2 Execution Planner

O Execution Planner monta dependências reais, mas a capacidade multi-step vem de:

- uma das 7 recipes por keyword;
- AI Orchestrator, em condições limitadas;
- plano single.

O AI Orchestrator suporta até seis steps, valida capabilities e só permite dependências para steps anteriores. Ele é tentado quando não há pending/recipe/action explicitamente fixada e o plano determinístico é general/legacy/baixa confiança ou contém sinais estratégicos. Falha ou plano inválido volta silenciosamente ao plano determinístico, guardando audit quando o caminho chega à persistência.

### 8.3 Duplicação de decisão

Há sobreposição entre:

1. fast action;
2. intent operacional grossa;
3. Intent Resolver de actions;
4. Planner do catálogo;
5. recipes;
6. AI Orchestrator;
7. Workflow Engine;
8. regras de entidade/campo faltante do handler.

O Planner sabe executar múltiplas ações somente via recipe/AI, mas não recebe histórico. Ele consegue perguntar antes de executar apenas indiretamente: o handler precisa devolver pending. Não existe um único contrato que diga “informação suficiente”, “confirme” e “execute”.

## 9. Ferramentas, executor e capacidade real

O catálogo registra 73 descriptors/72 actions; o mapa possui 71 handlers; 71 actions únicas são executáveis. `LIST_DOCUMENTS` aparece duas vezes e o primeiro descriptor (`proposal.summary`) vence. `GET_DOCUMENT` chega a `document.get`, que não tem handler e lança `COS_HANDLER_NOT_IMPLEMENTED:document.get`.

O inventário completo está em `docs/cos/COS_ACTION_INVENTORY.md`. Em resumo:

- consulta/análise: leads, imóveis, agenda, propostas, contratos, catálogo, financeiro, analytics, operação;
- criação: lead, imóvel, proposta, contrato, agenda e gerações do Studio;
- edição: lead, imóvel, contrato, agenda, catálogo, campanha;
- exclusão: lead e imóvel são exclusões efetivas/permanentes;
- orientação: 7 capabilities de ajuda e conversa geral;
- geração: Studio e descrição/análise de anexo.

Diferenças de promessa:

- A resposta canned de capacidades cita busca/cadastro, propostas, contratos, compromissos, operação e Studio, mas não distingue actions sem handler ou diferenças de superfície.
- Há ações existentes no catálogo que o Intent Resolver não escolhe por linguagem natural; só chegam por aliases, UI/action explícita, WhatsApp planner ou AI Planner.
- Há funcionalidades do EME fora do catálogo COS; logo existência no produto não significa executabilidade pelo COS.
- Perguntas sobre capacidade podem ser interpretadas como ordem (“Você consegue cadastrar…”).

Risco de falso sucesso: `CosActionResult` só exige `response` e `metadata`. Se um handler captura exceção e retorna “Não consegui…” sem lançar, o executor marca o step como concluído. `finalizeLeadDeletion`, por exemplo, possui caminho de catch que retorna resultado normal. A action pode ser persistida como `success` embora o texto diga falha.

## 10. Prompts e modelos de IA

### 10.1 Call sites alcançáveis

| Prompt/template | Arquivo/função | Objetivo | Provider/modelo | Contexto | Tamanho/saída | Timeout/retry/log |
|---|---|---|---|---|---|---|
| instrução system do AI Planner | `lib/cos/ai-orchestrator.ts` / `generateCosAiExecutionPlan` | restringir a planejamento | OpenAI / `OPENAI_MODEL` ou `gpt-5-mini` | nenhum histórico | ~160 caracteres fixos; structured Zod | SDK default; telemetria completa |
| prompt composto do AI Planner | `buildPlannerPrompt` | escolher até 6 capabilities | mesmo | mensagem, surface, workspace, pending recebido, resumo workflow, catálogo inteiro | dinâmico, tipicamente dezenas de KB; 1.200 output tokens | sem temperature explícita; reasoning minimal |
| system de ajuda | `lib/cos/capabilities/help/manage.ts` | responder só pelo manual | OpenAI / mesmo modelo | regras de suporte | ~350 caracteres, com literais de encoding suspeito | SDK default; operação `cos.help.reply` sem entrada correspondente no catálogo de IA |
| input de ajuda | `createHelpCapability` | manual + pergunta atual | mesmo | 1–15 arquivos, sem histórico | até ~27 KB; 1.800 output tokens, texto livre | fallback para excerpt sem client/truncamento |
| instrução de extração de imóvel | `lib/property-ad-import.ts` / `extractPropertyFromAd` | extrair fatos de anexo | OpenAI / mesmo modelo | texto do anexo, notas e imagem | JSON Schema; 2.200 output tokens | SDK default; telemetria |
| prompt de anúncio/importação | `buildPropertyAdPrompt` | estruturar texto/fonte/faltas | mesmo | texto limitado, fonte e imagem high detail | dinâmico; structured output | falha é absorvida por `attachment-analysis.ts` |

Metodologia da contagem: 3 chamadas a LLM e 6 blocos de instrução/input relevantes. O prompt de retry da descrição comercial existe no mesmo módulo, mas não é alcançado pelo caminho COS de attachment import (`workflow: import`) e foi excluído da contagem de runtime COS.

### 10.2 Conflitos e lacunas

- O AI Planner recebe todo o catálogo, mas não histórico nem memória conversacional completa.
- O prompt pede estratégia segura e descriptors carregam `requiresConfirmation`, enquanto o Execution Planner ignora a maior parte dessas flags.
- Ajuda é fiel ao manual somente depois de o roteamento determinístico escolher uma action help; perguntas fora do vocabulário nunca veem o manual.
- Alguns prompts/literais estão em português sem acentos; outros apresentam dupla codificação.
- Regras de negócio estão espalhadas entre prompt, descriptor, aliases e handlers.
- O Response Formatter não usa modelo, mesmo quando descriptor declara `responseMode: nlg`.

## 11. Conhecimento atual do EME

Existe uma base documental parcial em `docs/help/*.md`, lida em runtime por `lib/cos/capabilities/help/manual.ts`, com cache em memória. São 15 arquivos e 27.219 bytes:

`README`, primeiros passos, uso do COS, clientes, imóveis, catálogo, contratos, propostas, Studio IA, compromissos, financeiro, desempenho, configurações, planos e FAQ.

Não existe:

- RAG;
- embeddings/vector store;
- busca semântica;
- recuperação baseada na mensagem antes de intent;
- documentação do Marketplace no conjunto;
- knowledge context compartilhado com planner/formatter;
- glossário/regras/procedimentos versionados separadamente.

Conhecimento adicional está hardcoded em:

- títulos, descrições e aliases das capabilities;
- keywords do Intent Resolver/Planner;
- templates dos handlers;
- respostas sociais;
- prompts de AI Planner e attachment extraction.

Cobertura atual por módulo:

| Módulo | Conhecimento runtime | Situação |
|---|---|---|
| Clientes/Imóveis/Catálogo/Contratos/Propostas/Agenda/Studio/Financeiro/Desempenho | manual + capabilities | parcial e duplicado com código |
| Marketplace | sem manual dedicado | inexistente para a pergunta G |
| Analytics/operação | capability descriptions + docs desempenho | parcial |
| Conta/configurações/planos | manual só via `general_question` | tardio e sem roteamento dedicado |
| Demais módulos | apenas o que aliases/handlers mencionam | incompleto |

Portanto o COS conhece fragmentos do EME, não um modelo estruturado e recuperável do produto.

## 12. Localização e Response Formatter

Não há camada central de i18n/localização do COS. Há três fontes de vazamento:

1. literais com encoding corrompido em `workflow-engine.ts`, `response-formatter.ts`, `execution-planner.ts`, `conversation.ts`, rotas de conversa e vários handlers;
2. enums/status/actions internos em inglês (`pending`, `completed`, `success`, `failed`, `active`, `property`, `workflow`) mantidos em API/metadata;
3. strings de banco/Prisma interpoladas diretamente, como status de leads/contratos.

O cliente tenta reparar parte disso com `repairCosText()` e mapeamentos locais. Isso não cobre WhatsApp, API, logs ou novas strings.

`formatCosCapabilityResponse` retorna `actionResponse` sem transformação. `formatCosExecutionPlanResponse`:

- devolve a pergunta do step interrompido;
- em falha monta mensagem genérica;
- em um step repassa a resposta;
- em múltiplos steps concatena labels e a última resposta resumida por whitespace.

Não valida português, tamanho, repetição, enum, JSON, contraste de sucesso/falha ou consistência. A naturalidade depende de cada handler.

## 13. Observabilidade

### 13.1 O que existe

- `decisionAudit` na rota com fast action, requested/effective/resolved action, confidence, reason, candidates, workflow e origem do plano;
- `EmeMessage` e `AiAssistantInteraction` por turno;
- `AiOperationTelemetry` com provider, modelo, tokens, duração, custo, status e erro para chamadas instrumentadas;
- logs de planejamento/execução e audit do AI Orchestrator;
- workflow/memory atual em `BrokerDocument.content`.

### 13.2 O que falta

- trace ID único ligando cliente, rota, planner, handler e todas as escritas;
- snapshot exato do contexto usado e versão/hash de regras/prompts/catálogo;
- score detalhado por sinal do Intent Resolver;
- candidatos e decisão do Entity Resolver persistidos;
- argumentos/resultados de tool call padronizados;
- status tipado de handler;
- marcação explícita de fallback e silent degradation em todos os caminhos;
- transação que garanta consistência entre as três persistências;
- paridade de trace no WhatsApp e nas fast navigations do cliente.

Resposta à pergunta operacional: não é possível reconstruir integralmente e de forma determinística por que uma conversa errou. No portal, com `conversationId`, é possível reconstruir boa parte do roteamento e estado final. Não é possível saber com precisão todo score, contexto histórico ausente, candidatos de entidade, query executada e divergência entre escritas. No WhatsApp a visibilidade é ainda menor.

## 14. Fallbacks e erros

| Fallback | Disparo | Resposta/registro | Risco |
|---|---|---|---|
| `general.chat` | catálogo sem match | texto canned | mascara falta de intent/conhecimento |
| AI Planner → determinístico | desabilitado, indisponível, inválido ou exceção | audit + plano determinístico | usuário não sabe que a estratégia degradou |
| ajuda → excerpt | OpenAI ausente ou resposta truncada | trecho do manual | útil, mas não cobre erro lançado pelo provider em todos os casos |
| attachment extraction | erro OpenAI | `console.error`, drafts vazios | criação segue sem dados e causa parece “IA burra” |
| upload de imagem | erro de storage | `console.error`, URL nula | fluxo segue silenciosamente |
| parser do envelope | JSON inválido | `{workflow:null,memory:null}` | estado desaparece sem erro visível |
| busca de imóvel relaxada | zero resultado estrito | amplia filtros | pode retornar inventário pouco aderente |
| entidade ausente | contrato/agenda/lead em alguns handlers | registro mais recente | ação/consulta sobre entidade errada |
| handler captura erro | falha Prisma específica | texto “não consegui” em `CosActionResult` | executor pode marcar sucesso |
| executor por exceção | handler lança | step failed + erro genérico | causa real fica só em log/metadata |
| rota por exceção | falha geral/Prisma | JSON 500/503 genérico | diferentes causas convergem |
| evento de busca | `.catch(() => {})` | nenhum registro | observabilidade silenciosa |

Esses fallbacks fazem o COS parecer incoerente quando a falha original ocorreu em provider, storage, banco, resolução ou contrato de handler.

## 15. Segurança e confiabilidade

Pontos positivos:

- rota principal exige `BROKER` autenticado;
- queries auditadas usam `brokerId` e IDs são revalidados dentro do broker;
- AI Planner só pode devolver capabilities do catálogo e dependências anteriores;
- anexos são normalizados e limitados antes do uso.

Riscos:

- `decision-security.ts` é lista curta de regexes; não é isolamento robusto contra prompt injection em mensagem/anexo;
- texto e imagem de anexos são enviados ao provider sem camada de redaction por campo;
- AI Planner vê capabilities mutantes, enquanto confirmação efetiva cobre apenas seis actions;
- `ARCHIVE_PROPERTY` executa `property.delete` e `DELETE_LEAD` é permanente;
- fallback para entidade mais recente pode agir no alvo errado;
- handler-level confirmation e planner confirmation divergem;
- não há idempotency key por action/turno;
- writes de estado/interação/crédito não são atômicos.

Esta foi uma análise de segurança restrita ao COS, não uma auditoria geral do EME.

## 16. Testes e evals

### 16.1 Cobertura existente

- `tests/e2e/cos-operational-engine.spec.ts`: 4 testes puros de dependências, pending e falha.
- `tests/e2e/cos-conversation.spec.ts`: 18 casos efetivos de conversa social/categoria (13 parametrizados + 5 explícitos).
- `tests/e2e/cos-core.spec.ts`: 14 testes de UI/auth/atalhos/scroll e comandos com assertions amplas.
- `tests/e2e/cos-history-categories.spec.ts`: 1 teste de histórico.
- `tests/e2e/clients-cos-source.spec.ts`: 1 teste de entrada via Clientes.
- `lib/cos/evals/**` + `scripts/run-cos-evals.mjs`: 400 cenários gerados; último relatório informado como 400/400.
- `scripts/run-cos-planner-scenarios.cjs`: script legado de caracterização/planner.

O eval de 400 casos não executa o pipeline real completo: usa fast action + Intent Resolver e constrói um plano simplificado próprio, sem DB, handler, persistência ou sequência real. Muitos esperados derivam do mesmo catálogo/aliases testados, por isso 100% não equivale a confiabilidade conversacional.

Não existe benchmark consistente de:

- conversa multi-turno natural;
- correção e retorno de tópico;
- pronome/referência/ambiguidade no banco;
- pending expirado ou mudança de assunto;
- erro de handler versus status final;
- prompt snapshots/conflitos;
- paridade portal/WhatsApp;
- execução ponta a ponta com fixtures isoladas.

### 16.2 Bateria diagnóstica adicionada

`tests/e2e/cos-audit-diagnostics.spec.ts` caracteriza os cenários A–J sem banco nem provider. A matriz de resultados está em `docs/cos/COS_DIAGNOSTIC_MATRIX.md`.

O script legado `node scripts/run-cos-planner-scenarios.cjs` falha atualmente no cenário de comissão: esperava `getFinancialSummary` e observou `general`. A falha é preexistente e não foi corrigida.

### 16.3 Validação desta auditoria

- `npx playwright test tests/e2e/cos-conversation.spec.ts tests/e2e/cos-operational-engine.spec.ts tests/e2e/cos-audit-diagnostics.spec.ts --reporter=line`: **32/32 passaram** (10 diagnósticos, 18 sociais/categoria e 4 do executor/workflow).
- Eval sintético executado em modo somente leitura, chamando `runDefaultCosEvalSuite()` sem regravar os relatórios rastreados: **400/400 passaram**; essa taxa mede o escopo limitado descrito em 16.1.
- `node scripts/run-cos-planner-scenarios.cjs`: **falhou** no cenário “Quanto tenho de comissão prevista?”; esperado `getFinancialSummary`, observado `general`. Falha preexistente, não corrigida.
- `npm run lint`: **passou**, sem warnings de lint.
- `npx tsc --noEmit`: **passou**.
- `npm run build`: **passou**; 98 páginas estáticas geradas. O Next exibiu warning preexistente de múltiplos lockfiles e inferiu `C:\Users\mateu` como workspace root.
- A primeira tentativa do novo teste importava `workflow-engine.ts` diretamente e o runner não encontrou o pacote sentinela `server-only`; o teste diagnóstico foi mantido puro e passou a caracterizar o literal de localização por leitura do source, sem mudar produção ou criar infraestrutura paralela.
- Uma invocação isolada via `npx eslint tests/e2e/cos-audit-diagnostics.spec.ts` ficou sem saída até o timeout de 124 s; a chamada direta ao binário local passou em 13,9 s e o `npm run lint` global também passou.

## 17. Problemas encontrados

### P-01 — histórico não participa da decisão

**Problema:** histórico completo é só apresentação.
**Categoria:** Contexto
**Severidade:** crítica
**Arquivo(s):** `app/api/assistant/eme/route.ts`, `app/api/assistant/eme/conversations/[id]/route.ts`
**Comportamento atual:** resolver/modelos recebem mensagem atual, workflow e memória curta.
**Causa provável:** evolução da persistência visual sem integração ao pipeline decisório.
**Impacto:** pronome, correção, sequência e retorno falham.
**Correção recomendada:** criar snapshot conversacional tipado e resumido, com janela recente e referências, antes do roteamento.

### P-02 — confirmação declarativa ignorada

**Problema:** 25 descriptors pedem confirmação; o runtime central aplica só seis actions.
**Categoria:** Segurança
**Severidade:** crítica
**Arquivo(s):** `lib/cos/entities/*.ts`, `lib/cos/execution-planner.ts`
**Comportamento atual:** várias criações/edições/assinatura/Studio executam sem a confirmação declarada.
**Causa provável:** set hardcoded criado paralelamente ao catálogo.
**Impacto:** mutações inesperadas e contrato de segurança falso.
**Correção recomendada:** tornar descriptor/registry a fonte única, com política por risco e testes.

### P-03 — resultado não distingue falha de sucesso

**Problema:** `CosActionResult` não tem status tipado.
**Categoria:** Execução
**Severidade:** crítica
**Arquivo(s):** `lib/cos/types.ts`, `lib/cos/executor.ts`, `lib/cos/capabilities/lead/manage.ts`
**Comportamento atual:** texto de erro retornado sem throw marca step concluído/sucesso.
**Causa provável:** contrato orientado à resposta textual.
**Impacto:** COS pode registrar sucesso após falha real.
**Correção recomendada:** resultado discriminado `ok/error/awaiting_input`, com error code e formatter separado.

### P-04 — pipelines divergentes por superfície

**Problema:** portal, WhatsApp, demo e navegação local não usam o mesmo motor.
**Categoria:** Arquitetura
**Severidade:** alta
**Arquivo(s):** rotas do portal, WhatsApp, demo e hook do cliente
**Comportamento atual:** contexto, workflow, IA e observabilidade variam.
**Causa provável:** evolução incremental por canal.
**Impacto:** mesma frase tem capacidade e segurança diferentes.
**Correção recomendada:** núcleo de decisão/execução comum com adaptadores de superfície.

### P-05 — action duplicada e handler ausente

**Problema:** `LIST_DOCUMENTS` tem dois descriptors; `GET_DOCUMENT` não tem handler.
**Categoria:** Manutenibilidade
**Severidade:** alta
**Arquivo(s):** `lib/cos/entities/proposal.ts`, `operation.ts`, `capability-handlers.ts`, `capability-catalog.ts`
**Comportamento atual:** lookup por action usa proposta; `GET_DOCUMENT` lança handler não implementado.
**Causa provável:** registry cresceu sem unicidade/cobertura obrigatória.
**Impacto:** capacidade anunciada não executável e roteamento ambíguo.
**Correção recomendada:** validação de startup/teste para action única e handler obrigatório.

### P-06 — Intent Resolver cobre só parte do catálogo

**Problema:** 38 actions hardcoded para 72 actions únicas.
**Categoria:** Intenção
**Severidade:** alta
**Arquivo(s):** `lib/cos/intent-resolver.ts`, `lib/cos/entities/*.ts`
**Comportamento atual:** capabilities existem, mas não são alcançadas por linguagem natural nessa camada.
**Causa provável:** catálogo e resolver mantidos separadamente.
**Impacto:** falso “não consigo”, intents erradas e dependência de botões.
**Correção recomendada:** gerar candidatos do catálogo e aplicar camada contextual/semântica única.

### P-07 — múltiplas camadas classificam a mesma mensagem

**Problema:** fast action, operational intent, intent resolver, planner, recipe e AI planejam em sequência.
**Categoria:** Planejamento
**Severidade:** alta
**Arquivo(s):** `fast-action-resolver.ts`, `operational-intent.ts`, `intent-resolver.ts`, `planner.ts`, `execution-planner.ts`
**Comportamento atual:** decisões se ratificam ou competem sem ownership claro.
**Causa provável:** camadas adicionadas sem reduzir responsabilidade das anteriores.
**Impacto:** difícil explicar, testar e corrigir erro.
**Correção recomendada:** contrato único de decisão com evidências, seguido de planner apenas para dependências.

### P-08 — pending múltiplo e sem expiração

**Problema:** quatro representações, sem TTL/schema/version.
**Categoria:** Pending Input
**Severidade:** alta
**Arquivo(s):** `pending-input.ts`, `workflow-engine.ts`, rota e API de conversa
**Comportamento atual:** estado antigo captura mensagens, UI e servidor podem divergir.
**Causa provável:** pending evoluiu em metadata, memória, workflow e UI.
**Impacto:** loop, pergunta repetida e ação no campo errado.
**Correção recomendada:** estado único tipado, expirável e explicitamente cancelável/substituível.

### P-09 — “não” pode continuar em vez de cancelar

**Problema:** regex considera “não” continuidade forte; cancelamento real depende de flag do cliente.
**Categoria:** Conversação
**Severidade:** alta
**Arquivo(s):** `lib/cos/intent-resolver.ts`, `app/api/assistant/eme/route.ts`, `workflow-engine.ts`
**Comportamento atual:** handler pode receber “não” como valor do pending.
**Causa provável:** cancelamento e resposta negativa compartilham o mesmo score.
**Impacto:** fluxo preso ou dado inválido.
**Correção recomendada:** ato conversacional de rejeição/cancelamento antes do resume payload.

### P-10 — Entity Resolver é parcial e tardio

**Problema:** só cinco famílias têm resolver; proposta, corretor, conversa e documento não.
**Categoria:** Entidades
**Severidade:** alta
**Arquivo(s):** `lib/cos/entity-resolver.ts`, handlers
**Comportamento atual:** resolve depois da action; pronome/lista anterior não participa.
**Causa provável:** resolvers criados conforme handlers demandaram.
**Impacto:** pede dado já presente, escolhe entidade errada ou não entende referência.
**Correção recomendada:** camada de referências antes do plano, preservando resolução broker-scoped.

### P-11 — fallback para registro mais recente

**Problema:** alguns handlers/resolvers escolhem último lead/contrato/evento sem referente robusto.
**Categoria:** Entidades
**Severidade:** alta
**Arquivo(s):** `entity-resolver.ts`, `capabilities/lead/manage.ts`
**Comportamento atual:** “ele/aquele” pode resultar no registro mais recente, não no mencionado.
**Causa provável:** fallback operacional para evitar bloqueio.
**Impacto:** leitura/mutação no alvo errado.
**Correção recomendada:** nunca usar “mais recente” para mutação sem evidência/seleção confirmada.

### P-12 — não existe topic stack/list memory

**Problema:** somente um workflow e IDs atuais são persistidos.
**Categoria:** Memória
**Severidade:** alta
**Arquivo(s):** `lib/cos/types.ts`, `workflow-engine.ts`, rota
**Comportamento atual:** “voltando aos imóveis” não recupera lista/ordem.
**Causa provável:** memory foi desenhada como snapshot de execução.
**Impacto:** retorno e comparação multi-turno impossíveis.
**Correção recomendada:** referências de resultados e topic stack limitada, com expiração.

### P-13 — conhecimento entra tarde

**Problema:** manuais só são carregados depois de escolher help action.
**Categoria:** Conhecimento
**Severidade:** alta
**Arquivo(s):** `capabilities/help/manual.ts`, `help/manage.ts`, `intent-resolver.ts`
**Comportamento atual:** pergunta G vira `SHARE_CATALOG`; manual nunca é consultado.
**Causa provável:** documentação foi acoplada ao handler de ajuda.
**Impacto:** COS parece desconhecer o EME apesar de existirem documentos.
**Correção recomendada:** retrieval leve antes do plano para perguntas de produto.

### P-14 — sem distinção entre explicar e executar

**Problema:** “você consegue cadastrar?” vira `createLead`.
**Categoria:** Intenção
**Severidade:** média
**Arquivo(s):** `conversation.ts`, `operational-intent.ts`, `intent-resolver.ts`
**Comportamento atual:** verbo operacional domina ato de fala.
**Causa provável:** detector social/capacidade aceita apenas frases quase exatas.
**Impacto:** perguntas inocentes iniciam workflows.
**Correção recomendada:** classificar ato (`inform`, `execute`, `confirm`, `correct`, `refer`) antes da action.

### P-15 — persistência não atômica e duplicada

**Problema:** estado, duas interações e créditos são gravados separadamente.
**Categoria:** Arquitetura
**Severidade:** alta
**Arquivo(s):** `app/api/assistant/eme/route.ts`
**Comportamento atual:** falha parcial pode deixar histórico/estado/crédito divergentes.
**Causa provável:** `Promise.all` para reduzir latência sem transaction/outbox.
**Impacto:** retomada incorreta e auditoria inconsistente.
**Correção recomendada:** transação para estado operacional e outbox para efeitos externos.

### P-16 — attachment falha silenciosamente

**Problema:** extração/upload capturam exceção e seguem com resultado vazio.
**Categoria:** Execução
**Severidade:** alta
**Arquivo(s):** `lib/cos/attachment-analysis.ts`
**Comportamento atual:** usuário vê campos faltantes sem saber que provider/storage falhou.
**Causa provável:** fallback orientado à continuidade.
**Impacto:** diagnóstico falso de baixa inteligência.
**Correção recomendada:** resultado parcial tipado com warning/error explícito e trace.

### P-17 — localização espalhada e encoding corrompido

**Problema:** literais corrompidos e enums ingleses podem chegar ao usuário.
**Categoria:** Localização
**Severidade:** média
**Arquivo(s):** workflow, formatter, conversation, rotas, handlers e UI
**Comportamento atual:** mojibake/status técnico; reparo ad hoc no cliente.
**Causa provável:** arquivos/strings convertidos com encodings diferentes e ausência de i18n.
**Impacto:** baixa credibilidade e inconsistência por canal.
**Correção recomendada:** catálogo central de mensagens/status e limpeza única de encoding.

### P-18 — formatter é passthrough

**Problema:** não há contrato conversacional central.
**Categoria:** Resposta
**Severidade:** média
**Arquivo(s):** `lib/cos/response-formatter.ts`, handlers
**Comportamento atual:** tom, tamanho, status e erros variam por função.
**Causa provável:** handlers acumulam operação e apresentação.
**Impacto:** respostas robóticas/repetitivas ou tecnicamente vazadas.
**Correção recomendada:** view model de resultado + formatter/localização determinísticos; NLG opcional só após fatos.

### P-19 — observabilidade não reconstrói decisão completa

**Problema:** há audit parcial, sem trace/context/tool args padronizados.
**Categoria:** Observabilidade
**Severidade:** média
**Arquivo(s):** rota, telemetry, executor, handlers
**Comportamento atual:** é possível ver action final, não reproduzir todo porquê.
**Causa provável:** logging por camada sem contrato comum.
**Impacto:** suporte e regressão dependem de reprodução manual.
**Correção recomendada:** decision trace versionado, privacy-aware e correlacionado.

### P-20 — eval 100% não cobre runtime real

**Problema:** benchmark sintético reutiliza regras e não executa handlers.
**Categoria:** Observabilidade
**Severidade:** média
**Arquivo(s):** `lib/cos/evals/**`, `scripts/run-cos-evals.mjs`
**Comportamento atual:** 400/400 coexistem com falhas A–J.
**Causa provável:** eval de roteamento tratado como eval conversacional.
**Impacto:** indicador de qualidade excessivamente otimista.
**Correção recomendada:** separar routing eval, conversation eval e execution eval com fixtures independentes.

### P-21 — relatório de cobertura está obsoleto

**Problema:** `docs/cos-capability-coverage.md` registra 64/64; runtime tem 73 descriptors e lacunas.
**Categoria:** Manutenibilidade
**Severidade:** média
**Arquivo(s):** relatório e gerador de coverage
**Comportamento atual:** documentação declara cobertura total incorreta.
**Causa provável:** artefato não regenerado/validação permissiva por action duplicada.
**Impacto:** decisões técnicas partem de inventário falso.
**Correção recomendada:** coverage no CI com unicidade e handler por capability.

### P-22 — prompt do AI Planner cresce com catálogo inteiro

**Problema:** todas as capabilities são serializadas em cada chamada.
**Categoria:** Performance
**Severidade:** baixa
**Arquivo(s):** `lib/cos/ai-orchestrator.ts`
**Comportamento atual:** custo/latência crescem com registry mesmo para pergunta simples.
**Causa provável:** ausência de pré-seleção por domínio.
**Impacto:** tokens e chance de escolha irrelevante.
**Correção recomendada:** recuperar domínio/capabilities relevantes antes de montar prompt.

## 18. Ranking de problemas

### P0

- P-01: histórico fora da decisão.
- P-02: confirmação declarativa ignorada.
- P-03: falha pode virar sucesso.
- P-04: pipelines divergentes por superfície.
- P-05: action duplicada/handler ausente.

### P1

- P-06, P-07: cobertura parcial e decisão duplicada.
- P-08, P-09: pending múltiplo, sem TTL e negação ambígua.
- P-10, P-11, P-12: entidade parcial, fallback perigoso e ausência de topic/list memory.
- P-13: conhecimento entra tarde.
- P-15, P-16: persistência não atômica e attachment silencioso.

### P2

- P-14: explicar versus executar.
- P-17, P-18: localização e resposta.
- P-19, P-20, P-21: trace, eval e cobertura.

### P3

- P-22: redução futura de prompt/custo.
- expansão estruturada do Livro do EME e eval semântico após estabilizar P0/P1.

## 19. Pontos de integração do Livro do EME

A Knowledge Layer não deve entrar em toda chamada. O ponto recomendado é entre um roteador leve de ato/domínio e o planejamento final:

```text
mensagem + histórico curto + workspace
  -> detector de ato/domínios (explicar, consultar, executar, corrigir, confirmar)
  -> Knowledge Retrieval apenas se necessário
  -> Decision Context unificado
  -> Intent/Entity Resolution
  -> Planner/Executor
  -> formatter recebe fatos + trechos usados
```

Entradas específicas:

- Antes do Intent Resolver: somente índice leve/glossário para reconhecer “Catálogo”, “Marketplace”, módulo e ato de suporte.
- Durante planejamento: regras/procedimentos relevantes para pré-condições, confirmação e capabilities permitidas.
- Antes da execução: regras de negócio versionadas, não texto institucional livre.
- Formatter: trechos/document IDs usados para explicar; nunca alterar fatos do resultado.
- Perguntas de suporte: retrieval scoped direto, sem carregar catálogo de ferramentas inteiro.

Separação recomendada:

- conhecimento institucional;
- glossário e relações entre módulos;
- regras de negócio executáveis/versionadas;
- documentação de módulos;
- procedimentos passo a passo;
- exemplos conversacionais/evals.

Exemplo “Qual a diferença entre meu catálogo e o Marketplace?”: detector identifica ato `explain` e domínios `catalog` + `marketplace`; retrieval carrega só esses dois tópicos e presença pública; planner operacional não precisa receber contratos/Studio/financeiro.

## 20. Arquitetura recomendada

| Como é hoje | Como deveria ficar |
|---|---|
| quatro pipelines por superfície | core único + adapters de portal/WhatsApp/demo |
| mensagem atual + memory curta | conversation snapshot tipado + janela/resumo/referências |
| regex grossa → action | ato/domínio → contexto/knowledge → intent/action |
| Planner reclassifica | Intent decide objetivo; Planner decide steps/dependências |
| entity resolution dentro do handler | referência/entity context antes do plano, validação final no handler |
| pending em quatro lugares | pending único, versionado, expirável e cancelável |
| um workflow sobrescreve outro | workflow ativo + topic/result stack limitada |
| flags do catálogo ignoradas | registry como fonte de confirmação/permissão/capacidade |
| `CosActionResult` textual | resultado discriminado + payload factual + error code |
| formatter passthrough | formatter/localização sobre view model tipada |
| docs só no handler help | retrieval scoped por domínio/ato |
| logs por camada | trace correlacionado e versionado |
| eval sintético único | suites separadas de routing, conversation e execution |

Isso aproveita registry, workflow, handlers broker-scoped, telemetry e manuais existentes; não exige reescrever tudo.

## 21. Respostas às 25 perguntas obrigatórias

1. **Por que erra tanto?** Porque decide action com mensagem isolada/heurística antes de recuperar contexto, entidade e conhecimento suficientes.
2. **Camada com mais erros?** O conjunto Intent Resolver + estado conversacional; execução possui riscos estruturais próprios.
3. **Intent Resolver ajuda ou limita?** Ajuda comandos explícitos conhecidos; limita linguagem natural, continuidade e catálogo fora das 38 candidates.
4. **Entende conversa ou mensagens isoladas?** Majoritariamente mensagem atual + workflow/memória curta, não a sequência.
5. **Como resolve “ele/esse/o segundo”?** Pronome não é resolvido; ordinal só em pending de seleção; IDs ativos apenas influenciam scores/payload.
6. **Onde contexto se perde?** Histórico fora da rota, conclusão do pending, troca do único workflow e `lastResult` textual.
7. **Pending interfere?** Sim; resposta curta tende a ser capturada e não há TTL.
8. **Decisões duplicadas?** Sim, em pelo menos oito camadas listadas na seção 8.
9. **Conhece realmente o EME?** Parcialmente.
10. **Onde está o conhecimento?** 15 manuais de ajuda, descriptors/aliases, handlers, regexes e prompts.
11. **Como prompts são montados?** Templates inline somam mensagem atual + workspace/pending/workflow/catálogo ou manual; não incluem histórico real.
12. **Prompts conflitantes?** Há conflito entre segurança declarada no catálogo/prompt e confirmação efetiva; routing impede alguns prompts de receber a pergunta.
13. **Por que inglês/status?** Enums/metadata internos, interpolação direta e encoding inconsistente.
14. **Existe localização central?** Não; há reparos dispersos no cliente.
15. **Sabe o que consegue executar?** Registry sabe parcialmente, mas aceita descriptor sem handler e intent não cobre todo registry.
16. **Diferencia explicar de executar?** Não de forma geral; só regexes sociais/ajuda estreitas.
17. **Usa dados existentes sem perguntar?** Às vezes por IDs/pending; sem snapshot completo, repete perguntas.
18. **Corrige após “não, muda”?** Não de modo geral; cenário C falhou.
19. **Troca de assunto?** Sim quando nova intent tem score forte, mas o workflow anterior é perdido.
20. **Volta ao assunto anterior?** Não de forma confiável; não há topic/list stack.
21. **Logs bastam?** Não para reconstrução completa; só diagnóstico parcial no portal.
22. **Risco de sucesso após falha?** Sim, por `CosActionResult` sem status e catches de handler.
23. **Legado interferindo?** descriptors `source: legacy`, planner fallback, script/coverage obsoletos, status/pending reconstruídos e pipeline WhatsApp antigo.
24. **Onde conectar Livro do EME?** Após detector leve de ato/domínio e antes da resolução/plano, com retrieval scoped; também fornecer evidência ao formatter.
25. **O que fazer primeiro na Etapa 2?** Contrato de resultado/confirmation, snapshot de contexto, pending único e decision trace antes de melhorar prompts.

## 22. Plano para a Etapa 2

Sequência pequena e segura, sem iniciar nesta auditoria:

1. Congelar contratos e invariantes com testes: action única, handler obrigatório, confirmação do descriptor e resultado discriminado.
2. Introduzir `ConversationSnapshot` somente leitura, composto de janela recente, workflow, pending, entidades e últimos resultados.
3. Unificar pending/negação/cancelamento e adicionar TTL/versionamento compatível.
4. Separar ato conversacional (`explain/execute/correct/confirm/select/switch/return`) da escolha de capability.
5. Fazer Entity Resolver consumir referências/listas do snapshot antes do Planner, mantendo validação broker-scoped no handler.
6. Fazer o Planner cuidar apenas de steps/dependências e usar o registry como fonte de confirmação/permissão.
7. Adicionar resultado tipado e formatter/localização central, mantendo adaptadores temporários para handlers atuais.
8. Adicionar trace correlacionado e evals multi-turno A–J; só então integrar retrieval scoped do Livro do EME.

## 23. Artefatos e limite da etapa

- Relatório principal: `docs/cos/COS_AUDIT.md`
- Inventário: `docs/cos/COS_ACTION_INVENTORY.md`
- Matriz A–J: `docs/cos/COS_DIAGNOSTIC_MATRIX.md`
- Teste de caracterização: `tests/e2e/cos-audit-diagnostics.spec.ts`

Nenhuma correção funcional do COS foi implementada nesta etapa.
