# Captação de Imóveis — portal atual e validação local

Data da verificação: 14/09/2026. Sem push, publicação ou conexão com banco de produção.

## Base e preservação

- Origem: `C:\Users\mateu\Downloads\EME 2.0\EME`, branch `feat/landing-integracao-20260911`, HEAD `51207544b00a2ab75fe176eb55b1fd3dccab5f12`, incluindo alterações locais existentes.
- Desenvolvimento atual, por autorização posterior do usuário: `C:\Users\mateu\Downloads\EME 2.0\EME`, branch `main`. A cópia independente anterior permanece em `C:\Users\mateu\Documents\eme-captacao\app` como referência, sem ser a prévia ativa.
- Registro anterior ao desenvolvimento: `C:\Users\mateu\Documents\eme-captacao\snapshot`, manifesto SHA-256 de 1.316 arquivos versionados/não ignorados e cópia dos arquivos de produto. Segredos de ambiente e arquivos de limpeza de contas não foram transportados. O original permaneceu no lugar, incluindo esses arquivos.
- Preservação inicial na cópia: `01451c0`. Na pasta original, `e8bb70c` guarda os mesmos 46 arquivos existentes; `0bb79a5` acrescenta Captação. Antes da mudança de branch, novo backup em `C:\Users\mateu\Documents\eme-captacao\backup-original-20260914` com bundle Git, patch, arquivos alterados e ambiente privado. Os 1.316 hashes do original foram novamente conferidos antes das alterações.
- Não foi usada a pasta `EME-Portal-Integracao`. Nenhum componente do redesenho foi importado. `BROKER_PORTAL_V2=false` na prévia. O menu lateral atual permanece.
- Mudanças existentes de landing, login e cadastro não foram substituídas por demonstrações. A correção do player persistente do Marketplace da base original permanece.

### Conciliação pública autorizada e concluída

O estado de trabalho original não corresponde integralmente aos últimos arquivos públicos aprovados em 11/09. A comparação com o histórico público `c531b32` encontrou sete arquivos conciliados separadamente, após autorização explícita do usuário em 14/09:

1. `app/(auth)/page.tsx`: metadados/título e indexação condicionada ao ambiente Production; o estado local ainda usa `index: false` de forma incondicional.
2. `components/eme/integrated-landing/landing-markup.ts`: marca refinada e link público Marketplace.
3. `components/eme/integrated-landing/landing.css`: refinamentos aprovados do cabeçalho/mobile.
4. `public/landing-2026/assets/eme-logo-relief.png`: ativo da marca aprovada.
5. `lib/marketplace/server-data.ts`: carteira pública completa.
6. `app/imoveis/corretores/[slug]/page.tsx`: exibição de todos os imóveis publicados.
7. `tests/marketplace-broker-listings.test.mjs`: teste dessa correção pública.

A leitura do histórico mostrou que `c531b32` altera três arquivos da carteira pública e que os commits públicos anteriores de landing não alteram `app/corretor`, `broker-sidebar` ou `broker-page-shell`. A revisão automática inicialmente bloqueou a recuperação. Depois do backup e dos commits de preservação, o usuário confirmou expressamente a substituição desses sete arquivos públicos. Eles foram recuperados individualmente de `c531b32`, sem merge de branch e sem componente do redesenho. Esta pendência foi resolvida; não houve push nem alteração da produção.

## Fluxo implementado

- Menu Carteira: Clientes, Imóveis e Captação. Rota `/corretor/captacao` com Buscar imóveis / Minhas captações.
- Busca explícita por botão, fontes selecionáveis, paginação independente, preservação de resultados válidos em falhas parciais, detalhes adicionais somente por ação do corretor.
- Lista normalizada, consulta separada da publicação, origem/link, fatos de correspondência, identificação conservadora e possíveis duplicidades sem fusão automática.
- Oportunidades salvas, seis etapas, observações, preferência de contato, evidência de identidade, histórico, próxima ação e vínculo com a Agenda existente.
- Abordagem contextual sem IA: resumo, confirmações, estratégia e mensagem editável/copiável. WhatsApp somente para telefone validado e vinculado à origem. Nenhum envio automático. Copiar/abrir não registra contato.
- Encontrar ou salvar não cria cliente, proprietário nem imóvel. Após confirmação: revisão de duplicidades, contato existente ou criação consciente pela tela Clientes, abertura do formulário atual de imóvel e inclusão como rascunho.
- Fotos/descrição externas não são pré-preenchidas no cadastro. A descrição é escrita pelo corretor; a origem permanece na captação e nas observações jurídicas privadas do imóvel.
- A inclusão e o vínculo são atômicos; repetição retorna o imóvel associado. Registro de criação/notificação não é duplicado. A verificação final de repetição retornou HTTP 200 com o mesmo imóvel, sem aumentar as contagens de imóveis, notificações ou atividades.

