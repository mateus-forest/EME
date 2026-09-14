# Revisão de publicação — landing e acesso EME

> **Atualização de segurança, 11/09/2026:** os dois primeiros impedimentos deste relatório receberam correções locais separadas, descritas no [adendo de segurança e publicação](auth-seguranca-publicacao-20260911.md). O adendo registra a validação atual e as pendências restantes. O conteúdo abaixo permanece como histórico da revisão visual anterior; seus hashes e o diagnóstico original não substituem os artefatos finais com os fixes. Nada foi publicado.

Data: 11/09/2026. Destino informado pelo responsável: **https://www.meueme.com/**, projeto Vercel **eme**.

**Estado: candidata local preparada para revisão; publicação bloqueada pelos itens abaixo. Nada foi enviado à hospedagem. Nenhuma migração, substituição de banco ou transferência de contas foi executada.**

## Candidata e delimitação

- Branch de trabalho original preservada: `feat/landing-integracao-20260911`, HEAD `51207544b00a2ab75fe176eb55b1fd3dccab5f12`, incluindo suas alterações não commitadas.
- Branch separada da candidata: `release/landing-auth-20260911`.
- Pasta da candidata: `.qa-audit-tmp/release-landing-auth-20260911/project`.
- Base: `8c717794d7be1b5a910523fd6f343bf3836fafe1`, referência `main` confirmada por `git ls-remote` em 11/09/2026. **Isso não prova que esse seja o commit atualmente implantado na Vercel.** Antes de publicar, identificar o SHA do deployment ativo; se diferente, aplicar somente o delta revisado sobre aquela base e repetir a validação. Não substituir o portal por uma versão de origem não confirmada.
- O commit local adicional `5120754` modifica o player do Marketplace; ele **não pertence à candidata**. Não fazer merge da branch original inteira.
- Backup anterior à landing: `C:\Users\mateu\Downloads\EME 2.0\EME-Backup-Antes-Landing-20260911-110010\project`.
- Backup anterior ao acesso, já com a landing: `C:\Users\mateu\Downloads\EME 2.0\EME-Backup-Antes-Auth-20260911-113119\project`.

Os backups continuam locais e contêm configurações privadas; não são pacotes de publicação nem fontes para restaurar banco em produção.

Artefatos de revisão (delta de arquivos, não um build pronto para hospedar):

- `.qa-audit-tmp/release-landing-auth-20260911/landing-acesso.patch` — patch completo com binários.
- `.qa-audit-tmp/release-landing-auth-20260911/landing-acesso-arquivos.zip` — somente os 25 arquivos selecionados.
- `.qa-audit-tmp/release-landing-auth-20260911/release-manifest.json` — SHA256 por arquivo, base e limites de escopo.
- SHA256 do ZIP: `50d8584d0342e60e1f5727ce049b4a73f9122e1adf1ecec8eb28d4352080efd3`.
- SHA256 do patch: `cafd253a7f3cf2aec0f098320148a0a4c7e380b133749966cefd210c4561cce4`.

Os arquivos estão preparados no índice da branch isolada, sem commit/push. O manifesto confirma que a integração original permaneceu byte a byte igual ao início desta preparação. A varredura comparou os valores privados locais e as credenciais da conta de QA em memória e não os encontrou nos arquivos selecionados; nenhum valor foi exportado para o relatório/pacote.

### Arquivos que compõem o delta

25 arquivos: 23 de produto/assets e 2 testes. O manifesto e o patch da pasta de revisão listam cada arquivo e seu hash.

