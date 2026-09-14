# Autenticação: diagnóstico e validação real local

## Causa confirmada do erro interno

O processo antigo da prévia na porta 3105 foi iniciado com `NODE_OPTIONS=--require=./.qa-audit-tmp/landing-prisma-fixture.cjs` e banco inativo. Esse arquivo substitui `globalThis.prisma` por um objeto de leitura visual contendo somente `property`, `broker` e `searchEvent`.

O login real executa `prisma.user.findUnique`. Como `user` não existe nesse substituto, os logs registraram:

```text
[auth][login] unexpected error {
  message: "Cannot read properties of undefined (reading 'findUnique')"
}
POST /api/auth/login 500
```

Portanto, a falha acontecia antes de consultar o banco ou validar a senha. A mensagem genérica vinha do tratamento de erro existente da API. Não foi causada pelo novo layout e não foi corrigida com sucesso simulado nem alterações na autenticação. O processo antigo foi encerrado; o novo usa o Prisma real, sem preload/fixture.

## Ambiente real de teste preparado

- PostgreSQL 17.9 instalado no computador, em **cluster novo e independente**, escutando apenas `127.0.0.1:55439`.
- Diretório: `.qa-audit-tmp/auth-real-20260911/postgres-data`.
- Banco da aplicação: `eme_auth_test_runtime_20260911`.
- Usuário da aplicação: `eme_auth_app`, sem superusuário, criação de bancos ou criação de papéis.
- URL canônica da prévia: **http://localhost:3105**.
- `DATABASE_URL`, `DIRECT_URL` e `AUTH_SECRET` próprios, gerados localmente. Credenciais ficam em `.qa-audit-tmp/auth-real-20260911/config.json`, ignorado pelo Git.
- `.env.local` permanece intacto. O launcher esvazia as variáveis dos arquivos `.env*` no processo filho antes de definir as configurações de teste, impedindo que o Next carregue as credenciais remotas como fallback. Também remove `NODE_OPTIONS` e credenciais herdadas de serviços externos.
- Stripe, armazenamento externo, IA, WhatsApp e e-mail estão desabilitados somente nesse processo. Journey está habilitado no PostgreSQL local. Nenhuma chave externa foi usada.
- Nenhum dado foi importado de produção. As contas, catálogos e assinaturas locais foram criados pelo endpoint verdadeiro de cadastro, com dados sintéticos.

O Next ainda informa que encontrou `.env.local` ao iniciar; seus valores sensíveis estão sobrepostos pelo ambiente isolado do processo. Os testes completos não registraram nenhuma requisição externa.

Use **localhost**, em vez de alternar com `127.0.0.1`, na URL do navegador. O Next utiliza `http://localhost:3105` como origem interna neste ambiente; o coletor Journey rejeitava a origem IP com 403. Padronizar a URL resolveu isso sem alterar o coletor nem relaxar a validação de origem. A conexão PostgreSQL continua usando 127.0.0.1.

## Lacuna encontrada nas migrações

Uma tentativa de instalar as 50 migrações existentes em outro banco vazio, `eme_auth_test_20260911`, falhou na migração `20260811233000_contract_template_engine`:

```text
P3018 / PostgreSQL 42P01
ERROR: relation "BrokerDocument" does not exist
```

A migração adiciona uma chave estrangeira para uma tabela que ainda não existe nessa sequência de instalação. Esse banco foi preservado para diagnóstico. Não houve reset, exclusão nem reparação manual das migrações existentes.

Para validar a aplicação sem ampliar o escopo, foi criado o segundo banco vazio, `eme_auth_test_runtime_20260911`, e materializado o `schema.prisma` atual com `prisma db push`, **sem** `--force-reset` ou `--accept-data-loss`. O schema e as migrações do repositório não foram alterados. Esse banco de teste não representa uma validação bem-sucedida da cadeia histórica de migrações; a instalação do zero precisa de correção própria antes de ser usada como procedimento de homologação/deploy.

## Cadastro: aviso e passagem entre etapas

O texto da primeira etapa agora informa:

> Ao clicar em Continuar, você deverá informar seu CRECI e a UF do registro.

O aviso aparece na descrição inicial, antes dos campos. Foi mantida a composição visual, a validação real, a exigência de CRECI/UF e o formulário em duas etapas. Desktop de 1440 px e mobile de 390 px foram conferidos: aviso legível, campos profissionais visíveis após Continuar, foco no título da segunda etapa e nenhum overflow horizontal.

