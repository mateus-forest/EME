# Admin · Tráfego

Área `/admin/trafego`, acessível pelo menu Tráfego. Endpoint `GET /api/admin/journey-traffic`, restrito a ADMIN e com `Cache-Control: private, no-store`.

## Fontes e limites de escopo

Todas as métricas vêm exclusivamente de `JourneyEvent`. Não são consultados `CatalogEvent`, `SearchEvent`, `AiOperationTelemetry`, billing ou contagens de contas. `Catalog`, `Broker`, `Agency` e `User.name` servem somente à identificação atual do proprietário dos catálogos observados. Esse enriquecimento falha de forma independente: contagens continuam disponíveis, proprietário desconhecido fica explícito. Aliases respeitam o vínculo atual de `Catalog`; o slug direto é fallback conforme o carregador público. Vínculos ambíguos não são atribuídos.

Sem mudança em instrumentação, schema, dependências, billing, acesso ou dados existentes. Todas as consultas da área são SELECT parametrizados. `JourneyIdentityLink` não é necessário para fundir visitantes: a unidade é o mesmo anonymousId do navegador antes/depois do login, sem tentar identificar pessoas entre dispositivos.

## Filtros

- Hoje, últimos 7 ou 30 dias de calendário, ou intervalo inclusivo customizado de até 366 dias.
- Datas interpretadas em America/Sao_Paulo pelo resolvedor de período compartilhado com a Visão Geral. O SQL recebe `[start, end)` em UTC; hoje termina no instante da consulta.
- Superfície e rota aplicam-se a todos os blocos. Clique em uma superfície ou rota para detalhar; a remoção do chip limpa a rota. O detalhe do catálogo expande os agregados da linha sem criar tráfego público.
- Landing: `/`. Marketplace: `/imoveis` e descendentes. Catálogos: `/catalogo` e descendentes. Portal: `/corretor` e `/imobiliaria` e descendentes, com userId autenticado no evento. Login, cadastro e rotas restantes ficam em **Outras / autenticação**, para não desaparecerem dos totais.
- Eventos específicos de Marketplace/Catálogo pertencem à sua superfície; lead confirmado usa o canal explícito. Bots identificados e rotas `/admin` são excluídos em métricas e consultas históricas.

## Definições das métricas

| Métrica | Agregação e interpretação |
| --- | --- |
| Page views | `COUNT(*)` de `page_view`, producer=browser. Eventos específicos de acesso não são somados. |
| Visitantes únicos | `COUNT(DISTINCT anonymousId)` no intervalo inteiro e filtros. Estimativa por navegador/cookie; valores nulos não contam como uma pessoa. |
| Sessões | `COUNT(DISTINCT sessionId)` em page_view no intervalo e filtros. |
| Páginas por sessão | Page views que têm sessionId / sessões distintas. Sem denominador: `null`, apresentado como “—”. |
| Novos visitantes | anonymousIds do recorte sem page_view anterior ao início do período em qualquer superfície elegível do histórico Journey. “Novo” significa primeiro registro observado, sempre parcial. |
| Recorrentes | anonymousIds do recorte com page_view anterior ao início do período. Retornos dentro do mesmo período permanecem na categoria inicial, evitando dupla contagem entre novos e recorrentes. |
| Evolução | `date_trunc` em America/Sao_Paulo, por hora em intervalos de um dia e por dia nos demais. Série usa COUNT e DISTINCT em cada faixa; o total do período é calculado separadamente. |
| Superfícies | Page views, visitantes, sessões, entradas e participação nos page views do recorte. Cada page_view tem uma superfície; visitantes/sessões podem aparecer em várias linhas. |
| Entradas | Primeira página conhecida da sessão em todo o histórico até o fim do intervalo. Conta apenas se esse evento estiver dentro dos filtros; não recria uma entrada ao filtrar uma rota/superfície. |
| Saídas estimadas | Último page_view conhecido da sessão em todo o histórico disponível, dentro dos filtros e ocorrido ao menos 30 minutos antes do fim do intervalo. Página posterior, inclusive fora do intervalo, invalida a inferência. Não confirma fechamento do site nem ausência de atividade sem navegação. |
| Marketplace | Contagens separadas de marketplace_view, marketplace_search, marketplace_result_opened e lead_created do servidor com channel=marketplace. |
| Busca → imóvel | Buscas distintas por `(searchId, sessionId, anonymousId)` com abertura posterior de mesmo vínculo / buscas com vínculo completo. Ambos os eventos dentro dos filtros. Cada busca converte no máximo uma vez. Não divide aberturas brutas por buscas. |
| Catálogos | Ranking por catalogId (hoje slug) usando catalog_view para acessos, visitantes e sessões; catalog_property_opened para aberturas; lead_created do servidor com channel=catalog e catalogId explícito para leads. Visita pública não vira atividade do proprietário. |
| Aquisição / dispositivo | Uma atribuição por sessão do recorte, com source, medium, hostname de referrer e dispositivo da primeira página conhecida da sessão, mesmo anterior ao período/filtro. |

