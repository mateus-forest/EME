# Deploy EME

## Variaveis obrigatorias

Configure na Vercel e no ambiente local:

- `DATABASE_URL`: Postgres/Supabase usado pelo Prisma.
- `AUTH_SECRET`: segredo longo para assinar JWT de sessao.
- `NEXT_PUBLIC_APP_URL`: URL publica do app, por exemplo `https://seu-dominio.com`.

## Supabase

O EME usa Supabase Postgres via Prisma por `DATABASE_URL`. Nao trocar a autenticacao atual por Supabase Auth sem decisao de produto.

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
- `STRIPE_PRICE_BROKER`
- `STRIPE_PRICE_AGENCY_BASE`
- `STRIPE_PRICE_AGENCY_PER_BROKER`, quando a cobranca por corretor for finalizada
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, se o frontend passar a usar Stripe.js

Se `STRIPE_ENABLED=false`, checkout e webhook respondem com erro claro e nao quebram o build.

## OpenAI

OpenAI fica desligada ate a configuracao real:

- `OPENAI_ENABLED=false`

Para ativar:

- `OPENAI_ENABLED=true`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`, opcional, padrao `gpt-5-mini`

Se desativada, o endpoint de IA retorna erro amigavel sem expor chave.

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