| Grupo | Arquivos | Finalidade |
|---|---|---|
| Landing | `components/eme/integrated-landing/{integrated-landing.tsx,landing-markup.ts,landing-interactions.js,landing.css}` | Integração visual, animações isoladas, textos e acessibilidade |
| Metadados | `app/(auth)/page.tsx` | Título, indexação em Production e canonical |
| Rotas visuais | `components/eme/eme-auth-experience.tsx` | Conectar as rotas existentes às telas integradas |
| Acesso | `components/eme/integrated-auth/{auth-screen.tsx,auth.css}` | Login/cadastro reais, duas etapas e aviso CRECI/UF |
| Controlador | `components/eme/{use-auth-form.ts,auth-panel.tsx}`, `components/use-premium-login.ts` | Reutilizar o fluxo real e preservar a correção de autofill |
| Telemetria existente | `lib/journey/browser.ts` | Reconhecer senha revelada como credencial; sem novos eventos/analytics |
| Recuperação | `app/(auth)/recuperar-senha/page.tsx` | Página visual explícita de indisponibilidade |
| Assets | `public/landing-2026/assets/*`, `public/landing-2026/vendor/*`, `public/auth-2026/assets/*` | Imagens e GSAP/ScrollTrigger locais, com aviso de licença |
| QA | `tests/e2e/integrated-{landing,auth}.spec.ts` | Testes isolados, sem participação no runtime |

Ficam fora: alterações prévias de `app/globals.css`, `expanded-module-panel.tsx`, tempos de transição do modal antigo, Studio, scripts/relatórios de limpeza de contas, testes antigos modificados, player do Marketplace, scripts do banco de teste, referências ZIP/HTML e todos os `.env` privados. O `auth.js` demonstrativo do pacote não foi incorporado.

As APIs de autenticação, cookies/JWT, permissões, regras do cadastro, portal/admin, billing, schema/migrations, dependências, `vercel.json`, `next.config.mjs` e `proxy.ts` estão iguais à base. Os 14 arquivos de `app/api/auth` também foram comparados por SHA256 com o backup anterior à landing, sem diferenças.

## Textos finais

- Hero: **Uma estrutura. À sua altura.**
- Carteira: **MAIS VENDAS.**
- Vender: **MAIS ALCANCE.**
- Documentos: **MAIS VELOCIDADE.**
- Operação: **MAIS CONTROLE.**
- COS: **MAIS OPORTUNIDADES.**

Markup, fontes das animações, labels dos slides e anúncios acessíveis usam os mesmos textos. O ajuste tipográfico do COS preserva a geometria dos cards. Não foi acrescentado “Não aceite menos que isso”.

## Configuração real e preservação de contas

**Verificado no código e no pacote:** não há dependência do launcher/fixture de teste, URLs localhost ou contas de teste no caminho de runtime integrado. O login usa o endpoint existente e bcrypt; o cadastro envia os campos reais obrigatórios, incluindo CRECI e UF. PIN e biometria mantêm os adaptadores existentes. Os mocks dos testes são interceptadores do runner Playwright e não são importados pela aplicação.

**Ainda não verificado no painel:** variáveis do ambiente Production, equipe/ID do projeto, branch vinculada, comandos efetivos de build/install, SHA/ID do deployment ativo e alvo de rollback. Não há vínculo `.vercel/project.json`, CLI autenticada ou navegador conectado disponível nesta sessão. A `.env.local` do projeto não comprova a configuração remota e não foi copiada para a candidata.

No projeto **eme**, conferir sem exportar valores secretos:

| Configuração | Verificação exigida antes da publicação |
|---|---|
| Repositório/raiz | Projeto existente `eme`, repositório `mateus-forest/EME`, raiz correta; confirmar a branch e o SHA realmente implantados |
| `DATABASE_URL` | Mesma conexão real já usada pela produção; não substituir pelo PostgreSQL de validação nem por exemplo de configuração |
| `DIRECT_URL` | Preservar o valor existente; nenhuma ferramenta de alteração de schema será executada |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Preservar exatamente o segredo que já assina as sessões; não copiar o segredo local nem rotacioná-lo nesta publicação |
| `NEXT_PUBLIC_APP_URL` | `https://www.meueme.com/` no ambiente Production; nunca localhost, Preview ou domínio de teste |
| `COOKIE_SECURE_AUTO` | Ausente (padrão true) ou true; não importar o false do launcher local |
| Cookies/origem | `eme_auth`, HttpOnly, SameSite=Lax, Path=/, restrito ao host; preservar `www.meueme.com` e origem/RP ID da biometria |
| `SESSION_MAX_AGE_DAYS` | Preservar a duração real existente |
| `IMOBISEC_API_KEY` | Preservar o serviço real de verificação CRECI; ausência produz PENDING/CONFIGURATION_ERROR, não verificação fictícia |
| Stripe/Storage/IA/demais integrações | Manter os valores, vínculos e flags já existentes em Production; não importar flags false/chaves vazias do ambiente de QA |
| `NODE_OPTIONS` | Não carregar fixture, mock ou preload local de Prisma |
| Ambiente Vercel | System Environment Variables habilitadas; `VERCEL_ENV=production` fornecido pela plataforma ao build de Production |
| Build/install | Confirmar que os overrides do painel correspondem ao repositório e não incluem seed/reset/migrate/db push |

