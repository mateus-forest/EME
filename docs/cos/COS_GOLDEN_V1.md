# COS — Golden Conversation Scenarios V1

Data de conversão e auditoria do oracle: 18/08/2026

## Objetivo

Este conjunto transforma a biblioteca comportamental “COS — Golden Conversation Scenarios V1” em fixtures tipadas e executáveis, sem alterar o comportamento do COS para acomodar falhas atuais.

A fonte possui 104 números-base e 106 casos mínimos executáveis: os cenários 10 e 93 têm variantes A/B com estados transacionais distintos.

## Arquivos

- `lib/cos/evals/conversations/golden-v1.ts`: 104 cenários-base, 106 cases, turnos, estado, assertions, gaps e metadados versionados.
- `lib/cos/evals/golden-types.ts`: contrato tipado das classificações, prioridades, camadas, estado e resultado tri-state.
- `lib/cos/evals/conversational-runner.ts`: validação, execução determinística, métricas por camada e resultado por case/turno.
- `scripts/run-cos-evals.mjs`: geração de `latest`, baseline imutável e hashes de proveniência.
- `reports/cos-evals/latest.json`: resultado completo e legível por máquina.
- `reports/cos-evals/latest.md` e `docs/cos/COS_EVAL_REPORT.md`: resumo humano do último baseline.
- `docs/cos/COS_GOLDEN_V1_ORACLE_AUDIT.md`: correções do gabarito, exemplos antes/depois e falhas remanescentes do COS.

O golden anterior de 50 conversas/111 turnos permanece no repositório como referência histórica e é reportado separadamente. Ele não é somado ao resultado oficial V1.

## Contrato do case

Cada case registra:

- ID estável e vínculo ao cenário-base;
- classificação e prioridade da fonte;
- domínios;
- turnos e expectativas de ato, domínio primário/secundário, capability referenciada, capability selecionada, capability executada, referência, mutação, pending, confirmação e knowledge;
- fixture e estado antes/depois;
- working set esperado;
- trace, persistência, partial success, artefatos e fatos obrigatórios;
- forbidden behaviors por código;
- custo, entitlement e classe de falha quando aplicáveis;
- gap conhecido e camada esperada da falha;
- graceful degradation atual separado do contrato futuro.

## Semântica do baseline

O schema V1.1 não usa um único `capabilityId` como atalho. Cada turno separa:

- `referencedCapabilityId`: capability real mencionada ou relevante para a pergunta;
- `referencedProductFunction`: função real do produto quando ainda não existe capability no Registry;
- `selectedCapabilityId`: capability operacional escolhida para o fluxo;
- `executedCapabilityId`: capability que deve ter sido efetivamente executada.

Em perguntas de conhecimento e product gaps, seleção e execução permanecem explicitamente `null`. Em seleções, pending e confirmações, a capability pode estar selecionada enquanto a execução continua ausente.

Cada assertion termina em um de três estados:

- `pass`: a camada foi efetivamente executada e coincidiu com o expected;
- `fail`: a camada foi executada e divergiu;
- `not_evaluated`: o ambiente atual não possui oracle seguro para aquela camada.

O case termina como:

- `pass` somente se todas as camadas obrigatórias forem executadas e aprovadas;
- `fail` se ao menos uma camada executada falhar;
- `incomplete` se não houver falha executada, mas restar camada obrigatória não avaliada.

Accuracy e coverage são separadas. Uma camada com zero avaliações recebe `accuracy: null`, nunca 100%.

## O que o baseline determinístico avalia

- Dialogue Act;
- domínio primário e domínios secundários esperados;
- capability referenciada;
- capability selecionada para a operação;
- resolução de referência/entidade quando há ID esperado;
- continuidade contextual observável no Decision Layer;
- pending/clarificação;
- policy declarada de confirmação;
- retrieval de knowledge quando há documentos/trechos esperados;
- executor e Response ViewModel em fixtures estruturais independentes.

## O que permanece `not_evaluated`

Sem PostgreSQL isolado e providers injetáveis, o baseline não afirma cobertura de:

- persistência Prisma do cenário;
- diff transacional e isolamento real por tenant;
- ledger/débito/reembolso de créditos;
- entitlement real de Plano;
- chamadas e artefatos de storage/provider;
- qualidade semântica completa da resposta;
- forbidden behaviors que dependem de resposta ou side effect;
- capability realmente executada na conversa oficial, enquanto não houver trace ponta a ponta seguro;
- jornada ponta a ponta pela rota autenticada.

O ambiente local aponta para serviços reais. Por segurança e para evitar custo, a conversão não usa a rota autenticada, banco remoto, OpenAI nem providers do Studio.

## Inconsistências preservadas da fonte

1. A contagem declarada é 104, mas as variantes 10A/10B e 93A/93B resultam em 106 cases.
2. O cenário 78 combina `KNOWLEDGE_ONLY / PRODUCT_EXISTS_COS_GAP`.
3. O cenário 98 usa `KNOWLEDGE`, rótulo inexistente na legenda. A auditoria deixou de convertê-lo em `KNOWLEDGE_ONLY`: o caso permanece `SUPPORTED_NOW`, pois representa consulta operacional que deve pedir a métrica antes de executar.
4. Os cenários 75 e 96 usam prioridade híbrida `P0/P1`.
5. 10A/10B têm a mesma primeira frase, mas a fonte não define a precondição que diferencia pending de commit.
6. O cenário 18 cita bairro como requisito do Catálogo, embora o readiness atual do código não o exija.
7. O cenário 95 originalmente não fornece os inputs necessários para alcançar a falha técnica do segundo step; a case torna imóvel e valor explícitos e registra isso em `sourceIssues`.
8. Cenários condicionais, como 46, 52, 61, 68, 76, 78, 84, 85, 90 e 102, precisam de variantes adicionais para cobrir todos os ramos descritos.
9. Os cenários 74 e 75 são marcados `SUPPORTED_NOW`, embora incluam passos equivalentes a cenários classificados com gap conhecido.
10. Product gaps que misturam comportamento atual e futuro foram separados em `gracefulDegradation` e `futureContract`.

Essas divergências não foram usadas para rebaixar o expected nem para corrigir o COS.

## Execução

```bash
npm run cos:eval
```

O comando não falha por gaps do baseline, para permitir diagnóstico. O modo estrito permanece disponível:

```bash
COS_EVALS_STRICT=true npm run cos:eval
```

O script grava o resultado corrente e cria uma cópia imutável identificada pelo SHA-256 conjunto do dataset, schema e evaluator em `reports/cos-evals/baselines/`.

O oracle está congelado em `lib/cos/evals/conversations/golden-v1.lock.json`. Qualquer alteração em fixture, tipos ou evaluator invalida o lock e impede a geração silenciosa de outra baseline até uma nova auditoria explícita.

## Próxima etapa segura

Para avaliar P0 por persistência real, é necessário um PostgreSQL efêmero/dedicado, broker/tenant por fixture, relógio fixo, adapters de provider/storage, ledger inspecionável e fault injection por step. Até essa infraestrutura existir, as respectivas camadas devem continuar explicitamente `not_evaluated`.
