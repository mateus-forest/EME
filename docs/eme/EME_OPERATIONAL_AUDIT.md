# Mapa Operacional do EME para cenários do COS

> Auditoria estática do Portal do Corretor em 17/08/2026. O código atual é a fonte principal. Este documento descreve o produto como ele está; não propõe nem implementa mudanças.

## 1. Resumo executivo

O EME atual é um sistema operacional para o corretor que combina cadastro e divulgação de imóveis, relacionamento com clientes, produção de material, documentos comerciais, agenda, indicadores e gestão de assinatura. A entidade que delimita quase toda a operação é `Broker`; imóveis, leads, eventos, documentos, campanhas, conversas, créditos e configurações são associados ao corretor autenticado.

Foram auditados **15 módulos funcionais** do escopo solicitado e **3 superfícies auxiliares/legadas**. O COS possui **74 capabilities registradas, 74 actions únicas e 74 handlers**, distribuídos em 12 domínios. Desse total, 28 capabilities são mutações, 18 declaram confirmação e 28 declaram necessidade de seleção. Os invariantes do Registry impedem capability duplicada, action duplicada, descriptor inválido, handler ausente e handler órfão.

O COS cobre bem consultas e operações básicas de clientes, imóveis, compromissos e documentos legados. A maior distância para o produto aparece onde a UI evoluiu para modelos mais ricos: contratos baseados em Template → Version → Instance, comunicação e avaliações do Marketplace, Biblioteca do Studio, perfil público do Catálogo, segurança/Plano e os campos jurídicos/documentais completos de clientes e imóveis.

Há ainda diferenças de regra que importam para cenários reais. Em especial, a publicação feita pelo COS não passa sempre pelas mesmas verificações da UI/API; a disponibilidade do Marketplace é anunciada somente para Pro/Scale, mas não está uniformemente bloqueada no backend; e os números financeiros produzidos pelo COS são projeções operacionais, não lançamentos contábeis reais.

### Escopo e método

- Fontes prioritárias: `prisma/schema.prisma`, rotas em `app/api`, páginas em `app/corretor`, componentes, services em `lib`, Registry/handlers em `lib/cos` e, por último, documentação em `knowledge/eme` e `docs/cos`.
- Auditoria estática: contratos de API e ramificações de código foram inspecionados; não houve alteração de banco nem execução de ações reais.
- Portal Master/Admin foi consultado apenas para entender moderação de avaliações, validação e relações que afetam o corretor.
- Quando UI, API, COS e documentação divergem, este relatório registra separadamente o comportamento encontrado.

## 2. Mapa global dos módulos

| Módulo | Núcleo de dados | Produz/altera | Consumido por |
| --- | --- | --- | --- |
| COS | `EmeMessage`, `AiAssistantInteraction`, `BrokerDocument` de conversa, workflows | consultas, mutações nos módulos, notificações, consumo de créditos | Histórico, Clientes, Imóveis, Agenda, documentos, indicadores |
| Clientes | `Lead` e documentos anexos | relacionamento, qualificação, vínculo com imóvel | Propostas, Contratos, Agenda, Marketplace, Desempenho |
| Imóveis | `Property` e mídia/documentos | carteira, publicação, base comercial | Catálogo, Marketplace, Studio, Propostas, Contratos, Financeiro, Desempenho |
| Catálogo | perfil de `Broker`, `Property`, `CatalogEvent`, `SearchEvent` | vitrine pública, interesse e eventos | Clientes, Desempenho, compartilhamento |
| Marketplace | perfil do corretor, propriedades, conversas, mensagens e avaliações | lead, conversa, reputação | Clientes, Propostas, Desempenho |
| Studio IA | `StudioCampaign`, `StudioCampaignAsset` | conteúdo e campanhas | Biblioteca, Imóveis |
| Biblioteca | campanhas e assets do Studio | revisão, aprovação, download e derivações | Studio e canais externos manuais |
| Propostas | `BrokerDocument` do tipo proposta | documento comercial | Clientes, Imóveis, Marketplace, Contratos |
| Contratos | Templates, Versions, Instances e `BrokerDocument` | documento, readiness, PDF e estado de assinatura | Clientes, Imóveis, Histórico documental |
| Compromissos | `AgendaEvent` | tarefas, visitas e lembretes | Clientes, Imóveis, COS |
| Financeiro | `Property`, contratos e `BrokerFinancialConfig` | estimativas de carteira e comissão | COS e decisão operacional |
| Desempenho | eventos, buscas, leads e propriedades | métricas de aquisição e procura | decisão comercial e COS |
| Histórico | conversas COS, mensagens e interações | continuidade, renomeação e exclusão | COS |
| Plano | assinatura, conta do plano, créditos, pacotes e Stripe | limites, saldo e entitlement | Imóveis, COS, Studio, Marketplace |
| Conta | `User`, `Broker`, dispositivos e passkeys | identidade, CRECI, marca e segurança | Catálogo, Marketplace, Studio, publicação |

### Superfícies auxiliares encontradas

- `/corretor/corretor-eme`: solicitação/configuração de atendimento por WhatsApp (`BrokerEmeConfig`) e últimas mensagens. Não aparece no menu principal; a tela ainda comunica partes como futuras, embora o webhook já contenha resolução de corretor e qualificação de lead.
- `/corretor/corretor-m`: interface legada “Assessor EME”, usando a mesma API `/api/assistant/eme`, toggle de IA, pedido de créditos via notificação e últimas mensagens. Não aparece no menu e usa terminologia anterior ao COS.
- `/corretor/suporte`: FAQ e canais de WhatsApp/e-mail. O estado “Tudo funcionando normalmente” é estático, não health check. `/corretor/leads` apenas redireciona para Clientes.

## 3. Entidades e estados transversais

### Principais entidades

- Identidade e conta: `User`, `Broker`, `UserTrustedDevice`, `UserPasskeyCredential`, `BrokerPlanAccount`, `Subscription`.
- Operação comercial: `Property`, `Lead`, `AgendaEvent`, `BrokerDocument`.
- Contratos estruturados: `ContractTemplate`, `ContractTemplateVersion`, `ContractTemplateInstance`.
- Divulgação: `CatalogEvent`, `SearchEvent`, `StudioCampaign`, `StudioCampaignAsset`.
- COS: `EmeMessage`, `AiAssistantInteraction`, `BrokerDocument` de conversa e workflow, telemetria e notificações.
- Monetização: `AiCreditTransaction`, `ExtraPackagePurchase` e registros de assinatura.
- Marketplace: `MarketplaceConversation`, `MarketplaceMessage`, `MarketplaceReview` e mídia regional.

### Estados que atravessam o sistema

- Imóvel: `DRAFT`, `PUBLISHED`, `PAUSED`; publicação no Catálogo (`published`) e no Marketplace (`marketplacePublished`) são flags separadas.
- Lead: `NEW`, `CONTACTED`, `NEGOTIATING`, `WON`, `LOST`, `ARCHIVED`.
- CRECI: o selo público é derivado de `creciValidationStatus === VERIFIED`; não é campo manual.
- Contrato legado: rascunho, aguardando assinatura, assinado, concluído e cancelado. A engine estruturada acrescenta estados de análise/revisão do template e readiness da instância.
- Campanha/asset: rascunho, processando, revisão pendente, aprovado, rejeitado, publicado ou falha.
- Conversa Marketplace: aberta ou fechada; avaliação passa por revisão/moderação.
- Assinatura: trial, ativa, vencida e cancelada, com regras próprias para manutenção temporária do plano.

