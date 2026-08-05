# Deploy EME

## Variaveis obrigatorias

Configure na Vercel e no ambiente local:

- `DATABASE_URL`: Supabase Transaction Pooler usado pelo Prisma Client em runtime.
- `DIRECT_URL`: conexao direta do Supabase para Prisma CLI, migrations e ferramentas.
- `AUTH_SECRET`: segredo longo para assinar JWT de sessao.
- `NEXT_PUBLIC_APP_URL`: URL publica do app, por exemplo `https://seu-dominio.com`.
- `DATABASE_POOL_MAX`: limite do pool Node `pg`; use `1` na Vercel por padrao.

## Supabase

O EME usa Supabase Postgres via Prisma por `DATABASE_URL`. Nao trocar a autenticacao atual por Supabase Auth sem decisao de produto.

Para Vercel, use o Transaction Pooler do Supabase em `DATABASE_URL`, porta `6543`, com `pgbouncer=true`:

```bash
DATABASE_URL="postgresql://postgres.PROJECT_REF:SENHA@aws-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:SENHA@db.PROJECT_REF.supabase.co:5432/postgres"
DATABASE_POOL_MAX=1
```

Nao use o Session Pooler em producao serverless:

```bash
# Evitar na Vercel para runtime da aplicacao
postgresql://postgres.PROJECT_REF:SENHA@aws-REGION.pooler.supabase.com:5432/postgres
```

O Session Pooler mantem conexoes por sessao e pode causar `max clients reached in session mode` sob concorrencia. O Transaction Pooler multiplexa conexoes por transacao e e o formato recomendado para trafego de aplicacao serverless.

Storage e opcional:

- `SUPABASE_STORAGE_ENABLED=false` por padrao.
- Se ativar, configurar `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_STORAGE_BUCKET`.
- `SUPABASE_SERVICE_ROLE_KEY` e segredo server-side e nunca deve ser usado em Client Component.

## Vercel

O projeto usa `vercel.json` com:

- `installCommand`: `npm install`
- `buildCommand`: `npx prisma generate && npm run build`

Nao versionar `.env`, `.env.local`, `.env.production` ou `.env.development`.

## Stripe

Stripe fica desligado ate a configuracao real:

- `STRIPE_ENABLED=false`

Para ativar:

- `STRIPE_ENABLED=true`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_SCALE`
- `STRIPE_PRICE_CREDITS_250`
- `STRIPE_PRICE_CREDITS_750`
- `STRIPE_PRICE_CREDITS_1500`
- `STRIPE_PRICE_PROPERTIES_250`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, se o frontend passar a usar Stripe.js

O checkout atual continua preparado apenas para assinatura, mas a camada de ambiente ja expoe os prices de plano e de pacotes da arquitetura comercial nova.

Se `STRIPE_ENABLED=false`, checkout e webhook respondem com erro claro e nao quebram o build.

## OpenAI

OpenAI fica desligada ate a configuracao real:

- `OPENAI_ENABLED=false`

Para ativar:

- `OPENAI_ENABLED=true`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`, opcional, padrao `gpt-5-mini`

Se desativada, o endpoint de IA retorna erro amigavel sem expor chave.

## Fluxo de validacao em clone local

Em clones locais usados para desenvolvimento, as variaveis sensiveis de producao nao sao compartilhadas.

Isso inclui, por exemplo:

- `OPENAI_API_KEY`
- `DATABASE_URL`
- `AUTH_SECRET`
- outros secrets do ambiente da Vercel

Nesses casos, o fluxo esperado e:

- desenvolvimento e correcoes no codigo;
- validacao local por `lint`, `tsc --noEmit`, `build` e analise estatica;
- instrumentacao temporaria de logs quando necessario;
- deploy e testes reais feitos apenas no ambiente configurado;
- analise posterior dos logs de producao para continuar a investigacao.

Para integracoes externas indisponiveis no clone local, use sempre este status no relatorio:

- Corrigido em codigo
- Validado localmente (lint, build, tipagem e analise estatica)
- Pendente de validacao em producao (OpenAI/Vercel)

Nao considerar integracoes externas como validadas apenas com execucao local quando o ambiente depender de secrets ausentes.

## WhatsApp

Preparado para configuracao futura:

- `WHATSAPP_ENABLED=false`
- `WHATSAPP_PROVIDER`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_WEBHOOK_SECRET`
- `WHATSAPP_DEFAULT_COUNTRY_CODE=55`

Fluxo futuro desejado: fotos e audio pelo WhatsApp, IA cria anuncio, sistema publica e retorna link do catalogo.

## Validacao antes de deploy

Execute na ordem:

```bash
npm install
npx prisma generate
npx prisma validate
npx tsc --noEmit
npm run build
```

Se algum comando falhar, corrija antes de publicar.
