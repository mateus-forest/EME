# EME Credit Audit

Data de referencia: 2026-07-30

## Escopo e criterio

- Fonte de verdade: codigo atual do repositorio.
- Esta auditoria descreve apenas o consumo implementado hoje.
- Nao foram consideradas sugestoes futuras como se ja estivessem em producao.
- Quando uma operacao nao possui cobranca explicita, ela foi marcada como `nao cobra`.
- Quando o valor depende de fallback, isso foi indicado.
- Custo estimado usa a camada atual em `lib/ai-cost-engine.ts` e o catalogo em `lib/ai-operation-catalog.ts`.

## Como o consumo funciona hoje

### Fonte central de credito

- O mapa principal de credito esta em `lib/eme-plans.ts`, via `EME_CREDIT_COSTS`.
- `getEmeCreditCost(actionKey)` retorna o valor configurado.
- Se a chave nao existir no mapa, o fallback atual eh `1` credito.

### Debito real

- O debito centralizado acontece em `lib/eme-plan-service.ts`:
  - `hasBrokerAiCredits(...)`
  - `consumeBrokerAiCredits(...)`
  - `refundBrokerAiCredits(...)`
- Alguns fluxos antigos fazem debito manual direto no `Broker`, sem usar o servico central.

### Telemetria de custo

- A telemetria de operacoes inteligentes existe hoje em:
  - `lib/ai-operation-telemetry.ts`
  - `lib/openai-telemetry.ts`
  - tabela `AiOperationTelemetry`
- OpenAI usa wrapper central `createOpenAIResponse(...)`.
- Luma/video usa `recordEstimatedCatalogTelemetry(...)`.
- Nem toda operacao que custa dinheiro hoje esta cobrando credito.

## Tabela consolidada