## 4. Auditoria módulo por módulo

## 4.1 COS

### O que é e para que serve

É a camada conversacional do portal. Interpreta a intenção, resolve entidades, mantém estado de workflow, planeja steps e chama handlers do Registry. Serve para consultar a operação e executar tarefas sem navegar por todos os formulários.

### Tela, dados, ações e estados

- A tela principal tem conversa contínua, sugestões apenas quando vazia, composer com anexos/voz, saldo de créditos e painel “Saúde da operação”. No mobile o painel vira drawer.
- O painel agrega completude de clientes e imóveis, documentos não rascunho, contratos não cancelados, compromissos vencidos e leads novos. É saúde operacional, não parecer jurídico.
- Conversas usam `BrokerDocument` do tipo `cos_conversation`; mensagens usam `EmeMessage`; decisões/execuções usam `AiAssistantInteraction`. Workflows pendentes também ficam persistidos para retomada.
- Atos reconhecidos: executar, consultar, explicar, perguntar capacidade, corrigir, confirmar, rejeitar, cancelar, selecionar, trocar de assunto, retomar assunto, fornecer dado, social e desconhecido.
- Anexos aceitam imagens, PDF/DOC/DOCX/XML/TXT/CSV/JSON e vídeo. Imagens até 8 MB e PDFs até 5 MB podem ser processados inline. Há heurística para reduzir confiança em conteúdo suspeito ou instruções injetadas em anexos.
- O custo final considera os steps concluídos e ignora resultados marcados `noCharge`. Ajuda é gratuita; consultas simples normalmente custam menos que ações e workflows maiores. Saldo insuficiente retorna bloqueio de pagamento.

### Regras e integrações

- O Decision Layer combina ato, domínio, confiança, referência ao histórico, workflow pendente e seleções. Perguntas explicativas podem interromper um fluxo sem descartá-lo; confirmação, rejeição e cancelamento tratam o estado pendente.
- Receitas multi-step existentes: cliente → proposta → agenda; cliente → proposta; proposta → agenda; contrato criar → enviar; análise operacional; preparação de imóvel para venda; publicação em catálogo → campanha.
- A análise de anexos de imóvel pode extrair dados e salvar a primeira imagem antes da confirmação final; uma desistência posterior pode deixar mídia sem imóvel associado.
- O COS grava efeitos nos módulos pelos handlers e também alimenta Histórico, consumo de crédito, telemetria e notificações.

### O COS já consegue

As 74 capabilities são detalhadas no Mapa Global do COS. Em alto nível: ajuda e conversa; CRUD parcial de clientes; criação, consulta, publicação e mídia parcial de imóveis; catálogo; agenda; propostas; contratos legados; documentos; indicadores; finanças estimadas; Studio parcial; saúde operacional.

### O COS não consegue hoje

- Operar Marketplace, Biblioteca, Plano, checkout, perfil/segurança da Conta ou configuração pública completa do Catálogo.
- Usar a engine moderna de contratos baseada em Template/Version/Instance.
- Reproduzir toda a riqueza dos formulários de clientes e imóveis ou todos os geradores reais do Studio.
- Administrar o próprio Histórico (renomear/apagar) por capability, embora a UI faça isso diretamente.

### O COS deveria conseguir, por derivação natural

Tudo que já existe como operação autenticada e delimitada ao corretor é candidato natural: publicar no Marketplace com as regras existentes; responder/fechar conversa; revisar Biblioteca; operar instâncias de contrato; consultar plano/saldo; editar perfil e catálogo; administrar anexos e campos completos. Isso é uma lacuna de exposição, não uma sugestão de feature nova.

### Informações necessárias e situações reais

- Execução: intenção, alvo inequívoco ou seleção, campos obrigatórios do módulo, confirmação quando destrutiva/sensível e créditos quando aplicável.
- Situações: consulta rápida, ação direta, correção de campo, desambiguação entre homônimos, confirmação, cancelamento, retomada, referência por pronome, análise de arquivo, ação multi-step e pedido não suportado.

### Limitações e divergências

- O Registry atual está íntegro, mas `docs/cos-capability-coverage.md` ainda informa 64 capabilities e `docs/cos/COS_ACTION_INVENTORY.md` registra o estado antigo de 73 descriptors/72 actions/71 handlers. `knowledge/eme/15-capacidades-cos.md` é a documentação que coincide com as 74 atuais.
- Algumas capabilities compartilham handlers simples com menos fidelidade que a UI; “capability presente” não significa paridade funcional do módulo.

## 4.2 Clientes

### O que é, propósito e tela

É o CRM leve do corretor. A tela mostra totais e funil, busca por nome/CPF/telefone/imóvel, filtros por estágio e cards/lista com o cliente selecionado. O detalhe reúne contato, interesse, dados civis, endereço, representação, notas e documentos.

### Dados, ações e estados

- Entidade principal: `Lead`, opcionalmente ligada a `Property`, `Broker`, usuário e origem. Guarda contato, intenção/mensagem, termos de busca, estado, dados civis, endereço, representação e documentos.
- Ações: criar, consultar, editar, excluir com confirmação, trocar estágio, vincular imóvel, abrir WhatsApp, criar proposta, anexar/abrir/remover documentos e consultar CEP.
- Estados reais: novo, contatado, negociando, ganho, perdido e arquivado. A UI também apresenta agrupamentos como visita, ativos e vendidos a partir desses dados.
- Origem distingue cadastro manual, catálogo, Marketplace, WhatsApp/landing e entradas atribuídas ao assistente.

### Regras e integrações

- Criação manual exige ao menos nome, e-mail ou telefone; e-mail é validado e imóvel deve pertencer ao corretor. A API pode atualizar um lead já existente por telefone/e-mail.
- Entradas públicas exigem contexto de propriedade ou catálogo. Conversa do Marketplace cria/enriquece lead; primeira resposta do corretor pode movê-lo para contatado.
- Cliente alimenta Propostas, Contratos, Compromissos, Marketplace e métricas de Desempenho.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** criar, localizar, resumir, atualizar, excluir, converter, obter timeline e anexar PDF.
- **Não consegue:** manipular com paridade todos os dados civis/endereço/representação, administrar cada anexo, abrir WhatsApp ou cobrir o mesmo tratamento documental da tela. O anexo via COS é PDF e não recebe a análise estrutural dos contratos.
- **Deveria conseguir:** as operações já presentes na UI/API sobre dados completos e documentos do próprio lead.

### Informações necessárias e situações reais

- Criar: ao menos nome/e-mail/telefone; imóvel/interesse e origem quando conhecidos. Editar/excluir/anexar: cliente inequívoco, campos ou arquivo; exclusão exige confirmação.
- Situações: localizar contato, corrigir telefone/CPF, qualificar, associar imóvel, recuperar histórico, converter lead, anexar procuração, remover duplicata, criar proposta e agendar visita.

### Limitações/divergências

A UI modela um cadastro jurídico/documental mais rico que o contrato conversacional. Alguns nomes de filtro são conceitos de apresentação e não novos estados de banco.