## Matriz GeckoAPI

Consultas oficiais realizadas antes da implementação. Transporte único: `POST https://api.geckoapi.com.br/v1/extract`, com Bearer no servidor, `target` documentado e `type=plp` (busca) ou `pdp` (detalhes). Valores podem ser nulos; os exemplos oficiais não comprovam cobertura de anúncios reais.

| Fonte | Filtros confirmados e uso nesta versão | Paginação | Busca e detalhes | Anunciante/contato |
| --- | --- | --- | --- | --- |
| Chaves na Mão | UF/cidade, um bairro, venda/locação, tipos, preço, quartos/vagas (um valor por consulta), área, anunciante direto. Vários bairros são filtrados sobre páginas carregadas. | `page` a partir de 1; `nextPage`/`nextPageUrl`. EME usa página numérica. | Título, preços, localização, áreas, contagens, imagens e anunciante; PDP acrescenta descrição/dados disponíveis. | Nome, CRECI/tipo e telefones podem existir. Telefones só usados quando `phones.public=true`. Particular/PF não é proprietário confirmado. |
| VivaReal | UF/cidade, um bairro, venda/locação, tipos, preço, quartos/vagas, área e `directOwner`. Perfil profissional e vários bairros são locais. | `page` 1–500 na documentação; EME limita a 50. | Preços por finalidade, atributos, endereço, mídia, datas e anunciante; detalhes em `data.listing`. | Nome, licença, telefones/WhatsApp quando fornecidos. `contractType=OWNER` não basta para confirmar propriedade. |
| ZAP Imóveis | UF/cidade/finalidade, preço, quartos/vagas e área enviados. Tipo, bairros e perfil filtrados localmente quando comprováveis. | `page` a partir de 1; próxima página retornada. | PLP tem preço/endereço/anunciante/imagens, com cobertura menor de atributos; PDP usa `data.data`. Campos não documentados não são inventados. | Busca pode ter apenas nome/id. PDP documenta CRECI, telefones e WhatsApp; campos ausentes continuam indisponíveis. |
| OLX | UF/cidade, preço, categoria pública `imoveis`, palavras-chave. Finalidade/tipo e demais filtros são locais, quando identificáveis nos dados; palavras-chave não garantem cobertura. | `page` a partir de 1 em busca estruturada. Modo URL exige query própria; não utilizado. | Título, preço, imagens, localização, `listedAt`, atributos; PDP usa `data.data`. | Indicação profissional não define automaticamente corretor/imobiliária. Nome e telefones anonimizados são descartados: hashes não são contatos. Usar anúncio original. |

