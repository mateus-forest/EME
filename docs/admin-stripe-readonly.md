# Verificação Stripe somente de leitura

## Uso no Admin

Em **Usuários → Detalhes → Créditos, assinatura e cobranças**, clicar em
**Verificar Stripe**. A comparação aparece dentro da seção existente, sem redesenhar
o portal. A lista recebe o resultado daquela consulta na memória do navegador.
Recarregar a página volta à projeção local; nenhum resultado é persistido.

O endpoint `GET /api/admin/users/[id]/billing` exige ADMIN e responde com
`Cache-Control: private, no-store`. Não há POST, PATCH, recuperação por email,
sincronização, concessão de acesso ou correção automática nesse fluxo.

## Dados observados

- Customer: existência, exclusão, ambiente e metadata de vínculo.
- Subscriptions vinculadas e histórico do Customer, incluindo canceladas.
- Status original, start_date, trial_start/end, cancel_at_period_end, cancel_at e
  canceled_at. canceled_at é o valor original do Stripe, não uma data inventada de
  término do acesso.
- Todos os itens dentro dos limites da consulta, seus Prices, quantidade,
  recorrência, moeda, preço unitário e metadata de vínculo.
- current_period_start/end do **item do plano base**. Períodos de adicionais não
  determinam a renovação do plano.
- IDs/metadata comparados com User, BrokerPlanAccount e proprietário local.
- Outro usuário local usando o mesmo Customer/Subscription.

Somente metadata permitida de vínculo/plano é retornada; não se expõem credenciais,
dados de pagamento, emails do Customer nem metadata livre. O leitor não consulta
invoices: assinatura ativa continua sem comprovar pagamento.

## Limites e correspondência

O adaptador expõe exclusivamente cinco operações GET do SDK: Customer retrieve,
Subscription retrieve/list, SubscriptionItem list e Price retrieve. Cada chamada
tem timeout de cinco segundos e zero retries automáticos. A verificação permite
até 24 chamadas, três páginas por coleção e vinte segundos para iniciar novas
chamadas. Uma chamada já iniciada pode consumir seu timeout restante. Resultado
truncado, timeout ou erro mantém pendência explícita.

Uma Subscription local encerrada não esconde outra ativa no mesmo Customer.
Múltiplas assinaturas não encerradas, dois itens de plano, ambientes diferentes,
metadata de outro proprietário ou IDs compartilhados exigem revisão. Assinaturas
descobertas no Customer podem ser mostradas como candidatas; nunca são vinculadas
automaticamente nem substituem um vínculo ausente.

Prices de Pro/Scale usam o mapeamento configurado existente. Os Prices recorrentes
de capacidade são reconhecidos separadamente. Metadata, nome e valor do Price não
são usados para adivinhar um plano. Prices históricos não mapeados continuam
pendentes. Configuração conflitante de Prices deixa o leitor indisponível.

Free sem vínculo e sem sinais pagos não consulta Stripe. Isso não é uma busca global
por Customers órfãos: a interface informa que não houve consulta remota. Contas pagas
sem vínculo continuam pendentes.

## Integração com o resolvedor

`billing-resolution.ts` recebe snapshot e diagnóstico da leitura. Preserva plano
local/efetivo, plano contratado pelo Price, status original e fonte, datas e
conflitos. Evidência de outro proprietário/ambiente ou seleção ambígua não é usada
como autoridade para o plano.

`verificationStatus: verified` significa que a leitura remota terminou com evidência
identificada; ainda pode haver divergência com o banco, indicada pelos conflitos e
por `presentationStatus: Pendente de conciliação`.

`lastCheckedAt` registra a tentativa atual; `stripeObservedAt` registra o snapshot.
`lastReconciledAt` permanece nulo: não houve sincronização/reparo nem persistência
de histórico. Datas ausentes não são inferidas de criação de registros/créditos.

Não há alteração de schema, permissões, limites, analytics, webhook ou billing
transacional. As leituras de banco e Stripe não formam um snapshot atômico entre
sistemas; uma alteração simultânea pode exigir nova verificação.

## Verificações realizadas

- Testes de domínio/leitor: Free, Pro, Scale, trialing, past_due, incomplete,
  cancelamento programado, canceled, Price desconhecido, recursos ausentes,
  metadata, paginação, adicionais, ambiguidade, indisponibilidade e vínculos
  compartilhados. SDK e banco são injetados sem métodos de escrita.
- Teste da autorização do endpoint e cabeçalho sem cache.
- Teste de interface desktop/mobile com todas as APIs simuladas; verifica que a
  consulta é sob demanda e usa somente GET.
- Conferência real limitada a até cinco contas vinculadas: retornou duas contas,
  ambas Pro/active, sem divergência nos campos comparados. SELECT em transação
  PostgreSQL READ ONLY e consultas GET Stripe; nenhum dado pessoal é registrado
  neste documento. O driver SQL de validação usa UTC, como o Prisma.

```sh
node --experimental-strip-types --experimental-test-isolation=none --test tests/stripe-billing-reader.test.mjs tests/billing-resolution.test.mjs tests/billing-lifecycle.test.mjs
npx tsc --noEmit --incremental false --allowImportingTsExtensions
npx playwright test tests/e2e/admin-stripe-billing-readonly.spec.ts
```

## Revisão manual posterior

Revisar Prices não mapeados, recursos ausentes/excluídos, vínculos compartilhados,
metadata divergente, assinaturas concorrentes e discrepâncias de plano, status ou
datas. Timeout requer nova leitura, não alteração de plano. Nenhum desses reparos
é implementado aqui; a amostra real não identifica pendências nos campos conferidos
e não substitui uma auditoria completa da base ou de Customers sem vínculo local.
