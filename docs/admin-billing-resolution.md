# Resolução de assinatura do Admin — etapa 1

## Escopo e segurança

`resolveAccountBilling` em `lib/billing-resolution.ts` é uma função de domínio sem
Prisma, Stripe SDK, variáveis de ambiente ou efeitos colaterais. A primeira integração
é exclusivamente de leitura, na lista de usuários, no detalhe e nas respostas das
ações existentes dessa lista. Não é utilizada pelos controles de acesso.

Não há alteração de schema, webhook, créditos, permissões, dados existentes,
analytics ou cobrança. Nenhuma conciliação acontece ao abrir o Admin.

`loadAdminUserBillings` lê as assinaturas em lote para os proprietários BROKER e
AGENCY. Uma falha de consulta é propagada como erro, nunca como uma lista de contas
Free. O carregamento não chama helpers `ensure`/`upsert` nem endpoints Billing.

## Contrato e precedência

- **Identidade:** ID e papel são preservados; o papel não determina o plano.
- **Contratado:** Price explicitamente reconhecido, quando houver evidência Stripe;
  depois plano pago de BrokerPlanAccount; depois enum legado explícito e corroborado
  por estado/vínculo de assinatura. `BROKER` significa Pro e `AGENCY` significa Scale
  apenas como valores de `User.plan`, nunca como `User.role`.
- **Free:** exige ausência de sinais pagos/vínculos pendentes e ausência de plano
  desconhecido. `null` representa plano não resolvido, não Free.
- **Efetivo:** informa o tier persistido em BrokerPlanAccount ou o fallback legado
  usado quando a conta de plano está ausente. É uma observação/estimativa do acesso
  atual, não uma nova decisão de autorização. Flags globais e regras específicas de
  cada módulo continuam sendo aplicadas pelo código de acesso existente.
- **Original:** preserva status e fonte. Um `ACTIVE` local não é anunciado como
  status original Stripe `active`.
- **Apresentação:** Free, Trial, Ativa, Cancelando, Inadimplente, Cancelada ou Pendente
  de conciliação. Conflitos prevalecem na apresentação, preservando também o lifecycle
  observado e os planos conhecidos. `incomplete` tem pagamento pendente, não atraso.
- **Financeiro:** `active` não comprova pagamento. Sem evidência financeira, permanece
  desconhecido; não são fabricados valores, dias em atraso ou último pagamento.
- **Datas:** início Stripe, trial, renovação, cancelamento, observação e última
  conciliação são separados. Datas indisponíveis são `null`; criação da assinatura
  interna não se torna data de início financeiro. Cancelamento programado suprime a
  renovação, mesmo se `nextBillingAt` ainda contiver uma data antiga.

O alias comercial histórico `growth` continua reconhecido como Scale. Outros
planos ou Prices desconhecidos geram conflito, sem fallback para Free ou Pro.

## Limitação explícita desta etapa

O schema atual não preserva Price do plano, status original Stripe nem uma data
confiável de conciliação. Campos de período/concessão de créditos e `updatedAt` não
são usados para inventar esses dados. A leitura atual do Admin não consulta Stripe:
`stripeStatus`, `stripeObservedAt` e `lastReconciledAt` permanecem `null`, e a resposta
informa essa limitação.

Assim, uma assinatura local coerente pode ser apresentada como Ativa com fonte
`subscription`; isso não confirma que o Stripe esteja ativo em vez de trialing.
Um trial interno com vínculo Stripe não verificado é pendência explícita.

O resolvedor aceita evidência Stripe confiável e um mapa explícito Price → plano.
Os testes de trial Stripe, incomplete e Price desconhecido exercitam esse contrato
com fixtures. Isso não significa que esses dados tenham sido recuperados de contas
reais. O futuro leitor deve entregar o item do plano base, sem confundi-lo com
adicionais, e tratar múltiplas assinaturas candidatas como ambiguidade.

## Divergências detectadas

- Plano legado diferente do contratado ou do BrokerPlanAccount.
- Free com sinais de assinatura paga.
- Plano desconhecido; Price ausente/desconhecido em evidência Stripe fornecida.
- Customer/Subscription ausentes ou IDs conflitantes.
- Assinatura interna ausente para uma conta com sinais pagos.
- Status de User, Subscription e evidência Stripe incompatíveis.
- Cancelamento programado divergente ou assinatura cancelada com tier pago mantido.
- Trial local expirado, trial Stripe não verificado ou lifecycle não suportado.

Esses diagnósticos descrevem regras e fixtures; não é um levantamento de usuários
afetados em produção. Um plano conhecido continua visível junto da pendência.

## Integração no Admin

A coluna existente de plano mostra o plano contratado e o status da resolução;
o status operacional do usuário permanece separado. O filtro de pendências inclui
também Pro/Scale com conflito. O detalhe usa a mesma resolução. O formulário de
perfil envia apenas nome, email e telefone: o rótulo comercial, somente leitura,
não é reenviado ao parser legado de plano.

As demais telas administrativas e métricas não foram migradas nesta etapa.

## Próxima etapa: conciliação Stripe

1. Implementar leitor somente de leitura com mapeamento de Prices atuais/legados,
   ambiente e vínculo inequívoco por conta; não recuperar contas apenas por email.
2. Comparar seus snapshots com este resolvedor, sem atualizar acesso ou registros.
3. Revisar conflitos de vínculo, plano e lifecycle antes de qualquer reparo.
4. Definir persistência aditiva para snapshots/recebimentos e datas de conciliação;
   eventos duplicados e fora de ordem precisam de processamento seguro.
5. Só depois migrar outras superfícies e discutir uma política unificada de acesso.

## Validação local

```sh
node --experimental-strip-types --experimental-test-isolation=none --test tests/billing-resolution.test.mjs tests/billing-lifecycle.test.mjs
npx tsc --noEmit --incremental false --allowImportingTsExtensions
```

Os testes do resolvedor executam cenários sintéticos e os adaptadores reais com
dependências de banco injetadas. Não usam `.env.local`, banco ou conta Stripe.
