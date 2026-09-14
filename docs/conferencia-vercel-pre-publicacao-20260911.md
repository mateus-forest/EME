# Conferência antes da publicação — projeto eme

## Resultado desta conferência

O responsável informou estar autenticado na Vercel. A sessão não ficou disponível para as ferramentas: o inventário retornou `apps: [], browsers: []` e a tentativa de selecionar o navegador retornou `No browser is available`. Também não há CLI Vercel disponível, credencial CLI nos locais convencionais, `VERCEL_TOKEN` no processo ou vínculo `.vercel/project.json` da candidata. Não foram extraídos cookies ou segredos do navegador.

Assim, **deployment ativo, ID/SHA de produção, branch Production, variáveis remotas e overrides dos comandos continuam não confirmados**. Estar autenticado no navegador do usuário não comprova acesso dessa ferramenta à sessão.

## Candidata local reconferida

- Branch: `release/landing-auth-20260911`.
- Base de Git: `8c717794d7be1b5a910523fd6f343bf3836fafe1`; não é uma confirmação da base em produção.
- Árvore de arquivos combinada: `bee9e5eeb26aeafaded0719a086bc770edb81688`.
- Patch combinado SHA256: `61f63b9d3e9bdd7cc22f8ef290c5ef015aa00e7213f97581cb964df4ea686885`.
- Os 34 arquivos mantêm os hashes do manifesto; o índice foi comparado com a árvore acima sem diferenças.
- Inclui landing/textos finais, login/cadastro/recuperação visual, correção de autofill, bloqueio de papéis privilegiados no cadastro público e validação de `next` no servidor/cliente.
- Não inclui schema/migrations, configurações privadas, banco ou contas de QA, dependências novas, alterações de billing, player ou funcionalidades independentes do portal.
- `prisma`, dependências, `vercel.json`, `next.config.mjs`, assinatura de sessões/cookies e handlers de login/PIN/biometria não têm alterações no delta selecionado.

**O identificador da árvore não é um SHA de commit nem um ID de deployment.** A candidata continua em arquivos/índice local; nenhum deployment foi criado ou promovido. Não há um deployment Vercel exato a apresentar ainda.

Os testes anteriores permanecem associados aos mesmos arquivos: 110 unitários, 34 de navegador, lint, build e TypeScript aprovados; smoke de autenticação com PostgreSQL local real, sem mocks e sem criar contas. Não foram repetidos testes de aplicação nesta conferência, pois os hashes não mudaram.

## Comandos e configuração

Confirmado somente no repositório:

```text
Install: npm install
Build: npx prisma generate && npm run build
npm run build: next build
```

Esses comandos não chamam migração, seed, reset ou importação. A existência de scripts manuais de banco não significa que serão executados. O painel pode ter overrides: ainda é necessário verificá-los.

No painel do projeto **eme**, conferir sem revelar valores:

1. **Overview → Production Deployment:** ID, URL imutável, commit SHA, Git ref, estado Current/Ready e domínio `www.meueme.com`.
2. **Settings → Git:** repositório `mateus-forest/EME` e branch Production efetiva.
3. **Build and Deployment:** Root Directory, framework, versão Node, Install/Build e Ignored Build Step. Nenhum comando de migração, seed, reset ou `db push`.
4. **Environment Variables → Production:** preservar banco real (`DATABASE_URL`/`DIRECT_URL`), segredo vigente de autenticação e duração das sessões; confirmar `NEXT_PUBLIC_APP_URL=https://www.meueme.com`, `COOKIE_SECURE_AUTO` ausente/true e ausência de preload de fixture em `NODE_OPTIONS`. Preservar IMOBISEC, Stripe, Storage, IA e demais integrações reais. Não copiar ambiente de teste.
5. **Domains e contexto de build:** host `www` preservado para cookies/WebAuthn; `VERCEL_ENV=production` no build; landing indexável e canonical oficial, Preview sem indexação.
6. **Rollback:** ID/SHA e elegibilidade do deployment seguro de reversão. Não acionar agora.

## Reversão

A base local da interface anterior com as duas correções está em `review/auth-security-20260911`, árvore `a2a5fd3bad183ad88c4f7f43cef3382bc7801d89`. Seu índice foi reconferido sem diferenças.

O comando `git apply --check` confirmou que `03-integracao-visual-segura.patch` aplica sobre essa base corrigida. A verificação inversa na candidata combinada confirmou que retirar apenas esse delta visual preserva os patches de cadastro e redirecionamento. As verificações não alteraram arquivos nem banco.

Após identificar a base realmente em produção, adequar os deltas a ela se necessário e repetir a validação pertinente. Depois da aprovação, o procedimento prevê primeiro criar uma versão Production da interface anterior com ambos os fixes e registrar seu ID/SHA; essa será a base segura para reversão da mudança visual. Só então publicar a interface nova sobre a mesma base corrigida.

O rollback deve apontar para essa versão segura, sem restaurar banco, apagar contas ou trocar o segredo de autenticação. A elegibilidade no painel não está comprovada; **o deployment seguro de rollback ainda não foi criado/identificado nesta sessão**. Não usar automaticamente o deployment anterior se ele ainda contiver as vulnerabilidades.

## Impedimentos restantes

- Disponibilizar a aba autenticada para esta sessão ou fornecer os identificadores e confirmações não secretas do painel.
- Confirmar a base real de produção e o alvo seguro de rollback.
- Fixar o commit final sobre essa base e identificar o artefato/deployment a ser aprovado; a árvore local acima identifica somente o conteúdo atualmente revisado.
- Recuperação de senha segue explicitamente indisponível, sem simulação de envio; precisa ser aceita como limitação da versão.

Nada foi publicado, enviado por push ou alterado em produção. Nenhum banco ou conta foi transferido. O [relatório das correções](auth-seguranca-publicacao-20260911.md) contém os patches e os resultados detalhados.