## Testes reais executados

O smoke usou Chromium desktop e WebKit mobile, sem interceptação de APIs ou respostas fabricadas:

| Verificação | Resultado |
| --- | --- |
| Conta inexistente | HTTP 401, credenciais inválidas |
| Cadastro pela interface | HTTP 200 nos dois navegadores |
| Persistência consultada diretamente no PostgreSQL | User, Broker, Catalog e Subscription criados |
| Senha armazenada | Hash bcrypt validado, sem senha em texto puro na tabela |
| CRECI/UF | Persistidos; verificação externa PENDING |
| Senha incorreta | HTTP 401 com mensagem visível |
| Login correto pela interface | HTTP 200 e redirecionamento para `/corretor` |
| Sessão | Cookie HttpOnly e `/api/auth/me` HTTP 200 |
| Logout | Endpoint HTTP 200; consulta de sessão posterior HTTP 401 |
| Falhas HTTP 5xx durante o smoke completo | Nenhuma |
| Requisições externas durante o smoke completo | Nenhuma |

O primeiro ensaio criou uma conta e parou por um seletor de teste ambíguo entre o alerta do formulário e o anunciador de rotas do Next. O seletor foi corrigido somente no helper de teste; nenhum dado foi apagado. A rodada completa criou mais duas contas sintéticas e passou nos dois navegadores. Total após a rodada: três usuários locais de teste.

Uma verificação adicional, após padronizar a origem localhost, reutilizou uma dessas contas: login e sessão HTTP 200, coleta browser HTTP 202 e eventos de navegação/sucesso persistidos no banco local. Nenhuma simulação de validação CRECI, e-mail, PIN ou biometria foi adicionada.

ESLint dos dois arquivos de implementação alterados passou. `tsc --noEmit` encontrou oito erros TS5097 preexistentes em imports com extensão `.ts` de seis arquivos de testes fora desta alteração (`catalog-theme`, `eme-modules-finance`, `landing-modal-adjustments`, `operation-health-finance`, `operation-import-finance` e `rental-finance-cos-launch`). A verificação `tsc --noEmit --allowImportingTsExtensions --incremental false` passou; a opção foi aplicada somente ao comando, sem modificar o tsconfig. Nenhuma configuração ou teste preexistente foi alterado para ocultar esses erros. O smoke móvel usa WebKit no Windows, não um aparelho iPhone físico.

## Configurações/implementações ainda pendentes

1. **Consulta externa de CRECI:** falta uma credencial identificada como teste/homologação e a confirmação do ambiente de teste suportado pelo provedor IMOBISEC. A credencial remota existente não foi reutilizada. O comportamento real já implementado registra `PENDING` quando falta configuração; não houve falsa validação ou alteração dessa regra.
2. **Recuperação de senha:** continua sem backend de recuperação. Faltam o fluxo real de tokens/redefinição e configuração de envio de e-mail de teste. A tela permanece explícita sobre a indisponibilidade, sem envio nem confirmação fictícia.
3. **Migrações do zero:** resolver a dependência ausente de `BrokerDocument` antes de usar a sequência de migrações como instalação de homologação. Isso não impede o login neste banco de teste sincronizado com o schema atual.

Login por senha, cadastro com status CRECI pendente e sessão não têm configuração local faltante: foram exercitados de ponta a ponta.

## Acesso e operação local

- Login: <http://localhost:3105/login>
- Cadastro: <http://localhost:3105/cadastro>
- Acesso de uma conta sintética: `.qa-audit-tmp/auth-real-20260911/ACESSO-TESTE.txt` (somente local, ignorado pelo Git).
- Iniciar a prévia com o cluster ativo: `node scripts/auth-test-env.cjs start`.
- O launcher recusa bancos fora do host, porta e nome exatos do ambiente de teste. Não iniciar esta validação com `npm run dev`, pois esse comando não aplica o isolamento das credenciais.