Fontes primárias por linha: [Chaves PLP](https://geckoapi.com.br/docs/chavesnamao-com-br-plp/), [Chaves PDP](https://geckoapi.com.br/docs/chavesnamao-com-br-pdp/), [VivaReal PLP](https://geckoapi.com.br/docs/vivareal-com-br-plp/), [VivaReal PDP](https://geckoapi.com.br/docs/vivareal-com-br-pdp/), [ZAP PLP](https://geckoapi.com.br/docs/zapimoveis-com-br-plp/), [ZAP PDP](https://geckoapi.com.br/docs/zapimoveis-com-br-pdp/), [OLX PLP](https://geckoapi.com.br/docs/olx-com-br-plp/), [OLX PDP](https://geckoapi.com.br/docs/olx-com-br-pdp/), [categoria imobiliária pública OLX](https://www.olx.com.br/imoveis).

### Custos, limites e cache

Na primeira implementação, as páginas públicas consultadas não fixavam um custo individual verificável. Em 14/09, o dashboard autenticado confirmou **1 crédito** para cada uma das quatro fontes. Uma consulta real ao Chaves na Mão consumiu exatamente um crédito: saldo de 100 para 99. Não houve recarga, contratação nem rotação de chave. A [página de preços](https://geckoapi.com.br/precos/) informa 100 créditos iniciais, Developer de R$ 126,90/mês com 10.000 créditos e Business de R$ 999,90/mês com 100.000; o consumo varia por endpoint. Confirmar os custos e limites da conta no dashboard antes de habilitar a chave. Apenas uma consulta real foi executada nesta ativação; nenhum consumo adicional foi realizado para as outras fontes.

A implementação faz uma requisição por fonte/página e uma por detalhe solicitado, sem retries automáticos. Limites internos de segurança: 20 requisições/corretor/hora, 200 globais/hora, máximo de 50 páginas e 100 itens normalizados por resposta. Esses limites são do EME, não quotas prometidas pelo fornecedor. Não há desconto de créditos do corretor nem regra nova de cobrança.

Consultas idênticas por corretor são coordenadas no PostgreSQL; resultados recentes são reutilizados por 60 segundos e falhas têm espera mínima de um minuto. Respostas transitórias antigas são limpas após 24h, oportunisticamente na próxima consulta do corretor; metadados de consumo permanecem. Os [termos do fornecedor](https://geckoapi.com.br/termos-de-uso/) atribuem ao cliente a responsabilidade pelas permissões para coleta/armazenamento. Não foi encontrada uma duração contratual de cache específica: confirmar permissões/condições comerciais antes da ativação real. Oportunidades salvas conscientemente têm persistência própria.

Portal Azul continua não confirmado e não foi implementado. Portal Zuk e leilões não foram incluídos.

## Dados e isolamento

Migração aditiva: `prisma/migrations/20260914100000_add_captacao/migration.sql`.

- `Captacao`: corretor, chave da fonte/anúncio, fotografia dos dados estruturados (JSON; não arquivo de imagem), etapa, notas, próxima ação/data, preferência de contato, identificação confirmada e vínculos opcionais com contato, imóvel e Agenda.
- `CaptacaoActivity`: atividade, nota, timestamp e chave idempotente por captação.
- `CaptacaoQuery`: contador/coordenação de consulta, fonte, fingerprint, resposta temporária e erro controlado.
- Enum de seis etapas, chaves estrangeiras e índices para corretor/etapa/data/consulta. Conferência direta no PostgreSQL local confirmou 12 índices (incluindo três chaves primárias) e seis chaves estrangeiras. Chaves únicas evitam repetir anúncio por corretor, atividade por operação, imóvel ou compromisso associado.
- SQL cria três tabelas e um enum; não contém DROP, TRUNCATE, DELETE, alteração de colunas antigas ou transferência de dados.
- Todas as APIs usam autenticação e papel BROKER existentes. Acesso restrito ao corretor autenticado, como Clientes e Agenda atuais; não foi aberto compartilhamento adicional para equipes.
- Anúncios a salvar carregam comprovante assinado, vinculado ao corretor e válido por 24h. JSON arbitrário do navegador não é aceito como resultado da origem.
- URLs HTTPS em domínios permitidos; nenhum proxy genérico/URL de fornecedor configurável. Descrições são texto não confiável, sem HTML executável e sem envio automático a IA.

## Prévia e testes

Prévia: `http://localhost:3116/corretor/captacao`. Acesso local em `C:\Users\mateu\Documents\eme-captacao\qa\ACESSO-LOCAL.txt`. Inicializador: `qa\start-preview.ps1` da pasta externa, preservando o ambiente sanitizado. Edite **`C:\Users\mateu\Downloads\EME 2.0\EME`** para ver alterações na prévia. O inicializador externo agora executa essa pasta, com o ambiente privado de teste separado.

Banco local exclusivo: PostgreSQL em `127.0.0.1:55449`, banco `captacao_preview`. Contas novas, sem importação das contas existentes. A chave existente da GeckoAPI foi configurada somente no `.env.local` original, ignorado pelo Git. `BROKER_PORTAL_V2=false`; os demais serviços externos ficam desativados no iniciador. Os registros sintéticos antigos continuam identificados como FIXTURE. A busca normal agora consulta a GeckoAPI de verdade, somente por clique.

### Evidência real local anterior à ativação da chave

17 verificações HTTP/servidor/PostgreSQL aprovadas: acesso anônimo/senha incorreta, login/cookie HttpOnly, ausência de configuração, salvar concorrentemente uma única oportunidade, ausência de criação automática de cliente/imóvel, leitura/gravação/comprovante isolados entre corretores, comprovante adulterado, contato explícito/idempotente, preferência de não contato, Agenda e remarcação sem duplicatas, associação consciente a contato próprio, revisão obrigatória, rascunho com origem sem republicação de mídia, limites de consumo antes do fornecedor e indicadores por ações.

### Evidência com fixtures

14 testes de domínio/handler aprovados: filtros e paginação das quatro fontes, payloads documentados, hashes, classificação conservadora, URLs, dados faltantes, duplicidades, remoção/erros e ausência de retry, abordagem contextual e resultados parciais. O transporte do fornecedor foi substituído por fixtures explicitamente sintéticas. Isso **não comprova funcionamento ao vivo da GeckoAPI**.

Navegador Chromium: login real pela tela, menu lateral, busca somente no clique, falha parcial preservando resultados, paginação, abordagem editável, fechamento por Escape, salvamento/contato/confirmação/revisão e criação real de rascunho pelo formulário existente. Testes de busca interceptam apenas a fronteira do fornecedor nesse navegador; os endpoints de autenticação e gravação são reais no banco local.

Mobile em 320/390/430 px: ausência de overflow horizontal e rolagem completa dos modais, incluindo histórico. Capturas inspecionadas; corrigido o escopo de tema do modal para manter contraste. Não houve teste em iPhone físico. Uma retomada do teste preservou o rascunho já criado, após corrigir um seletor que encontrava as duas mensagens existentes de sucesso.

Compilação Next completa e TypeScript: aprovados. Lint dos arquivos de produto alterados: aprovado. Ajuste mínimo `allowImportingTsExtensions=true` em `tsconfig.json`, com `noEmit` já existente, para acomodar imports `.ts` dos testes antigos que impediam a checagem integral. Nenhuma dependência de produto adicionada; package/lock preservados.

Comandos da validação anterior (na cópia isolada, com fornecedor desativado; não repetir a suíte de cenário não configurado contra a prévia real atual):

```powershell
node --test tests/captacao/domain.test.cjs
$env:EME_CAPTACAO_LOCAL_ACCESS='C:\Users\mateu\Documents\eme-captacao\qa\access.json'
node tests/captacao/local-integration.cjs
node tests/captacao/browser.cjs
npx tsc --noEmit
```

Os testes locais exigem explicitamente o banco/porta isolados. Não apontar esses testes a outros ambientes. Logs e capturas ficam na pasta externa `qa`, sem credenciais no Git.

## Pendências e limites

**Preexistentes:** a reprodução do histórico completo de migrações em um banco vazio falhou em `20260811233000_contract_template_engine`, por ausência de `BrokerDocument`. A migração antiga não foi alterada. A nova migração foi aplicada e testada num segundo banco vazio inicializado com o schema anterior atual. O primeiro banco local de diagnóstico, `captacao_local`, foi preservado. Antes de uma migração futura, conferir o histórico efetivo do ambiente de destino; não executar reset nem substituir banco. Recuperação de senha permanece na condição anterior; não foram simulados envios.

**Dependências desta funcionalidade:** a chave e o saldo locais estão confirmados. Ainda faltam homologação ao vivo das outras três fontes, dos detalhes/paginação real e dos contatos, além de confirmação contratual de retenção e permissões/limites por fonte. ZAP e OLX têm lacunas documentadas: filtros locais podem excluir anúncios sem atributos; a cobertura é parcial. Identificação de proprietário depende de evidência registrada pelo corretor. Chaves na Mão foi validado ao vivo; as demais fontes continuam com cobertura por fixtures e documentação.

**Preparação para entrega remota:** os sete arquivos públicos foram conciliados; revisar/aprovar o SQL aditivo no ambiente de destino e configurar a chave nesse ambiente antes de ativar a funcionalidade em produção. Esta entrega não inclui migração remota, push ou publicação. Os arquivos de ambiente, contas, dados de teste, snapshot e QA nunca devem ser enviados.

**Regressões encontradas e corrigidas nesta implementação:** corrida ao salvar a mesma oportunidade, reabertura de anúncio ignorando a preferência de contato, campos do modal editáveis durante confirmação de gravação, rótulos dos selects e contraste do modal fora do escopo visual do portal. Sem alegação de homologação das integrações externas preexistentes.
## Ativação no original — 14/09/2026

- Prévia ativa a partir da pasta original, em `http://localhost:3116/corretor/captacao`, com a mesma conta e o mesmo banco `captacao_preview` preservados.
- Consulta real pela interface: Chaves na Mão, São Paulo/SP, venda, primeira página. Retornou **15 anúncios** com links de origem e dados apresentados na tela. Sem fixtures/interceptação nessa consulta. Não foram criados contatos, captações ou imóveis automaticamente.
- Dashboard GeckoAPI: saldo inicial 100, saldo após a consulta 99; uma requisição consumida. Nenhuma chave criada/rotacionada. Configuração privada fora do Git.
- 129 testes selecionados de Captação, carteira pública e segurança aprovados no original, mais cinco testes do iniciador local. O iniciador recusa bancos remotos/não identificados como teste e comandos de migração; não transporta os demais segredos de produção para o processo de prévia.
- Compilação do original e TypeScript usam somente o banco local. `.qa-audit-tmp` foi excluída da checagem de tipos porque contém cópias de outros projetos e verificações antigas; não faz parte do produto.
- Os arquivos locais de limpeza de contas preexistentes continuam preservados e fora dos commits. Não foram executados.

Para iniciar a prévia no terminal da pasta original:

```powershell
npm run dev:captacao -- "C:\Users\mateu\Documents\eme-captacao\qa\.env.captacao-local"
```

O iniciador usa esse arquivo exclusivamente para banco/autenticação de teste e lê apenas a chave Gecko do `.env.local` do projeto. Não usa o banco de produção. Para a validação local desta entrega, utilize esse comando em vez de `npm run dev` sem a seleção do ambiente de teste.

A `main` local contém os commits preparados para `git push origin main`; nenhum push foi executado. A migração da Captação e a chave no ambiente de hospedagem são etapas separadas: não foram aplicadas à produção, e a chave local não será enviada pelo Git.