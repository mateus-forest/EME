# COS — Etapa 2B: memória e contexto conversacional

## Objetivo e fronteira

Esta etapa adiciona contexto estruturado ao COS do portal/PWA sem implementar o Livro do EME, sem substituir Intent Resolver/Planner por LLM e sem alterar o runtime do WhatsApp.

## `CosConversationSnapshot`

O snapshot versão 1 é persistido no mesmo envelope do `BrokerDocument` da conversa e reúne:

- 12 mensagens/turnos recentes de `EmeMessage`;
- workflow e pending ativos;
- tópico atual e até quatro tópicos anteriores;
- entidades ativas e até dez entidades recentes;
- até oito resultados estruturados recentes;
- até cinco selection sets;
- última action e última execução;
- referências temporais normalizadas;
- workspace atual.

O snapshot não é memória infinita. Selection sets expiram em sete dias e guardam no máximo vinte itens cada.

## Fontes e reconstrução

Antes do Intent Resolver, a rota do portal:

1. carrega o envelope persistido da conversa;
2. busca os últimos 12 `EmeMessage` vinculados pelo `metadata.conversationId`;
3. normaliza memory antiga e workspace;
4. reconstrói entidades, resultados e listas que estejam presentes na metadata das mensagens;
5. resolve correções e referências simples;
6. entrega snapshot e IDs selecionados ao contexto usado pelo Intent Resolver/Planner;
7. atualiza e persiste o snapshot após a execução.

`CosConversationMemory` continua disponível durante a migração. Quando snapshot e memory possuem o mesmo tipo de entidade, a referência estruturada do snapshot tem prioridade. Campos legados ainda mantidos: `leadId`, `propertyId`, `documentId`, `contractId`, `proposalId`, `selectedClient`, `selectedProperty`, `selectedContract`, `selectedProposal`, `lastAction` e `lastResult`.

## Entidades e referências

Tipos inicialmente suportados:

- lead/cliente;
- imóvel;
- proposta;
- contrato;
- compromisso de agenda.

Cada referência registra ID, label quando disponível, origem, timestamp, confiança e evidência.

A resolução segue a ordem:

1. tipo explicitamente mencionado;
2. selection set do tópico aplicável;
3. entidade ativa daquele tipo;
4. entidades recentes compatíveis;
5. desambiguação, sem escolher quando restam múltiplas candidatas.

São cobertos pronomes e demonstrativos (`ele`, `ela`, `dele`, `dela`, `esse`, `essa`, `aquele`, `aquela`) e ordinais (`primeiro`, `segundo`, `terceiro`, `último`, `anterior`, além de índice numérico).

## Selection sets

Resultados com vários IDs/opções viram listas estruturadas independentes de `pendingInput`. Assim, a lista continua recuperável depois que o workflow técnico termina.

Exemplo validado:

```text
Mostre imóveis em Gramado.
O segundo.
Quantos metros ele tem?
```

O segundo item ativa o respectivo `propertyId`; a pergunta seguinte é roteada para `property.get`. Essa capability consulta uma operação já existente no banco, limitada ao broker, e apresenta área cadastrada em `legalData`, quartos, banheiros, vagas, localização e preço. Ela existe somente em `portal`/`cos_home`.

## Topic stack

Workflow e tópico agora são conceitos separados:

- workflow representa uma operação transacional que pode aguardar input;
- tópico representa o assunto discursivo e pode continuar recuperável depois da operação.

Ao trocar de imóveis para clientes, clientes vira o tópico atual e imóveis entra na pilha recente com sua selection set. `Voltando aos imóveis, abre o primeiro` recupera a lista anterior sem reabrir um workflow mutável antigo.

## Correções e continuidade

Correções óbvias (`não, muda para`, `na verdade`, `corrige para`, `troca para`, `quis dizer`) preservam o workflow ativo e atualizam o dado estruturado extraído. O valor monetário é normalizado em centavos.

Após criar/consultar uma entidade, o ID permanece ativo. Email ou telefone subsequente é ligado ao cliente inequívoco; múltiplos clientes compatíveis não são escolhidos silenciosamente.

Uma pergunta clara de outro domínio pode iniciar nova intenção mesmo com pending ativo. O pending anterior não recebe o texto como se fosse telefone, preço ou seleção.

## Contexto temporal mínimo

O snapshot normaliza, quando mencionados:

- hoje, amanhã e ontem;
- esta semana e semana passada;
- próximo mês.

Os handlers continuam responsáveis pela consulta ou mutação real.

## Diagnóstico A–J: antes/depois

| Cenário | Antes | Após 2B | Próxima etapa |
| --- | --- | --- | --- |
| A — cadastro simples | `createLead` | Mantido | — |
| B — Marina + telefone + email | email perdia a entidade | lead ativo gera `UPDATE_LEAD` | ampliar correções livres na 2C |
| C — proposta 900 → 850 | iniciava `LIST_PROPOSALS` | mantém `CREATE_PROPOSAL` e corrige o slot para 850 mil | refinar dialogue acts na 2C |
| D — lista + segundo + ele | pronome virava analytics | ordinal e pronome resolvem o mesmo imóvel | — |
| E — agenda → leads | agenda ainda pode ser classificada como criação | troca de tópico é preservada e pending não captura leads | corrigir classificação de agenda na 2C |
| F — imóveis → clientes → voltar | lista anterior perdida | topic stack recupera a lista e o primeiro imóvel | — |
| G — Catálogo x Marketplace | vira compartilhamento | inalterado | Livro do EME/2C |
| H — “você consegue...” | vira ordem | inalterado | dialogue act/capacidade na 2C |
| I — “manda aquele” | sem resolução | resolve somente com evidência; múltiplos candidatos geram ambiguidade | ação de envio depende de domínio explícito |
| J — inglês/codificação | texto corrompido ainda alcançável | inalterado | localização/formatter na 2C |

O teste de auditoria original continua caracterizando o Intent Resolver isolado. Os testes da 2B verificam o comportamento quando a nova camada contextual, que é o caminho da rota de produção, está presente.

## Testes

`tests/e2e/cos-conversation-snapshot.spec.ts` cobre:

- janela recente e compatibilidade com memory;
- continuidade da Marina;
- correção de proposta;
- selection set, ordinal e pronome;
- troca/retorno de tópico;
- referência ambígua;
- pending + troca de assunto;
- contexto temporal.

Também permanecem ativos os testes de execução, registry, workflow e diagnósticos A–J. E2E da UI cobre mudança de contexto, cancelamento e retomada de proposta.

## Limitações deixadas para 2C

- classificação geral de perguntas de agenda;
- distinção completa entre pergunta de capacidade, explicação e ordem;
- conhecimento de Catálogo/Marketplace e demais módulos;
- correções linguísticas que não possuam marcador explícito;
- resolução semântica de nomes fora das entidades/resultados disponíveis;
- localização central e correção dos textos antigos com encoding corrompido;
- recuperação de múltiplos workflows transacionais pausados (a pilha desta etapa é de tópicos, não de mutações).
