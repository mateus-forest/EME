# COS — Etapa 2A: confiabilidade operacional

## Escopo

Esta etapa endurece os contratos internos do COS sem alterar linguagem natural, conhecimento do EME ou memória conversacional profunda. O runtime do WhatsApp não foi modificado.

## Registry e actions

- `proposal.summary` deixou de reutilizar a action genérica `LIST_DOCUMENTS` e passou a usar `LIST_PROPOSALS`.
- `document.list` permanece responsável por `LIST_DOCUMENTS`.
- `document.get` foi conectado a uma consulta real, limitada ao `brokerId`, sobre `BrokerDocument`.
- O registry passa a falhar no carregamento diante de capability/action duplicada, action inválida, capability sem handler ou handler órfão.
- `getCosCapabilityDescriptorByAction` deixou de retornar silenciosamente a primeira capability quando a action não existe.

## Política declarativa de confirmação

O conjunto `confirmationOnlyActions` do Execution Planner foi removido. Planejamento e telemetria consultam exclusivamente `requiresConfirmation` do descriptor.

Revisão aplicada:

- consultas, buscas, drafts e edições reversíveis não recebem confirmação genérica;
- exclusões, publicação/despublicação, envio/assinatura/cancelamento e conversões sensíveis continuam confirmadas;
- `lead.delete` agora declara a política no descriptor, em vez de escondê-la somente no handler.

## Resultado discriminado

O resultado operacional normalizado possui três estados:

- `success`: ação concluída;
- `awaiting_input`: ação interrompida com `pendingInput` estruturado;
- `error`: falha com `errorCode` e mensagem segura.

O executor marca `error` como step `failed`, não libera dependências e não cobra crédito pela etapa. O formatter usa a mensagem segura do erro quando disponível.

### Adapter temporário

Handlers ainda não migrados podem retornar o contrato anterior. `normalizeCosActionResult`, no executor, é o único adapter permitido. Ele converte `metadata.pendingInput` em `awaiting_input`; qualquer outro retorno legado vira `success`. O adapter não lê a resposta textual. A remoção desse adapter fica para depois da migração integral dos handlers não críticos.

Foram migrados explicitamente ou normalizados na fronteira os fluxos críticos de cliente, imóvel, proposta, contrato e agenda. Falhas conhecidas de exclusão de cliente e limite de imóveis agora retornam `error` estruturado.

## Pending Input

Novos pendings usam schema 2 com:

- `createdAt` e `expiresAt`;
- TTL de 24 horas;
- `source` e `reason`;
- `capabilityId`, action e entity associadas.

O leitor normaliza pendings antigos em um único ponto (`legacy_adapter`). Pending expirado não é tratado como workflow ativo. O runtime não usa mais perguntas como “Qual ...” ou “Pode confirmar” para inferir estado.

Respostas isoladas são classificadas antes do handler. `não` rejeita com segurança; `cancelar`, `deixa`, `esquece` e equivalentes cancelam. Frases como `não, o valor é 850 mil` são classificadas como correção e não como cancelamento global.

## Seleção segura de mutações

- cliente update/delete/convert não escolhe mais o cliente mais recente sem referência;
- publicar, despublicar, atualizar mídia ou excluir imóvel exige ID/contexto resolvido;
- update/send/sign/cancel de contrato exige ID de contrato/documento do broker;
- update/cancel/complete de agenda exige compromisso explícito;
- dependências posteriores só executam após step `completed`.

Na ausência de evidência suficiente, o resultado é `awaiting_input` com seleção/desambiguação.

## Persistência

Steps persistem `resultStatus` e `resultErrorCode`. Conversas antigas continuam hidratadas pelo adapter. `AiAssistantInteraction`, `EmeMessage` e workflow passam a manter correspondência entre sucesso, processamento/pending, erro e cancelamento; steps com erro não são contabilizados como sucesso nem cobrados.

## Testes

`tests/e2e/cos-execution-contracts.spec.ts` cobre:

- invariantes do registry;
- política de confirmação declarativa;
- propagação de success/awaiting/error;
- ausência de inferência por texto;
- compatibilidade e TTL do pending;
- negação/cancelamento/correção;
- ausência dos fallbacks perigosos nas mutações críticas.

A bateria diagnóstica A–J foi preservada. As falhas de contexto B–H continuam caracterizadas para as etapas 2B/2C.

