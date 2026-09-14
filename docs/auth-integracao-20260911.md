# Integração visual de login, cadastro e recuperação — prévia local

Atualização posterior: o processo visual isolado descrito neste relatório foi substituído por PostgreSQL local real de teste. Consulte [diagnóstico, validação real e acesso atual](./auth-validacao-real-20260911.md). A URL canônica agora é `http://localhost:3105`.

## Referência e estado preservado

- Pacote: `C:\Users\mateu\Downloads\EME-Login-Cadastro-Para-Integrar.zip`.
- Extração separada: `C:\Users\mateu\Downloads\EME 2.0\Auth-Referencia-20260911-114000\EME-Login-Cadastro-Para-Integrar`.
- `LEIA-ME-PRIMEIRO.txt`, `login.html`, `cadastro.html`, `recuperar-senha.html`, `auth.css`, `auth.js` e imagens foram lidos. O JavaScript demonstrativo não foi incorporado ao produto.
- Backup anterior à integração, incluindo a landing integrada, `.git`, `.env.local`, arquivos ignorados e alterações não commitadas: `C:\Users\mateu\Downloads\EME 2.0\EME-Backup-Antes-Auth-20260911-113119\project`.
- O backup teve 1.300 arquivos de fonte/configuração/estado Git verificados por SHA-256, sem divergências. Logs, manifesto e patches estão na pasta que contém `project`.
- Branch existente mantida: `feat/landing-integracao-20260911`, HEAD `51207544b00a2ab75fe176eb55b1fd3dccab5f12`.
- Sem commit, push, publicação ou alteração de dados nesta etapa.

## Integração

As rotas `/login`, `/cadastro` e `/cadastro/corretor` usam a composição visual do pacote com formulários React conectados ao comportamento real já existente. `/` continua renderizando a landing integrada. Foi adicionada a página visual `/recuperar-senha`.

O CSS fica inteiramente sob `.eme-integrated-auth`, com animações próprias e reset local que preserva os desenhos SVG. As três imagens são cópias idênticas às referências. O enquadramento do logo foi corrigido por CSS, sem modificar o arquivo original. Desktop mantém a composição em duas colunas; mobile prioriza o formulário conforme o pacote. Não foi adicionada biblioteca.

O cadastro mantém nome, e-mail, senha, confirmação de senha, CRECI e UF. A primeira etapa reúne os dados da conta; a segunda, CRECI/UF. Os campos permanecem montados para preservar valores ao voltar e manter os marcos de Journey já existentes. Somente a etapa ativa participa da validação nativa. Não foi importada a regra demonstrativa de senha mínima do pacote nem criado campo profissional sem correspondência no backend.

## Funcionamento real preservado

- O controlador existente foi extraído de `AuthPanel` para `useAuthForm`, compartilhado com as novas telas; o modal antigo conserva seu JSX e comportamento visual.
- Login por senha continua em `usePremiumLogin` e `/api/auth/login`; PIN e WebAuthn usam os mesmos serviços, disponibilidade do dispositivo e endpoints existentes.
- Cadastro continua enviando `role: BROKER`, nome/CRECI sem espaços nas pontas, e-mail normalizado, UF e senha para `/api/auth/register`, com cookies incluídos.
- Validações obrigatórias, confirmação da senha, formato de CRECI e lista das 27 UFs foram preservados. Nenhuma regra de plano, acesso, banco ou permissão mudou.
- Login mantém o parâmetro `next` e os redirecionamentos existentes por papel; cadastro mantém o destino original após sucesso confirmado pela API. O redirecionamento já existente de `/cadastro/imobiliaria` foi mantido.
- Falhas de rede no cadastro agora recebem mensagem visível, sem rejeição não tratada. Erros retornados pela API continuam sendo apresentados; não há confirmação baseada em temporizador.
- Navegação por teclado, envio por Enter nas duas etapas, foco no título/erro, rolagem móvel, mostrar/ocultar senha e retorno à landing foram verificados.
- Suspense atende à renderização inicial de `useSearchParams`; o formulário aceita interação após a hidratação, evitando perda de valores digitados antes de os controles estarem prontos.
- Correção pontual no classificador existente de Journey: senhas reveladas continuam sendo identificadas como credenciais por `autocomplete`, evitando concluir uma etapa com senhas diferentes. Não foram criados eventos, payloads ou tracking novos, e senhas não são enviadas à telemetria.

