---
id: operacao-cos-v2
title: Base operacional canônica do COS V2
domains: [lead, property, proposal, contract, agenda, catalog, marketplace, analytics, studio, help, general]
aliases: [base operacional cos v2, conhecimento operacional eme, suporte operacional do corretor]
version: 1.0.0
updated_at: 2026-08-20
knowledge_type: [rule, procedure, capability]
---

# Base operacional canônica do COS V2

Esta é a fonte principal do COS V2 para explicar, diagnosticar e operar o EME atual. Financeiro não faz parte deste documento. `KNOWLEDGE` contém fatos estáticos; `DIAGNOSIS` define o que consultar; `ACTION` referencia somente capabilities reais. Fatos estáticos nunca substituem consultas de dados atuais do corretor.

## O que é Clientes / Leads [KNOWLEDGE]

Clientes é o CRM baseado em `Lead`. Serve para registrar contato, origem, interesse e andamento comercial. Origens reais incluem manual, Catálogo, Marketplace, conversa do Marketplace, WhatsApp, Corretor EME, Assessor EME e landing. Os dados podem incluir nome, telefone, e-mail, CPF, endereço, profissão, estado civil, observações, interesse, imóvel relacionado e documentos. No cadastro é necessário identificar a pessoa por ao menos nome, telefone ou e-mail; entradas públicas também dependem do contexto público, como imóvel ou slug do catálogo. Os demais campos são opcionais e podem ficar incompletos. Estados: `NEW`, `CONTACTED`, `NEGOTIATING`, `WON`, `LOST` e `ARCHIVED`. Histórico, origem, criação, atualizações e vínculos alimentam timeline, propostas, contratos, agenda e métricas. Conversão é derivada de leads ganhos, não uma informação inventada pelo COS.

## Diagnóstico de Clientes / Leads [DIAGNOSIS]

Se um lead não aparece, consultar corretor proprietário, origem, período, telefone/e-mail usados, status e filtros ativos. Se houver duplicidade ou origem inesperada, verificar se uma entrada manual, do COS ou do chat atualizou um registro pelo contato; esse fluxo pode sobrescrever a origem, enquanto entradas públicas não usam sempre a mesma deduplicação. Dados incompletos decorrem de campos opcionais ou de captação pública parcial. Para imóvel, proposta, documento ou histórico ausente, confirmar os IDs e vínculos persistidos. A resposta deve dizer a causa encontrada; sem consulta, deve apenas indicar essas verificações.

## O que o COS pode fazer em Clientes / Leads [ACTION]

Capabilities reais: `lead.create`, `lead.find`, `lead.summary`, `lead.summarize`, `lead.update`, `lead.timeline`, `lead.convert`, `lead.attach_document` e `lead.delete`. Atualização exige cliente resolvido; conversão e exclusão seguem confirmação do Registry. O COS não possui paridade para toda edição jurídica/documental avançada da tela, fusão explícita de duplicados ou correção automática da origem. Nunca escolher o registro mais recente como alvo de mutação sem evidência suficiente.

## O que é Imóveis [KNOWLEDGE]

Imóvel é o cadastro privado `Property`, criado manualmente, por IA ou importação. Guarda título, tipo, finalidade/status, preço, CEP e endereço, cidade/bairro, descrição, áreas, quartos, banheiros, vagas, imagens, capa, áudio, documentos e dados jurídicos. Para rascunho, título, tipo e finalidade/status são a base mínima; publicação exige readiness da superfície. Estados privados: `DRAFT`, `PUBLISHED` e `PAUSED`. Catálogo usa `published`; Marketplace usa `marketplacePublished`, de forma independente. A API aceita até seis imagens. Planos limitam a carteira a 5, 150 ou 1.000 imóveis. Imóveis alimentam Catálogo, Marketplace, Studio, clientes, propostas, contratos, documentos, compromissos e desempenho.

## Diagnóstico de Imóveis [DIAGNOSIS]