| Operacao | Modulo | Credito atual | Como calcula hoje | Arquivo responsavel | Fixo ou variavel | Telemetria de custo | Custo estimado atual | Observacoes |
| --- | --- | ---: | --- | --- | --- | --- | ---: | --- |
| Conversa COS (`general.chat` / `cos.message`) | COS | `1` por mensagem base; workflow cobra soma dos steps executados | `app/api/assistant/eme/route.ts` inicia com `1`, mas antes de executar recalcula `creditsUsed = sum(getEmeCreditCost(step.action))`; cobra apenas steps executados | `app/api/assistant/eme/route.ts`, `lib/eme-plans.ts` | Variavel por workflow | Sim | ~R$ 0,0044 | O planner/orquestrador nao eh cobrado separadamente; o custo real do OpenAI pode ser maior que 1 credito em fluxos compostos, mas a cobranca eh por action legacy. |
| AI Orchestrator (`cos.ai_orchestrator`) | COS | `nao cobra diretamente` | Roda dentro do fluxo do COS; nao possui `actionKey` propria em `EME_CREDIT_COSTS` | `lib/cos/ai-orchestrator.ts`, `app/api/assistant/eme/route.ts` | Sem cobranca direta | Sim | ~R$ 0,0049 | Tem telemetria/custo, mas o usuario nao paga um credito separado por planejamento. |
| Busca de imoveis (`searchProperties`) | COS / Assessor | `1` | `getEmeCreditCost("searchProperties")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts`, `app/api/whatsapp/webhook/route.ts` | Fixo | Parcial | Embutido no COS | Custo real depende da conversa; a action em si nao tem catalogo proprio. |
| Criar rascunho de imovel (`createPropertyDraft`) | COS / Assessor | `2` | `getEmeCreditCost("createPropertyDraft")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts`, `app/api/whatsapp/webhook/route.ts` | Fixo | Parcial | Embutido no COS | Usa action legacy; nao equivale ao fluxo visual completo de cadastro inteligente. |
| Criar proposta (`CREATE_PROPOSAL`) | COS / Propostas | `2` | `getEmeCreditCost("CREATE_PROPOSAL")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts`, `lib/cos/entities/proposal.ts` | Fixo | Parcial | Embutido no COS | Existe no COS; nao encontrei endpoint independente de “proposta com IA” cobrando separadamente fora do COS. |
| Criar contrato (`CREATE_CONTRACT`) | COS / Contratos | `2` | `getEmeCreditCost("CREATE_CONTRACT")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts`, `lib/cos/entities/contract.ts` | Fixo | Parcial | Embutido no COS | Mesmo comportamento da proposta: cobra no COS, nao por um endpoint de “contrato com IA” separado. |
| Resumo de leads (`getLeadsSummary`) | COS | `2` | `getEmeCreditCost("getLeadsSummary")` | `lib/eme-plans.ts` | Fixo | Nao evidente | Nao catalogado | A chave existe, mas nao apareceu entre as operacoes catalogadas de custo. |
| Analytics (`getAnalyticsSummary`) | COS | `2` | `getEmeCreditCost("getAnalyticsSummary")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts` | Fixo | Parcial | Embutido no COS | Sem custo dedicado no catalogo; entra no custo agregado da conversa. |
| Analise de catalogo (`analyzeCatalog`) | COS | `2` | `getEmeCreditCost("analyzeCatalog")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts` | Fixo | Parcial | Embutido no COS | Mesmo caso de analytics. |
| Resumo do catalogo (`getCatalogSummary`) | COS | `2` | `getEmeCreditCost("getCatalogSummary")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts` | Fixo | Parcial | Embutido no COS | Mesmo caso de analytics. |
| Resumo financeiro (`getFinancialSummary`) | COS | `2` | `getEmeCreditCost("getFinancialSummary")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts` | Fixo | Parcial | Embutido no COS | Mesmo caso de analytics. |
| Criar compromisso (`CREATE_AGENDA_EVENT`) | COS / Agenda | `1` | `getEmeCreditCost("CREATE_AGENDA_EVENT")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts` | Fixo | Parcial | Embutido no COS | Sem catalogo de custo proprio. |
| Listar compromissos (`LIST_AGENDA_EVENTS`) | COS / Agenda | `1` | `getEmeCreditCost("LIST_AGENDA_EVENTS")` | `lib/eme-plans.ts`, `app/api/assistant/eme/route.ts` | Fixo | Parcial | Embutido no COS | Sem catalogo de custo proprio. |
| Cadastro inteligente de imovel (`generate_property_ai`) | Imoveis | `2` | `getEmeCreditCost("generate_property_ai")`, valida saldo, cobra apos sucesso e estorna em falha | `app/api/ai/generate-property/route.ts` | Fixo | Sim | ~R$ 0,0030 | Cobranca coerente com implementacao; custo real bem baixo frente a 2 creditos. |
| Importacao por texto | Imoveis | `4` | `smart_import_text` | `app/api/properties/import/ad/extract/route.ts` | Fixo | Sim | ~R$ 0,0089 | Mesma cobranca para texto puro, link do anuncio e XML por URL convertido em texto/public page fetch. |
| Importacao por link do anuncio | Imoveis | `4` | Cai no mesmo fluxo de `smart_import_text` quando nao ha imagem | `app/api/properties/import/ad/extract/route.ts` | Fixo | Sim | ~R$ 0,0089 | Nao ha tarifa distinta para URL vs texto puro. |
| Importacao por XML URL via IA | Imoveis | `4` quando usa rota de extracao IA; `0` no preview XML classico | Se passar pelo extrator IA cai em `smart_import_text`; se usar fluxo XML dedicado nao cobra | `app/api/properties/import/ad/extract/route.ts`, `app/api/properties/import/xml/preview/route.ts` | Misto | Parcial | ~R$ 0,0089 ou R$ 0 | Ha dois caminhos diferentes de produto para “XML por URL”. |
| Importacao por imagem | Imoveis | `5` | `smart_import_image` | `app/api/properties/import/ad/extract/route.ts` | Fixo | Sim | ~R$ 0,0120 | Cobre imagem unica e imagens com varios imoveis no mesmo custo. |
| Importacao por print | Imoveis | `5` | Mesmo caminho de `smart_import_image` | `app/api/properties/import/ad/extract/route.ts` | Fixo | Sim | ~R$ 0,0120 | Mesmo valor de imagem comum. |
| Importacao por audio | Imoveis | `nao cobra` | Nao existe endpoint server-side de transcricao IA; a tela usa `SpeechRecognition` do navegador e depois reaproveita o fluxo normal de preview | `components/broker-new-property-page.tsx` | Sem cobranca | Nao | R$ 0 no backend atual | O audio atual eh transcricao client-side, nao OpenAI/Whisper. Pode gerar anuncio depois, mas o credito cobrado eh o da geracao/previsao subsequente. |
| Upload de audio do imovel | Imoveis | `nao cobra` | Apenas upload/storage | `app/api/properties/[id]/audio/route.ts` | Sem cobranca | Nao | Nao instrumentado | Operacao de armazenamento, nao “inteligente”. |
| Importacao XML preview | Imoveis | `nao cobra` | Parse local/HTTP fetch do XML sem IA | `app/api/properties/import/xml/preview/route.ts` | Sem cobranca | Nao | R$ 0 de IA | Fluxo inteligente para o usuario, mas nao consome creditos nem telemetria de custo. |
| Importacao XML confirm | Imoveis | `nao cobra` | Criacao de propriedades e validacoes operacionais | `app/api/properties/import/xml/confirm/route.ts` | Sem cobranca | Nao | R$ 0 de IA | Pode consumir operacao/banco, mas nao credito IA. |
| Broker Assistant `general` | Corretor EME | `1` | `getBrokerAssistantCreditCost("general")` com override opcional por env | `lib/broker-assistant.ts`, `app/api/ai/broker-assistant/route.ts` | Fixo | Sim | ~R$ 0,0037 | Tem tabela propria, paralela ao mapa central. |
| Broker Assistant `create_ad` | Corretor EME | `2` | Puxa do mapa central `getEmeCreditCost("create_ad")` | `lib/broker-assistant.ts` | Fixo | Sim | ~R$ 0,0037 | Hoje o custo do catalogo para `broker.assistant` nao muda por subtipo, mas a cobranca muda. |
| Broker Assistant `improve_description` | Corretor EME | `1` | `getBrokerAssistantCreditCost` | `lib/broker-assistant.ts` | Fixo | Sim | ~R$ 0,0037 | Sem operacao catalogada propria por subtipo. |
| Broker Assistant `reply_client` | Corretor EME | `1` | `getBrokerAssistantCreditCost` | `lib/broker-assistant.ts` | Fixo | Sim | ~R$ 0,0037 | Sem operacao catalogada propria por subtipo. |
| Broker Assistant `match_properties` | Corretor EME | `2` | `getBrokerAssistantCreditCost` | `lib/broker-assistant.ts` | Fixo | Sim | ~R$ 0,0037 | Custo catalogado do backend assistente nao distingue busca mais cara. |
| Broker Assistant `analyze_catalog` | Corretor EME | `3` | `getBrokerAssistantCreditCost` | `lib/broker-assistant.ts` | Fixo | Sim | ~R$ 0,0037 | Parece caro em creditos frente ao custo real desse endpoint. |
| Broker Assistant `lead_ideas` | Corretor EME | `1` | `getBrokerAssistantCreditCost` | `lib/broker-assistant.ts` | Fixo | Sim | ~R$ 0,0037 | Mesmo custo do fluxo geral. |
| Assessor EME no WhatsApp | WhatsApp / COS | Varia por `action`; fallback `1` | `getEmeCreditCost(action)` dentro de `processAssessorMessage(...)` | `app/api/whatsapp/webhook/route.ts` | Variavel | Nao usa wrapper de telemetria central | Custo agregado da conversa | Usa o mapa central, mas muitas actions nao estao no catalogo de custo; se faltar chave, cobra 1. |
| Corretor EME no WhatsApp | WhatsApp | `1` | Valor hardcoded e debito manual/reserva | `app/api/whatsapp/webhook/route.ts` | Fixo | Nao | ~R$ 0,0037 | Nao usa `consumeBrokerAiCredits`; faz reserva direta no Broker em um dos caminhos. |
| Corretor EME interno (`/api/corretor-eme/message`) | Corretor EME | `1` | Valor hardcoded e debito manual direto no Broker | `app/api/corretor-eme/message/route.ts` | Fixo | Nao | ~R$ 0,0037 | Fluxo legado fora do servico central de credito. |
| Studio IA Instagram | Studio IA | `nao cobra` | Nao chama `hasBrokerAiCredits` nem `consumeBrokerAiCredits` | `app/api/studio-ia/instagram/route.ts` | Sem cobranca | Sim | ~R$ 0,0119 | Tem custo real e telemetria, mas hoje sai sem debitar creditos. |
| Studio IA compradores | Studio IA | `nao cobra` | Sem cobranca implementada | `app/api/studio-ia/buyers/route.ts` | Sem cobranca | Sim | ~R$ 0,0095 | Mesmo padrao do Instagram. |
| Studio IA proprietarios | Studio IA | `nao cobra` | Sem cobranca implementada | `app/api/studio-ia/owners/route.ts` | Sem cobranca | Sim | ~R$ 0,0111 | Mesmo padrao do Instagram. |
| Studio IA plano de venda | Studio IA | `nao cobra` | Sem cobranca implementada | `app/api/studio-ia/sell-property/route.ts` | Sem cobranca | Sim | ~R$ 0,0102 | Mesmo padrao do Instagram. |
| Studio IA geracao de imagem (obra -> pronto) | Studio IA | `nao cobra` | Sem cobranca implementada | `app/api/studio-ia/construction/route.ts` | Sem cobranca | Sim | ~R$ 0,0602 | Operacao relativamente cara e sem debito atual. |
| Studio IA video - previa | Studio IA | `12` | `getStudioVideoEstimatedCredits(...)`, valida saldo e cobra por etapa | `app/api/studio-ia/video/route.ts`, `lib/studio-ia-video.ts` | Variavel por etapa | Sim | ~R$ 0,2214 | Cobranca forte e coerente com custo externo. |
| Studio IA video - nova previa | Studio IA | `12` | Mesmo mecanismo por etapa | `app/api/studio-ia/video/route.ts`, `lib/studio-ia-video.ts` | Variavel por etapa | Sim | ~R$ 0,2214 | Cobra novamente a regeneracao. |
| Studio IA video - final | `38` | `getStudioVideoEstimatedCredits(...)` para etapa final | `app/api/studio-ia/video/route.ts`, `lib/studio-ia-video.ts` | Variavel por etapa | Sim | ~R$ 1,5302 | A operacao mais cara do sistema no estado atual. |
| PDF de proposta | Documentos | `1` | `getEmeCreditCost("generate_proposal_pdf")` | `app/api/brokers/documents/[id]/pdf-credit/route.ts` | Fixo | Nao | R$ 0 externo | Cobranca de produto, nao de API. |
| PDF de contrato | Contratos | `1` | `getEmeCreditCost("generate_contract_pdf")` | `app/api/brokers/contracts/[id]/pdf-credit/route.ts` | Fixo | Nao | R$ 0 externo | Cobranca de produto, nao de API. |

