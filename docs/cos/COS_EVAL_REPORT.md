# COS — Baseline do Golden Conversation Scenarios V1

Gerado em: 2026-08-18T05:22:08.986Z

## Dataset

- Routing legado single-turn: 400 casos.
- Golden V1: 104 cenários-base / 106 cases executáveis / 168 turnos.
- Golden anterior preservado: 50 conversas / 111 turnos.
- Execution fixtures no executor real: 10.
- Response fixtures: 12.
- Localization fixtures: 5.

## Auditoria do oracle V1.1

- Cases auditados contra a fonte humana: 106.
- Cases afetados pela ambiguidade estrutural do campo único de capability: 106.
- Cases com correção semântica além da separação mecânica do schema: 82.
- Oracle congelado: `true` em 2026-08-18; versão `golden-v1.1-oracle-audit`.

Categorias afetadas (podem se sobrepor):

- `knowledgeAndProductGapSemantics`: 33 cases.
- `deferredSelectionOrExecution`: 28 cases.
- `multiDomainExpectations`: 44 cases.
- `contextSeedCorrections`: 3 cases.
- `sourceClassificationCorrections`: 1 cases.
- `confirmationContractCorrections`: 16 cases.

## Resultado dos cases oficiais

- Passaram integralmente: 0.
- Falharam em ao menos uma camada avaliada: 102.
- Incompletos por camada obrigatória não avaliada: 4.
- Falhas associadas a gaps conhecidos: 36.
- Falhas fora dos gaps previamente anotados: 66.
- Forbidden behaviors com observação executável: 0; não avaliados: 106.

Um case só passa integralmente quando todas as camadas obrigatórias são avaliadas e aprovadas. Camada sem oracle executável produz `incomplete`, nunca aprovação implícita.

### Causas estruturais mais frequentes

- `dialogue_act`: 95 cases com falha.
- `domain`: 78 cases com falha.
- `capability_reference`: 73 cases com falha.
- `capability_selection`: 72 cases com falha.
- `entity_resolution`: 44 cases com falha.
- `reference_resolution`: 44 cases com falha.

## Cobertura e acurácia por camada do Golden V1

| Camada | Aprovados/avaliados | Acurácia | Cobertura | Não avaliados |
|---|---:|---:|---:|---:|
| dialogue_act | 11/106 | 10.38% | 100% | 0 |
| domain | 28/106 | 26.42% | 100% | 0 |
| entity_resolution | 12/56 | 21.43% | 100% | 0 |
| reference_resolution | 12/56 | 21.43% | 100% | 0 |
| working_set | 0/0 | N/A | 0% | 28 |
| context_continuity | 3/42 | 7.14% | 100% | 0 |
| capability_reference | 8/81 | 9.88% | 76.42% | 25 |
| capability_selection | 34/106 | 32.08% | 100% | 0 |
| capability_execution | 0/0 | N/A | 0% | 106 |
| pending_input | 2/21 | 9.52% | 100% | 0 |
| confirmation | 1/8 | 12.5% | 100% | 0 |
| persistence | 0/0 | N/A | 0% | 47 |
| partial_success | 0/0 | N/A | 0% | 6 |
| knowledge_correctness | 4/15 | 26.67% | 42.86% | 20 |
| gap_recognition | 0/0 | N/A | 0% | 36 |
| failure_classification | 0/0 | N/A | 0% | 7 |
| entitlement_security | 0/0 | N/A | 0% | 3 |
| credit_correctness | 0/0 | N/A | 0% | 20 |
| response_quality | 0/0 | N/A | 0% | 106 |
| forbidden_behaviors | 0/0 | N/A | 0% | 106 |

## Métricas determinísticas auxiliares

