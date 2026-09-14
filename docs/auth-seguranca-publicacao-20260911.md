# Correções de segurança antes da publicação — EME

Data: 11/09/2026. Destino previsto: **https://www.meueme.com/**, projeto Vercel **eme**.

**Estado: correções locais separadas para revisão. Nenhuma publicação, push, migração, substituição de banco ou transferência de contas foi autorizada ou executada nesta etapa.** Este adendo substitui o diagnóstico ainda não corrigido dos dois primeiros impedimentos do [relatório anterior](publicacao-landing-acesso-20260911.md). O relatório anterior permanece como registro da candidata visual e dos testes realizados naquela etapa.

## Cadastro público

A causa era a aceitação do enum de usuários, incluindo `ADMIN`, diretamente a partir do body público. O formulário visual enviava `BROKER`, mas isso não restringia requisições diretas à API.

`app/api/auth/register/route.ts` agora admite explicitamente somente os tipos públicos já existentes, `BROKER` e `AGENCY`. `ADMIN`, qualquer outro papel, tipo incorreto, variação de caixa ou valor ausente recebe HTTP 400 com código `PUBLIC_REGISTRATION_ROLE_INVALID`, antes de consultar usuário, verificar CRECI, gerar hash, abrir transação ou emitir sessão. Não se converte um papel inválido silenciosamente em outro tipo de conta.

O fluxo `BROKER` conserva CRECI e UF obrigatórios e a validação existente. O contrato público de `AGENCY` conserva seus campos e sua criação de perfil; suas telas e rotas continuam desativadas onde o proxy já as desativava. A correção não reativa essas telas. Campos adicionais como `isAdmin`, `permissions` ou um objeto `user` não determinam o papel persistido. Contas existentes, inclusive administradores legítimos, não são alteradas.

## Retorno após autenticação

A causa era considerar qualquer texto iniciado com `/` como interno. Valores como `//outro-host` ou uma barra seguida de contrabarra podem ser interpretados como outra origem pelo navegador.

`lib/auth-redirect.ts` concentra a política usada no servidor e no cliente:

- aceita caminhos internos nas superfícies existentes, com query e hash legítimos;
- rejeita URLs absolutas, referências externas, contrabarras, controles, codificações ambíguas no pathname, raízes não previstas e `next` duplicado;
- impede retorno para autenticação, APIs e arquivos fora das superfícies admitidas;
- normaliza o caminho antes de conferir a raiz e, depois da autenticação, respeita os papéis já exigidos pelos guards do portal;
- usa `/corretor` para BROKER, `/admin` para ADMIN e `/` para AGENCY quando o valor não é aceito.

O `proxy.ts` confere `next` em `/login` antes de renderizar a tela. Remove valores inválidos ou duplicados, preserva os outros parâmetros e normaliza um destino válido quando necessário. Sem `next`, o cliente usa o destino padrão do usuário autenticado. Os redirecionamentos e respostas 410 preexistentes do proxy permanecem preservados.

O controlador integrado e os dois componentes de login anteriores usam o mesmo resolvedor no cliente. Isso também mantém uma base segura para voltar à interface anterior. A restrição por papel repete os guards existentes; não concede nem remove permissões. Os endpoints de login por senha, PIN e biometria não consomem `next` e continuam retornando o usuário como antes, sem nova chamada de rede ou alteração da cerimônia WebAuthn.

## Separação revisável

Base de revisão: `8c717794d7be1b5a910523fd6f343bf3836fafe1`. **Essa referência não comprova o SHA atualmente em produção.** Se o deployment ativo tiver outra base, aplicar somente os deltas aprovados sobre ela e repetir a validação.

- Branch de segurança: `review/auth-security-20260911`, na pasta `.qa-audit-tmp/auth-security-20260911/project`.
- Candidata visual: `release/landing-auth-20260911`, na pasta `.qa-audit-tmp/release-landing-auth-20260911/project`.
- Alterações de revisão mantidas em arquivos/índices, sem commits ou push nesta etapa.

Os patches de revisão têm esta divisão, na pasta `.qa-audit-tmp/auth-security-20260911/`:

