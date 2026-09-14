# Integração da landing — prévia local

## Segurança e estado inicial

- Pacote: `C:\Users\mateu\Downloads\EME-Landing-Para-Integrar.zip`.
- Referência extraída: `C:\Users\mateu\Downloads\EME 2.0\Landing-Referencia-20260911-110010\EME-Landing-Para-Integrar`.
- `LEIA-ME-PRIMEIRO.txt` lido antes da integração.
- Backup completo, anterior às alterações: `C:\Users\mateu\Downloads\EME 2.0\EME-Backup-Antes-Landing-20260911-110010\project`.
- Backup inclui `.git`, configurações locais, arquivos ignorados, alterações não commitadas, dependências e artefatos: 61.290 arquivos, 3.919.579.696 bytes, zero falhas. Verificação inicial por hashes de 1.287 arquivos e comparação completa da árvore sem diferenças. Logs e relatório ficam na pasta que contém `project`.
- Branch separada: `feat/landing-integracao-20260911`; base `51207544b00a2ab75fe176eb55b1fd3dccab5f12`.
- Sem publicação, push ou alterações no banco. O trabalho anterior não commitado foi preservado.

## Integração e destinos

Apenas `/` renderiza a nova landing. Login e cadastro continuam usando a experiência, formulários, validações e handlers existentes. O HTML estático do pacote é mantido em um módulo local confiável; não recebe conteúdo de usuário. Sua identidade permanece estável para o React não substituir os elementos controlados pelo script durante navegações.

| Origem no pacote | Destino integrado |
| --- | --- |
| `index.html` / logo | `/` |
| `login.html` / Entrar | `/login` |
| `cadastro.html` / Criar conta / CTAs | `/cadastro` |
| Atalho dinâmico de Vender | `/imoveis` — Explorar o Marketplace |
| `catalogo-demo.html` no rodapé | Atalho de demonstração removido, conforme permitido pelo pacote |
| Âncoras de resultados/ecossistema | Seções da própria landing |

Textos, cards, imagens, fontes e coreografia do pacote foram preservados, salvo a descrição do atalho substituído para o Marketplace. Os sete arquivos de assets/vendors/licença são cópias idênticas. GSAP e ScrollTrigger são locais e não exigiram instalar dependências.

Todos os seletores CSS estão sob `.eme-integrated-landing`. O reset local exclui os desenhos SVG para preservar atributos de apresentação. O script restringe consultas e animações à landing e limpa listeners, observers e animações no desmontar. Carrossel e ecossistema funcionam antes do carregamento dos vendors e quando esse carregamento falha. Preferências de movimento reduzido são respeitadas. Não foram criados eventos de analytics adicionais.

`noindex,nofollow` permanece apenas na metadata da nova home, conforme o pacote. Revisar somente em uma futura publicação autorizada.

## Arquivos desta integração

Existentes alterados:

- `app/(auth)/page.tsx`: metadata da prévia.
- `components/eme/eme-auth-experience.tsx`: seleção da nova home apenas em `/`.

Novos:

- `components/eme/integrated-landing/integrated-landing.tsx`
- `components/eme/integrated-landing/landing-markup.ts`
- `components/eme/integrated-landing/landing-interactions.js`
- `components/eme/integrated-landing/landing.css`
- `public/landing-2026/assets/ambiente.webp`
- `public/landing-2026/assets/carteira-atendimento.webp`
- `public/landing-2026/assets/casa.webp`
- `public/landing-2026/assets/eme-logo-header.png`
- `public/landing-2026/vendor/gsap-3.14.2.min.js`
- `public/landing-2026/vendor/ScrollTrigger-3.14.2.min.js`
- `public/landing-2026/vendor/NOTICE.txt`
- `tests/e2e/integrated-landing.spec.ts`
- Este relatório.

Os arquivos que já estavam alterados (`app/globals.css`, painéis de autenticação/módulos e testes anteriores) não fazem parte desta integração. Comparação final dos 1.277 arquivos rastreados com o backup encontrou mudanças somente nos dois arquivos existentes acima. `.env.local` e o trabalho anterior também foram conferidos por hash, sem diferenças.

## Validação local

- `next build`: passou, incluindo TypeScript e geração das 110 páginas estáticas. O acesso ao banco foi apontado para localhost inativo; a rota antiga `/api/landing/activity` registrou a indisponibilidade esperada e o build concluiu com código 0.
- ESLint dos arquivos da integração: passou.
- Chromium: 17 cenários aprovados, executados em rodadas de integração e regressão. Cobrem composição responsiva, cards, setas, teclado, swipe, ecossistema, URLs, metadata, login/cadastro, validação sem submissão, movimento reduzido, falha/atraso dos vendors e retorno pelo histórico.
- Marketplace: estilos antes/depois da navegação pela landing permaneceram iguais. Testado com fixture em memória de inventário vazio.
- Capturas revisadas em 1440, 375, 390, 393 e 430 px, sem overflow horizontal. As alturas em 1440 e 390 px coincidem com a referência. Comparação de pixels em 390 px, excluindo rodapé de demonstração e indicador de desenvolvimento: nenhuma diferença acima da tolerância adotada.
- WebKit mobile: 16 cenários aprovados; o swipe via CDP é exclusivo do Chromium e foi pulado. Viewport/touch de iPhone, escala de renderização 1×. A escala 3× apresentou agendamento lento de frames no Windows também no pacote original. Comparação controlada em 1× confirmou transição de aproximadamente 0,52 s nas duas versões para a animação configurada em 0,48 s. A validação automatizada não equivale a um iPhone físico.

Prévia: `http://127.0.0.1:3105/`. Capturas e relatórios locais ficam em `.qa-audit-tmp/landing-preview/` e não entram no Git.

## Limites da prévia

Analytics está desabilitado somente no processo local. Banco local inacessível e fixture Prisma em memória impedem operações sobre dados reais. APIs de autenticação nos testes são simuladas; não foi criado usuário nem efetuado login/pagamento real. As rotas e regras reais permanecem no código sem mudanças. O cenário que abre o Marketplace exige `LANDING_MARKETPLACE_FIXTURE=true` no runner e servidor isolado com fixture; fica desabilitado por padrão porque as leituras SSR não são interceptadas pelos mocks do browser.

Antes de uma publicação futura, validar em aparelho físico e revisar indexação e domínio de forma autorizada. A prévia não foi publicada e nenhum commit ou push foi feito nesta tarefa.