### Cobertura e atribuição

O primeiro `receivedAt` comprova apenas o início observado da coleta, não continuidade. Intervalos anteriores a esse instante, coleta desativada e identidades/vínculos faltantes recebem indicação parcial. Falha da fonte retorna `data: null` e “indisponível”, nunca zeros artificiais. Coleta continua best effort.

Source/medium são os valores normalizados existentes em metadata (`utmSource`/`utmMedium`), inclusive defaults `direct`/`other`. A coleta atual não permite distinguir sempre UTM explícita de default. UTMs fora da lista permitida podem ser descartadas; referrers internos não são removidos. Não há modelo multicanal. **UTM campaign e navegador não são capturados** e aparecem como indisponíveis; nenhum tracking foi adicionado.

Não há page_view identificável por catálogo individual: o caminho é normalizado, sem slug, e o page_view não carrega catalogId. O ranking usa catalog_view explicitamente e não fabrica page views por catálogo. Eventos de catálogo sem ID ficam nos totais da superfície, mas fora do ranking, com indicação parcial. Slug renomeado ou proprietário removido pode não ter correspondência atual; o histórico não é reescrito.

A taxa de busca é parcial quando há buscas sem vínculo completo ou aberturas sem busca correspondente no recorte. Aberturas diretas podem existir legitimamente. Leads sem canal/catalogId não são atribuídos por suposição baseada no proprietário ou no pathname.

## Consultas e eficiência

`lib/admin-traffic-sql.ts` contém uma consulta de agregação retornando um JSON com totais, série e rankings. O escopo temporal de eventos relevantes é materializado uma vez; páginas e bordas de sessão são reutilizadas. Leituras históricas laterais por sessionId e verificações de histórico por anonymousId aproveitam os índices existentes desses campos com occurredAt. A unicidade de eventId vem da chave primária; nenhuma deduplicação é feita somando eventos legados.

Rankings de rotas, catálogos e aquisição retornam até 200 grupos, escolhidos por volume, com aviso parcial se excederem o limite. A interface ordena os grupos recebidos e pagina em blocos de 10; os totais globais permanecem completos. Não são enviados eventos individuais, sessionIds, anonymousIds ou userIds à interface.

Pool de leitura limitado a 2 conexões, timeout de conexão de 4 s, statement timeout de 8 s e query timeout de 10 s. A consulta de proprietário é uma única leitura em lote, somente quando há catálogos no ranking. Não há migração de índice nesta etapa. Min/max de receivedAt e o período ainda podem exigir varreduras; medir novamente antes de maior escala. O limite de tempo vira estado indisponível sem afetar operações do produto.

Referência simples para conferir os principais totais no mesmo período UTC:

