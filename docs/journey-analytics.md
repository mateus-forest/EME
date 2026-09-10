# Analytics e jornada EME — primeira camada

Implementação de coleta; o Admin e as regras de negócio permanecem com o comportamento existente. Não há gráficos, backfill ou alterações manuais em registros reais.

## Ativação

1. Aplicar `prisma/migrations/20260910230000_journey_analytics/migration.sql` pelo processo normal de deploy, primeiro em homologação. A migração cria somente `JourneyEvent`, `JourneyIdentityLink` e índices; não altera tabelas de billing ou permissões.
2. Gerar o cliente Prisma e publicar o código.
3. Definir `JOURNEY_ANALYTICS_ENABLED=true` no servidor. A gravação fica **desligada por padrão**; cada ambiente precisa dessa configuração própria.
4. Exercitar jornadas de contas de teste e verificar os fatos e vínculos. Desativar a variável interrompe as novas gravações sem remover tabelas ou dados de negócio.

A ativação local de 10/09/2026 aplicou a migração ao banco configurado e definiu a variável no `.env.local` (ignorado pelo Git). Isso não configura a variável de um deploy remoto. A geração do cliente e a validação do schema, isoladamente, não aplicam migrações.

## Contrato e fontes

`lib/journey/contract.ts` é a lista única de eventos e a normalização executada tanto no browser como no servidor. Cada fato contém `eventId`, `schemaVersion`, `eventName`, `occurredAt`, `producer`, `userId`, `anonymousId`, `sessionId`, `pathname`, `route`, `referrer`, `device`, `module`, `step`, `outcome`, `requestId`, `correlationId`, referências de recursos, `errorCode` e metadata permitida. Campos sem evidência são nulos.

`JourneyEvent.eventId` é a chave primária. `receivedAt` distingue chegada de ocorrência. Datas são `TIMESTAMPTZ(3)` e o contrato serializa UTC. `ADMIN_ANALYTICS_TIME_ZONE` define `America/Sao_Paulo` para consultas/apresentação futuras.

| Eventos | Fonte e confirmação | Deduplicação/contexto |
| --- | --- | --- |
| `page_view`, `landing_view`, `marketplace_view` | Browser, mudança de pathname/hidratação inicial; landing somente `/`, Marketplace em `/imoveis/**` | Uma execução por transição, incluindo proteção contra repetição de efeito React; mudança apenas de query não é nova página |
| `signup_started` | Abertura do cadastro nos formulários existentes | Superfície e sessão; abertura repetida imediata é descartada |
| `signup_step_completed` | Browser: grupo de identificação válido, credenciais preenchidas/coincidentes, envio ao endpoint | Marcos `identity`, `credentials`, `submitted`; identificação e credenciais uma vez por instância de formulário |
| `signup_failed` | Browser para validação local; servidor para resposta de erro do cadastro | `client_validation` separado de `server_validation`; sem registrar valores de campos |
| `signup_completed` | Servidor, resposta bem-sucedida do registro com usuário criado e cookie de autenticação | ID do usuário; cria vínculo de identidade |
| `login_completed`, `login_failed` | Servidor, resposta de login por senha, PIN ou biometria | Requisição; sucesso exige usuário retornado pelo fluxo autenticado |
| `marketplace_search` | Browser no ponto existente de busca concluída, inclusive zero resultados | Um fato por execução do tracker; não faz fan-out por corretor; query vira apenas comprimento |
| `marketplace_result_opened` | Browser no tracker existente de abertura do imóvel | Imóvel; associa último `searchId` quando disponível |
| `catalog_view`, `catalog_property_opened` | Browser nos pontos existentes do catálogo público | Catálogo/imóvel e proteção contra repetição imediata; `catalogId` atualmente contém **slug**, conforme contrato público existente |
| `lead_created` | Servidor após criação/commit: formulário público, CRM de corretor/imobiliária, COS e conversa do Marketplace | ID do lead; atualização de lead existente não conta; `brokerId` é destinatário, nunca ator implícito |
| `property_created` | Servidor após persistência por corretor/imobiliária, importação e COS | ID do imóvel |
| `property_published` | Servidor após persistência de transição para publicado, inclusive criação já publicada e edição geral | Imóvel + canal (`catalog`/`marketplace`) + instante da versão; repetir PATCH ou despublicar não gera sucesso |
| `proposal_created` | Servidor, `BrokerDocument` do tipo `proposal` persistido, inclusive COS | ID do documento; outros tipos não contam |
| `contract_generated` | Servidor, PDF **final** gerado e atualização correspondente confirmada no fluxo de instância de template | Instância + hash do conteúdo fonte; baixar novamente a mesma versão não soma; rascunho não conta |
| `cos_message_sent` | Servidor, mensagem persistida nos runtimes principal/v2 e COS Launch | Requisição; não representa visita pública, mensagem de cliente no WhatsApp ou clique de navegação |
| `cos_action_completed`, `cos_action_failed` | Resultado de execução real nos runtimes COS e nas ações de formulário do Launch; lançamentos financeiros após commit | Requisição/workflow; confirmações pendentes e pedidos de esclarecimento não são sucesso |
| `studio_generation_started` | Campanha em processamento criada; nos fluxos síncronos, imediatamente antes da execução do provedor, após validações | Campanha ou requisição do fluxo síncrono |
| `studio_generation_completed` | Campanha/artefato persistido: preparar imóvel, visualizar projeto, campanhas e vídeo final | Campanha; polling e reenvios têm o mesmo ID. Prévia de imagem do vídeo não completa o vídeo |
| `studio_generation_failed` | Falha da geração após início/estado de campanha falho | Operação/campanha, com erro central associado; falhas de validação anteriores ao início são erros da API |
| `checkout_started` | Servidor, Checkout Session criada no Stripe | Checkout Session; mudança direta de assinatura sem Checkout não simula checkout |
| `checkout_completed` | Webhook assinado, pagamento confirmado e sincronização/fulfillment local concluído; trial Stripe confirmado aceita `no_payment_required` | Mesmo ID de Session entre `completed` e `async_payment_succeeded`; metadata distingue trial e pagamento |
| `checkout_failed` | Erro do endpoint de checkout ou webhook assinado de pagamento assíncrono falho | Requisição ou Checkout Session |
| `error_occurred` | Browser: exceções, rejeições e rede; servidor: respostas de erro nas rotas instrumentadas, exceções do Next e falhas lógicas COS/Studio/checkout | Código e correlação; evita repetir erro lógico como erro HTTP e exceção da rota como exceção global |

