# COS - Capacidades da versao de lancamento

Este documento e a fronteira operacional canonica do COS atual. Ele descreve o que o runtime realmente entrega hoje, sem inferir suporte apenas pela existencia de uma action ou de um handler no codigo.

## Regra central

| Classe | Comportamento no runtime |
| --- | --- |
| `SUPPORTED` | Executa o handler real, respeita dados obrigatorios e confirmacao e informa apenas o resultado persistido. |
| `READ_ONLY` | Consulta, resume, analisa ou gera uma sugestao transitoria. Nao promete alteracao no sistema. |
| `GUIDANCE_ONLY` | Explica o procedimento de forma curta e deixa claro que nao executa a operacao. |
| `NOT_AVAILABLE` | Nao chama o handler. Responde: "Ainda nao consigo executar essa acao diretamente por aqui. Posso te orientar sobre como fazer no EME." |

Capabilities novas ou sem classificacao explicita ficam em `NOT_AVAILABLE` por seguranca.

## Resumo

| Classe | Quantidade | Escopo principal |
| --- | ---: | --- |
| `SUPPORTED` | 22 | Clientes, imoveis, agenda, rascunhos de propostas/contratos, publicacao segura e campanhas selecionadas. |
| `READ_ONLY` | 31 | Consultas, resumos, historicos, indicadores e sugestoes transitorias. |
| `GUIDANCE_ONLY` | 8 | Ajuda de uso do EME e conversa geral. |
| `NOT_AVAILABLE` | 13 | Fluxos incompletos, perigosos ou baseados em estimativas financeiras sem fonte transacional. |

## SUPPORTED

| Capability | Intencao do usuario | Action/handler real | Dados necessarios | Confirmacao | Resultado persistido | Limitacoes conhecidas |
| --- | --- | --- | --- | --- | --- | --- |
| `agenda.cancel` | Cancelar compromisso | `CANCEL_AGENDA_EVENT` | Compromisso selecionado | Sim | Status do compromisso cancelado | Nao cancela evento em calendario externo. |
| `agenda.complete` | Concluir compromisso | `MARK_AGENDA_DONE` | Compromisso selecionado | Nao | Status concluido | Atua somente na agenda interna. |
| `agenda.create` | Criar compromisso | `CREATE_AGENDA_EVENT` | Titulo, data/hora e tipo; cliente/imovel opcionais | Nao | Novo compromisso | Nao sincroniza calendario externo. |
| `agenda.update` | Editar compromisso | `UPDATE_AGENDA_EVENT` | Compromisso e campos alterados | Nao | Compromisso atualizado | Somente campos suportados pela agenda interna. |
| `catalog.unpublish` | Retirar imovel do Catalogo | `UNPUBLISH_CATALOG` | Imovel selecionado | Sim | Publicacao retirada | Nao remove o cadastro do imovel. |
| `contract.cancel` | Cancelar contrato | `CANCEL_CONTRACT` | Contrato selecionado | Sim | Status cancelado | Nao cancela assinatura em provedor externo. |
| `contract.create` | Criar rascunho de contrato | `CREATE_CONTRACT` | Tipo; cliente e imovel quando disponiveis | Nao | `BrokerDocument` em rascunho | Cria rascunho local; revisao final continua necessaria. |
| `contract.sign` | Marcar contrato como assinado | `SIGN_CONTRACT` | Contrato selecionado | Sim | Status assinado | Nao realiza assinatura eletronica nem coleta evidencia externa. |
| `contract.update` | Atualizar contrato | `UPDATE_CONTRACT` | Contrato e campos alterados | Nao | Documento atualizado | Limitado aos campos do documento local. |
| `lead.attach_document` | Anexar documento ao cliente | `ATTACH_LEAD_DOCUMENT` | Cliente e anexo PDF | Nao | Documento associado ao cliente | Aceita PDF; nao substitui gestao documental completa. |
| `lead.convert` | Marcar cliente como ganho | `CONVERT_LEAD` | Cliente selecionado | Sim | Status comercial `WON` | Conversao e representada pelo status; nao cria contrato automaticamente. |
| `lead.create` | Cadastrar cliente | `createLead` | Nome; telefone/e-mail e demais dados opcionais | Nao | Cliente criado ou atualizado com seguranca | Deduplicacao depende dos identificadores disponiveis. |
| `lead.delete` | Excluir cliente | `DELETE_LEAD` | Cliente selecionado | Sim | Cliente excluido | Exclusao e permanente; dependencias podem bloquear a operacao. |
| `lead.update` | Editar cliente | `UPDATE_LEAD` | Cliente e campos alterados | Nao | Cliente atualizado | Atualiza apenas campos expostos pelo handler. |
| `property.create` | Criar rascunho de imovel | `createPropertyDraft` | Dados basicos do imovel | Nao | Imovel em rascunho | Respeita capacidade; exige conclusao manual de dados/midias. |
| `property.media.update` | Atualizar midias por URL | `UPDATE_PROPERTY_MEDIA` | Imovel e URLs validas | Sim | Lista de imagens atualizada | Nao faz upload de arquivo; opera somente com URLs fornecidas. |
| `property.publish` | Publicar imovel | `PUBLISH_PROPERTY` | Imovel selecionado e readiness valido | Sim | Imovel publicado | Bloqueia quando requisitos reais nao estao completos. |
| `property.unpublish` | Retirar publicacao do imovel | `UNPUBLISH_PROPERTY` | Imovel selecionado | Sim | Imovel volta ao estado nao publicado | Mantem cadastro e dados existentes. |
| `proposal.create` | Criar proposta | `CREATE_PROPOSAL` | Cliente e imovel; condicoes quando informadas | Nao | Rascunho de proposta | Cria documento base; condicoes complexas podem exigir conclusao na tela. |
| `studio.generateCampaign` | Criar campanha base | `STUDIO_GENERATE_CAMPAIGN` | Imovel, objetivo e contexto | Sim | Campanha e assets base | Entrega campanha suportada, nao todos os formatos futuros. |
| `studio.generateInstagram` | Criar conteudo para Instagram | `STUDIO_GENERATE_INSTAGRAM` | Imovel/campanha e contexto | Sim | Campanha e assets de Instagram | Resultado depende dos dados e creditos disponiveis. |
| `studio.regenerate` | Gerar nova versao de campanha | `STUDIO_REGENERATE` | Campanha existente e instrucao | Sim | Nova versao persistida | Requer campanha compativel ja existente. |