## 4.3 Imóveis

### O que é, propósito e tela

É a carteira de propriedades. Mostra indicadores, busca/filtros, cards com status, publicação, visualizações e leads; oferece cadastro manual/IA/importação, detalhe/edição, mídia, documentos e ações comerciais.

### Dados, ações e estados

- `Property` guarda código público, título/descrição, preço em centavos, finalidade/tipo, localização, proprietário, quartos/suítes/banheiros/vagas, mídia, dados legais, documentos, views/leads e vínculos.
- Ações: criar, importar anúncio/XML, extrair com IA, editar, consultar, anexar imagens/áudio/documentos, publicar/pausar, publicar separadamente no Catálogo e Marketplace, abrir propostas e excluir permanentemente com confirmação.
- Estados: rascunho, publicado ou pausado; `published` e `marketplacePublished` têm ciclos independentes.

### Regras e integrações

- Cadastro básico exige título, cidade, bairro, preço positivo, tipo e status.
- Catálogo exige título, preço, cidade e CRECI verificado.
- Marketplace exige também bairro, área positiva, finalidade/tipo, dormitórios em residencial, banheiros, vagas quando aplicável, descrição com pelo menos 100 caracteres e 4–6 imagens válidas JPG/PNG/WebP, resolução mínima equivalente a 1200×675 e capa horizontal.
- Limite de carteira vem do plano e pacotes. Imóveis alimentam Catálogo, Marketplace, Studio, Propostas, Contratos, Agenda, Financeiro e Desempenho.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** criar rascunho, buscar/obter, melhorar descrição, publicar/despublicar, atualizar URLs de mídia, sugerir preço e arquivar/excluir.
- **Não consegue:** edição integral, importação de anúncio/XML, áudio, dados legais/documentos, ordenação/validação completa de imagens e publicação específica no Marketplace.
- **Deveria conseguir:** acionar os mesmos endpoints e validadores existentes para essas operações, sempre com seleção e confirmação equivalentes.

### Informações necessárias e situações reais

- Criar: título, cidade, bairro, preço, tipo e status; complementos de características e mídia. Publicar: imóvel selecionado, readiness, CRECI e limite. Marketplace: todos os campos e imagens adicionais.
- Situações: corrigir preço/endereço, comparar carteira, melhorar texto, importar anúncio, trocar capa, identificar pendências, publicar em um ou dois canais, pausar e excluir.

### Limitações/divergências

- `catalog.publish` no COS altera a publicação sem reproduzir readiness, CRECI e limite; `property.publish` verifica readiness, mas não o limite do plano.
- A API de publicação tradicional usa uma contagem que inclui DRAFT/PUBLISHED/PAUSED e adiciona uma unidade; um rascunho já contado pode ser bloqueado ao publicar no limite exato.
- A UI anuncia Marketplace apenas em Pro/Scale, mas o endpoint de Marketplace não aplica de forma uniforme esse entitlement.

## 4.4 Catálogo

### O que é, propósito e tela

É a vitrine pública individual do corretor. No Portal, o corretor configura slug, identidade e apresentação; no público há header, banner/perfil, métricas, busca, imóveis, sobre, contato, vídeo opcional e Assistente EME limitado aos imóveis daquele catálogo.

### Dados, ações e estados

- Usa campos do `Broker` para nome público, slug, headline, banner, bio, tempo de atuação, imóveis vendidos, área/cidades/faixa de preço, especialidades, diferenciais e vídeo. CRECI/selo vêm da conta.
- Usa somente propriedades do corretor com `published=true` e `status=PUBLISHED`.
- Ações: salvar perfil, fazer upload/remover banner e vídeo, copiar/compartilhar URL, navegar/buscar/filtrar, abrir imóvel, favoritar, manifestar interesse, chamar WhatsApp e abrir contato/assistente.
- Eventos reais: visualização do catálogo/imóvel, WhatsApp e pesquisa; há deduplicação temporal e incremento de views.

### Regras e integrações

- Slug é único. Experiência aceita 0–100 anos; vendidos 0–1.000.000; listas até 16 itens de até 120 caracteres.
- Banner aceita JPG/PNG/WebP e vídeo MP4/WebM/QuickTime, com upload direto limitado a 4 MB no fluxo atual. URLs públicas persistidas devem ser HTTPS.
- Catálogo público exige corretor ativo. Interesse público cria lead; eventos e buscas alimentam Desempenho; Assistente reutiliza o motor local do Marketplace, mas recebe somente as propriedades já filtradas do catálogo.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** resumo, análise, estatísticas, compartilhar e publicar/despublicar imóvel no catálogo.
- **Não consegue:** configurar slug, hero, bio, métricas, listas, banner/vídeo e contato; nem consultar/alterar eventos com os filtros completos da tela.
- **Deveria conseguir:** ler/editar os mesmos campos de perfil e mídia existentes e explicar pendências reais de publicação.

### Informações necessárias e situações reais

- Configurar: campos desejados e mídia; publicar: imóvel e readiness; compartilhar: slug público válido.
- Situações: trocar banner, corrigir bio, verificar selo, publicar imóvel, descobrir por que algo não aparece, analisar buscas, abrir contato ou restringir recomendação ao próprio portfólio.

### Limitações/divergências

O Portal pode apresentar o catálogo como configurado/ativo mesmo quando conta, CRECI ou carteira não produzem uma experiência pública completa. A capability de publicação do COS é mais permissiva que o fluxo normal.

## 4.5 Marketplace dentro do Portal

### O que é, propósito e tela

É o workspace de exposição e atendimento no Marketplace público. Mostra conversas abertas, leads de origem Marketplace, imóveis publicados, avaliações pendentes, configuração do perfil e prévia pública.

### Dados, ações e estados

- Entidades: campos Marketplace do `Broker`, `Property.marketplacePublished`, `MarketplaceConversation`, `MarketplaceMessage`, `MarketplaceReview` e `Lead`.
- Ações: configurar especialidade/região/modalidade/sobre, publicar imóveis pelo módulo de Imóveis, responder conversa, compartilhar imóvel ou proposta compatível, fechar conversa e solicitar/receber avaliação.
- Conversas: abertas/fechadas. Mensagens: cliente/corretor e texto/imóvel/proposta. Avaliação: 1–5, pendente de revisão, aprovada/rejeitada conforme moderação.

### Regras e integrações

- Conversa pública cria ou enriquece lead `marketplace_chat`; resposta do corretor pode marcar contato; encerramento gera fluxo de avaliação. Só propostas ligadas ao contexto e imóveis publicados podem ser compartilhados.
- Avaliação exige contexto verificável e há proteção temporal contra duplicidade. Somente aprovadas entram na nota pública.
- Recebe imóveis e propostas; envia leads e eventos a Clientes/Desempenho. O Assistente público faz busca local e não é o COS autenticado.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** não há domínio/capability de Marketplace; pode somente agir indiretamente sobre lead, imóvel ou proposta já existentes.
- **Não consegue:** listar/responder/fechar conversas, compartilhar na conversa, editar perfil, publicar no canal ou consultar avaliações.
- **Deveria conseguir:** as mesmas ações autenticadas do workspace, com seleção de conversa/imóvel/proposta e confirmação ao fechar.

