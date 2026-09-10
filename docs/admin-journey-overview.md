# Visão Geral do Admin — Journey Analytics

O endereço `/admin` usa `GET /api/admin/journey-overview`. As outras áreas administrativas permanecem com seus endpoints existentes. Nenhuma alteração de schema, biblioteca, regra de billing ou instrumentação foi necessária.

## Períodos e apresentação

- Hoje, 7 dias e 30 dias são períodos de calendário em `America/Sao_Paulo`, incluindo o dia corrente até o instante da consulta. Não são janelas móveis de 24 horas.
- Personalizado aceita datas inclusivas e no máximo 366 dias, sem datas futuras. O backend transforma o início em meia-noite local e o fim na meia-noite do dia seguinte, exclusiva; quando termina hoje, usa o instante da consulta.
- UTC é usado nos parâmetros e armazenamento. Séries e datas na tela usam São Paulo. Hoje tem série por hora; os demais períodos, por dia.
- A interface descarta respostas antigas quando o período muda. Um erro de fonte apresenta “Indisponível” e `—`, preservando fontes independentes que responderam. Zero significa contagem observada igual a zero, nunca erro convertido em zero.

## Métricas e agregações

A consulta está em `lib/admin-journey-sql.ts`. Uma CTE delimita os eventos do período, excluindo `device='bot'`, `module='admin'` e pathnames administrativos. As agregações são feitas no PostgreSQL, não por transferência de todos os eventos ao browser.

| Indicador | Cálculo / origem |
| --- | --- |
| Visitantes únicos | `COUNT(DISTINCT anonymousId)` sobre `page_view` de browser, no período inteiro; estimativa por navegador |
| Sessões | `COUNT(DISTINCT sessionId)` sobre os mesmos page views |
| Page views | `COUNT(*)` de `page_view`; não soma `landing_view` ou visitas específicas |
| Novos cadastros | `COUNT(*)` de `User` com papel BROKER/AGENCY e `createdAt` no período; contas ADMIN ficam fora |
| Cadastros iniciados | Sessões distintas com `signup_started` |
| Cadastros concluídos | Usuários distintos com `signup_completed`, emitido pelo servidor |
| Landing → cadastro | Sessões que chegaram a cadastro concluído na coorte, divididas pelas sessões da landing; sem denominador, apresenta `—` |
| Assinantes ativos | Fotografia atual: resolvedor administrativo existente, plano contratado Pro/Scale, status de apresentação Ativa/Cancelando, status original active e sem trial. Conflitos e trials ficam fora, indicados separadamente |
| Marketplace / Catálogo views | Contagem dos eventos `marketplace_view` e `catalog_view`, respectivamente |
| Leads gerados | `lead_created` confirmado pelo servidor; inclui todos os canais instrumentados |
| Erros registrados | Apenas `error_occurred`, sem somar `signup_failed`, `checkout_failed`, etc. |

Visitantes/sessões mensais são recalculados diretamente no período. Nunca são soma dos únicos diários nem das linhas de origem, rota ou módulo.

Aquisição usa `DISTINCT ON(sessionId)` para a primeira página observada de cada sessão **dentro do período**. Origem prioriza UTM reconhecida, depois hostname de referrer, depois “Direto / não informado”. Dispositivos também representam sessões, não page views. As origens exibem os seis maiores grupos.

O funil usa cinco CTEs sucessivas: landing → início do cadastro → cadastro concluído → checkout iniciado → checkout concluído. Cada etapa exige a mesma sessão, ocorrência posterior ou simultânea à etapa anterior e confirmação do servidor para os sucessos. Cada sessão aparece no máximo uma vez por etapa. A tela distingue sessões da coorte dos eventos totais; “sem avanço” pode incluir jornadas ainda em andamento.

Produto considera page views do portal e ações concluídas, com `userId` explícito. Navegação pública de Marketplace/Catálogo não vira uso do proprietário, mesmo que exista `brokerId`. Cada módulo mostra eventos de uso e usuários distintos. As ações são fatos confirmados pelo servidor, sem cliques ou eventos de geração iniciada.

Marketplace/Catálogo mostram os seis eventos solicitados. Erros agrupam por código e rota, com `COUNT(DISTINCT userId)`, `COUNT(DISTINCT sessionId)` e `MAX(occurredAt)`. Rotas agrupam page views por pathname normalizado e mostram contagem, visitantes e sessões distintos. As tabelas de rotas/módulos exibem até 12 grupos; códigos/rotas de erro, até cinco.

## Independência das fontes

Journey, contas criadas e assinantes são carregados com `Promise.allSettled`. Falha em uma fonte não substitui valores das demais. O endpoint exige autenticação ADMIN antes de consultar o dashboard e retorna `Cache-Control: private, no-store`.