## Principais achados

### 1. Operacoes sem consumo definido ou sem cobranca implementada

- `cos.ai_orchestrator` tem custo e telemetria, mas nao possui cobranca direta.
- Todo o bloco textual do Studio IA hoje roda sem debito:
  - `instagram`
  - `buyers`
  - `owners`
  - `sell-property`
- A geracao de imagem do Studio IA (`construction`) tambem nao cobra.
- Importacao XML classica (`preview` e `confirm`) nao cobra.
- Importacao por audio nao possui backend de IA; portanto nao ha credito proprio.
- PDF de proposta e contrato cobram credito, mas nao usam telemetria/custo porque sao operacoes internas.

### 2. Operacoes possivelmente cobrando credito em excesso

- `generate_property_ai` cobra `2` creditos para um custo estimado muito baixo (~R$ 0,0030).
- `smart_import_text` cobra `4` creditos para custo estimado ~R$ 0,0089.
- `smart_import_image` cobra `5` creditos para custo estimado ~R$ 0,0120.
- `generate_proposal_pdf` e `generate_contract_pdf` cobram `1` credito mesmo sem custo externo de API.
- `broker.assistant.analyze_catalog` cobra `3` creditos, mas usa o mesmo backend leve de texto do assistente.

### 3. Operacoes que parecem baratas demais