### Informações necessárias e situações reais

- Responder: conversa e texto; compartilhar: conversa + item compatível; fechar: conversa; perfil: região/especialidade/modalidade/apresentação.
- Situações: responder novo interessado, continuar negociação, enviar imóvel, enviar proposta, encerrar atendimento, entender avaliação pendente e corrigir perfil.

### Limitações/divergências

Marketplace aparece como benefício Pro/Scale, porém a proteção está principalmente na apresentação do plano; rotas e endpoints não demonstram enforcement uniforme. A documentação de conhecimento mais antiga ainda afirma conjunto de recursos igual entre planos.

## 4.6 Studio IA

### O que é, propósito e tela

É a central de criação de marketing. A home oferece campanha de Instagram, atrair compradores, captar proprietários, vender imóvel, visualizar projeto/obra, preparar imóvel e criar vídeo, além de métricas recentes.

### Dados, ações e estados

- Entidades: `StudioCampaign` e `StudioCampaignAsset`; tipos de campanha Instagram, compradores, proprietários, venda, obra, preparação e vídeo.
- Assets: imagem, vídeo, carrossel, story, reel, copy e thumbnail. Campanha/asset passa por rascunho, processamento, revisão, aprovação/rejeição, publicação ou falha.
- Ações: selecionar imóvel, fornecer objetivo/instruções/mídia, gerar, regenerar, continuar para Biblioteca e iniciar derivações.
- Integra provedores de IA/imagem/vídeo e storage; o código evita troca silenciosa de provedor quando o escolhido falha.

### Regras e integrações

- Créditos variam por operação: caption 2, campanha Instagram 10, compradores/proprietários/venda 3, imagem de obra 40; vídeo usa etapas de prévia/regeneração (12) e final/econômico conforme o fluxo (até 38). O débito depende do endpoint realmente executado.
- Usa imóvel e identidade visual da Conta; resultados persistidos vão para Biblioteca.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** gerar/melhorar descrição e texto; criar campanhas/copies simplificadas de Instagram; gerar respostas para Facebook/Story; criar roteiro de vídeo; regenerar por clonagem do último material.
- **Não consegue:** executar com paridade os pipelines reais dos provedores, gerar/renderizar todos os assets, cobrir todas as telas e opções nem acompanhar jobs/erros com a mesma granularidade.
- **Deveria conseguir:** iniciar e acompanhar os mesmos fluxos já expostos no Studio, informando custo e exigindo os mesmos inputs.

### Informações necessárias e situações reais

- Em geral: imóvel, objetivo/canal, instruções, mídia e opções específicas (formato, duração/transformação); saldo suficiente.
- Situações: criar campanha, adaptar copy, transformar imagem, gerar vídeo, retomar falha, regenerar variação, explicar custo ou localizar resultado.

### Limitações/divergências

As capabilities do COS têm nomes semelhantes aos fluxos reais, mas alguns handlers apenas criam texto determinístico/roteiro ou resposta, sem o asset final. Não se deve interpretar “gerar vídeo” no Registry como paridade com o pipeline completo de vídeo do Studio.

## 4.7 Biblioteca

### O que é, propósito e tela

É o repositório operacional dos materiais do Studio. Lista campanhas/assets com busca, filtros por mídia e status, paginação e detalhe de revisão.

### Dados, ações e estados

- Usa `StudioCampaign` e `StudioCampaignAsset`, inclusive prompt, caption, texto, URLs, metadados e relação com imóvel.
- Filtros: imagens, vídeos, carrossel, story, aprovado, em revisão e publicado; paginação de 12 itens.
- Ações: abrir/visualizar, baixar, copiar caption/prompt, editar texto quando permitido, aprovar, rejeitar, excluir com confirmação, regenerar e iniciar vídeo/anúncio derivado.
- Texto pode ser editado quando a campanha está em revisão, aprovada ou publicada; rascunho/rejeitada/falha não segue o mesmo caminho. Status da campanha é derivado dos assets.

### Integrações, COS e requisitos

- Recebe tudo do Studio e devolve alvo/contexto para regenerações e derivações.
- **COS já consegue:** somente regeneração parcial associada a campanha/propriedade, por meio das capabilities do Studio.
- **COS não consegue:** listar, buscar, abrir, baixar, editar, aprovar, rejeitar ou excluir items da Biblioteca.
- **COS deveria conseguir:** as mesmas operações já autenticadas, selecionando campanha/asset e confirmando ações destrutivas.
- Informações: campanha/asset, novo texto ou decisão de revisão; para derivar, imóvel e tipo de produção.

### Situações e limitações

Situações: encontrar última arte, aprovar copy, corrigir legenda, baixar vídeo, rejeitar versão, regenerar ou excluir. A Biblioteca é uma área real do produto sem domínio próprio no Registry.

## 4.8 Propostas

### O que é, propósito e tela

É o gerador e arquivo de propostas comerciais. A tela combina lista filtrável, preview e formulário com cliente/imóvel existentes ou dados manuais.

### Dados, ações e estados

- Persistência em `BrokerDocument` do tipo proposta, com HTML/conteúdo, status e vínculos opcionais com `Lead`/`Property`.
- Campos de criação incluem título, contato/imóvel, entrada, parcelas, forma de pagamento, condições e validade.
- Ações: criar, consultar/filtrar, visualizar, copiar, imprimir/baixar PDF, marcar assinada e compartilhar em conversa compatível do Marketplace.
- Estados usados pela tela: rascunho, gerada, assinada; a API também aceita arquivada.

### Regras e integrações

- A UI aceita proposta manual sem IDs; quando existem, os vínculos conectam Clientes e Imóveis. PDF não consome crédito. Compartilhamento no Marketplace exige contexto compatível e documento não arquivado.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** resumo e criação após selecionar cliente e imóvel.
- **Não consegue:** proposta manual sem entidades, todos os termos comerciais, edição completa, mudança de status, PDF, assinatura/arquivo ou compartilhamento.
- **Deveria conseguir:** operar os mesmos campos e ações já presentes, sem inventar condições.

### Informações necessárias, situações e divergências

- UI: cliente/contato e imóvel ou descrições manuais; termos, valores, validade. COS atual: cliente e imóvel selecionados.
- Situações: gerar oferta, corrigir entrada, prorrogar validade, comparar propostas, baixar/assinar, compartilhar com interessado.
- O resumo do COS busca uma amostra limitada e pode apresentar o tamanho dessa amostra como total, não uma contagem global garantida.

## 4.9 Contratos

### O que é, propósito e tela

É o workspace documental. No desktop organiza lista, preview A4 e revisão/readiness. Há três famílias convivendo: engine estruturada Template → Version → Instance, anexos externos e contratos legados em `BrokerDocument`.

### Dados, ações e estados

- Template importado de PDF/DOCX (até 15 MB) passa por extração/análise, revisão de blocos/campos/bindings e gera versões. Versão usada é imutável.
- Instância nasce de uma versão pronta, guarda snapshot de versão, partes, valores, bindings e readiness; mantém um espelho em `BrokerDocument`.
- Ações estruturadas: importar, revisar/reanalisar, criar instância, selecionar partes/cliente/imóvel, preencher, duplicar, gerar PDF rascunho/final, registrar assinatura externa, cancelar e excluir conforme regras.
- Anexo externo aceita PDF/DOC/DOCX, exige cliente e pode ter imóvel/tipo/título/notas/status; permite substituir, abrir e baixar.
- Contrato legado oferece modelos internos, termos/cláusulas, revisão, duplicação, PDF e estados rascunho, aguardando assinatura, assinado, concluído e cancelado.

