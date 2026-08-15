# COS — Etapa 4 — Knowledge Layer

Data: 14/08/2026

Escopo: recuperação seletiva do Livro do EME no runtime privado do COS no portal/PWA. O runtime do WhatsApp não foi alterado.

## Resultado

A Etapa 4 conecta a Decision Layer da Etapa 2C ao Livro versionado criado na Etapa 3. A solução é local, lexical, determinística e testável; não usa embeddings, vector database, RAG externo ou um segundo serviço.

```text
mensagem + ConversationSnapshot
  → Dialogue Decision
       ├ dialogue act
       ├ domínio primário/secundários
       ├ objetivo
       └ capability alvo
  → Knowledge Need
  → loader/index local do Livro
  → retrieval escopado
  → CosKnowledgeContext
  → Planner / Help / Response
```

Knowledge não substitui o Capability Registry, autorização, confirmação, resolução broker-scoped, handlers ou resultado tipado. Texto documental nunca concede permissão nem executa diretamente uma operação.

## Fonte e loader

A fonte canônica é `knowledge/eme/*.md`, com os 16 capítulos validados na Etapa 3. O loader fica em `lib/cos/knowledge/loader.server.ts` e:

- lê apenas Markdown do diretório versionado;
- ordena os arquivos para produzir resultado estável;
- exige `id`, `title`, `domains`, `aliases`, `version`, `updated_at` e `knowledge_type`;
- valida domínios e tipos contra os contratos conhecidos;
- preserva filename, versão e metadata documental;
- falha explicitamente em metadata inválida, sem pular silenciosamente uma fonte;
- mantém uma Promise/index em cache no processo, evitando reler os 16 arquivos a cada mensagem.

`next.config.mjs` inclui `knowledge/eme/**/*.md` no output tracing da rota `/api/assistant/eme`, garantindo que os capítulos estejam disponíveis no runtime empacotado.

O `sourceVersion` é uma composição determinística dos pares `documentId@version`. Ele identifica o conjunto usado sem copiar o conteúdo do Livro para logs ou mensagens.

## Índice

O índice local contém:

- documentos já normalizados;
- chunks ordenados e vinculados ao documento de origem;
- mapas por ID, alias normalizado, domínio e tipo;
- versão composta da fonte.

A recuperação restringe candidatos usando:

- domínio primário e domínios secundários da Decision Layer;
- ID do documento quando explicitamente filtrado;
- interseção de `knowledge_type`;
- aliases do frontmatter;
- capability alvo, quando existir;
- termos de glossário.

O índice não consulta banco nem provider e não depende do estado de outro corretor.

## Chunking

O chunker preserva o conteúdo introdutório entre o H1 e o primeiro H2 como `Visão geral`; isso é necessário, por exemplo, para a tabela do Glossário. As demais seções são separadas por headings H2.

Se uma seção exceder o limite físico, ela é dividida em partes estáveis. Cada chunk preserva:

- `id` estável (`sourceId#heading[-parte-N]`);
- `sourceId`;
- título do documento;
- heading;
- domínios;
- tipos de conhecimento;
- versão;
- ordem dentro do documento;
- texto;
- score e evidências somente depois do retrieval.

O inventário do Capability Registry é dividido em partes; o runtime não envia a tabela inteira por causa de uma pergunta pontual. Frontmatter e headings seguintes não vazam para o texto da seção anterior.

## Quando recuperar

`shouldRetrieveCosKnowledge` recupera conhecimento para:

- `explain`;
- `capability_question`;
- perguntas de procedimento/funcionamento;
- regras operacionais documentadas de contratos e Marketplace quando a execução precisa delas.

Normalmente não recupera para:

- confirmação, rejeição ou cancelamento simples;
- seleção como “o segundo”;
- resposta factual de pending, como telefone;
- consulta simples que deve ir diretamente ao banco;
- mutação cuja confirmação e segurança já estão no Registry/handler.

Uma pergunta procedimental pode exigir Livro mesmo quando a Decision Layer a classificou como `query`. Exemplo: “Como publico meu imóvel?” consulta o procedimento, não executa `PUBLISH_PROPERTY`.