`vercel.json` continua com `npm install` e `npx prisma generate && npm run build`. `prisma generate` gera o client; não aplica schema. Nenhum script de install/build do `package.json` chama migração, seed ou reset.

**Não transferir** `.env*` privados, `.qa-audit-tmp`, diretórios PostgreSQL, `ACESSO-TESTE.txt`, `config.json` de QA, dumps, contas sintéticas, `scripts/auth-test-env.cjs`, `.next` compilado localmente, `node_modules`, perfis/cookies de navegador, backups ou arquivos `.account-cleanup`. A candidata só contém a `.env.example` original, que não é carregada como configuração e não deve ser copiada para `.env` na hospedagem.

## Indexação

Na candidata, somente `VERCEL_ENV=production` gera `index, follow` na home. Local/Preview permanecem `noindex, nofollow`; a recuperação indisponível permanece `noindex, nofollow` também em produção. O canonical da home usa a raiz HTTPS de `NEXT_PUBLIC_APP_URL`, que deve ser o domínio confirmado.

A consulta pública em 11/09/2026 retornou: `www.meueme.com/` HTTP200 com HTTPS/HSTS e sem `X-Robots-Tag: noindex`; `meueme.com/` HTTP307 para `www.meueme.com/`; `/robots.txt` HTTP404. A home ainda não contém a nova integração. A ausência de robots.txt não equivale a bloqueio geral de indexação; não foi criado bloqueio global ou sitemap nesta mudança.

Consultas HEAD sem credenciais também retornaram 200 em `/login` e `/cadastro`, e 401 em `/api/auth/me`. `/corretor` entrega a estrutura HTML com 200; isso não equivale a uma sessão autenticada ou autorização de acesso aos dados. Não foram enviados dados de login nem realizadas consultas a contas em produção.

Após o build de Production, conferir HTML e cabeçalhos da home (inclusive Googlebot): título, `index, follow`, canonical `https://www.meueme.com/`, ausência de `noindex` em cabeçalho/CDN e ausência de configuração externa que impeça o crawl. Indexável não significa indexação imediata pelos buscadores.