### Regras e integrações

- Template: analisando → revisão necessária → pronto, ou falha. Não se exclui template com instâncias. Instância só usa versão atual pronta.
- PDF final requer readiness de 100%; então a instância vai para aguardando assinatura. “Registrar assinatura” registra fato/data/nota externa; não existe e-sign nativa nem validação jurídica.
- Clientes e Imóveis alimentam bindings; documentos aparecem no histórico documental. “Perguntar ao COS” está visualmente presente no painel de revisão, mas sem ação ligada.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** operar somente contratos legados: criar, listar, obter, visualizar, atualizar parcialmente, enviar, marcar assinado, cancelar, fornecer rota de download e histórico.
- **Não consegue:** importar/revisar/reanalisar/versionar template; criar/preencher instância real; resolver bindings/partes/readiness; gerar o PDF da engine; anexar contrato externo ou registrar assinatura com os dados da UI.
- **Deveria conseguir:** operar a engine atual e seus mesmos bloqueios, preservando Template → Version → Instance.

### Informações necessárias e situações reais

- Template: arquivo e tipo; revisão: blocos/campos/bindings. Instância: template pronto, cliente/partes, imóvel e valores obrigatórios. Finalizar: readiness 100%. Assinatura: instância, data/nota.
- Situações: importar modelo da imobiliária, corrigir extração, preencher campo pendente, trocar cliente, gerar minuta, emitir final, registrar assinatura, cancelar ou recuperar versão.

### Limitações/divergências

- O COS e a UI principal operam motores diferentes; sucesso no COS não equivale a criar uma `ContractTemplateInstance`.
- Download pelo COS retorna caminho do portal, não necessariamente um arquivo binário imediato.
- “Perguntar ao COS” não abre nem envia contexto hoje.

## 4.10 Compromissos

### O que é, propósito e tela

É a agenda operacional de visitas, tarefas, lembretes e eventos. A tela filtra hoje, amanhã, semana e todos; mostra métricas e permite edição rápida.

### Dados, ações e estados

- `AgendaEvent`: título, tipo, data, hora, notas, status e vínculos opcionais com lead/imóvel.
- Ações: criar, listar, editar, concluir, reabrir e cancelar.
- Estados: pendente, concluído e cancelado.

### Regras e integrações

- A API aplica defaults para título/tipo/data inválidos; Cliente e Imóvel podem ser vinculados, embora o formulário principal não exponha todo esse contexto.
- Não há recorrência, calendário externo ou sincronização Google/Outlook.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** criar, listar geral/hoje/semana/mês, concluir, atualizar e cancelar; pode resolver cliente/imóvel.
- **Não consegue:** reabrir explicitamente e não há capability de integração externa. O descriptor de update anuncia data/hora/título/notas, mas o handler atualiza título/hora/notas, não a data.
- **Deveria conseguir:** editar a data e reabrir conforme a API/UI existente.

### Informações necessárias, situações e limitações

- Criar: título, tipo, data e hora; cliente/imóvel/notas opcionais. Alterar/cancelar: evento selecionado; cancelamento exige confirmação no COS.
- Situações: agendar visita, remarcar data, concluir tarefa, cancelar reunião, ver agenda semanal e relacionar compromisso a negociação.
- A atualização de vínculos na API não demonstra a mesma checagem explícita de ownership usada em outros módulos, podendo terminar em erro de relação ou escopo.

## 4.11 Financeiro

### O que é, propósito e tela

É uma visão estimativa da carteira, não um módulo contábil. Calcula valor de portfólio, ticket médio, estados dos imóveis e comissão projetada segundo percentual configurável.

### Dados, ações e estados

- Fonte: `Property` e `BrokerFinancialConfig`; não existe entidade de lançamento, conta a pagar/receber, despesa ou liquidação.
- A tela filtra status, tipo, finalidade e forma de cálculo; alterna visão geral/por imóvel; mostra composição por tipo/cidade e últimos cinco imóveis como “histórico financeiro”.
- Ações: consultar, filtrar e salvar percentual/modo/status/tipo/visão. O filtro de finalidade existe no cliente, mas não é persistido pela API.
- Não há status financeiro transacional; os estados apresentados vêm de imóveis e contratos.

### Integrações e COS

- Recebe carteira e contratos para estimar; não envia lançamento a outros módulos.
- **COS já consegue:** resumo, recebíveis, pagáveis, previsão, comissão e fluxo de caixa, todos read-only.
- **COS não consegue:** reproduzir exatamente filtros/configuração da tela nem operar transações, porque elas não existem no modelo.
- **COS deveria conseguir:** consultar os mesmos cálculos/configurações existentes e declarar claramente que são estimativas.

### Informações necessárias, situações e limitações

- Informações: percentual de comissão e filtros; para pergunta específica, imóvel/período/contexto.
- Situações: estimar comissão, comparar cidades/tipos, ver valor de carteira, projetar entrada e entender divergência.
- O COS calcula “a receber” como comissão sobre publicados e usa valores fixos por contratos para “a pagar/saídas”; forecast usa razões operacionais de leads/imóveis. Esses números não são fatos contábeis e não devem ser apresentados como dívida/caixa real.
- A rota existe, mas Financeiro não está no menu principal atual. “Histórico financeiro” não é histórico de transações.

## 4.12 Desempenho

### O que é, propósito e tela

É o painel de aquisição e procura. Mostra visualizações, contatos por WhatsApp, leads, imóveis monitorados, imóveis mais acessados, origens e buscas recentes.

### Dados, ações e estados

- Agrega `CatalogEvent`, `SearchEvent`, `Lead` e `Property` em períodos de 7/30/90 dias ou total, com filtros por imóvel, origem e termo.
- Ações são predominantemente consulta/filtro; o sistema registra eventos de navegação, busca e contato nos pontos públicos.
- Não há workflow de status próprio; usa tipo/origem/data dos eventos e status dos leads.

### Integrações e COS

- Recebe tráfego do Catálogo e Marketplace e conversões em Clientes.
- **COS já consegue:** resumo, desempenho, vendas, imóveis e leads.
- **COS não consegue:** reproduzir todos os recortes de período/imóvel/origem, ranking e buscas recentes da tela.
- **COS deveria conseguir:** consultar essas mesmas agregações e explicar a origem dos números.

### Informações necessárias, situações e limitações

- Informações: período; imóvel/origem/termo se houver filtro.
- Situações: imóvel mais visto, origem dos leads, queda de contatos, comparação 7×30 dias, buscas sem resultado e acompanhamento de campanha.
- O texto “Filtro atual: Todos os imóveis” permanece fixo mesmo após selecionar um imóvel. Conjuntos de eventos usados por UI/API e por alguns resumos do COS não são perfeitamente idênticos.

## 4.13 Histórico

### O que é, propósito e tela

É a lista de conversas persistidas do COS. Permite localizar e retomar uma conversa com seu workflow pendente.

