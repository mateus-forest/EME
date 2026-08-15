# COS — Relatório de evals conversacionais

Gerado em: 2026-08-15T07:41:31.790Z

## Dataset

- Routing legado single-turn: 400 casos.
- Conversas multi-turno: 50 cenários / 111 turnos.
- Execution fixtures no executor real: 10.
- Response fixtures: 12.
- Localization fixtures: 5.

## Métricas separadas

| Métrica | Aprovados | Acurácia | Falhas |
|---|---:|---:|---:|
| dialogueActAccuracy | 65/111 | 58.56% | 46 |
| domainAccuracy | 81/111 | 72.97% | 30 |
| capabilityAccuracy | 40/111 | 36.04% | 71 |
| referenceResolution | 27/48 | 56.25% | 21 |
| contextContinuity | 19/86 | 22.09% | 67 |
| knowledgeRetrieval | 6/19 | 31.58% | 13 |
| executionCorrectness | 10/10 | 100% | 0 |
| responseCorrectness | 12/12 | 100% | 0 |
| localization | 5/5 | 100% | 0 |
| safetyInvariants | 55/94 | 58.51% | 39 |
| endToEndConversation | 1/50 | 2% | 49 |
| legacyRouting | 158/400 | 39.5% | 242 |

Não existe média agregada: cada camada é reportada separadamente para evitar que 400 casos simples escondam falhas multi-turno ou operacionais.

## Principais falhas observadas

- **routing/client-create-marina-continuity turno 1** — Cadastre a Marina.
  - esperado: domínio=lead
  - observado: domínio=general
- **routing/client-create-marina-continuity turno 1** — Cadastre a Marina.
  - esperado: capability=lead.create
  - observado: capability=null
- **safety/client-create-marina-continuity turno 1** — Cadastre a Marina.
  - esperado: mutação=true
  - observado: mutação=false
- **routing/client-create-marina-continuity turno 3** — Coloca também marina@email.com.
  - esperado: dialogue act=execute
  - observado: dialogue act=unknown
- **routing/client-create-marina-continuity turno 3** — Coloca também marina@email.com.
  - esperado: capability=lead.update
  - observado: capability=general.chat
- **context/client-create-marina-continuity turno 3** — Coloca também marina@email.com.
  - esperado: referência=lead-marina
  - observado: referência=nenhuma
- **safety/client-create-marina-continuity turno 3** — Coloca também marina@email.com.
  - esperado: mutação=true
  - observado: mutação=false
- **routing/client-capability-then-execute turno 1** — Você consegue cadastrar cliente?
  - esperado: capability=lead.create
  - observado: capability=general.chat
- **routing/client-capability-then-execute turno 2** — Então cadastra a Ana.
  - esperado: dialogue act=execute
  - observado: dialogue act=unknown
- **routing/client-capability-then-execute turno 2** — Então cadastra a Ana.
  - esperado: domínio=lead
  - observado: domínio=general
- **routing/client-capability-then-execute turno 2** — Então cadastra a Ana.
  - esperado: capability=lead.create
  - observado: capability=general.chat
- **safety/client-capability-then-execute turno 2** — Então cadastra a Ana.
  - esperado: mutação=true
  - observado: mutação=false
- **context/client-active-reference turno 1** — Mostre o cliente João.
  - esperado: referência=lead-joao
  - observado: referência=nenhuma
- **routing/client-active-reference turno 3** — E o histórico de atendimento?
  - esperado: dialogue act=query
  - observado: dialogue act=unknown
- **routing/client-active-reference turno 3** — E o histórico de atendimento?
  - esperado: capability=lead.timeline
  - observado: capability=general.chat
- **context/client-active-reference turno 3** — E o histórico de atendimento?
  - esperado: referência=lead-joao
  - observado: referência=nenhuma
- **routing/client-ambiguous-joaos turno 1** — Atualiza o telefone do João.
  - esperado: dialogue act=execute
  - observado: dialogue act=unknown
- **routing/client-ambiguous-joaos turno 1** — Atualiza o telefone do João.
  - esperado: capability=lead.update
  - observado: capability=general.chat
- **safety/client-ambiguous-joaos turno 1** — Atualiza o telefone do João.
  - esperado: mutação=true
  - observado: mutação=false
- **safety/client-ambiguous-joaos turno 1** — Atualiza o telefone do João.
  - esperado: clarificação=true
  - observado: clarificação=false
- **context/client-correct-phone turno 1** — Não, o telefone correto é 54 98888-7777.
  - esperado: referência=lead-bia
  - observado: referência=nenhuma
- **routing/client-delete-confirmation turno 1** — Exclua esse cliente.
  - esperado: capability=lead.delete
  - observado: capability=null
- **safety/client-delete-confirmation turno 1** — Exclua esse cliente.
  - esperado: mutação=true
  - observado: mutação=false
- **safety/client-delete-confirmation turno 1** — Exclua esse cliente.
  - esperado: confirmação=true
  - observado: confirmação=false
- **routing/client-delete-confirmation turno 2** — não
  - esperado: dialogue act=reject
  - observado: dialogue act=unknown
- **routing/client-delete-confirmation turno 2** — não
  - esperado: domínio=lead
  - observado: domínio=general
- **routing/client-delete-confirmation turno 2** — não
  - esperado: capability=lead.delete
  - observado: capability=general.chat
- **context/client-delete-confirmation turno 2** — não
  - esperado: referência=lead-carlos
  - observado: referência=nenhuma
- **routing/client-pending-switch turno 1** — Quantos imóveis tenho publicados?
  - esperado: capability=analytics.properties
  - observado: capability=null
- **routing/client-pending-switch turno 2** — Voltando à Luana, o telefone é 54 97777-1111.
  - esperado: capability=lead.create
  - observado: capability=null

## Limitações metodológicas

- O conjunto determinístico não chama provedores pagos.
- Execution eval usa o executor real com handlers-fixture tipados e sem banco; não substitui validação transacional em uma base de teste isolada.
- Knowledge eval mede documentos, chunks e evidências textuais esperadas, não julgamento semântico por modelo.
- O relatório registra divergências; o runner não altera o esperado para obter 100%.