Se o PostgreSQL de teste estiver parado, iniciar exclusivamente esse cluster no PowerShell:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D '.qa-audit-tmp/auth-real-20260911/postgres-data' -l '.qa-audit-tmp/auth-real-20260911/postgres.log' -w start
node scripts/auth-test-env.cjs start
```

O cluster local e a prévia ficaram ativos para revisão. O serviço PostgreSQL previamente instalado e seus bancos não foram alterados.

Evidências locais: `smoke-results.json`, `canonical-origin-results.json`, `cadastro-1440.png`, `cadastro-390.png` e as capturas `cadastro-creci-*`, todos em `.qa-audit-tmp/auth-real-20260911/`. Helpers de diagnóstico também ficam em `.qa-audit-tmp/`.

## Arquivos do projeto nesta correção

- `components/eme/integrated-auth/auth-screen.tsx`: somente o aviso de CRECI/UF na primeira etapa.
- `scripts/auth-test-env.cjs`: launcher do ambiente real e isolado de teste.
- `docs/auth-integracao-20260911.md`: referência para a atualização deste diagnóstico.
- Este relatório.

APIs de autenticação, schema, migrações, landing, portal, CSS e `.env.local` preservados. Sem commit, push, publicação ou acesso a dados de produção.

## Correção posterior: credenciais visíveis diferentes das enviadas

Após a confirmação de falha também com a conta sintética em `http://localhost:3105/login`, foi reproduzido um segundo problema, independente do antigo Prisma visual:

1. Digitar credenciais iniciais e depois preencher os controles nativos com a conta correta sem disparar eventos React (comportamento possível de gerenciadores de senhas/autofill).
2. Os campos exibiam e-mail e senha corretos, mas o estado React ainda continha o e-mail anterior.
3. Uma renderização ao mudar o foco podia repor esse valor antigo antes do submit. A API recebia o e-mail anterior e retornava 401, apesar do preenchimento correto observado antes do clique.

A primeira tentativa de apenas ler os campos no submit não foi suficiente: o valor podia ser substituído antes do evento submit. A correção completa deixa o valor dos dois campos de login sob controle nativo do navegador, preservando o autofill entre renderizações, e captura os campos atuais na submissão. O controlador recebe explicitamente essas credenciais e sincroniza seu estado. A normalização existente do e-mail continua no adaptador; a senha é enviada exatamente como preenchida, inclusive espaços, sem qualquer alteração da verificação bcrypt ou das regras de acesso.

Reprodução com a mesma conta e a API real: antes, e-mail visível correto / e-mail enviado diferente / HTTP 401; depois, e-mail e senha enviados idênticos aos campos / HTTP 200. O diagnóstico armazena somente booleanos e status, nunca senhas.

Arquivos dessa correção:

- `components/eme/integrated-auth/auth-screen.tsx`: inputs de login com `defaultValue`, mantendo marcação e aparência.
- `components/eme/use-auth-form.ts`: captura dos campos do formulário no submit por senha.
- `components/use-premium-login.ts`: credenciais explícitas opcionais, preservando os chamadores existentes, PIN e biometria.
- `tests/e2e/integrated-auth.spec.ts`: regressões de autofill com estado anterior vazio/preenchido, senha revelada, Enter e preservação de espaços na senha.

O teste de reprodução não inspeciona nem identifica a extensão/navegador usado na aba pessoal do usuário: ele confirma e corrige um defeito reproduzível no tratamento dos controles. A conta habitual do EME continua fora do banco de teste; para essa prévia, devem ser usados o e-mail e a senha da mesma conta sintética do arquivo de acesso.

Validação dessa correção:

- **4 cenários reais aprovados**, sem mocks: Chromium e WebKit, cada um com campos inicialmente vazios e com valores anteriores. Em todos, autofill e sessão HTTP 200, valores enviados iguais aos preenchidos e senha incorreta HTTP 401. Contas existentes reutilizadas, sem mudar senhas ou criar usuários.
- **23 cenários de regressão aprovados no Chromium**, em rodadas: 21 na rodada completa e os dois restantes na repetição isolada, sem mudança nos limites originais. A execução concorrente inicial teve timeouts e compaction do cache de desenvolvimento; os dois casos de cadastro passaram na repetição. As regressões novas cobrem inclusive senha revelada, Enter e espaços na senha.
- ESLint dos quatro arquivos de implementação/testes envolvidos: aprovado.
- TypeScript dos arquivos alterados e suas dependências: aprovado com `.qa-audit-tmp/tsconfig-auth-autofill.json`, que estende o tsconfig existente sem modificá-lo. A checagem geral desta rodada foi interrompida para reduzir disputa de recursos com os navegadores; não é apresentada como concluída.
- Evidência real sem credenciais: `.qa-audit-tmp/auth-real-20260911/autofill-real-results.json`.

Nenhuma alteração em CSS, layout, API de autenticação, senhas, banco de produção ou permissões. Sem publicação, commit ou push.