### Dados, ações e estados

- Conversa em `BrokerDocument`, mensagens em `EmeMessage` e execução em `AiAssistantInteraction`.
- Agrupa por hoje, ontem, últimos 7 dias, mês e anteriores; categoriza Clientes, Imóveis, Propostas, Contratos, Agenda, Studio, Consultas e Conversas gerais.
- Ações: criar nova conversa, abrir/continuar, buscar, filtrar, carregar mais, renomear e excluir permanentemente.
- Pode reabrir confirmação/seleção pendente. Exclusão remove conversa, mensagens e interações relacionadas.

### COS, requisitos e situações

- **Já consegue:** usar o contexto ao conversar e persistir/retomar workflows.
- **Não consegue:** renomear, listar ou excluir o histórico por capability; essas ações são feitas pela UI/hook.
- **Deveria conseguir:** administrar as próprias conversas com os mesmos limites e confirmação de exclusão.
- Informações: conversa alvo; novo título ou confirmação de exclusão.
- Situações: retomar proposta, localizar conversa antiga, voltar a uma seleção, mudar assunto e retornar, renomear ou apagar conteúdo.

### Limitações/divergências

A busca é aplicada ao conjunto já carregado/paginado, logo pode não representar todo o histórico sem carregar mais. A exclusão é material e abrangente.

## 4.14 Plano

### O que é, propósito e tela

É a área de assinatura, limites, créditos e pacotes extras. Mostra plano atual, uso, benefícios, upgrade e históricos compactados.

### Dados, ações e estados

- Free: R$ 0, 5 imóveis, 30 créditos mensais/iniciais, módulos centrais e COS, sem Marketplace.
- Pro: R$ 129, 150 imóveis, 500 créditos, Marketplace. Scale: R$ 389, 1.000 imóveis, 2.000 créditos, Marketplace.
- Pacotes: +250/+750/+1.500/+3.000 créditos; +50/+100/+200 de capacidade, mantendo chaves legadas maiores internamente.
- Ações: Free → checkout Pro; Pro → checkout Scale; Scale indica plano máximo. “Quero evoluir” segue o próximo plano ou leva Scale aos extras. Compra pacote via checkout Stripe. Históricos iniciam em 3 registros e expandem/recolhem.
- Assinatura: trial, ativa, vencida e cancelada. Crédito mensal expira; extra acumula. Capacidade extra só é ativa com plano pago ativo.

### Regras e integrações

- Webhook Stripe sincroniza `Subscription`, `BrokerPlanAccount`, créditos e compras. Plano vencido pode manter o nível até cancelamento conforme a regra atual.
- Limites são consumidos em Imóveis; créditos em COS e Studio; feature Marketplace vem da lista de benefícios.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** apenas explicar genericamente o uso do sistema; não há capabilities de billing.
- **Não consegue:** consultar plano/saldo/histórico, explicar uma cobrança real, iniciar upgrade/pacote ou mostrar entitlement.
- **Deveria conseguir:** consultar os mesmos dados do plano e abrir os checkouts já existentes após escolha explícita; nunca comprar sem confirmação.

### Informações necessárias, situações e limitações

- Upgrade: plano atual e próximo permitido. Pacote: tipo/quantidade e confirmação no checkout.
- Situações: saldo insuficiente, limite de carteira, comparar planos, comprar extras, entender renovação e recuperar pagamento vencido.
- A UI bloqueia pacotes no Free, mas o endpoint não demonstra o mesmo bloqueio. Marketplace também não tem enforcement uniforme. A contagem chamada “imóveis ativos” inclui os três estados. Documentação antiga diz que todos os planos têm o mesmo conjunto, em conflito com `lib/eme-plans.ts`.

## 4.15 Conta e configurações

### O que é, propósito e tela

Centraliza identidade do corretor, contato, CRECI, foto, marca do Studio, senha e segurança do dispositivo.

### Dados, ações e estados

- `User` e `Broker`: nome, e-mail, telefone/WhatsApp, foto, CRECI/UF, descrição e identidade visual (cor, logo, watermark).
- Segurança: senha, dispositivo confiável, PIN de seis dígitos e passkey/WebAuthn; lista até dez dispositivos.
- Ações: editar perfil, enviar/remover foto/marca, alterar senha, confiar dispositivo, habilitar/desabilitar PIN/biometria e consultar dispositivos.
- Conta do corretor e CRECI têm estados próprios; CRECI verificado produz o selo e libera condições de publicação.

### Regras e integrações

- Nome, e-mail, telefone e CRECI são obrigatórios; e-mail é validado/único. Mudança de nome ou CRECI/UF pode reiniciar validação. Rejeição impede a conclusão do fluxo.
- Biometria exige plataforma compatível e dispositivo confiável. Perfil alimenta Catálogo, Marketplace, Studio, contato e regras de publicação.

### COS: consegue, não consegue e deveria conseguir

- **Já consegue:** orientar genericamente por ajuda.
- **Não consegue:** ler/editar perfil, marca, CRECI, senha, PIN, passkey ou dispositivos.
- **Deveria conseguir:** consultar/editar dados não secretos já suportados; operações de segurança devem preservar reautenticação e confirmação existentes.

### Informações necessárias, situações e limitações

- Perfil: campos alterados; senha/PIN: credencial atual e nova; passkey: navegador/dispositivo compatível; CRECI: número/UF e identidade coerente.
- Situações: trocar WhatsApp, atualizar foto, corrigir CRECI, entender selo, mudar senha, ativar biometria, revisar dispositivo e ajustar marca.
- A rota legada `/api/brokers/me` ainda contém ramo de PIN de quatro dígitos, enquanto a tela ativa usa o fluxo separado de seis dígitos. A documentação fala em revogar dispositivos individualmente, mas a UI apenas lista outros dispositivos, sem ação individual clara.

## 5. Fluxos transversais reais

### 5.1 Jornada comercial básica

```text
Lead/Cliente
→ vínculo com imóvel de interesse
→ proposta (BrokerDocument)
→ contrato legado ou instância estruturada
→ compromisso de visita/assinatura
→ status ganho/perdido e indicadores
```

### 5.2 Catálogo público até negociação

```text
Imóvel publicado no Catálogo
→ visualização/pesquisa/WhatsApp (CatalogEvent/SearchEvent)
→ manifestação de interesse
→ Lead
→ Clientes
→ proposta/contrato/compromisso
→ Desempenho
```

### 5.3 Marketplace até reputação

```text
Imóvel com marketplacePublished
→ descoberta/Assistente público
→ MarketplaceConversation
→ criação ou enriquecimento de Lead
→ resposta do corretor (CONTACTED)
→ compartilhamento de imóvel/proposta
→ fechamento da conversa
→ MarketplaceReview
→ moderação
→ nota pública do corretor
```

### 5.4 Produção de marketing

```text
Imóvel + marca da Conta
→ fluxo do Studio IA
→ provedor externo/storage
→ StudioCampaign + StudioCampaignAsset
→ Biblioteca
→ revisão/aprovação/download/regeneração
```

### 5.5 Publicação multicanal

```text
Property
├─ status + published → Catálogo do corretor
└─ marketplacePublished → Marketplace
```

As duas publicações não são sinônimas e têm regras/readiness diferentes.