| Artefato | Escopo |
|---|---|
| `01-cadastro-publico.patch` | Bloqueio servidor de papéis privilegiados e testes da API pública |
| `02-redirecionamento-interno.patch` | Resolvedor compartilhado, proxy e consumidores da interface anterior; testes de redirecionamento |
| `03-integracao-visual-segura.patch` | Delta visual sobre a base de segurança, incluindo a ligação do controlador integrado ao resolvedor |
| `combined-review.patch` | Resultado combinado para revisão; não é uma instrução de publicação |
| Manifesto de revisão | Base, arquivos, hashes e composição dos deltas, gerado junto aos patches |

**Artefatos gerados e conferidos.** O arquivo `review-manifest.json` registra SHA256 de cada patch e arquivo. São 9 arquivos na base de segurança, 26 no delta visual e 34 arquivos distintos no resultado combinado. Os patches 01 e 02 são independentes sobre a mesma base; o patch 03 aplica sobre a interface anterior com ambos os fixes. Foram conferidas a aplicação do delta visual e sua reversão, além da ausência de valores secretos locais nos arquivos. Os antigos artefatos visuais foram preservados como histórico e não devem ser usados isoladamente para publicar.

Arquivos das correções:

| Grupo | Arquivos |
|---|---|
| Cadastro | `app/api/auth/register/route.ts`, `tests/public-registration-security.test.mjs` |
| Domínio e servidor | `lib/auth-redirect.ts`, `lib/auth-client.ts`, `proxy.ts` |
| Consumidores cliente | `components/login-page.tsx`, `components/auth-v0-experience.tsx`, `components/eme/use-auth-form.ts` |
| Testes de retorno | `tests/auth-redirect-security.test.mjs`, `tests/e2e/auth-redirect-security.spec.ts` |
| Registro da revisão | Este adendo e o aviso no topo do relatório anterior |

Não fazem parte dos deltas: schema/migrations, dados ou arquivos PostgreSQL, `.env` privados, credenciais e contas de QA, fixtures de runtime, scripts de teste local, mudanças independentes do player/Studio/portal ou alterações anteriores fora da landing e do acesso.

## Validação

| Verificação | Resultado desta etapa |
|---|---|
| Testes Node de cadastro público | 33 passaram |
| Testes Node do resolvedor e proxy | 77 passaram |
| Total Node | **110 passaram**, sem falhas |
| ESLint dos arquivos da correção | Passou |
| Build e TypeScript da candidata combinada | Passaram; 111 páginas geradas |
| Fluxos no navegador, cadastro/login legítimos e retornos inválidos | **34 passaram**, sem falhas ou skips: 11 novos de segurança e 23 da integração de acesso |
| Smoke com serviço de autenticação e banco locais reais | Passou, sem interceptação/mocks e sem criar contas |

Comando das suítes Node:

```text
node --test --experimental-test-isolation=none tests/public-registration-security.test.mjs tests/auth-redirect-security.test.mjs
```

As suítes executam o código real da rota, do resolvedor e do proxy, transpilation isolada e classes `NextRequest`/`NextResponse`. **A suíte do cadastro substitui explicitamente banco, hashing, tokens e provedor CRECI por dependências controladas:** comprova rejeição antes de efeitos e preservação do contrato, mas não equivale a cadastro em serviços reais. Não há credenciais ou acesso de produção nesses testes. A suíte de redirecionamento não precisa de banco nem rede.

Há cobertura de tentativa `ADMIN` e outros papéis inválidos, payload malformado, campos obrigatórios, conta existente, CRECI rejeitado e criação legítima BROKER/AGENCY. Para redirecionamento, há URLs externas, controles, codificação, duplicados, destinos de autenticação/API, papel incorreto, defaults, query/hash, normalização, ausência de loop e preservação dos bloqueios preexistentes de agência. Uma consulta de origem codificada dentro de um filtro permanece permitida quando o destino da navegação é interno.

A revisão final também rejeitou `?` e `#` codificados no pathname: esses valores poderiam ser classificados a partir de uma interpretação diferente do caminho retornado e acabar em 404. Não foi demonstrado bypass de origem ou de papel nesse caso adicional. Query e fragmento normais continuam permitidos. A busca por outras criações de usuário não encontrou endpoint público alternativo que contorne o guard corrigido.