| Métrica | Aprovados | Acurácia | Falhas |
|---|---:|---:|---:|
| dialogueActAccuracy | 37/168 | 22.02% | 131 |
| domainAccuracy | 53/168 | 31.55% | 115 |
| capabilityReferenceAccuracy | 31/136 | 22.79% | 105 |
| capabilityAccuracy | 68/168 | 40.48% | 100 |
| referenceResolution | 24/85 | 28.24% | 61 |
| contextContinuity | 6/104 | 5.77% | 98 |
| knowledgeRetrieval | 5/17 | 29.41% | 12 |
| executionCorrectness | 10/10 | 100% | 0 |
| responseCorrectness | 12/12 | 100% | 0 |
| localization | 5/5 | 100% | 0 |
| safetyInvariants | 116/191 | 60.73% | 75 |
| deterministicConversationChecks | 4/106 | 3.77% | 102 |
| legacyRouting | 158/400 | 39.5% | 242 |

Não existe média agregada: coverage e accuracy são separadas para impedir que uma camada não executada apareça como 100%.

## Primeiras falhas observadas por turno/camada

- **routing/CLIENT_001 turno 2** — E quantos estão negociando?
  - esperado: domínio=lead
  - observado: domínio=general
- **routing/CLIENT_001 turno 2** — E quantos estão negociando?
  - esperado: capability referenciada=lead.summary
  - observado: capability referenciada=null
- **routing/CLIENT_001 turno 2** — E quantos estão negociando?
  - esperado: capability selecionada=lead.summary
  - observado: capability selecionada=null
- **routing/CLIENT_001 turno 3** — Quem são?
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_001 turno 3** — Quem são?
  - esperado: domínio=lead
  - observado: domínio=general
- **routing/CLIENT_001 turno 3** — Quem são?
  - esperado: capability referenciada=lead.summary
  - observado: capability referenciada=general.chat
- **routing/CLIENT_001 turno 3** — Quem são?
  - esperado: capability selecionada=lead.summary
  - observado: capability selecionada=null
- **routing/CLIENT_002 turno 1** — Procura alguma coisa pro Carlos.
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_002 turno 1** — Procura alguma coisa pro Carlos.
  - esperado: domínio=property+lead
  - observado: domínio=general
- **routing/CLIENT_002 turno 1** — Procura alguma coisa pro Carlos.
  - esperado: capability referenciada=property.search
  - observado: capability referenciada=general.chat
- **routing/CLIENT_002 turno 1** — Procura alguma coisa pro Carlos.
  - esperado: capability selecionada=property.search
  - observado: capability selecionada=null
- **safety/CLIENT_002 turno 1** — Procura alguma coisa pro Carlos.
  - esperado: clarificação=true
  - observado: clarificação=false
- **routing/CLIENT_002 turno 2** — Mendes.
  - esperado: dialogue act=select
  - observado: dialogue act=provide_input
- **routing/CLIENT_002 turno 2** — Mendes.
  - esperado: domínio=property+lead
  - observado: domínio=property
- **context/CLIENT_002 turno 2** — Mendes.
  - esperado: referência=lead-carlos-mendes
  - observado: referência=nenhuma
- **routing/CLIENT_003 turno 1** — Tem alguma coisa boa pra Fernanda?
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_003 turno 1** — Tem alguma coisa boa pra Fernanda?
  - esperado: domínio=property+lead
  - observado: domínio=general
- **routing/CLIENT_003 turno 1** — Tem alguma coisa boa pra Fernanda?
  - esperado: capability referenciada=property.search
  - observado: capability referenciada=general.chat
- **routing/CLIENT_003 turno 1** — Tem alguma coisa boa pra Fernanda?
  - esperado: capability selecionada=property.search
  - observado: capability selecionada=null
- **context/CLIENT_003 turno 1** — Tem alguma coisa boa pra Fernanda?
  - esperado: referência=lead-fernanda
  - observado: referência=nenhuma
- **routing/CLIENT_003 turno 2** — E o outro?
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_003 turno 2** — E o outro?
  - esperado: domínio=property+lead
  - observado: domínio=property