Para falha no Catálogo, verificar título, preço positivo, cidade, CRECI `VERIFIED`, limite do plano e propriedade do registro. Para Marketplace, verificar também bairro, descrição com ao menos 100 caracteres, de quatro a seis fotos, capa horizontal válida com pelo menos 1200x675, área positiva e, conforme o tipo residencial/construído, quartos, vagas e banheiro. Falha de imagem, áudio ou documento exige MIME, tamanho, URL e estado do storage; falha de IA exige provider, credencial, créditos e resultado persistido. Um imóvel publicado pode ficar incompleto após edição porque a readiness não é automaticamente revalidada. A UI Free ainda pode mencionar três imóveis, embora a regra atual seja cinco.

## O que o COS pode fazer em Imóveis [ACTION]

Capabilities reais: `property.create`, `property.search`, `property.get`, `property.description.improve`, `property.media.update`, `property.price.suggest`, `property.publish`, `property.unpublish` e `property.archive`. Publicar, remover mídia e arquivar seguem seleção/confirmação do Registry. A sugestão de preço usa comparáveis da carteira, não laudo externo. O COS não executa importação XML, cadastro completo pelas fotos, upload de áudio/documentos jurídicos nem toda edição disponível na UI. Existe inconsistência entre handlers de publicação do Catálogo: um valida readiness/limite e outro pode publicar sem a mesma checagem; o COS não deve afirmar uniformidade até o resultado real do handler.

## O que é Catálogo [KNOWLEDGE]

Catálogo é a vitrine pública individual do corretor ou imobiliária, acessada por slug próprio; não é o Marketplace agregado. Perfil pode conter nome, foto, headline, banner, experiência, vendas, área de atendimento, faixa de preço, cidades, bio, especialidades, diferenciais, vídeo e marca. Nome e slug sustentam a página; os demais campos são opcionais. Não existe enum global de catálogo ativo: a exposição decorre da URL e de cada imóvel com publicação de Catálogo. Eventos reais incluem visualização do catálogo e do imóvel, clique no WhatsApp, busca e outras interações. Eventos, leads e imóveis publicados alimentam desempenho.

## Diagnóstico de Catálogo [DIAGNOSIS]

Se o catálogo ou imóvel não aparece, consultar slug, proprietário, `published`, status do imóvel, readiness, CRECI e limite. Badges de ativo ou sincronizado na UI são informativos e não estados persistidos. Para métricas ausentes, conferir eventos, origem, período e deduplicação de 30 minutos; `catalog_search` não usa a mesma deduplicação. Remover do Catálogo não apaga o cadastro nem remove do Marketplace. Se o link falhar, validar slug e perfil público antes de atribuir problema à publicação.

## O que o COS pode fazer no Catálogo [ACTION]

Capabilities reais: `catalog.summary`, `catalog.analyze`, `catalog.publish`, `catalog.unpublish`, `catalog.share` e `catalog.stats`. Publicar e despublicar exigem imóvel resolvido e confirmação. O COS pode fornecer o link e métricas retornadas pelo handler; não deve inventar URL ou número. Não configura todos os campos visuais do perfil. A divergência de validação entre handlers de publicação deve ser tratada pelo resultado concreto, sem prometer readiness uniforme.

## O que é Marketplace [KNOWLEDGE]

Marketplace é a superfície pública agregada para descoberta de imóveis e corretores. Publicação é independente do Catálogo. Um perfil público requer corretor `ACTIVE` e ao menos um imóvel com `marketplacePublished`; configurações podem incluir região, especialidade, transações e apresentação. Conversas são `OPEN` ou `CLOSED`; mensagens podem ser de cliente ou corretor e dos tipos texto, imóvel ou proposta. Abrir conversa cria ou atualiza Lead; resposta do corretor pode marcar `CONTACTED` e nova mensagem do cliente pode marcar `NEW`. Avaliações são `PENDING_REVIEW`, `APPROVED` ou `REJECTED`, e apenas aprovadas entram na nota pública. Planos declaram Marketplace para Pro e Scale.

## Diagnóstico de Marketplace [DIAGNOSIS]

Para imóvel não publicado, verificar readiness completa, `marketplacePublished`, corretor ativo, CRECI, plano e vínculo. Para perfil ausente, verificar corretor ativo e existência de anúncio publicado. Para lead ausente, consultar conversa, telefone, brokerId, source e criação/atualização do Lead. Para avaliação ou nota, consultar moderação e usar apenas aprovadas. Inconsistências atuais: a rota de publicação não aplica diretamente a restrição Pro/Scale; o selo público pode considerar mera existência de CRECI em vez do status validado; o dashboard limita listagens a 30 e pode subcontar totais. Não apresentar essas divergências como regra uniforme.