```sql
SELECT count(*) AS page_views,
       count(DISTINCT "anonymousId") AS visitantes,
       count(DISTINCT "sessionId") AS sessoes,
       round(count(*) FILTER (WHERE "sessionId" IS NOT NULL)::numeric
             / nullif(count(DISTINCT "sessionId"), 0), 2) AS paginas_por_sessao
FROM "JourneyEvent"
WHERE "eventName" = 'page_view' AND producer = 'browser'
  AND "occurredAt" >= $1::timestamptz AND "occurredAt" < $2::timestamptz
  AND device <> 'bot' AND module <> 'admin'
  AND pathname !~ '^/admin(/|$)';
```

Para rotas, acrescentar pathname e GROUP BY pathname; para superfícies, aplicar a classificação documentada. A referência não usa o dia em UTC como substituto do dia de São Paulo.

## Validação desta entrega

- Unitários: filtros, fronteiras de São Paulo, cobertura parcial, isolamento de falhas, proprietário ambíguo e autorização ADMIN/cache do endpoint. Regressão do resolvedor de período e da Visão Geral.
- PostgreSQL real, fixtures via `jsonb_populate_recordset` em CTE dentro de `BEGIN READ ONLY`: múltiplos dias/sessões do mesmo navegador, entrada antes do intervalo, retorno em outra superfície, sessão ativa, página posterior ao recorte, identidade incompleta, bots/admin, lead forjado/sem canal, busca sem vínculo/fora de ordem/repetida e proprietário por alias/fallback. Sem INSERT, DDL ou cleanup.
- Playwright: 1440 e 390 px, filtros, período customizado, ordenação, detalhamento de rota/catálogo, ausência de overflow do documento, valores indisponíveis e resposta antiga que não sobrescreve filtros novos.
- Conferência direta no banco em **10/09/2026 17:07:12 (America/Sao_Paulo)**, corte UTC `2026-09-10T20:07:12.561Z`: 24 combinações (Hoje/7d/30d/customizado × seis opções de superfície), todas correspondentes. Comparação independente dos registros elegíveis com totais, rotas, superfícies, séries, dispositivos, aquisição e eventos específicos. Transação de referência REPEATABLE READ READ ONLY.
- Nesse corte, Hoje/7d/30d/customizado (09–10/09), todas as superfícies: **1 visitante, 1 sessão, 5 page views, 5 páginas/sessão, 1 novo observado, 0 recorrentes e 1 entrada**. Portal: 4 page views; Outras (/login): 1. Não havia acessos públicos humanos elegíveis de Marketplace/Catálogo; cenários com volume são cobertos pelas fixtures.
- `EXPLAIN (ANALYZE, BUFFERS)` no conjunto atual: planejamento ~1,99 ms, execução ~1,91 ms; leituras das combinações até 163 ms na conexão estabelecida. Esse conjunto tem apenas 6 eventos elegíveis históricos, portanto **não é um teste de carga**.
- A interface também recebe os resultados reais dessa conferência para verificar os números renderizados nos dois tamanhos. Autenticação e transporte HTTP são simulados nesse teste de apresentação: a sessão disponível no navegador do usuário é de corretor. O endpoint real tem sua autorização validada nos testes unitários; smoke autenticado com uma sessão ADMIN real permanece pendente.

Comandos de testes (PowerShell):

```powershell
node --test tests/admin-traffic.test.mjs tests/admin-journey-overview.test.mjs
$env:ADMIN_TRAFFIC_SQL_TEST='true'
node --env-file=.env.local --test tests/admin-traffic-sql.test.mjs
npx playwright test tests/e2e/admin-traffic.spec.ts --workers=1
npx tsc --noEmit --incremental false --allowImportingTsExtensions
```

Lint aplicado aos arquivos alterados e testes desta área. Artefatos locais de conferência e screenshots ficam em `.qa-audit-tmp/`, ignorados pelo Git; variáveis de ambiente e credenciais não fazem parte do commit.