Se o webhook não consegue resolver o vínculo/plano local, registra `STRIPE_BILLING_UNRESOLVED` com o estado real de pagamento. Não transforma pagamento confirmado em pagamento falho nem conta sincronização inconclusiva como checkout concluído.

## Transporte, identidade e privacidade

- Browser: cookies próprios aleatórios, anônimo por até 365 dias e sessão renovada com 30 minutos de inatividade; fallback em memória se cookies/storage estiverem bloqueados. Fila limitada a 80 fatos, lotes de 20, `fetch` com `keepalive`, flush ao ocultar/sair da página. Sem retries de envio nesta etapa.
- A interceptação de `fetch` acrescenta IDs de requisição/correlação e pathname saneado somente em APIs da mesma origem. Não lê corpos de requisição para registrar dados. A própria coleta não entra na interceptação.
- `/api/journey/events`: JSON de até 32 KiB, limite de 20 fatos, checagem de origem e limite por sessão em memória. Só aceita eventos de browser; não aceita sucesso de negócio forjado. `userId` enviado pelo cliente é ignorado. JWT verificado fornece ator apenas se cookies e sessão do evento coincidirem, evitando atribuir lotes antigos a uma conta recém-conectada.
- `withJourneyRoute` preserva o resultado e exceções do handler. A autenticação existente preenche o ator do contexto. A inspeção de respostas e a escrita acontecem após a resposta com `after`. Não há chamada de analytics aguardada dentro de transação de negócio.
- Persistência usa pool separado, máximo de uma conexão, timeout de conexão de 3 s, ociosidade de 30 s, statement de 1,5 s, query de 2 s e limite de quatro gravações concorrentes/enfileiradas por processo. A conexão ao banco remoto pode ultrapassar os 700 ms inicialmente configurados; ampliar esse limite e reutilizar a conexão evita descarte prematuro sem colocar a escrita no caminho da resposta. Falhas e excesso de carga descartam coleta; aviso operacional agregado distingue timeout, capacidade, conexão e armazenamento, sem expor mensagem original ou payload. Não há garantia de entrega sem perda/outbox transacional.
- `JourneyIdentityLink` guarda `(anonymousId, sessionId, userId, authenticatedAt)` somente a partir de `signup_completed`/`login_completed`, na mesma instrução SQL que insere o fato. Logout gira a sessão. Não reescreve eventos passados nem une toda a vida de um dispositivo a uma conta.
- Em dispositivo compartilhado, uma sessão com mais de um usuário autenticado não deve ter seus fatos anônimos atribuídos automaticamente a um deles. Eventos com `userId` explícito continuam válidos. Usar apenas vínculos de sessão sem ambiguidade ao reconstruir o trecho anterior ao login.
- `brokerId`, `propertyId` e `catalogId` são contexto do recurso. **Nunca usar o dono do catálogo/imóvel como usuário ativo por causa de visita pública.** Atividade de produto considera ator autenticado e rotas/ações do portal; tráfego público é métrica separada.
- Metadata é uma allowlist de enums, números limitados, booleanos e IDs. Não são armazenados email, nome, telefone, senha, PIN, tokens, IP, corpo de mensagem, prompt, conteúdo do contrato, query de busca, stack trace ou texto livre de exceção nesta camada. Referrer contém somente hostname; path tem query/fragmento removidos e segmentos dinâmicos ocultados como `:id`. UTMs aceitam apenas valores enumerados.