## O que o COS pode fazer no Marketplace [ACTION]

Não há capability privada própria de Marketplace no Registry do COS. O assistente público e o runtime privado são fluxos distintos. O COS pode explicar regras e usar capabilities de imóveis, clientes, propostas e analytics quando elas realmente cobrem a solicitação, mas não pode publicar no Marketplace, administrar conversas, alterar perfil, moderar avaliações ou contatar um corretor por um handler privado inexistente. Nesses casos deve orientar pela interface, sem simular execução.

## O que é Studio IA [KNOWLEDGE]

Studio IA cria campanhas e assets a partir de imóvel, mídia, objetivo e provider. Campanhas: `DRAFT`, `PROCESSING`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `PUBLISHED` ou `FAILED`; assets usam os mesmos estados, sem `PROCESSING`. Fluxos reais incluem Instagram com feed/story/carrossel, campanha para compradores, captação de proprietários, venda de imóvel, preparação visual, construção/transformação, visualização de projeto e vídeo. Instagram exige imóvel, objetivo, provider, versão e foto real; vídeo usa asset aprovado, formato 9:16 ou 16:9, movimento/instrução e duração configurada. Outputs alimentam Biblioteca. Custos observados: Instagram 10 créditos; compradores, proprietários e venda 3; construção 40; importações inteligentes variam por fonte.

## Diagnóstico de Studio IA [DIAGNOSIS]

Em falha de geração, consultar campanha/asset, imóvel, foto original, MIME e tamanho, provider/modelo, credenciais, créditos, status, erro do job e gravação no storage. Foto precisa ser mídia válida do imóvel quando o fluxo a exige. Falha de provider não autoriza troca silenciosa. Se não houver saldo, explicar o custo confirmado do fluxo; não inventar custo ausente. Preparação e visualização não possuem débito EME universal observado. Imagem gerada é ilustrativa e não altera fatos do imóvel. Resultado aprovado é pré-requisito para alguns vídeos.

## O que o COS pode fazer no Studio IA [ACTION]

Capabilities reais: `studio.generateCampaign`, `studio.generateDescription`, `studio.generateFacebook`, `studio.generateInstagram`, `studio.generateStory`, `studio.generateVideo`, `studio.improveText` e `studio.regenerate`. Confirmação e seleção seguem o Registry. Gap crítico: os handlers atuais do COS usam fluxo determinístico `eme-cos`; a ação de vídeo produz roteiro, não o pipeline de vídeo da UI, e não representa provider/custo real. O COS também não cobre preparação visual, construção, visualização e todos os controles de campanha. Deve declarar o resultado efetivo do handler, nunca prometer paridade com o Studio visual.

## O que é Biblioteca [KNOWLEDGE]

Biblioteca organiza campanhas e assets produzidos no Studio. Permite localizar, filtrar, abrir detalhe, editar conteúdo, aprovar, rejeitar, publicar, renderizar, baixar, excluir e reutilizar itens quando o estado permite. Dados incluem campanha, tipo de asset, conteúdo, mídia, provider/modelo, status, timestamps, versão e vínculo com imóvel. Ela recebe outputs do Studio e pode fornecer um asset aprovado para vídeo ou reutilização. Estados seguem campanha/asset do Studio; publicação e aprovação são diferentes de geração concluída.

## Diagnóstico de Biblioteca [DIAGNOSIS]

Se um item não aparece, consultar brokerId, campanha, asset, filtros, status e data. Se não puder baixar, publicar ou reutilizar, verificar URL/storage, renderização e se o asset está aprovado. Asset `FAILED` exige erro de geração; `PENDING_REVIEW` ainda depende de revisão. Exclusão ou mudança de estado não deve ser inferida apenas pelo texto retornado. Conteúdo ausente pode resultar de job concluído sem persistência ou falha de storage.

## O que o COS pode fazer na Biblioteca [ACTION]