## Pendência: recuperação de senha

Não existe fluxo real implementado de recuperação de senha. A nova página informa explicitamente essa indisponibilidade, mantém e-mail/ação desabilitados e oferece retorno ao login. Não faz POST, não envia e-mail e não exibe sucesso fictício. Os trechos demonstrativos de `auth.js` não são utilizados.

A implementação futura exige um fluxo real de solicitação e envio, tokens de redefinição com expiração/uso único, validação e atualização segura da senha. Essas funções não foram implementadas nesta integração visual.

## Arquivos desta etapa

Existentes alterados em relação ao backup anterior à autenticação:

- `components/eme/eme-auth-experience.tsx`: seleção das novas telas pelas rotas existentes.
- `components/eme/auth-panel.tsx`: uso do controlador compartilhado, preservando o modal.
- `lib/journey/browser.ts`: identificação de credenciais ao revelar a senha.
- `tests/e2e/integrated-landing.spec.ts`: expectativas de navegação atualizadas para as novas telas e sua prontidão.

Novos:

- `components/eme/use-auth-form.ts`
- `components/eme/integrated-auth/auth-screen.tsx`
- `components/eme/integrated-auth/auth.css`
- `app/(auth)/recuperar-senha/page.tsx`
- `public/auth-2026/assets/ambiente.png`
- `public/auth-2026/assets/apartamento.png`
- `public/auth-2026/assets/eme-logo-header.png`
- `tests/e2e/integrated-auth.spec.ts`
- Este relatório.

A comparação final por hash dos 1.300 arquivos presentes no backup encontrou somente os quatro arquivos existentes listados acima com alterações. Landing e seus assets, portal, serviços/API de autenticação, `.env.local`, CSS global, schema, dependências e demais alterações locais anteriores foram preservados. O arquivo gerado `next-env.d.ts` foi restaurado ao estado do backup após o build.

## Validação

- `next build`: aprovado, incluindo TypeScript e geração das 111 páginas estáticas. O processo usou URL de banco local inativo; a rota preexistente `/api/landing/activity` registrou a indisponibilidade esperada, sem impedir a conclusão (código 0).
- ESLint: aprovado nos oito arquivos TypeScript/TSX de implementação e testes envolvidos.
- `integrated-auth.spec.ts`: **21/21 no Chromium e 21/21 no WebKit**. Cobertura de layout, validação obrigatória, duas etapas/retorno, CRECI/UF, confirmação, payload real normalizado, erros HTTP/rede, login por senha/PIN/biometria, disponibilidade do dispositivo, redirecionamentos, Enter, foco/rolagem, recuperação sem envio e Journey sem dados sensíveis.
- Regressão da landing: **17 cenários Chromium aprovados**, somando a rodada de 16 cenários e o cenário de navegação para login/cadastro corrigido após a verificação de hidratação. Esse último também passou no WebKit.
- Capturas revisadas em desktop de 1440 px e mobile de 375, 390, 393 e 430 px; sem overflow horizontal nem erros de página. Cadastro completo permanece acessível por rolagem.

Os testes interceptam respostas das APIs e as páginas de destino protegidas. Verificam o contrato e o comportamento do cliente, mas não efetuam login real, criação de contas ou envio de e-mail. Biometria usa fixture WebAuthn, sem hardware. WebKit usa viewport/touch móvel com escala 1× no Windows; não equivale a teste em iPhone físico.

## Prévia para revisão

- Login: <http://127.0.0.1:3105/login>
- Cadastro: <http://127.0.0.1:3105/cadastro>
- Recuperação: <http://127.0.0.1:3105/recuperar-senha>
- Landing preservada: <http://127.0.0.1:3105/>

O servidor local usa banco inativo, fixture Prisma em memória e analytics desabilitado apenas no processo, sem mudar `.env.local`. A prévia permite revisão visual; operações de autenticação que dependem do banco não concluem nesse servidor isolado. Os mocks existem somente nos testes, não nos formulários integrados.

Capturas e verificação de preservação: `.qa-audit-tmp/auth-preview/` (artefatos locais ignorados pelo Git).
