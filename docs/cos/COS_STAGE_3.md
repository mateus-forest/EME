# COS — Etapa 3 — Livro do EME

Data: 14/08/2026

Escopo: fonte versionada de conhecimento operacional. O runtime do COS e o runtime do WhatsApp não foram integrados ou alterados nesta etapa.

## Resultado

Foi criado `knowledge/eme/` com 16 capítulos Markdown, frontmatter uniforme e conteúdo verificado contra a implementação real. O Livro diferencia fatos atuais, limitações e dívida técnica; não incorpora roadmap nem regra comercial presumida.

Capítulos:

1. EME;
2. COS;
3. Clientes;
4. Imóveis;
5. Catálogo;
6. Marketplace;
7. Propostas;
8. Contratos;
9. Compromissos;
10. Financeiro;
11. Desempenho;
12. Studio IA;
13. Planos e conta;
14. Regras de negócio;
15. Glossário;
16. Capacidades do COS.

## Fontes usadas

- `prisma/schema.prisma`, incluindo entidades, relações e enums atuais;
- rotas de API do portal, Catálogo, Marketplace, Studio, documentos, contratos, agenda, financeiro, analytics, conta e plano;
- componentes das telas correspondentes;
- `lib/cos/entities/**`, Capability Catalog, Registry, handlers e capabilities;
- configurações em `lib/eme-plans.ts`, billing e política de créditos;
- engines de proposta/contrato, busca/publicação, comunicação Marketplace e campanhas Studio;
- `docs/help/*.md` como evidência secundária, nunca prevalecendo sobre o runtime.

## Metadata e validação

Cada capítulo declara:

- `id`;
- `title`;
- `domains`;
- `aliases`;
- `version`;
- `updated_at`;
- `knowledge_type`.

O comando `npm run cos:knowledge:validate` valida:

- os 16 capítulos obrigatórios;
- frontmatter e campos requeridos;
- IDs únicos;
- domínios e tipos conhecidos;
- aliases globais duplicados;
- seções obrigatórias dos módulos;
- links Markdown internos;
- correspondência entre as 74 capabilities e as 74 chaves de handler;
- sincronização exata do capítulo de capabilities com o inventário derivado do Registry.

`npm run cos:knowledge:sync` regenera apenas o trecho marcado do inventário, sem criar uma segunda fonte manual.

## Divergências encontradas

### Clientes

- A UI usa “Clientes”, mas a entidade é `Lead`; labels de `CONTACTED`, `NEGOTIATING`, `LOST` e `ARCHIVED` ainda variam entre contratos de apresentação.
- Cadastro manual pode deduplicar por contato; entradas públicas não seguem necessariamente a mesma regra.
- “Visita agendada” pode ser inferência textual, não compromisso persistido.

### Imóveis, Catálogo e Marketplace

- Publicação no Catálogo e no Marketplace é independente.
- `property.archive` exclui fisicamente, apesar do nome sugerir arquivamento reversível.
- “Catálogo ativo/sincronizado” é badge visual, não estado persistido; o catálogo consulta dados ao vivo.
- O Assistente público do Marketplace não é o runtime operacional privado do COS.
- O matching não usa diretamente especialidade, prazo ou financiamento; a listagem ainda possui mapa ilustrativo.
- Não há capability Marketplace no Registry do COS.

### Propostas e contratos

- Propostas são `BrokerDocument`, sem modelo próprio; UI e COS criam status iniciais diferentes e o PDF atual usa impressão do navegador.
- Contratos possuem motor legado e motor novo de template/versão/instância.
- O COS ainda cria/opera documento legado e não sincroniza integralmente a instância moderna.
- Modelos importados preservam o texto e proíbem criação de cláusula; o gerador legado ainda produz cláusulas programáticas.
- Assinatura é registro de evento externo, não assinatura digital nativa certificada.

### Compromissos, financeiro e desempenho

- Atualização de compromisso pelo COS não cobre todos os campos prometidos pelo descriptor.
- Financeiro não possui ledger, títulos, despesas ou pagamentos: os números são projeções/heurísticas.
- UI e capabilities de analytics usam períodos, limites e taxonomias diferentes; uma leitura do COS limita parte do contexto a 20 registros.
- Avaliação pública permanece separada de performance operacional.

### Studio, planos e conta

- Pipelines reais do Studio e capabilities COS não são equivalentes; o COS atual gera principalmente texto, registros e roteiro, sem disparar todo renderer/provider.
- “Adapter pronto” não garante provider disponível.
- `docs/help/planos.md` dizia que upgrade era apenas contato comercial, mas há checkout real quando Stripe está configurado.
- UI e backend não aplicam de forma idêntica a restrição de pacotes extras no Free.
- Um branch legado ainda menciona PIN de quatro dígitos; a validação atual exige seis.

## Fatos não confirmados ou deliberadamente não documentados como regra

- monetização, limites ou política de destaque específica do Marketplace;
- painel administrativo atual para imagens de região;
- busca semântica/LLM no Marketplace;
- assinatura digital nativa ICP-Brasil;
- contabilidade, conciliação bancária ou comissões realizadas;
- provider/modelo do Studio como promessa estável;
- feature futura copiada de landing ou comentário sem implementação.

## Pontos preparados para a Etapa 4

- metadata filtrável por domínio, alias e tipo;
- seções previsíveis para chunking por heading;
- regras transversais separadas de módulos;
- glossário próprio;
- inventário de capabilities sincronizado com o Registry;
- IDs e versões estáveis para observabilidade.

## Validação

- `npm run cos:knowledge:validate`: passou — 16 capítulos, 74 capabilities e 48 aliases únicos;
- `npm run lint`: passou;
- `npx tsc --noEmit`: passou;
- `npm run build`: passou — 98 páginas estáticas;
- permaneceu apenas o warning preexistente do Next sobre múltiplos lockfiles/workspace root;
- o script em Node emite warnings não bloqueantes de type stripping/módulo sem `type: module`.