O ambiente é determinado por [VERCEL_ENV](https://vercel.com/docs/environment-variables/system-environment-variables); a Vercel também usa `X-Robots-Tag: noindex` em [Preview Deployments](https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines). Não reutilizar/promover o `.next` da validação local ou um artefato compilado com variáveis de Preview. Recompilar o código aprovado no contexto Production, com os serviços reais já existentes.

## Impedimentos concretos

1. **Cadastro público aceita papel ADMIN na base existente.** `app/api/auth/register/route.ts` recebe o papel do body, aceita ADMIN, persiste esse papel e emite sessão. Não há guarda nesse endpoint; `withJourneyRoute` só acrescenta telemetria e o proxy não o protege. O formulário visual envia BROKER, mas isso não protege a API pública. Confirmado por leitura e comparação com o backup; nenhuma requisição exploratória ou conta foi criada. Requer correção de segurança separada antes de liberar publicação. Não foi misturada ao pacote visual.
2. **`next` permite redirecionamento externo.** O controlador mantém a condição `next.startsWith('/')` herdada do modal. Tanto `//host.example/path` quanto uma barra seguida de contrabarra podem resolver para outra origem. Confirmado offline com a API URL. Requer correção separada e testes de retorno interno, mantendo os destinos legítimos. Não alterado silenciosamente nesta revisão.
3. **Configuração/deployment real sem confirmação no painel.** Nome e domínio informados, HTTPS público e main remoto verificados; isso não comprova DB/secret/comandos/SHA do deployment. Não liberar publicação com essa lacuna.
4. **Recuperação de senha sem backend.** `/recuperar-senha` exibirá “A recuperação de senha ainda não está disponível. Você pode voltar ao login e usar os métodos de acesso já configurados na sua conta.” com campo e envio desabilitados, sem confirmação de email e com retorno ao login. É limitação conhecida, já autorizada para a integração visual. Deve constar do aceite do lançamento; esta entrega não implementa reset por email.

O teste anterior de instalação de um banco vazio também encontrou erro histórico de ordem de migrações (tabela BrokerDocument ausente). Isso não foi corrigido e **não autoriza executar migrações nesta publicação**; o delta visual não muda schema. Não usar banco/contas de QA para contornar problemas da produção.

Critérios para as correções de segurança separadas: cadastro público deve rejeitar criação administrativa sem alterar papéis/contas existentes; o retorno do login deve aceitar apenas destinos da mesma origem, preservar rotas/query/hash legítimos e usar o destino padrão do papel ao rejeitar uma URL externa. Cobrir rejeição sem gravação de conta e as variantes de URL externa em testes isolados. A auditoria não verificou exploração desses problemas nem consultou dados reais de usuários.

## Procedimento de publicação — executar somente depois da aprovação

1. Resolver e validar os dois problemas de segurança em alterações separadas, conferir painel e confirmar o SHA ativo. Após autorização própria dessas correções, preparar uma versão segura da UI anterior que já as contenha. Registrar URL/ID imutável desse deployment, SHA, domínio e contexto Production como baseline e alvo de reversão, sem copiar segredos.
2. Revisar/aprovar o delta visual, limitações e correções de segurança separadas. Confirmar por diff que o portal, schema e integrações fora do escopo permanecem na versão atualmente aprovada. Se a base ativa não for `8c717794…`, transplantar somente os arquivos/hunks aprovados sobre a base ativa e repetir testes.
3. Usar checkout limpo do código aprovado. Não publicar a pasta de trabalho original, backups, pasta de QA ou o ZIP de referências. Não fazer push/merge automático antes da aprovação: o Git integrado pode disparar publicação.
4. Preservar todos os serviços e variáveis do projeto `eme`. Recompilar no ambiente Production usando o comando verificado `npx prisma generate && npm run build`. **Não executar `prisma migrate`, `prisma db push`, seed, reset, importação/restauração de dump ou sincronização de contas.**
5. Publicar apenas no projeto e domínio existentes, sem recriar banco, projeto Supabase, Stripe Customer ou contas. Não trocar o domínio canônico nem AUTH_SECRET.
6. Verificar home/CTAs/login/cadastro/recuperação, CSS isolado e acesso ao portal. Acompanhar 4xx/5xx, autenticação e cookies. A validação autenticada usa uma conta real autorizada já existente, preferencialmente pelo próprio responsável; não importar a conta local nem criar contas demonstrativas em produção. Cadastro completo já deve ter sido validado no ambiente isolado; qualquer criação em produção requer autorização específica.
7. Conferir indexação e cabeçalhos no domínio real. Registrar horário, deployment/commit e resultado dos checks. Se houver erro novo de login, perda de sessão, problema no portal ou regressão visual relevante, executar reversão.

## Reversão

Antes da publicação, preencher o **ID/URL do deployment anterior real e seguro**: landing anterior com as correções de segurança já aplicadas. O backup local e o commit `main` não substituem esse identificador. O delta visual deve ser reaplicado e validado sobre essa base segura antes do lançamento.

No projeto `eme`, usar **Instant Rollback** para o deployment anterior registrado, preservando domínio e banco. A reversão da Vercel volta ao artefato anterior sem recompilar; isso preserva seu contexto de build, motivo para manter as variáveis e o segredo de autenticação nesta mudança. Ver [procedimento oficial](https://vercel.com/docs/instant-rollback).

Depois da reversão: verificar home antiga, login/sessão em `www.meueme.com`, portal e logs, mantendo os fixes de segurança. Não retornar ao artefato vulnerável atualmente auditado. Não restaurar banco, não apagar usuários criados legitimamente durante a janela e não executar downgrade de schema. Registrar o rollback e impedir republicação automática do código revertido até diagnóstico. Se o plano/projeto não disponibilizar Instant Rollback, preparar previamente um redeploy da UI anterior com os fixes no mesmo contexto Production; não descobrir esse impedimento durante o incidente.

## Validação desta candidata

Concluído no código exato da candidata, sem alterar dependências/schema/regras:

| Verificação | Resultado |
|---|---|
| ESLint dos arquivos alterados e dos dois testes | Passou |
| `next build` / Turbopack em modo Production | Passou; 111 páginas estáticas geradas |
| TypeScript executado pelo build Next | Passou; não foi alterado tsconfig nem desabilitada checagem |
| Playwright/Chromium, landing e acesso | 39 cenários passaram; 2 tiveram timeout inicial e passaram ao repetir somente os falhos, com o mesmo código e timeout |
| Teste legado de CSS do Marketplace | 1 cenário da suíte ficou marcado como skip por exigir fixture; o equivalente foi executado separadamente com PostgreSQL local real e passou |
| Indexação/canonical | 5 combinações de ambiente/configuração verificadas; HTML compilado também conferido |
| Login real por HTTP/API local | Login200, sessão200, senha incorreta401, ausência de sessão401; sem mocks |
| Cookie no runtime em modo Production | HttpOnly, Secure, SameSite=Lax, Path=/ e sem Domain confirmados no Set-Cookie real |
| Login real no Chromium | Autofill nativo sem eventos React, estado anterior preenchido e senha revelada: requisição correta, login200, sessão200, retorno `/corretor`; sem mocks |
| Landing responsiva | COS completo e sem overflow em 320/375/390/393/430/1440 px |
| Cadastro | Aviso CRECI/UF confirmado desde a primeira etapa; duas etapas/validação preservadas em desktop e mobile |
| Preservação | 25 arquivos no índice; nenhum diff fora da lista na candidata; integração original preservada; sem valores privados no patch/ZIP |

O primeiro build não completou porque a junction de `node_modules` apontava para fora da raiz aceita pelo Turbopack. A junction foi substituída por uma cópia local das mesmas dependências, sem mudar `next.config.mjs`; o build completo seguinte passou. Os espaços de licença dos arquivos vendor originais foram preservados; o check de whitespace do restante do delta passou.

O ambiente de validação foi exclusivamente o PostgreSQL local já existente na porta 55439, com conta sintética já cadastrada. Nenhuma conta foi criada, importada ou transferida nesta preparação. As variáveis usadas no processo de QA e os artefatos compilados não fazem parte do patch/ZIP. Não houve validação de provedor externo de CRECI, de biometria física no domínio público ou de sessão autenticada em produção; esses pontos dependem dos serviços e da conferência do painel.

Prévias locais:

- **Candidata compilada para revisão:** `http://localhost:3106/`, `/login`, `/cadastro`, `/recuperar-senha`. Build com metadados de Production para validação; domínio continua estritamente local e o banco é de teste.
- **Prévia original reaberta e preservada:** `http://localhost:3105/`, ainda com política de Preview/noindex e o mesmo ambiente isolado anterior.

Evidências ficam em `.qa-audit-tmp/release-landing-auth-20260911/`: `build.log`, `lint.log`, `e2e.log`, `e2e_failed.log`, `metadata-results.json`, `smoke-real-results.json`, `visual-smoke-results.json` e capturas `landing-*.png`, `login-*.png`, `cadastro-*.png`, `cadastro-creci-*.png`. As capturas finais de cadastro aguardam o fim da animação de entrada para mostrar a apresentação estável.

**Decisão pendente:** revisão/aprovação do pacote visual e tratamento dos impedimentos listados. Não publicar, fazer push ou migrar banco a partir desta revisão.