Não existe capability dedicada de Biblioteca no Registry atual. As capabilities do Studio geram conteúdo, mas não oferecem paridade para listar, editar, aprovar, rejeitar, publicar, excluir, renderizar ou baixar assets. O COS deve orientar o caminho na Biblioteca ou usar somente uma capability de Studio compatível; não pode afirmar que alterou o estado de um asset.

## O que é Propostas [KNOWLEDGE]

Proposta é um `BrokerDocument` do tipo `proposal`, ligado opcionalmente a cliente e imóvel. Guarda dados manuais ou vinculados, valor/condições, observações, conteúdo gerado, status e histórico. Para criar pelo fluxo conversacional, cliente e imóvel precisam estar resolvidos; campos comerciais adicionais podem ser opcionais e revisados depois. Estados operacionais: rascunho, gerada, assinada e arquivada. Proposta não vira contrato automaticamente. Pode alimentar negociação, conversa do Marketplace e contrato posterior.

## Diagnóstico de Propostas [DIAGNOSIS]

Se a proposta estiver incompleta, consultar IDs de cliente e imóvel, dados obrigatórios do documento, condições, conteúdo e status. Cliente ou imóvel ambíguo exige seleção, não escolha automática. Se não aparece, verificar brokerId, tipo `proposal`, filtros e arquivamento. Compartilhamento no Marketplace exige proposta compatível com a conversa. Assinada é estado registrado; não implica assinatura digital nativa.

## O que o COS pode fazer em Propostas [ACTION]

Capabilities reais: `proposal.create` e `proposal.summary`. O COS cria proposta básica com cliente/imóvel selecionados e consulta resumo/lista. Não possui capabilities para edição comercial completa, assinatura, arquivamento, exclusão, PDF ou compartilhamento. Deve orientar essas operações na interface e não tratar proposta como contrato.

## O que é Contratos [KNOWLEDGE]

O fluxo atual possui `Template`, `Version` e `Instance`, além de documentos legados. Template importado aceita PDF ou DOCX, passa por análise/extração e pode ficar `ANALYZING`, `REVIEW_REQUIRED`, `READY` ou `FAILED`. Instância usa versão, bindings e dados de cliente, imóvel, corretor e partes adicionais; estados: rascunho, aguardando assinatura, assinado ou cancelado. Readiness compara campos obrigatórios preenchidos com o total. PDF final e envio para assinatura exigem 100%; PDF de rascunho pode ser gerado antes. Nova versão é criada quando a estrutura muda e a versão atual já foi usada. Marcar assinado registra assinatura externa, não e-sign certificada nativa.

## Diagnóstico de Contratos [DIAGNOSIS]

Para template falho, consultar arquivo, MIME, extração, status e erro da análise. Para contrato incompleto, consultar versão, bindings, cliente, imóvel, corretor, partes adicionais e lista de campos pendentes; não inferir readiness pela existência de PDF. Envio ou PDF final bloqueado normalmente indica readiness abaixo de 100%, template não pronto ou arquivo ausente. Se o contrato não aparece, verificar brokerId, modelo legado versus instância e status. Alteração estrutural após uso deve gerar nova versão.

## O que o COS pode fazer em Contratos [ACTION]

Capabilities reais: `contract.create`, `contract.list`, `contract.get`, `contract.update`, `contract.preview`, `contract.download`, `contract.history`, `contract.send`, `contract.sign` e `contract.cancel`. Operações sensíveis seguem seleção e confirmação. Gap crítico: handlers conversacionais operam principalmente o modelo legado `BrokerDocument` e não têm paridade garantida com importação, análise, versões, bindings e readiness do motor de templates; `send` pode apenas mudar estado. O COS deve descrever o resultado real e não afirmar validação jurídica ou assinatura nativa.

## O que é Documentos [KNOWLEDGE]

Documentos aparecem em `BrokerDocument` e em dados documentais de clientes e imóveis. Podem representar propostas, contratos e anexos, com nome, tipo, URL/conteúdo, vínculo, status e datas. PDFs anexados a cliente ficam ligados ao Lead; documentos jurídicos de imóvel podem estar em estruturas JSON. Campos exigidos dependem do fluxo, mas arquivo válido, proprietário e entidade de destino são necessários para anexar. Documentos alimentam histórico do cliente, imóvel, proposta e contrato; não são o chat do Marketplace.