### 5.6 Contrato estruturado

```text
PDF/DOCX importado
→ ContractTemplate
→ análise e revisão
→ ContractTemplateVersion READY e imutável após uso
→ ContractTemplateInstance com snapshot/bindings
→ readiness 100%
→ PDF final
→ aguardando assinatura
→ registro de assinatura externa
```

### 5.7 Telemetria e decisão

```text
Catálogo/Marketplace
→ eventos, buscas e leads
→ Desempenho
→ leitura operacional pelo corretor/COS
```

### 5.8 Monetização

```text
Checkout Stripe
→ Subscription + BrokerPlanAccount
→ limite de carteira + saldo de créditos + features
→ Imóveis / COS / Studio / Marketplace
→ AiCreditTransaction e histórico de pacotes
```

### 5.9 Execução conversacional

```text
Mensagem/anexo
→ Decision Layer + segurança
→ resolução de entidade/seleção
→ plano ou receita multi-step
→ confirmação quando exigida
→ handler do Registry
→ mutação/consulta no módulo
→ mensagem, interação, telemetria e débito
→ Histórico/retomada
```

## 6. Mapa global atual do COS

### 6.1 Inventário derivado do Registry

| Domínio | Quantidade | Capabilities atuais |
| --- | ---: | --- |
| Geral/ajuda | 8 | `general.chat`; primeiros passos; usar COS; cadastrar imóveis; gerenciar clientes; contratos/propostas; marketing/Studio; pergunta geral |
| Clientes | 9 | criar, resumir, sumarizar lead, atualizar, excluir, localizar, timeline, converter, anexar documento |
| Imóveis | 9 | criar, buscar, obter, melhorar descrição, publicar, despublicar, atualizar mídia, sugerir preço, arquivar |
| Catálogo | 6 | resumo, analisar, publicar, despublicar, compartilhar, estatísticas |
| Analytics | 5 | resumo, desempenho, vendas, imóveis, leads |
| Financeiro | 6 | resumo, recebíveis, pagáveis, previsão, comissão, fluxo de caixa |
| Compromissos | 8 | criar, listar, concluir, atualizar, cancelar, hoje, semana, mês |
| Propostas | 2 | resumo, criar |
| Contratos | 10 | criar, listar, obter, preview, atualizar, enviar, assinar, cancelar, download, histórico |
| Documentos | 2 | listar, obter |
| Studio | 8 | descrição, campanha, Instagram, Facebook, vídeo, story, melhorar texto, regenerar |
| Operação | 1 | resumo/saúde operacional |
| **Total** | **74** | **74 actions únicas e 74 handlers** |

### 6.2 Leitura por tipo de operação

- **Read-only:** 46 descriptors não mutantes; consultas, resumos, busca, preview, análise e ajuda.
- **Mutações:** 28 descriptors; criam/alteram/excluem/publicam documentos e entidades.
- **Confirmação declarada:** 18; concentra cancelamentos, exclusões, publicação sensível, envio/assinatura e gerações de campanha.
- **Seleção declarada:** 28; resolve cliente, imóvel, compromisso, contrato, campanha ou documento antes da execução.
- **Dependências comuns:** autenticação do broker → entitlement/créditos → resolução de entidade → coleta de campos → seleção → confirmação → execução → persistência/telemetria.
- **Superfícies:** 74 no Portal, 70 na home do COS, 73 no canal WhatsApp e 10 no modo demo, conforme filtros dos descriptors.

### 6.3 Confirmações e seleções que merecem cenários próprios

- Exclusão de cliente, cancelamento de compromisso/contrato e arquivamento de imóvel.
- Publicar/despublicar quando houver risco de alcance externo.
- Enviar/assinar contrato e gerar campanhas/mídia com custo.
- Homônimos, múltiplos imóveis com texto parecido e referências como “esse”, “o segundo” ou “o cliente anterior”.
- Fluxos que precisam pedir horário, preço, cliente, imóvel ou tipo de contrato antes de continuar.

## 7. Gaps COS × produto

### Dez maiores gaps

1. **Contratos:** COS atua em `BrokerDocument` legado; a tela principal usa Template → Version → Instance, bindings e readiness.
2. **Marketplace:** não há capabilities para perfil, publicação, conversas, compartilhamento, fechamento ou avaliações.
3. **Studio:** vários handlers geram texto/roteiro simplificado e não executam os pipelines/outputs reais das telas homônimas.
4. **Biblioteca:** não há listagem, busca, revisão, edição, aprovação, download ou exclusão por COS.
5. **Publicação:** `catalog.publish`/`property.publish` não reproduzem de modo uniforme readiness, CRECI, limite do plano e regras da UI.
6. **Plano e entitlement:** o COS não lê plano/saldo/histórico/checkout; Marketplace e pacote extra também não têm enforcement backend uniforme com a UI.
7. **Financeiro:** o COS apresenta heurísticas e custos fixos sobre carteira/contratos sem ledger real; risco de parecer valor contábil.
8. **Conta e segurança:** perfil, CRECI, marca, senha, PIN, passkey e dispositivos não são operáveis pelo COS.
9. **Clientes/Imóveis completos:** dados civis, endereço, representação, documentos, áudio, dados legais, importações e edição rica não têm paridade.
10. **Desempenho:** consultas do COS não oferecem todos os filtros, rankings, buscas recentes e conjuntos de eventos da tela.

### Outros gaps relevantes

- Propostas do COS não incluem todos os termos, PDF, status, assinatura ou compartilhamento.
- Agenda: update não altera a data apesar do descriptor; reabertura não tem capability.
- Histórico: gestão de conversas existe na UI, não no Registry.
- Catálogo: perfil, mídia e vídeo não são configuráveis pelo COS.
- Não existe capability financeira para transação real porque o próprio produto não mantém ledger.

## 8. Taxonomia de cenários para a Fase 2

| Categoria | O que deve variar nos cenários | Exemplo de intenção |
| --- | --- | --- |
| Pergunta sobre funcionamento | módulo, regra, limite, etapa | “Como publico este imóvel no Marketplace?” |
| Consulta de dados | entidade, filtro, período, vazio | “Quais leads novos chegaram hoje?” |
| Execução | ação simples com todos os dados | “Crie uma visita amanhã às 15h.” |
| Edição/correção | antes/depois, alvo corrente ou anterior | “Corrija o telefone dela.” |
| Confirmação | sim explícito, ambíguo, recusa | “Pode publicar.” |
| Cancelamento/rejeição | cancelar workflow ou entidade | “Esquece essa proposta.” |
| Seleção | homônimos, lista ordinal, nenhum resultado | “É o segundo apartamento.” |
| Comparação | período, imóvel, cliente, canal | “Qual teve mais procura?” |
| Análise | diagnóstico baseado em fatos, sem inventar | “Por que minha operação está com 62%?” |
| Recomendação | somente opções suportadas e evidenciadas | “Qual imóvel faz sentido para este cliente?” |
| Continuidade | completar etapa pendente | “A entrada é de 80 mil.” |
| Referência/pronome | esse/ela/o anterior/último | “Envie para ela.” |
| Troca de assunto | consulta lateral sem perder workflow | “Antes, quanto crédito isso custa?” |
| Retomada | retornar ao fluxo interrompido ou histórico | “Volte para o contrato.” |
| Erro/problema | validação, permissão, saldo, provider, arquivo | “O vídeo falhou; o que aconteceu?” |
| Ação multi-step | receita com dependências internas | “Cadastre o lead e prepare uma proposta.” |
| Ação entre módulos | efeito encadeado e vínculo | “Publique e crie campanha para o imóvel.” |
| Pedido impossível/não suportado | ausência de capability ou de dado real | “Assine juridicamente por mim.” |