O pool de leitura do Journey tem no máximo duas conexões e timeouts limitados (conexão 4 s, statement 8 s, query 10 s). Todas as consultas são SELECTs parametrizados. Não há sincronização com Stripe, atualização, backfill, correção de conta ou escrita de eventos pelo endpoint.

Assinantes reutiliza `loadAdminUserBillings` e `resolveAccountBilling`, sem modificá-los. O número é marcado **estimado / atual**, pois o estado local pode estar atrasado e não distingue todos os estados originais Stripe. Não representa o número histórico de assinantes no intervalo selecionado nem prova pagamento recebido.

## Cobertura e limites

- A coleta foi ativada recentemente. Um período que começa antes do primeiro evento recebido é parcial. Faixas vazias anteriores à coleta aparecem como traços cinza no gráfico. Eventos efetivamente observados continuam visíveis mesmo quando chegaram atrasados.
- O primeiro evento recebido é evidência de cobertura, não garantia de coleta contínua. Bloqueadores, cookies desabilitados, dispositivos compartilhados e descartes do transporte podem limitar os números. A flag desligada e falta de identidade também geram aviso de parcialidade.
- Uma pessoa em dois navegadores pode contar duas vezes; pessoas compartilhando navegador podem contar uma. Não há identificação probabilística nem união cross-device.
- O funil é por sessão/período. Conversões em outra sessão, fora da janela ou sem sessão não são atribuídas retrospectivamente. Ausência de avanço não prova abandono definitivo.
- Eventos legados (`CatalogEvent`, `SearchEvent`, `AiOperationTelemetry`) não são somados ao Journey. Não há histórico retroativo ou estimativa por legado.
- Os testes automatizados anteriores com HeadlessChrome estão marcados como bot e ficam fora. A navegação manual de testes pode continuar presente; nenhum registro foi apagado.
- O volume atual é pequeno. Os índices existentes atendem as chaves de evento/sessão/módulo; períodos extensos e os extremos de `receivedAt` devem ser reavaliados com `EXPLAIN` quando a base crescer, antes de adicionar índices ou rollups.

## Validação de 10/09/2026

Consultas independentes, somente de leitura, compararam os agregados para o corte `2026-09-10T19:23:35.420Z`:

| Métrica | Hoje | 7 dias | 30 dias |
| --- | ---: | ---: | ---: |
| Visitantes únicos | 1 | 1 | 1 |
| Sessões | 1 | 1 | 1 |
| Page views | 5 | 5 | 5 |
| Novos cadastros no banco | 0 | 0 | 1 |
| Cadastros iniciados / concluídos por evento | 0 / 0 | 0 / 0 | 0 / 0 |
| Assinantes ativos (estimativa atual) | 2 | 2 | 2 |
| Pendentes de conciliação, fora do total | 1 | 1 | 1 |
| Marketplace / Catálogo views | 0 / 0 | 0 / 0 | 0 / 0 |
| Leads / erros | 0 / 0 | 0 / 0 | 0 / 0 |

Os três períodos bateram integralmente nos totais, estágios do funil e faixas temporais. O serviço levou aproximadamente 2,7 s na primeira leitura e 1,1 s nas seguintes, incluindo a conferência independente; não é benchmark de produção. A interface desktop (1440 px) e mobile (390 px) foi alimentada com esses mesmos resultados reais no navegador de QA e os valores renderizados foram comparados; sem overflow. Nessa conferência, somente autenticação/transporte HTTP foram simulados no navegador. A sessão fornecida no navegador do usuário era de corretor, portanto o smoke HTTP autenticado com ADMIN ainda requer essa sessão.

Os testes incluem autorização, intervalos inválidos, falhas isoladas, cobertura parcial, resolvedor existente, seleção de período, respostas fora de ordem, estados indisponíveis e layout responsivo. O teste SQL executa fixtures via CTE e `jsonb_populate_recordset` em transação `READ ONLY`, sem inserir dados ou criar tabelas. Ele confirma únicos entre dias, fronteira do fuso, funil em ordem, exclusão de bots/Admin, erro sem dupla contagem e distinção entre visitante e dono do catálogo.

Comandos de validação:

```text
node --no-warnings --experimental-strip-types --experimental-test-isolation=none --test tests/admin-journey-overview.test.mjs tests/journey-analytics.test.mjs tests/billing-resolution.test.mjs tests/stripe-billing-reader.test.mjs tests/billing-lifecycle.test.mjs
# Opt-in de SELECTs no banco configurado: ADMIN_JOURNEY_SQL_TEST=true
node --env-file=.env.local --no-warnings --test tests/admin-journey-sql.test.mjs
npx playwright test tests/e2e/admin-journey-overview.spec.ts
npx tsc --noEmit --incremental false --allowImportingTsExtensions
```

O lint dos arquivos alterados também é executado. Os arquivos e alterações anteriores do usuário ficam fora deste commit.