## Diagnóstico de Documentos [DIAGNOSIS]

Em upload falho, consultar extensão/MIME, tamanho, URL, storage, brokerId e entidade vinculada. Se o documento não aparece, verificar tipo, filtros, Lead/Property/Contract correto e persistência do vínculo. Conteúdo extraído ausente em contrato pode ser falha de análise, não de upload. O COS não deve dizer que um arquivo está válido apenas porque recebeu o nome; precisa do resultado do handler/storage.

## O que o COS pode fazer em Documentos [ACTION]

Capabilities reais: `document.list`, `document.get` e `lead.attach_document`. O anexo conversacional disponível é PDF ligado a cliente. Não há capabilities gerais para anexar a imóvel/contrato, editar metadados, extrair, substituir, excluir ou compartilhar documentos. Quando a operação não existir, orientar a tela correspondente.

## O que é Compromissos [KNOWLEDGE]

Agenda registra compromissos com título, tipo, data, horário, cliente, imóvel, notas e status. Tipos: visita, lembrete, evento e tarefa. Estados: pendente, concluído ou cancelado. Título, data e contexto temporal são essenciais; horário, vínculos e notas podem ser opcionais conforme o fluxo. Compromissos recebem clientes e imóveis e alimentam agenda diária, semanal e mensal, histórico de atendimento e contexto operacional.

## Diagnóstico de Compromissos [DIAGNOSIS]

Se um compromisso não aparece, consultar brokerId, período, timezone, status, filtros, cliente/imóvel e data persistida. Para “o que tenho amanhã”, usar consulta real da agenda, nunca conhecimento estático. Conflitos de horário não são detectados por capability atual. Cancelado e concluído são estados distintos; reabrir não é coberto pelo COS. Data ambígua deve ser esclarecida antes da criação.

## O que o COS pode fazer em Compromissos [ACTION]

Capabilities reais: `agenda.create`, `agenda.list`, `agenda.today`, `agenda.week`, `agenda.month`, `agenda.update`, `agenda.complete` e `agenda.cancel`. Cancelamento exige confirmação e seleção quando aplicável. O COS não reabre compromisso, não detecta conflito automaticamente e não oferece toda edição avançada da interface.

## O que é Desempenho [KNOWLEDGE]

Desempenho deriva métricas de `CatalogEvent`, eventos de busca, Leads e Properties. Pode apresentar visualizações de Catálogo, Marketplace e imóveis, cliques/WhatsApp, contatos, buscas, leads, origens, períodos, imóveis monitorados, rankings e buscas recentes. Filtros reais incluem 7, 30, 90 dias ou todo o período, imóvel, origem e consulta. `totalViews` combina páginas de Catálogo e Marketplace conforme a agregação atual. Conversão deriva de Lead `WON`. Eventos usam deduplicação de 30 minutos, exceto busca de Catálogo. Avaliação pública não é desempenho operacional.

## Diagnóstico de Desempenho [DIAGNOSIS]

Para número inesperado, consultar período, origem, tipo de evento, imóvel, deduplicação, brokerId e limite da consulta. Comparações Catálogo x Marketplace exigem separar source; não atribuir total combinado a uma única superfície. Para “qual imóvel teve mais cliques” ou “quantos leads vieram do Marketplace”, consultar eventos/leads atuais e ranking, nunca responder com regra estática. Dashboard do Marketplace limitado a 30 pode subcontar. Métrica zero pode significar evento não registrado, filtro incorreto ou ausência real.

## O que o COS pode fazer em Desempenho [ACTION]

Capabilities reais: `analytics.summary`, `analytics.performance`, `analytics.properties`, `analytics.leads` e `analytics.sales`. Elas consultam agregados atuais, mas não cobrem todos os filtros, rankings, buscas recentes e separações da UI. Há divergência conhecida: respostas do COS podem rotular visualizações combinadas como Catálogo. O COS deve usar os campos retornados e explicitar a origem disponível, sem fabricar granularidade.

## O que é Histórico [KNOWLEDGE]