Os 34 testes de navegador usam Chromium e APIs explicitamente isoladas pelo runner. Validam o proxy real, login/cadastro, CRECI/UF, erros, autofill, PIN, cadeia WebAuthn, recuperação indisponível e layout em 1440/375/390/430 px. Três testes inserem `next` malicioso com `history.replaceState` depois da renderização, sem uma nova requisição ao servidor, e comprovam a defesa independente no cliente.

O smoke separado usou o PostgreSQL existente em `127.0.0.1:55439`, banco `eme_auth_test_runtime_20260911`, e a conta sintética já preparada, sem dados ou serviços de produção:

- ADMIN, SUPERADMIN e OWNER receberam 400, código `PUBLIC_REGISTRATION_ROLE_INVALID`, sem cookie; nenhuma conta foi criada.
- Identificadores, emails, papéis e hashes de senha foram comparados em memória antes/depois e permaneceram iguais; os valores não foram exportados.
- Login e sessão reais retornaram 200, inclusive com autofill nativo e senha revelada; senha incorreta retornou 401 e sessão anônima retornou 401.
- O retorno legítimo `/corretor/imoveis?origem=security-review` foi preservado; um destino externo resultou em `/corretor`, sem requisições ao host externo.
- Cookie conferido: HttpOnly, Secure, SameSite=Lax, Path=/ e restrito ao host, sem novo Domain.
- Home no contexto Production local: `index, follow`, canonical `https://www.meueme.com/`; recuperação: `noindex, nofollow`, sem confirmação fictícia.

O cadastro legítimo com validação externa CRECI continua coberto pelo teste isolado da rota; este smoke não criou usuários nem chamou o provedor CRECI real. A configuração IMOBISEC de Production deve ser conferida no painel.

A primeira build com a configuração padrão passou, mas a geração estática repetiu tarefas por pressão de memória da estação. A build final manteve TypeScript e todos os checks ativos, limitando temporariamente a geração a dois workers; gerou as 111 páginas sem repetição. `next.config.mjs` foi restaurado byte a byte e a alteração automática de `next-env.d.ts` foi retirada. Nenhum ajuste de concorrência faz parte dos patches. O `.next` local usa contexto de QA e não deve ser publicado.

Evidências locais: `.qa-audit-tmp/auth-security-20260911/{browser-tests.log,smoke-real-results.json,validation-results.json,review-manifest.json}` e `.qa-audit-tmp/release-landing-auth-20260911/{build.log,smoke-real-results.json}`. Prévia da candidata compilada: `http://localhost:3106/login`; a prévia original `http://localhost:3105/login` também foi reaberta, sempre com a base isolada.

## Vercel — conferência ainda necessária no painel

Nesta sessão não há conector Vercel, CLI `vercel` no PATH, vínculo `.vercel/project.json` na raiz/candidata, variáveis de autenticação Vercel herdadas ou arquivo de autenticação nos locais convencionais. O inventário do navegador conectado está vazio. **Não foi possível conferir variáveis Production, equipe/ID do projeto, deployment ativo ou elegibilidade do alvo de reversão.** A configuração `.env.local` não comprova a configuração remota e não será transferida.

O responsável deve conferir os itens abaixo sem copiar ou enviar valores secretos. Registrar ID/URL de deployment, SHA, branch e o resultado das verificações é suficiente; não exportar segredos.

