# COS — Etapa 2C: camada de decisão conversacional

## Objetivo e fronteira

A Etapa 2C introduz uma decisão conversacional estruturada antes da escolha de action/capability. Ela reutiliza o `CosConversationSnapshot` da 2B e os contratos de execução da 2A. Não implementa Livro do EME, RAG, embeddings, nova personalidade, localização central ou runtime de WhatsApp.

## Antes e depois

```text
ANTES

message
→ fast action
→ operational intent
→ Intent Resolver com 38 actions hardcoded
→ planner reclassifica
→ recipe/AI planner
→ workflow
→ handler


DEPOIS DA 2C

message
+ ConversationSnapshot
→ Dialogue Decision
     ├ dialogue act
     ├ domínio(s)
     ├ referências
     └ objetivo
→ capability candidates from Registry
→ capability resolution
→ Planner
→ Workflow
→ Executor
```

Fast actions explícitas continuam disponíveis. Uma `requestedAction` enviada pela UI continua sendo evidência forte, mas não contorna Registry, confirmação, permissão, seleção de entidade ou os contratos tipados do executor.

## Contrato `CosDialogueDecision`

A decisão versão 1 contém:

- `dialogueAct`, confiança e evidências;
- domínio primário e domínios secundários;
- objetivo (`execute`, `query`, `explain`, `respond`, `continue` ou `clarify`);
- referência resolvida e IDs ambíguos;
- capability/action selecionada;
- candidatas ranqueadas, com confiança e evidências;
- decisão de continuar workflow, iniciar outro ou não iniciar;
- motivo de esclarecimento e fonte da decisão.

O resultado é persistido no `decisionAudit` de forma reduzida. Mensagens e valores sensíveis não são duplicados no audit.

## Dialogue acts

Foram implementados:

- `execute`;
- `query`;
- `explain`;
- `capability_question`;
- `correct`;
- `confirm`;
- `reject`;
- `cancel`;
- `select`;
- `switch_topic`;
- `return_topic`;
- `provide_input`;
- `social`;
- `unknown`.

A classificação combina estrutura linguística clara, pending tipado, workflow, referências, selection sets, tópico atual, topic stack, entidades ativas, workspace e anexos. Não há chamada adicional a LLM para classificar cada turno.

### Regras contextuais importantes

- `não` só é `reject` quando há confirmação pendente;
- `não, o valor é...` é `correct`;
- `cancelar compromisso` é uma operação de agenda, enquanto `deixa pra lá` com workflow ativo é `cancel`;
- valor compatível com pending é `provide_input`;
- pergunta de outro domínio durante pending é `switch_topic`/`query` e não vira valor do campo;
- ordinal/demonstrativo usa selection set; sem referente, pede contexto;
- `capability_question` responde sobre capacidade e nunca abre automaticamente a mutação.

## Domínios

O contrato conversacional cobre:

- `lead`;
- `property`;
- `proposal`;
- `contract`;
- `agenda`;
- `catalog`;
- `marketplace`;
- `finance`;
- `analytics`;
- `studio`;
- `help`;
- `general`.

Domínio e capability são conceitos separados. `property` restringe o universo de busca, mas não implica analytics; `agenda` não implica criação; `catalog` não implica compartilhamento.

## Resolução pelo Registry

O catálogo hardcoded de 38 actions foi removido do `Intent Resolver`. A fonte de candidatas agora são os descriptors do catálogo/Registry, filtrados por:

1. surface;
2. domínio conversacional;
3. dialogue act e natureza da operação;
4. aliases/tokens do descriptor;
5. referências e entidade ativa;
6. sinais específicos seguros, usados somente como boosts.

Na surface `portal`, existem 74 descriptors e 73 capabilities/actions roteáveis. `operation.summary` é a única exceção direta: ela continua interna porque agrega resultados de uma recipe e não representa um objetivo final isolado.

Capabilities antes fora do universo do Intent Resolver, como agenda hoje/semana/mês, fluxo de caixa, previsões financeiras, preview de contrato e `property.get`, agora podem participar do roteamento.

## Confiança e fallback

Os parâmetros estão centralizados em `COS_DECISION_CONFIDENCE`:

- alta confiança: `0.82`;
- média confiança: `0.62`;
- mínimo read-only: `0.56`;
- mínimo de mutação: `0.72`;
- margem mínima de ambiguidade: `0.08`.

Mutações exigem mais evidência que consultas. Se ato e domínio são conhecidos, mas a capability permanece ambígua, a rota responde `needs_clarification` com candidatas ou pede o referente mínimo. O runtime não escolhe por ordem de cadastro e não cai silenciosamente em `general.chat` nesses casos.

## Relação com `ConversationSnapshot`

A Decision Layer consome diretamente:

- active/recent entities;
- workflow e pending;
- tópico atual e tópicos recentes;
- selection sets;
- última execução;
- workspace e referências temporais.

Consultas read-only, explicações e perguntas de capacidade podem interromper um pending sem destruí-lo. A consulta atualiza tópico/resultados do snapshot, enquanto o workflow transacional anterior permanece disponível para retomada explícita.

`CosConversationMemory` permanece como adapter legado para IDs ativos. Não foi criada outra memória paralela.

## Intent Resolver antes/depois