- **routing/CLIENT_003 turno 2** — E o outro?
  - esperado: capability referenciada=property.get
  - observado: capability referenciada=general.chat
- **routing/CLIENT_003 turno 2** — E o outro?
  - esperado: capability selecionada=property.get
  - observado: capability selecionada=null
- **context/CLIENT_003 turno 2** — E o outro?
  - esperado: referência=property-b
  - observado: referência=nenhuma
- **routing/CLIENT_004 turno 1** — Procura apartamento pro João.
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_004 turno 1** — Procura apartamento pro João.
  - esperado: domínio=property+lead
  - observado: domínio=property
- **routing/CLIENT_004 turno 1** — Procura apartamento pro João.
  - esperado: capability referenciada=property.search
  - observado: capability referenciada=general.chat
- **routing/CLIENT_004 turno 1** — Procura apartamento pro João.
  - esperado: capability selecionada=property.search
  - observado: capability selecionada=null
- **safety/CLIENT_004 turno 1** — Procura apartamento pro João.
  - esperado: clarificação=true
  - observado: clarificação=false
- **routing/CLIENT_004 turno 2** — Pereira.
  - esperado: dialogue act=select
  - observado: dialogue act=provide_input
- **routing/CLIENT_004 turno 2** — Pereira.
  - esperado: domínio=property+lead
  - observado: domínio=property
- **context/CLIENT_004 turno 2** — Pereira.
  - esperado: referência=lead-joao-pereira
  - observado: referência=nenhuma
- **routing/CLIENT_004 turno 3** — Só até 700.
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_004 turno 3** — Só até 700.
  - esperado: domínio=property+lead
  - observado: domínio=property
- **routing/CLIENT_004 turno 3** — Só até 700.
  - esperado: capability referenciada=property.search
  - observado: capability referenciada=general.chat
- **routing/CLIENT_004 turno 3** — Só até 700.
  - esperado: capability selecionada=property.search
  - observado: capability selecionada=null
- **context/CLIENT_004 turno 3** — Só até 700.
  - esperado: referência=lead-joao-pereira
  - observado: referência=nenhuma
- **routing/CLIENT_004 turno 4** — E com duas vagas?
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_004 turno 4** — E com duas vagas?
  - esperado: domínio=property+lead
  - observado: domínio=property
- **routing/CLIENT_004 turno 4** — E com duas vagas?
  - esperado: capability referenciada=property.search
  - observado: capability referenciada=general.chat
- **routing/CLIENT_004 turno 4** — E com duas vagas?
  - esperado: capability selecionada=property.search
  - observado: capability selecionada=null
- **context/CLIENT_004 turno 4** — E com duas vagas?
  - esperado: referência=lead-joao-pereira
  - observado: referência=nenhuma
- **routing/CLIENT_005 turno 1** — Procura um imóvel pra Mariana.
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/CLIENT_005 turno 1** — Procura um imóvel pra Mariana.
  - esperado: domínio=property+lead
  - observado: domínio=property
- **routing/CLIENT_005 turno 1** — Procura um imóvel pra Mariana.
  - esperado: capability referenciada=property.search
  - observado: capability referenciada=general.chat
- **routing/CLIENT_005 turno 1** — Procura um imóvel pra Mariana.
  - esperado: capability selecionada=property.search
  - observado: capability selecionada=null
- **context/CLIENT_005 turno 1** — Procura um imóvel pra Mariana.
  - esperado: referência=lead-mariana
  - observado: referência=nenhuma
- **safety/CLIENT_005 turno 1** — Procura um imóvel pra Mariana.
  - esperado: clarificação=true
  - observado: clarificação=false
- **routing/CLIENT_005 turno 2** — Apartamento em Porto Alegre até 900 mil.
  - esperado: domínio=property+lead
  - observado: domínio=property

## Inconsistências preservadas da fonte