## Retrieval e scoring

A consulta é normalizada em português, sem diferença de caixa ou acentuação, limitada antes da busca e tokenizada com remoção de termos estruturais comuns. Tokens são comparados contra heading, título, aliases e texto.

Os sinais ficam centralizados em `lib/cos/knowledge/retrieval.ts`:

| Sinal | Peso |
|---|---:|
| domínio primário | +8 |
| domínio secundário | +5 |
| tipo esperado | +3 |
| capability alvo no chunk | +18 |
| alias completo | +13 |
| token no heading | +4 |
| token no título | +3 |
| token em alias | +2,5 |
| token no texto | +1 |
| inventário com a capability alvo | +10 adicional |
| termo técnico no Glossário | +14 |

Os resultados são ordenados por score decrescente e, em empate, por ID de chunk. Fontes diretamente associadas aos domínios são preservadas dentro dos limites para consultas relacionais, como Catálogo × Marketplace.

O heading aplica sinais contextuais adicionais: definições/relações para explicação e comparação, regras para perguntas normativas, fluxos para procedimentos, “O que o COS pode fazer” para capacidade e `Visão geral` para definições do Glossário. Seções de exemplos recebem penalidade para não superar a fonte factual apenas porque repetem a pergunta.

Boost de domínio não basta para declarar conhecimento encontrado em perguntas genéricas. A recuperação exige evidência lexical suficiente, alias, termo de glossário ou capability verificável; isso permite sinalizar feature inexistente como `knowledgeMiss`.

## `CosKnowledgeContext`

O contrato tipado contém:

- `required` e a razão da necessidade;
- query normalizada;
- documentos selecionados (`id`, título e versão);
- chunks, scores e evidências;
- `knowledgeMiss`;
- versão composta da fonte;
- limites e quantidade de caracteres selecionada.

`formatCosKnowledgeContext` monta um contexto com cabeçalhos de origem e versão. Em miss ou ausência de chunks, retorna string vazia.

## Capability Registry

Perguntas como “Você consegue criar uma proposta?” usam duas fontes com responsabilidades diferentes:

1. o Registry confirma se `proposal.create` existe, possui handler e está disponível na surface atual;
2. o Livro fornece explicação e limitações de uso.

O Registry prevalece sempre. Um capítulo mencionar uma ação não torna essa ação executável, e uma capability indisponível para a surface não pode ser prometida pelo texto recuperado.

O inventário em `knowledge/eme/15-capacidades-cos.md` permanece sincronizado pela validação da Etapa 3, mas é evidência documental, não substituto do descriptor carregado em runtime.

## Adapters e integração

### Rota do COS

A rota recupera conhecimento depois da decisão conversacional completa e da resolução de intent contextual. O contexto é anexado ao `CosNormalizedContext`, ficando disponível para planejamento e handlers sem criar outra memória paralela.

O retrieval não é executado no preflight, pois esse momento ainda não possui toda a janela recente e a decisão contextual final.

### Help legado

As capabilities guiadas continuam preservando seus menus e CTAs. No portal e `cos_home`, perguntas específicas usam os chunks do Livro presentes em `context.knowledge`; um miss gera resposta limitada explícita. A leitura de `docs/help/*.md` permanece como adapter de compatibilidade para superfícies que ainda não recebem `CosKnowledgeContext`. Isso migra a autoridade sem apagar material útil abruptamente e sem alterar WhatsApp.

Quando o provider não está configurado, falha ou trunca a saída, o handler devolve o trecho recuperado em vez de trocar de fonte silenciosamente. A metadata identifica se a resposta veio de knowledge, fallback, miss ou manual legado.

### Planner e resposta

Regras recuperadas podem orientar prerequisites e explicações, mas não podem alterar confirmação, permissões, entidade resolvida ou resultado do executor. O formatter recebe fatos e fontes já selecionados; não recebe o Livro inteiro.