### Dimensões obrigatórias de cobertura

- Alvo único, múltiplos alvos, alvo inexistente e alvo fora do escopo do corretor.
- Dados completos, parcialmente completos, inválidos e contraditórios.
- Com/sem confirmação, com recusa e com correção após preview.
- Saldo suficiente/insuficiente; plano permitido/não permitido; CRECI verificado/não verificado.
- Estado vazio, primeiro registro, muitos registros, item arquivado/cancelado/publicado.
- Conversa nova, continuidade imediata, retomada histórica, troca de assunto e pronome distante.
- Falha de API/provider/storage, duplicidade, timeout e resultado parcial de workflow.
- Consultas que precisam distinguir estimativa de fato, principalmente no Financeiro.

## 9. Principais limitações e divergências consolidadas

| Área | Divergência observada | Impacto para cenários |
| --- | --- | --- |
| Registry × docs | Registry atual tem 74; dois documentos ainda descrevem inventários antigos de 64 e 73/72/71 | Código/Registry deve vencer a documentação desatualizada |
| Contratos | UI estruturada e COS legado não criam o mesmo objeto | Validar entidade produzida, não só a copy de sucesso |
| Publicação | Caminhos UI/API/COS aplicam subconjuntos diferentes de readiness/limite | Criar cenários de bloqueio e bypass observável |
| Marketplace × Plano | Benefício Free/Pro/Scale não é uniformemente imposto no backend | Distinguir apresentação de entitlement efetivo |
| Financeiro | Tela é estimativa; COS acrescenta heurísticas fixas | Nunca tratar como contabilidade real |
| Studio | Nome da action sugere geração completa, handler pode produzir apenas copy/roteiro | Verificar asset persistido e provider acionado |
| Agenda | update declara data, handler não altera data | Cenário de correção deve detectar não efeito |
| Propostas | resumo limitado pode parecer total | Validar paginação/contagem antes de afirmar total |
| Desempenho | texto de filtro e conjuntos de evento divergem | Perguntas filtradas precisam citar escopo real |
| Histórico | busca sobre lote carregado, não necessariamente todo o acervo | Não afirmar ausência global sem paginação |
| Conta | PIN legado de 4 dígitos e fluxo ativo de 6 coexistem | Usar o fluxo da tela ativa |
| Suporte | saúde mostrada é estática | Não usar como disponibilidade real |
| Corretor EME | tela fala em futuro, webhook já tem partes funcionais | Tratar canal como implementação parcial |

## 10. Base recomendada para a Fase 2

### Unidade de cenário

Cada cenário deve registrar:

1. domínio e capability esperada, ou motivo de não suporte;
2. estado inicial real das entidades;
3. mensagem e anexos do corretor;
4. ato conversacional e entidades/referências esperadas;
5. dados ainda necessários e ordem de coleta;
6. seleção e confirmação esperadas;
7. plano/CRECI/créditos/readiness aplicáveis;
8. steps e efeitos persistidos esperados;
9. resposta final e fatos que ela pode afirmar;
10. efeitos que **não** podem acontecer;
11. custo esperado e condição `noCharge`;
12. comportamento de retomada, erro e idempotência.

### Priorização sugerida

- **P0 — segurança e integridade:** exclusões/cancelamentos, publicação, envio/assinatura, isolamento por corretor, créditos e workflows parcialmente concluídos.
- **P1 — jornadas de receita:** lead → proposta → contrato → compromisso; catálogo/Marketplace → lead; imóvel → publicação → Studio.
- **P2 — precisão analítica:** Financeiro como estimativa, Desempenho por filtro, contagens/paginação e saúde operacional.
- **P3 — gaps explícitos:** pedidos de Marketplace, Biblioteca, contratos estruturados, Plano e Conta devem produzir resposta de limite honesta, nunca sucesso simulado.

### Fontes canônicas para gerar o dataset

- Capabilities/descriptors: `lib/cos/entities/*` e `lib/cos/capability-registry.ts`.
- Execução real: `lib/cos/capability-handlers.ts`, `lib/cos/capabilities/*`, `lib/eme-backend.ts` e `/api/assistant/eme`.
- Estado/conversa: `lib/cos/conversation-decision.ts`, `lib/cos/execution-planner.ts`, `lib/cos/workflow-engine.ts` e `lib/cos/conversation-snapshot.ts`.
- Regras de produto: APIs do módulo, `lib/property-publication-readiness.ts`, `lib/eme-plans.ts`, services de contratos/Studio/Marketplace e `prisma/schema.prisma`.
- A interface serve para descobrir ações expostas; o handler/API serve para confirmar o efeito real.

## 11. Índice de evidências do código

- Portal e navegação: `app/corretor/**`, `components/broker-portal.tsx`, `components/broker-*-page.tsx`.
- Clientes/imóveis: `app/api/leads/**`, `app/api/properties/**`, `lib/lead-contract.ts`, `lib/property-contract.ts`, `lib/property-publication-readiness.ts`.
- Catálogo: `app/api/brokers/catalog/**`, `lib/public-catalog.ts`, `components/broker-public-catalog.tsx`.
- Marketplace: `app/api/brokers/marketplace/**`, `app/api/marketplace/**`, `lib/marketplace/**`, `components/marketplace/**`.
- Studio/Biblioteca: rotas `app/corretor/studio-ia/**`, APIs de campanhas/geração e `lib/studio-*.ts`.
- Propostas/Contratos: `app/api/brokers/documents/**`, `app/api/brokers/contracts/**`, `app/api/brokers/contract-templates/**`, `app/api/brokers/contract-instances/**`, `lib/contract-*.ts`.
- Agenda/indicadores: `app/api/brokers/agenda`, `app/api/brokers/financial`, `app/api/brokers/analytics`.
- Plano/Conta: `lib/eme-plans.ts`, `lib/eme-plan-service.ts`, `lib/billing-enforcement.ts`, rotas Stripe, `app/api/brokers/plan`, `app/api/brokers/subscription`, `app/api/brokers/me` e APIs de segurança.
- Persistência: `prisma/schema.prisma`.

## 12. Conclusão operacional

O EME já tem dados e fluxos suficientes para uma Fase 2 rica: consultas, comandos, desambiguação, confirmações, retomadas e cadeias entre módulos. O dataset não deve ser produzido apenas a partir dos nomes das 74 capabilities. Para ser realista, ele precisa combinar Registry, handler, regra de API, estado persistido e comportamento da UI — principalmente nos pontos onde esses quatro níveis ainda divergem.

O melhor critério de sucesso para a próxima fase é: o COS identifica corretamente o que o corretor quer, pede apenas os dados indispensáveis, nunca simula uma operação fora de cobertura, aplica as mesmas proteções do produto e descreve com precisão o efeito realmente persistido.