Histórico de conversas reutiliza `BrokerDocument` do tipo `cos_conversation`, mensagens `EmeMessage`, interações do assistente, workflow, memória e snapshot. Conversas podem ser agrupadas em Hoje, Últimos 7 dias e anteriores, pesquisadas, renomeadas e arquivadas. Categorias incluem clientes, imóveis, propostas, contratos, agenda, Studio, consultas e geral. Ao abrir uma conversa, o COS recupera mensagens e contexto persistidos; a rota antiga pode permanecer como dependência interna, mas não é a navegação principal.

## Diagnóstico de Histórico [DIAGNOSIS]

Se uma conversa não aparece, consultar brokerId, tipo do documento, arquivamento, busca, data de atualização e existência de mensagens. Se abre sem contexto, verificar snapshot, entidades ativas, pending e resultados recentes. Renomear não altera mensagens; arquivar não equivale a excluir. O COS não deve alegar memória infinita: o contexto operacional é compacto e a conversa persistida é a fonte para retomada.

## O que o COS pode fazer no Histórico [ACTION]

O runtime do COS já abre e persiste conversas reais, mas não há domínio de capability dedicado para listar, buscar, renomear, arquivar, restaurar, exportar ou excluir histórico. Essas ações existentes na interface não devem ser simuladas por `general.chat`. O COS pode continuar a conversa carregada e orientar a gestão no sidebar.

## O que é Plano / Créditos [KNOWLEDGE]

Planos atuais: Free, R$ 0, 5 imóveis e 30 créditos mensais; Pro, R$ 129, 150 imóveis e 500 créditos; Scale, R$ 389, 1.000 imóveis e 2.000 créditos. Pacotes de créditos: 250/R$29, 750/R$79, 1.500/R$139 e 3.000/R$249. Pacotes de imóveis: +50/R$49, +100/R$89 e +200/R$159, aplicados somente a assinatura paga elegível e ativa. Créditos mensais são consumidos antes dos extras; o ledger registra concessão, consumo e estorno. Saldo, uso e assinatura são dados atuais e precisam ser consultados. Marketplace é declarado comercialmente para Pro e Scale.

## Diagnóstico de Plano / Créditos [DIAGNOSIS]

Para falta de crédito, consultar conta do plano, saldo mensal, saldo extra, ledger, custo da operação e possível estorno. Para limite de imóveis, consultar plano normalizado, assinatura, pacote extra ativo e total de imóveis considerado pelo enforcement. Para Marketplace, comparar plano comercial, assinatura, CRECI e a rota efetivamente usada; a publicação não aplica a regra Pro/Scale de forma uniforme. Mensagem antiga de limite Free pode mostrar três, embora o limite atual seja cinco. Checkout, pagamento ou renovação exigem status real, não inferência pelo nome do plano.

## O que o COS pode fazer em Plano / Créditos [ACTION]

Não há capability dedicada para consultar saldo/ledger, alterar plano, comprar pacote, abrir checkout, cancelar ou renovar assinatura. O COS pode explicar valores e regras canônicas, mas uma pergunta como “quantos créditos tenho?” exige dado atual e não pode ser respondida com a franquia do plano. Deve orientar a área de Plano/Créditos quando não houver consulta real disponível.

## O que é Conta / CRECI / Segurança [KNOWLEDGE]

Conta reúne identidade e acesso. Nome, e-mail, telefone e CRECI são dados centrais; UF é exigida ao alterar a identificação profissional. Foto, descrição, marca, logo, marca d'água e outros dados são opcionais. CRECI pode estar `VERIFIED`, `REJECTED`, `REVIEW_REQUIRED` ou `PENDING`. Causas registradas incluem ativo, não encontrado, entrada inválida, inativo, nome divergente, resposta ambígua, timeout, configuração, autenticação, pagamento, rate limit e erro do provider Imobisec. Publicação no Catálogo exige `VERIFIED`. Segurança inclui PIN, dispositivo confiável, biometria/passkeys e revogação de dispositivos.

## Diagnóstico de Conta / CRECI / Segurança [DIAGNOSIS]

Para CRECI não validado, consultar número, UF, nome, status, motivo, tentativa e resposta do provider; traduzir o motivo sem inventar aprovação. Timeout/rate limit/provider pedem nova tentativa posterior; `NOT_FOUND`, inativo ou nome divergente pedem correção ou revisão. Para publicação bloqueada, confirmar `VERIFIED`, não apenas CRECI preenchido. Em acesso, consultar dispositivo, desafio, PIN e sessão. Há inconsistência entre fluxos que mencionam PIN de quatro e validação atual de seis dígitos; o COS deve orientar seis e reconhecer a divergência se a UI mostrar quatro.