- O COS em workflows complexos pode continuar barato demais quando varias capacidades relevantes caem em actions legacy de baixo custo.
- O AI Orchestrator nao cobra separado, embora adicione custo OpenAI em casos de ambiguidade.
- Algumas actions do Assessor/WhatsApp dependem do fallback `1` credito quando a chave nao existe no mapa central.

### 4. Inconsistencias entre custo real e credito cobrado

- O catalogo financeiro sugere creditos para Studio IA textual e imagem, mas os endpoints atuais nao debitam nada.
- O sistema de credito real e a documentacao sugerida nao estao 100% alinhados:
  - `docs/eme-credit-system.md` sugere cobranca para Instagram, campanhas e imagem.
  - o codigo atual nao cobra essas rotas.
- PDFs cobram credito sem lastro em custo externo.
- Audio nao usa IA server-side, mas do ponto de vista de UX pode parecer uma “operacao inteligente” equivalente a outras cobradas.

### 5. Possiveis duplicidades ou riscos de duplicidade

- No COS atual nao encontrei duplicidade de debito real dentro do mesmo request:
  - o planner roda
  - a execucao calcula steps
  - a cobranca final usa apenas os steps executados
- Existe risco conceitual futuro de dupla cobranca se alguem decidir cobrar o AI Orchestrator separadamente sem ajustar o fluxo do COS.
- Ha coexistencia de dois estilos de cobranca:
  - centralizado via `consumeBrokerAiCredits(...)`
  - manual direto em `Broker` (`/api/corretor-eme/message` e parte do WhatsApp)