## READ_ONLY

| Capability | Intencao do usuario | Action/handler real | Dados necessarios | Confirmacao | Resultado persistido | Limitacoes conhecidas |
| --- | --- | --- | --- | --- | --- | --- |
| `agenda.list` | Listar compromissos | `LIST_AGENDA_EVENTS` | Filtros opcionais | Nao | Nenhum | Le agenda interna. |
| `agenda.month` | Consultar agenda do mes | `LIST_AGENDA_MONTH` | Mes de referencia | Nao | Nenhum | Nao consulta calendario externo. |
| `agenda.today` | Consultar agenda de hoje | `LIST_AGENDA_TODAY` | Data atual | Nao | Nenhum | Usa compromissos internos. |
| `agenda.week` | Consultar agenda da semana | `LIST_AGENDA_WEEK` | Semana de referencia | Nao | Nenhum | Usa compromissos internos. |
| `analytics.leads` | Consultar metricas de clientes/leads | `GET_ANALYTICS_LEADS` | Periodo/filtros opcionais | Nao | Nenhum | Somente telemetria registrada. |
| `analytics.performance` | Consultar desempenho | `GET_ANALYTICS_PERFORMANCE` | Periodo | Nao | Nenhum | Metricas ausentes nao sao inferidas. |
| `analytics.properties` | Comparar desempenho de imoveis | `GET_ANALYTICS_PROPERTIES` | Periodo/imovel opcionais | Nao | Nenhum | Depende dos eventos existentes. |
| `analytics.sales` | Consultar vendas registradas | `GET_ANALYTICS_SALES` | Periodo | Nao | Nenhum | Reflete estados registrados, nao conciliacao financeira. |
| `analytics.summary` | Resumir analytics | `getAnalyticsSummary` | Periodo opcional | Nao | Nenhum | Agregacao dos dados disponiveis. |
| `catalog.analyze` | Analisar prontidao do Catalogo | `analyzeCatalog` | Corretor/imoveis | Nao | Nenhum | Diagnostico; nao corrige pendencias. |
| `catalog.share` | Obter link do Catalogo | `SHARE_CATALOG` | Catalogo publico existente | Nao | Nenhum | Retorna link; nao envia por canal externo. |
| `catalog.stats` | Consultar estatisticas do Catalogo | `CATALOG_STATS` | Periodo opcional | Nao | Nenhum | Somente metricas coletadas. |
| `catalog.summary` | Resumir Catalogo | `getCatalogSummary` | Corretor atual | Nao | Nenhum | Nao publica nem altera imoveis. |
| `contract.download` | Localizar arquivo do contrato | `DOWNLOAD_CONTRACT` | Contrato selecionado | Nao | Nenhum | Retorna arquivo/caminho quando existente; nao cria PDF ausente. |
| `contract.get` | Consultar contrato | `GET_CONTRACT` | Contrato selecionado | Nao | Nenhum | Le o documento local. |
| `contract.history` | Consultar historico de contratos | `CONTRACT_HISTORY` | Contrato/filtros opcionais | Nao | Nenhum | Limitado ao historico persistido. |
| `contract.list` | Listar contratos | `LIST_CONTRACTS` | Filtros opcionais | Nao | Nenhum | Nao inclui documentos fora do EME. |
| `contract.preview` | Pre-visualizar contrato | `CONTRACT_PREVIEW` | Contrato selecionado | Nao | Nenhum | Preview textual/documental existente. |
| `document.get` | Consultar documento | `GET_DOCUMENT` | Documento selecionado | Nao | Nenhum | Nao edita nem assina. |
| `document.list` | Listar documentos | `LIST_DOCUMENTS` | Filtros opcionais | Nao | Nenhum | Somente documentos cadastrados. |
| `lead.find` | Localizar cliente | `FIND_LEAD` | Nome, telefone, e-mail ou identificador | Nao | Nenhum | Pode pedir selecao quando houver homonimos. |
| `lead.summarize` | Resumir um cliente | `summarizeLead` | Cliente selecionado | Nao | Nenhum | Usa somente dados persistidos. |
| `lead.summary` | Resumir carteira de clientes | `getLeadsSummary` | Filtros opcionais | Nao | Nenhum | Agregacao da carteira atual. |
| `lead.timeline` | Consultar historico do cliente | `LEAD_TIMELINE` | Cliente selecionado | Nao | Nenhum | Somente eventos registrados no EME. |
| `operation.summary` | Consultar saude da operacao | `createInternalNotification` | Corretor atual | Nao | Nenhum | O nome legado da action diverge; o handler apenas consulta e resume. |
| `property.get` | Consultar imovel | `GET_PROPERTY` | Imovel selecionado | Nao | Nenhum | Somente dados persistidos. |
| `property.price.suggest` | Obter referencia de preco | `SUGGEST_PROPERTY_PRICE` | Imovel e comparaveis disponiveis | Nao | Nenhum | E estimativa, nunca avaliacao oficial nem alteracao de preco. |
| `property.search` | Buscar imoveis | `searchProperties` | Termos/filtros | Nao | Nenhum | Pesquisa a carteira acessivel ao corretor. |
| `proposal.summary` | Listar/resumir propostas | `LIST_PROPOSALS` | Filtros opcionais | Nao | Nenhum | Nao altera status ou condicoes. |
| `studio.generateDescription` | Sugerir descricao | `STUDIO_GENERATE_DESCRIPTION` | Dados do imovel | Nao | Nenhum | Texto transitorio; o usuario precisa salvar onde desejar. |
| `studio.generateStory` | Sugerir texto de Story | `STUDIO_GENERATE_STORY` | Imovel/campanha | Nao | Nenhum | Gera apenas sugestao textual; nao cria asset publicado. |