Antes, o resolver construía e pontuava manualmente 38 actions. Agora ele:

1. aplica o guard de segurança;
2. consome `CosDialogueDecision`;
3. traduz a decisão para o contrato legado de continuidade usado pela rota;
4. entrega action, confiança, candidatas e evidências.

Ele deixou de ser o catálogo de actions e deixou de inferir sozinho continuidade por tamanho da mensagem. O resolver permanece como adapter durante a migração para preservar chamadas existentes e `requestedAction` explícita.

## Planner

`planCosCapability` prioriza `context.decision.selectedCapabilityId`. O score genérico do Planner permanece apenas como compatibilidade/fallback para callers que ainda não entregam Decision Layer.

O Planner passa a cuidar principalmente de:

- plano single ou multi-step;
- ordem e dependências;
- prerequisites/pending dos handlers;
- confirmação declarativa;
- telemetria do plano.

## Recipes

As sete recipes foram preservadas como templates de dependências. Cada recipe agora declara dialogue acts e domínios primários compatíveis. O match textual só é aceito quando concorda com o objetivo resolvido; uma substring isolada não pode substituir uma decisão de outro ato/domínio.

O cenário `Cadastre a Ana e depois crie uma proposta...` resolve primeiro `execute/lead` e permite a recipe `lead_create_then_proposal` criar steps dependentes.

## AI Orchestrator

O AI Orchestrator não virou classificador principal. Quando acionado, recebe:

- dialogue act;
- domínios;
- objetivo e capability escolhida;
- referências não sensíveis;
- resumo do snapshot;
- capabilities filtradas por decisão/domínio.

Ele não recebe mais necessariamente o catálogo inteiro. A validação determinística continua impedindo capability inexistente, surface inválida e dependência inválida. Confirmação, autorização, broker scope e execução permanecem fora do modelo.

## Agenda

Antes, `Tenho compromisso amanhã?` era candidato a `CREATE_AGENDA_EVENT`. Depois da 2C:

- pergunta sobre amanhã → `query/agenda` → `LIST_AGENDA_EVENTS`;
- hoje → `LIST_AGENDA_TODAY`;
- semana → `LIST_AGENDA_WEEK`;
- criação explícita → `CREATE_AGENDA_EVENT`;
- alterar, cancelar e concluir usam as respectivas capabilities mutantes.

## Capability questions

Antes, `Você consegue cadastrar um cliente?` iniciava `createLead`. Agora gera `capability_question/lead`, identifica `lead.create` como capacidade consultada, executa somente `general.chat` gratuito e oferece continuidade sem criar workflow de cadastro.

O mesmo foi validado para imóveis, propostas, contratos, agenda e Studio IA.

## Explain e conhecimento atual

`Qual a diferença entre catálogo e Marketplace?` agora gera `explain`, domínios `catalog + marketplace`, e usa `help.general_question`. Não executa `SHARE_CATALOG`.

Como o Livro do EME ainda não existe e o manual atual não possui cobertura completa de Marketplace, a qualidade factual continua limitada ao conteúdo disponível. A decisão correta e a limitação honesta são responsabilidade desta etapa; o conhecimento completo fica para as próximas.

## Observabilidade

`decisionAudit.dialogue` passou a registrar:

- act/confiança/evidências;
- domínio primário/secundários;
- tipo/ID/reason da referência;
- objective;
- capability/action selecionada;
- candidatas e confiança;
- switch/return/correct por meio das evidências;
- fonte e motivo de esclarecimento.

Isso permite reconstruir, por exemplo: `query → agenda → agenda.list → LIST_AGENDA_EVENTS`, em vez de observar somente a action final.

## Testes e cenários

`tests/e2e/cos-conversational-decision.spec.ts` cobre A–O, oito variações de agenda, cinco perguntas de capacidade e o inventário roteável do Registry.

`tests/e2e/cos-audit-diagnostics.spec.ts` foi atualizado para o comportamento A–J pós-2C. A matriz detalhada está em `docs/cos/COS_DIAGNOSTIC_MATRIX.md`.

Validação executada em 14/08/2026:

- suíte combinada de Decision Layer, ConversationSnapshot, contratos de execução, workflow/executor, diagnóstico A–J e conversa: 75/75 testes passaram;
- rerun final da Decision Layer + diagnóstico A–J: 39/39 testes passaram;
- E2E autenticado de troca/retorno de tópico, seleção, cancelamento, retomada e ambiguidade: 5/5 testes passaram;
- `npm run lint`: passou sem erros;
- `npx tsc --noEmit`: passou sem erros;
- `npm run build`: passou, com 98 páginas estáticas geradas;
- warning conhecido do Next sobre múltiplos lockfiles/workspace root permaneceu sem alteração.

## Limitações e próximas etapas

Não implementado nesta etapa:

- Etapa 3 — Livro do EME;
- Etapa 4 — Knowledge Retrieval contextual;
- Etapa 5 — Response Layer e localização central;
- resolução semântica por nomes fora do snapshot/banco;
- memória longa ou múltiplos workflows mutantes simultâneos;
- integração ou paridade de WhatsApp.

O ponto de integração futuro para conhecimento fica entre a identificação de act/domínios e a resolução final de capability. A Decision Layer poderá solicitar trechos relevantes sem incorporar documentação ou regras institucionais ao resolver.