## O que o COS pode fazer em Conta / CRECI / Segurança [ACTION]

Não há capabilities para editar conta, validar/revalidar CRECI, alterar senha/PIN, registrar biometria/passkey, confiar ou revogar dispositivo. O COS pode diagnosticar somente se receber estados reais por outro contexto; sem isso, orienta a tela de Conta/Segurança e o significado dos motivos. Nunca deve afirmar que verificou CRECI apenas pela existência do número.

## O que é Notificações [KNOWLEDGE]

Notificações registram título, mensagem, leitura, arquivamento e datas. A interface permite listar, marcar uma ou todas como lidas e arquivar. Elas podem refletir eventos internos de operação, mas não substituem o histórico da entidade. Notificação lida continua existente; arquivada sai da visão principal conforme o filtro. A serialização antiga pode usar categoria administrativa genérica, sem representar a origem precisa.

## Diagnóstico de Notificações [DIAGNOSIS]

Se uma notificação não aparece, consultar brokerId/usuário, `read`, `archivedAt`, filtros, criação e origem. Contador incorreto exige comparar não lidas com arquivadas. Categoria genérica não comprova que a origem foi administrativa. Ausência de notificação não prova que a operação falhou; consultar também a entidade e o resultado da execução.

## O que o COS pode fazer em Notificações [ACTION]

Não há capabilities de usuário para listar, ler, marcar como lida ou arquivar notificações. `operation.summary` não deve ser tratado como gestão completa da central. O COS deve orientar a interface e não simular alteração de leitura ou arquivamento.

## O que é Suporte / Corretor EME [KNOWLEDGE]

Suporte combina orientação operacional e canais humanos. A tela atual contém FAQ e links de WhatsApp/e-mail. O indicador “Tudo funcionando” é estático e não é health check. Corretor EME possui configuração preparatória com WhatsApp, nome de exibição, mensagem inicial, notas, provider, phone number id, verify token, status e webhook. Estados: `IN_PREPARATION`, `REQUESTED`, `ACTIVE` e `PAUSED`; webhook pode estar `NOT_CONFIGURED`. A integração real de WhatsApp do Corretor EME ainda não está ativa; esses campos não significam disponibilidade operacional.

## Diagnóstico de Suporte / Corretor EME [DIAGNOSIS]

Para problema operacional, identificar domínio, entidade, brokerId, status, validações, limites, provider/storage e último erro antes de orientar. O COS deve consultar dado atual quando houver capability e usar esta base apenas para interpretar. Para Corretor EME, verificar status, provider, identificadores e webhook, mas informar que a integração não está ativa. O badge estático de saúde não confirma APIs, banco, IA, storage ou terceiros. Se não houver estado consultável, pedir apenas o dado mínimo ou orientar o canal humano.

## O que o COS pode fazer em Suporte / Corretor EME [ACTION]

Capabilities de orientação: `help.first_steps`, `help.use_cos`, `help.register_properties`, `help.manage_clients`, `help.contracts_proposals`, `help.marketing_studio`, `help.general_question` e `general.chat`. O COS deve responder curto, localizar o domínio e, quando existir capability real, consultar ou executar com seleção, validação e confirmação. Não há capability para configurar/ativar Corretor EME, testar webhook, abrir chamado ou verificar saúde global. Gaps devem ser assumidos como limites atuais, não implementados por improviso.

## Fluxos transversais do EME [KNOWLEDGE]

Jornadas canônicas: lead → cliente → imóvel → proposta → contrato → compromisso; imóvel → Catálogo → lead → Desempenho; imóvel → Marketplace → conversa → lead → proposta; imóvel → Studio → Biblioteca; conta/CRECI/plano → permissões e limites de publicação. Cada seta exige vínculo ou evento real. Catálogo e Marketplace compartilham imóvel e perfil, mas possuem publicação, exposição, assistentes, leads e métricas distintas. Nenhum estado posterior deve ser inferido apenas porque o anterior existe.
