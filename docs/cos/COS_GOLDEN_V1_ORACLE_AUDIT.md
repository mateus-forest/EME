# COS — Auditoria técnica do oracle Golden V1

Data: 18/08/2026

Oracle: `golden-v1.1-oracle-audit`

Baseline congelada: `cos-golden-v1-c8d03151d369`

## Escopo e resultado

Os 106 cases executáveis foram conferidos contra os 104 cenários humanos. Nenhum arquivo do runtime do COS, Decision Layer, Intent Resolver, Registry, prompt ou handler foi alterado.

- 106/106 cases usavam o campo único `capabilityId`, estruturalmente ambíguo.
- 82/106 exigiram correção semântica além da separação mecânica do schema.
- 24/106 mantiveram o mesmo contrato semântico, apenas distribuído nos novos campos.
- As categorias abaixo se sobrepõem; por isso seus totais não devem ser somados.

| Categoria | Cases afetados |
|---|---:|
| KNOWLEDGE_ONLY e PRODUCT_EXISTS_COS_GAP | 33 |
| Seleção/execução diferida | 28 |
| Domínio primário/secundário | 44 |
| Contexto técnico de seleção | 3 |
| Classificação incoerente da fonte | 1 |
| Contrato de confirmação versus efeito final | 16 |

## Correções do gabarito

### Capability

O oracle agora separa:

- `referencedCapabilityId`: capability real mencionada ou relevante;
- `referencedProductFunction`: função do produto sem capability no Registry;
- `selectedCapabilityId`: capability escolhida para o fluxo;
- `executedCapabilityId`: capability efetivamente executada.

`capability_reference`, `capability_selection` e `capability_execution` são camadas distintas. Como a baseline atual não executa a conversa oficial ponta a ponta, `capability_execution` permanece honestamente `not_evaluated`.

### KNOWLEDGE_ONLY

Perguntas e explicações não selecionam uma operação para execução. Mutação, confirmação e execução permanecem ausentes.

Antes, no case `CLIENT_008`:

```text
capabilityId = lead.create
```

Isso fazia a ausência de execução de `lead.create` parecer uma falha.

Depois:

```text
referencedCapabilityId = lead.create
selectedCapabilityId = null
executedCapabilityId = null
```

Na nova baseline, ato, domínio, capability referenciada e ausência de seleção passam para “Dá para cadastrar cliente sem telefone?”. O case fica `incomplete` apenas pelas camadas sem observação segura, não por uma falsa falha operacional.

### PRODUCT_EXISTS_COS_GAP

Funções existentes no produto, mas ausentes do Registry, usam `referencedProductFunction`. O reconhecimento é avaliado por ato, domínio, entidade e, futuramente, resposta/gap recognition; não se exige uma capability inexistente.

Exemplo:

```text
referencedProductFunction = account.password.change
selectedCapabilityId = null
executedCapabilityId = null
```

Se o COS escolher uma capability operacional diferente ou simular execução, continua falhando. Se apenas não possuir a capability inexistente, isso não gera sozinho uma falha de seleção.

### Seleção, pending e confirmação

Cases como `CLIENT_002`, `CLIENT_004` e `PROPERTY_021` agora preservam o pending e o tópico anterior antes de avaliar “Mendes”, “Pereira” e “Solar Norte”. A capability pode estar selecionada enquanto `executedCapabilityId` permanece `null` até a seleção, o dado ou a confirmação necessária.

Rejeição e cancelamento também deixam de ser registrados como execução da mutação rejeitada.

### Multi-domínio

O turno passou a declarar domínio primário e domínios secundários relevantes.

Exemplo:

```text
“Procura alguma coisa pro Carlos.”
primaryDomain = property
secondaryDomains = [lead]
```

O evaluator exige o domínio primário e a presença dos secundários declarados, mas não reprova domínios extras não conflitantes.

### Cenário 98

O rótulo `KNOWLEDGE` da fonte não pertence ao enum oficial. A conversão anterior o transformava em `KNOWLEDGE_ONLY`, embora “Qual imóvel está performando melhor?” seja uma consulta operacional que precisa esclarecer a métrica.

O case agora permanece somente `SUPPORTED_NOW`, referencia/seleciona `analytics.performance` e mantém execução ausente enquanto a métrica não for escolhida.

## Baseline antes/depois

| Medida | Antes | Depois |
|---|---:|---:|
| Cases pass | 0 | 0 |
| Cases fail | 103 | 102 |
| Cases incomplete | 3 | 4 |
| Capability selection | 8,49% | 32,08% |
| Confirmation | 6,25% | 12,50% |
| Domain | 32,08% | 26,42% |
| Context continuity | 7,14% | 7,14% |
| Capability reference | não existia | 9,88% |
| Capability execution | não existia | 0% de cobertura |

A queda de Domain não representa regressão do COS: o runtime não mudou. Ela resulta do oracle agora exigir os domínios secundários humanos que antes não eram medidos. O aumento de Capability Selection remove falsos negativos de perguntas, product gaps e execução diferida.

## Falhas que continuam sendo do COS

Após retirar as distorções conhecidas do oracle, permanecem falhas observáveis em componentes reais e puros:

- dialogue act: 95 cases;
- domínio primário/secundário: 78;
- capability referenciada: 73;
- capability selecionada: 72;
- resolução de entidade/referência: 44;
- continuidade contextual: 39;
- pending/clarificação: 19;
- confirmação: 7;
- knowledge correctness: 11.

Exemplos concretos:

- “Procura alguma coisa pro Carlos.” ainda vira `unknown/general` em vez de busca de imóvel relacionada ao cliente.
- “Mendes.” e “Pereira.” recebem o estado anterior, mas o runtime ainda não resolvem corretamente a entidade/continuidade.
- “Mudar minha senha” já não falha por não selecionar uma capability inexistente; continua falhando porque ato e domínio não são reconhecidos.
- “Qual imóvel está performando melhor?” reconhece `query`, mas não reconhece `analytics` como domínio nem `analytics.performance` como função relevante.

Persistência, execução oficial, resposta semântica, entitlement, créditos e forbidden behaviors dependentes de side effect continuam `not_evaluated`. Não são contabilizados como aprovação nem como falha do COS nesta baseline.

## Congelamento

O lock `lib/cos/evals/conversations/golden-v1.lock.json` fixa:

- 104 cenários-base;
- 106 cases executáveis;
- SHA-256 do dataset;
- SHA-256 conjunto de fixture, tipos e evaluator.

O gerador recusa criar outra baseline se qualquer parte do oracle divergir do lock. Uma mudança futura exige nova auditoria explícita.