## Telemetria anterior

`CatalogEvent`, `SearchEvent`, `AiOperationTelemetry` e Vercel Analytics continuam funcionando. Não foram migrados, apagados ou somados à nova tabela. `legacySource` identifica o ponto de instrumentação compartilhado, não um evento adicional a agregar.

Para novos indicadores de jornada, **usar somente `JourneyEvent`**. Para custos/tokens/tentativas de provedor, continuar com `AiOperationTelemetry`. Um trabalho Studio pode envolver diversas chamadas de IA: essas linhas não equivalem a diversas gerações concluídas. Para histórico anterior à ativação, apresentar a origem e cobertura separadamente; não concatenar contagens legadas com as novas.

## Consultas futuras do Admin

| Pergunta | Critério |
| --- | --- |
| Pessoas, sessões e páginas hoje | `page_view`; distintos `anonymousId` e `sessionId`, excluindo bots; não somar `landing_view` ao total de páginas |
| Origem e rotas | Primeiro `page_view` da sessão, hostname/UTMs permitidas, `route`, `device` |
| Cadastro e abandono | Sequência temporal de `signup_started`, marcos e `signup_completed`; agrupar por sessão/requisição e janela de tentativa. Abandono é inferido por ausência após janela, nunca evento de fechamento de aba |
| Erros | Somente `error_occurred`, agrupado por código/rota e usuário/sessão; último `occurredAt`, correlação e frequência |
| Marketplace e cada catálogo | `marketplace_view`/`catalog_view`, distintos visitantes e sessões, `catalogId`; buscas em evento próprio |
| Uso e frequência | Ator autenticado em páginas do portal e ações concluídas; contagens de dias ativos e última ação, sem inferência por proprietário |
| Ações concluídas | Eventos de negócio `producer='server'`; ID único e canal; não usar clique como sucesso |

Exemplo de dia do Admin, preservando índice temporal:

```sql
SELECT count(*) AS pages,
       count(DISTINCT "anonymousId") AS visitors,
       count(DISTINCT "sessionId") AS sessions
FROM "JourneyEvent"
WHERE "eventName" = 'page_view' AND device <> 'bot'
  AND "occurredAt" >= ($1::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
  AND "occurredAt" < (($1::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
```

Para formatar timestamps, usar `Intl.DateTimeFormat('pt-BR', { timeZone: ADMIN_ANALYTICS_TIME_ZONE, ... })`. Não converter datas na escrita nem truncar por dia UTC para responder “hoje” no Brasil.

## Cobertura e limites restantes

- O banco configurado e o servidor local foram ativados; cada deploy remoto ainda exige configuração e smoke próprios. Não há dados retroativos na nova tabela.
- Captura HTTP central cobre as famílias auth, properties/uploads, brokers, agencies, leads, studio-ia, stripe, assistant, cos-launch e conversas públicas do Marketplace. Exceções não tratadas de outras rotas Node/render entram pelo hook global; respostas de erro **tratadas** em famílias ainda não envolvidas precisam aderir ao wrapper.
- PDF final de template está coberto. Exportações de contrato realizadas exclusivamente no browser e simples download de documento já anexado não são contados como geração confirmada no servidor.
- Mensagens externas WhatsApp, assistentes legados fora do COS principal/Launch, jobs fora de contexto HTTP e acesso cross-device ainda exigem instrumentação específica. Nunca serão inferidos a partir do dono do recurso. Validações dos formulários financeiros do Launch têm código de erro na coleta, preservando a resposta existente da interface.
- Na geração síncrona, início usa ID de requisição e conclusão usa ID de campanha; a ligação se faz por `correlationId`. Jobs retomados em outra sessão são atribuídos à campanha/ator autenticado, sem reconstruir a sessão original quando não existe evidência persistida.
- Sessões já autenticadas antes da ativação terão ator nos eventos atuais; vínculo histórico anônimo só nasce no próximo login/cadastro confirmado. Cookies bloqueados/perfis privados/ad blockers podem reduzir continuidade e coleta. Não se promete contagem exata de pessoas físicas.
- Rate limit é local ao processo; limitação distribuída, retenção/remoção de dados pseudônimos, monitoração de descarte e eventual fila durável devem acompanhar a expansão. A arquitetura atual prioriza não interromper cadastro, pagamento ou publicação.
- Admin novo, consultas agregadas, gráficos e política de conversão por tentativa ficam para a próxima etapa, usando estas definições.