## GUIDANCE_ONLY

| Capability | Intencao do usuario | Action/handler real | Dados necessarios | Confirmacao | Resultado persistido | Limitacoes conhecidas |
| --- | --- | --- | --- | --- | --- | --- |
| `general.chat` | Conversar ou pedir orientacao geral | `general` | Pergunta do usuario | Nao | Nenhum | Responde/orienta; nao transforma conversa em operacao implicita. |
| `help.contracts_proposals` | Entender contratos e propostas | `help_contracts_proposals` | Duvida | Nao | Nenhum | Orientacao de uso, sem criar ou enviar automaticamente. |
| `help.first_steps` | Conhecer primeiros passos | `help_first_steps` | Duvida | Nao | Nenhum | Ajuda curta, sem configuracao automatica. |
| `help.general_question` | Tirar duvida sobre o EME | `help_general_question` | Pergunta | Nao | Nenhum | Usa conhecimento operacional, nao dados atuais sem consulta. |
| `help.manage_clients` | Aprender a gerenciar clientes | `help_manage_clients` | Duvida | Nao | Nenhum | Orienta; a mutacao exige capability suportada especifica. |
| `help.marketing_studio` | Entender o Studio IA | `help_marketing_studio` | Duvida | Nao | Nenhum | Nao promete formatos ainda indisponiveis. |
| `help.register_properties` | Aprender a cadastrar imoveis | `help_register_properties` | Duvida | Nao | Nenhum | Pode orientar ou oferecer o rascunho suportado separadamente. |
| `help.use_cos` | Aprender a usar o COS | `help_use_cos` | Duvida | Nao | Nenhum | Descreve apenas capacidades desta versao. |