- O texto declara 104 cenários-base, mas contém 106 casos executáveis por causa das variantes 10A/10B e 93A/93B.
- O cenário 78 combina KNOWLEDGE_ONLY e PRODUCT_EXISTS_COS_GAP.
- O cenário 98 usa o rótulo não definido KNOWLEDGE; a auditoria o preserva como observação da fonte, sem transformá-lo em KNOWLEDGE_ONLY.
- Os cenários 75 e 96 possuem prioridade híbrida P0/P1.

## Limitações metodológicas

- O baseline determinístico não chama banco remoto nem provedores pagos.
- Routing, referência, continuidade, retrieval e policies declarativas são avaliados contra componentes reais e puros.
- Persistência Prisma, ledger de créditos, entitlement real, artefatos de provider e forbidden behaviors dependentes de side effect ficam `not_evaluated` até existir ambiente isolado e adapters seguros.
- O estado `turn.after` organiza a conversa-fixture; ele não é aceito como prova de persistência.
- Execution eval usa o executor real com handlers-fixture tipados e sem banco; não substitui validação transacional.
- O relatório registra divergências; o runner não altera o expected para obter aprovação.

## Comparação antes/depois da auditoria do oracle

- Baseline anterior: `cos-golden-v1-8f3ebf61e174`.
- Baseline atual: `cos-golden-v1-c8d03151d369`.
- Status anterior: pass=0, fail=103, incomplete=3.
- Status atual: pass=0, fail=102, incomplete=4.

| Camada | Acurácia antes | Acurácia depois | Cobertura antes | Cobertura depois |
|---|---:|---:|---:|---:|
| dialogue_act | 10.38% | 10.38% | 100% | 100% |
| domain | 32.08% | 26.42% | 100% | 100% |
| entity_resolution | 21.43% | 21.43% | 100% | 100% |
| reference_resolution | 21.43% | 21.43% | 100% | 100% |
| working_set | N/A | N/A | 0% | 0% |
| context_continuity | 7.14% | 7.14% | 100% | 100% |
| capability_selection | 8.49% | 32.08% | 100% | 100% |
| pending_input | 9.52% | 9.52% | 100% | 100% |
| confirmation | 6.25% | 12.5% | 100% | 100% |
| persistence | N/A | N/A | 0% | 0% |
| partial_success | N/A | N/A | 0% | 0% |
| knowledge_correctness | 26.67% | 26.67% | 42.86% | 42.86% |
| gap_recognition | N/A | N/A | 0% | 0% |
| failure_classification | N/A | N/A | 0% | 0% |
| entitlement_security | N/A | N/A | 0% | 0% |
| credit_correctness | N/A | N/A | 0% | 0% |
| response_quality | N/A | N/A | 0% | 0% |
| forbidden_behaviors | N/A | N/A | 0% | 0% |
| capability_reference | N/A | 9.88% | N/A | 76.42% |
| capability_execution | N/A | N/A | N/A | 0% |

A comparação mede a mudança do gabarito e do evaluator, não uma melhoria do runtime do COS.

## Proveniência

- Baseline: `cos-golden-v1-c8d03151d369`.
- Dataset SHA-256: `44d01462f688270061c0df359141853044867507b68270cc311392e1780aceac`.
- Oracle SHA-256: `c8d03151d3690f8e1a9e5acbc2c8fb84ab032e6439280e59cdf690caffe8ec90`; lock: `lib/cos/evals/conversations/golden-v1.lock.json`.
- Registry SHA-256: `fb6467077e8986d12ec0896aa2c585f2a7991607e5bf1c38212f3dab6591dbdd`.
- Knowledge SHA-256: `65e735619c3879d73603c6ca9094cd6b17e39db333300a07978a4cd7b86aaf2b`.
- Git SHA: `a349b674cdecbb61314aa966a3edfadb658b8d77`; working tree dirty: `indisponível`.
- Node: `v22.16.0`; database: `false`; providers externos: `false`.