1. **Equipe correta → projeto `eme` → Overview → Production Deployment:** anotar ID/URL imutável, Git SHA/ref, data e estado Current/Ready. Confirmar que esse deployment atende `www.meueme.com`. Comparar o SHA com a base de revisão; `main` remoto não substitui essa prova.
2. **Settings → Git:** confirmar `mateus-forest/EME` e a branch usada por Production. Um push/merge pode disparar publicação automática, por isso não o realizar antes da aprovação final.
3. **Settings → Build and Deployment:** conferir Root Directory, framework Next e versão Node vigente. Os comandos do repositório são Install `npm install` e Build `npx prisma generate && npm run build`. Conferir overrides e também Ignored Build Step: nenhum pode executar migração, seed, reset, `db push`, importação ou restauração de banco. Os scripts manuais de banco do repositório não fazem parte do install/build e não serão usados.
4. **Settings → Environment Variables, filtro Production:** `DATABASE_URL` e `DIRECT_URL` devem continuar apontando para os serviços reais atuais; preservar o segredo vigente `AUTH_SECRET` ou `NEXTAUTH_SECRET` e `SESSION_MAX_AGE_DAYS`; `NEXT_PUBLIC_APP_URL` deve ser `https://www.meueme.com`; `COOKIE_SECURE_AUTO` deve estar ausente ou true. Não substituir pelas credenciais, flags ou portas locais. Conferir que `NODE_OPTIONS` não carrega fixture, mock ou preload de QA. Manter as integrações IMOBISEC/CRECI, Stripe, Storage, IA, Journey e demais serviços reais já usados por Production.
5. **Settings → Domains:** preservar `www.meueme.com` em Production e o redirecionamento do domínio sem `www`. Não trocar host, segredo de sessão ou RP ID/origem da biometria. O cookie `eme_auth` deve continuar HttpOnly, Secure em HTTPS, SameSite=Lax e Path=/, sem introduzir outro Domain.
6. **System Environment Variables:** confirmar que `VERCEL_ENV=production` chega ao build Production. A home candidata é indexável nesse contexto; Local/Preview permanecem noindex. Conferir também canonical `https://www.meueme.com/` e ausência de `X-Robots-Tag: noindex` no domínio público depois do lançamento aprovado. Não promover um build compilado com configuração local/Preview.
7. **Overview → Instant Rollback:** inspecionar elegibilidade e anotar o alvo seguro, sem confirmar a ação agora. Verificar permissão da conta e disponibilidade pelo plano.

Os nomes e caminhos do painel foram conferidos na [documentação de configurações da Vercel](https://vercel.com/docs/project-configuration/project-settings); variáveis têm escopo por ambiente. O contexto de build é descrito em [variáveis de sistema](https://vercel.com/docs/environment-variables/system-environment-variables).

## Publicação e reversão — somente depois da aprovação

A primeira publicação autorizada deve criar uma baseline da **interface anterior com ambas as correções de segurança**, sobre o commit de produção confirmado. Registrar o ID/URL imutável, SHA, domínio e contexto Production dessa versão. Só então publicar a integração visual segura sobre a mesma base. Isso permite desfazer a mudança visual preservando os fixes; não voltar ao deployment anterior vulnerável.

Usar checkout limpo com somente os deltas aprovados. Preservar todas as variáveis reais do projeto `eme`, sobretudo banco e segredo de autenticação. Não transferir configurações locais, `.next` local, backups, banco ou contas de teste. **Não executar qualquer migração, seed, reset, importação de contas ou restauração de banco.** `prisma generate` gera o client, não aplica schema.

Antes da publicação visual, o alvo de reversão precisa existir de fato e estar registrado. Instant Rollback usa o artefato e a configuração do deployment anterior, sem recompilar; são elegíveis deployments previamente associados ao domínio de produção. Hobby limita a reversão ao anterior imediato. Após rollback, a atribuição automática de domínios fica suspensa até desfazer a reversão ou promover outra versão. [Procedimento oficial da Vercel](https://vercel.com/docs/instant-rollback)

Se houver regressão de login, sessão, portal ou apresentação, reverter o domínio para a baseline segura registrada. Conferir login/sessão, portal e logs. Não restaurar banco, remover contas criadas legitimamente ou mudar AUTH_SECRET. Se a opção Instant Rollback não estiver disponível para o alvo seguro, preparar e aprovar previamente um redeploy da interface anterior com os fixes no mesmo ambiente Production. **Até essa baseline existir e o painel ser conferido, não há alvo seguro de rollback comprovado.**

## Limitações e aceite final

- Recuperação de senha permanece explicitamente indisponível em `/recuperar-senha`, com campo e envio desabilitados e retorno ao login. Não há confirmação fictícia de email. A integração visual não implementa backend de recuperação.
- A configuração/deployment real da Vercel e a base segura de reversão continuam pendentes de conferência no painel.
- Validações locais e manifesto concluídos; falta a conferência remota acima e a aprovação de publicação.
- As correções não investigam exploração histórica nem fazem conciliação ou alteração de contas existentes.

**Aprovação pendente:** revisar os deltas, validar as pendências identificadas e aprovar expressamente a publicação. Este documento não autoriza deploy, push ou alteração de banco.