O AI Orchestrator recebe no máximo dois chunks de tipo `rule`/`procedure`, limitados em conjunto a 3.000 caracteres. Seu audit registra hash e tamanho do prompt e IDs de knowledge, não o prompt completo. O catálogo de capabilities continua filtrado pela Decision Layer e pela surface.

### WhatsApp

Nenhum adapter, webhook, teste ou runtime do WhatsApp foi alterado nesta etapa.

## Fallback e knowledge miss

Quando a busca não encontra evidência suficiente:

- `knowledgeMiss=true`;
- `selectedDocuments=[]`;
- `chunks=[]`;
- nenhum conteúdo é inventado;
- a camada de resposta pode declarar a limitação e, quando houver, apontar uma capability real próxima.

Erro de leitura/parsing também é transformado em contexto indisponível explícito (`eme-book:unavailable`, `knowledgeMiss=true`) e registrado no servidor; não cai silenciosamente para conteúdo inventado.

Uma interseção impossível de filtros também produz miss. O retrieval não amplia silenciosamente a busca para o Livro inteiro.

## Observabilidade

O `decisionAudit` registra somente:

- `knowledgeRequired`;
- `retrievalQuery`;
- IDs dos documentos;
- IDs dos chunks;
- scores;
- `knowledgeMiss`;
- versão do conhecimento.

O texto dos chunks não é persistido no audit. Assim é possível reconstruir a decisão com a versão do Livro sem duplicar conteúdo potencialmente grande em metadata.

A query do audit é limitada e redige sequências numéricas longas antes da persistência.

## Limites e performance

Os limites atuais são declarativos e testados:

- no máximo 5 chunks;
- no máximo 1.600 caracteres por chunk;
- no máximo 6.000 caracteres de contexto selecionado;
- query normalizada limitada a 320 caracteres;
- cache local do índice por processo.

O algoritmo percorre apenas o índice local pequeno e previamente carregado. Não existe chamada de rede, embedding ou provider no retrieval.

## Testes

`tests/e2e/cos-knowledge-layer.spec.ts` cobre:

- loader, metadata, cache e erros explícitos;
- chunking, introdução, IDs, ordem e tamanho;
- Catálogo × Marketplace;
- regra de cláusulas em contratos, incluindo a divergência do legado;
- capability de proposta conferida no Registry;
- procedimento de publicação de imóvel;
- Glossário para `property`, `agenda` e `lead`;
- knowledge miss para feature inexistente;
- isolamento entre módulos e limites de contexto;
- mensagens que não devem carregar o Livro;
- filtros por ID, tipo e alias;
- projeção de observabilidade sem texto integral.

### Validação executada

- `npx playwright test tests/e2e/cos-knowledge-layer.spec.ts --reporter=line`: **15/15 passaram**.
- Suíte focada com Knowledge, Decision Layer, ConversationSnapshot, contratos de execução, Workflow/Executor, conversa e diagnósticos A–J: **90/90 passaram**.
- E2E autenticados `cos-core`, `clients-cos-source` e `cos-history-categories`: a execução chegou ao limite de 180 s após o login de fixture permanecer em `/login`; o artefato confirma falha de autenticação antes de entrar no COS. É uma dependência preexistente do ambiente e não foi mascarada nem corrigida fora do escopo.
- `npm run lint`: passou.
- `npx tsc --noEmit`: passou.
- `npm run build`: passou, com 98 páginas estáticas. O único aviso foi o já existente de múltiplos lockfiles/workspace root inferido.
- O manifesto `.next/server/app/api/assistant/eme/route.js.nft.json` contém os 16 arquivos de `knowledge/eme`, confirmando o empacotamento do Livro na rota de produção.

## Limitações conhecidas

- A recuperação é lexical; sinônimos ausentes do texto/aliases podem exigir atualização editorial.
- `knowledge_type` é metadata de documento, não uma ontologia por parágrafo.
- A resposta final e a localização central serão tratadas na Etapa 5.
- O Livro descreve o produto atual; não contém roadmap nem cria capabilities.
- A Knowledge Layer não é memória conversacional e não substitui o `ConversationSnapshot`.