## Validação

### Smoke de ativação — 10/09/2026

- `prisma migrate deploy` encontrou somente `20260910230000_journey_analytics` pendente. Depois da aplicação, o checksum no histórico correspondeu ao arquivo; as duas chaves primárias e os oito índices secundários estavam válidos/prontos. Os três campos temporais são `TIMESTAMPTZ(3)`. As contagens de registros existentes permaneceram iguais imediatamente após a migração.
- Após o ajuste do pool, uma jornada pública real produziu dez eventos de browser e todos foram encontrados uma única vez no banco: quatro `page_view` (landing, abertura de cadastro, Marketplace e catálogo), `landing_view`, `signup_started`, `signup_failed`, `marketplace_view`, `catalog_view` e um erro frontend controlado. Todos mantiveram a mesma sessão/identidade anônima e `userId=null`.
- Uma mensagem de ajuda enviada na interface autenticada do COS teve resposta normal e `cos_message_sent` persistido pelo servidor, com ator e correlação. As páginas de Studio e plano foram exercitadas sem iniciar geração ou pagamento. Requisições sem autenticação aos endpoints do Studio/checkout preservaram o 401 e persistiram os erros de cada módulo.
- A associação após login ainda depende de um novo login confirmado: na última consulta do smoke, não havia `login_completed` nem linha em `JourneyIdentityLink`. A sessão já aberta permitiu validar o ator no COS/Studio/plano, mas não comprova a criação do vínculo. Não foi criado vínculo manual nem alterado evento histórico para suprir essa ausência.
- Reenviar seis cópias do mesmo evento real, distribuídas em três requisições, manteve uma única linha. O coletor respondeu 202 em 50–92 ms nesse teste local. Bloquear somente o coletor no navegador preservou a navegação (200) e a resposta real de validação do cadastro (400).
- Não foram criados usuários, imóveis, leads ou pagamentos para o smoke. A conversa/mensagem de ajuda gerada pelo fluxo normal do COS foi preservada. As tabelas de analytics contêm os acessos e erros deliberados desta validação; eles não representam incidentes de usuários finais.
- Estas medições são um smoke local, com compilação de desenvolvimento e banco remoto; não constituem benchmark de produção. Cadastro concluído, geração paga e pagamento concluído não foram provocados no ambiente real. Seus pontos de confirmação continuam cobertos pelos testes automatizados.
- Regressão após o ajuste: 118 testes de domínio/analytics/billing e quatro testes de navegador aprovados; TypeScript e lint dos arquivos de código alterados aprovados. O teste novo verifica descarte por capacidade, recuperação da fila e ausência de credenciais nos avisos de timeout.

`tests/journey-analytics.test.mjs` exercita contrato, privacidade, contexto concorrente, confirmação de autenticação, falha de coleta, publicação, deduplicação, collector, webhook real com dependências simuladas e persistência de prévia/vídeo do Studio. `tests/e2e/journey-analytics.spec.ts` usa Chromium em desktop/mobile, APIs simuladas e módulos reais do browser. Não usa Stripe/banco reais.

Foram executados também os testes anteriores de billing, TypeScript com `--allowImportingTsExtensions` (necessário aos testes já existentes), lint dos arquivos alterados, `prisma validate`, `prisma generate` e diff local dos schemas. O lint global revelou problemas anteriores em `lib/billing.ts` (`no-useless-assignment`) e no script local não rastreado `scripts/cleanup-candidate-accounts.cjs`; esses arquivos não fazem parte desta entrega.

Referências: [Next.js — after](https://nextjs.org/docs/app/api-reference/functions/after), inclusive callbacks aninhados e execução após resposta; [Stripe — fulfillment](https://docs.stripe.com/checkout/fulfillment), confirmação de pagamento e entregas repetidas/assíncronas.