- Essa duplicidade de arquitetura aumenta o risco operacional de divergencia de saldo e historico.

## Recomendacoes de ajuste

| Operacao / Grupo | Situacao atual | Recomendacao |
| --- | --- | --- |
| Studio IA textual | Tem custo e telemetria, nao cobra | Alinhar com a estrategia sugerida ou assumir explicitamente como beneficio incluido no plano. |
| Studio IA imagem | Tem custo material e nao cobra | Prioridade alta de alinhamento economico. |
| AI Orchestrator | Custa, mas nao cobra separado | Manter embutido no COS ou criar regra explicita; hoje esta implicito. |
| XML classico | Sem credito | Aceitavel se a decisao for tratar XML como operacao operacional e nao IA. |
| PDFs | Cobram 1 credito sem custo externo | Rever se devem continuar como limitador de produto ou sair do saldo IA. |
| Hardcoded `1 credito` | Existe em fluxos legados | Migrar para mapa central para evitar drift. |
| Fallback `getEmeCreditCost` | Chave ausente vira `1` | Bom como seguranca, ruim como precificacao; requer auditoria recorrente. |

## Conclusao

O sistema hoje ja possui:

- um mapa central de credito funcional;
- debito e estorno centralizados para boa parte dos fluxos;
- telemetria moderna de custo para OpenAI e Luma;
- documentacao estrategica recente.

Mas o consumo real ainda esta assimetrico:

- COS, importacao IA, geracao de anuncio e video cobram de fato;
- parte relevante do Studio IA ainda nao cobra;
- XML classico e audio seguem sem credito;
- alguns fluxos legados ainda debitam fora do servico central;
- o fallback de `1` credito mascara gaps de precificacao.

Em resumo, o EME hoje tem uma base boa para monetizacao, mas ainda nao possui paridade total entre:

- custo real,
- telemetria,
- documentacao sugerida,
- e credito efetivamente debitado do corretor.