## NOT_AVAILABLE

| Capability | Intencao do usuario | Action/handler existente | Dados que seriam necessarios | Confirmacao | Persistencia atual | Motivo do bloqueio de lancamento |
| --- | --- | --- | --- | --- | --- | --- |
| `catalog.publish` | Publicar pelo fluxo generico do Catalogo | `PUBLISH_CATALOG` | Imovel e readiness | Sim | O handler altera status | O fluxo generico nao aplica todas as validacoes do publicador seguro; usar a publicacao de imovel na interface. |
| `contract.send` | Enviar contrato ao cliente | `SEND_CONTRACT` | Contrato e destinatario | Sim | Apenas muda status local | Nao existe entrega externa comprovada; nao pode afirmar que enviou. |
| `finance.cashflow` | Consultar fluxo de caixa | `GET_FINANCE_CASHFLOW` | Lancamentos financeiros reais | Nao | Nenhuma | O handler usa aproximacoes, nao um livro financeiro real. |
| `finance.commission` | Calcular comissao real | `GET_FINANCE_COMMISSION` | Venda, percentual e recebimentos | Nao | Nenhuma | Resultado e estimado e nao conciliado. |
| `finance.forecast` | Consultar previsao financeira | `GET_FINANCE_FORECAST` | Receitas/despesas reais | Nao | Nenhuma | Nao ha base transacional suficiente para tratar como dado atual. |
| `finance.payable` | Consultar contas a pagar | `GET_FINANCE_PAYABLE` | Contas registradas | Nao | Nenhuma | O produto nao possui registros reais completos para essa resposta. |
| `finance.receivable` | Consultar contas a receber | `GET_FINANCE_RECEIVABLE` | Recebiveis registrados | Nao | Nenhuma | A resposta atual e derivada/estimada, nao uma cobranca real. |
| `finance.summary` | Resumir financeiro | `getFinancialSummary` | Dados financeiros conciliados | Nao | Nenhuma | Nao deve apresentar estimativas como saldo ou receita atual. |
| `property.archive` | Arquivar imovel | `ARCHIVE_PROPERTY` | Imovel selecionado | Sim | O handler exclui o registro | A implementacao nao arquiva: exclui permanentemente. Bloqueada para evitar perda de dados. |
| `property.description.improve` | Melhorar descricao do imovel | `improvePropertyDescription` | Imovel e instrucao | Nao | Nenhuma | O handler devolve a descricao atual como base, sem melhoria real. |
| `studio.generateFacebook` | Gerar campanha para Facebook | `STUDIO_GENERATE_FACEBOOK` | Imovel/campanha | Sim | Nenhuma entrega completa | Nao gera asset final persistido de ponta a ponta. |
| `studio.generateVideo` | Gerar video | `STUDIO_GENERATE_VIDEO` | Imovel, midias e briefing | Sim | Apenas roteiro/base | Nao entrega video renderizado; nao pode afirmar que gerou um video. |
| `studio.improveText` | Melhorar texto | `STUDIO_IMPROVE_TEXT` | Texto e instrucao | Nao | Nenhuma | O retorno atual apenas rotula o texto como revisado, sem transformacao comprovada. |

## Inconsistencias encontradas

- O inventario anterior equiparava handler registrado a operacao suportada.
- `property.archive` executa exclusao permanente apesar do nome de arquivamento.
- `contract.send` altera somente o status local e nao comprova envio.
- `catalog.publish` possui caminho paralelo que nao aplica a mesma readiness da publicacao segura de imovel.
- Algumas actions do Studio retornam sugestao ou roteiro, mas eram apresentadas como asset final.
- As capabilities financeiras usam estimativas e nao podem responder como dados financeiros atuais.
- `operation.summary` possui nome de action legado relacionado a notificacao, embora apenas consulte a saude operacional.

## O que fica para uma versao futura

- Entrega externa e rastreavel de contratos, incluindo assinatura eletronica.
- Arquivamento real com soft delete e restauracao.
- Publicador unico para Catalogo/Marketplace com readiness centralizada.
- Geracao final de Facebook, video e revisao de texto com asset persistido.
- Capabilities financeiras apoiadas por dados transacionais conciliados.
- Upload de midia pelo COS, em vez de somente atualizacao por URL.

Esses itens nao devem ser simulados no COS de lancamento.
