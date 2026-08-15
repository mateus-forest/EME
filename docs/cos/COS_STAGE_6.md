# COS — Etapa 6: evals conversacionais reais

Data: 15/08/2026
Escopo: avaliação determinística do COS do portal. Nenhuma chamada paga e nenhuma alteração no runtime do WhatsApp.

## Estrutura

A suíte agora separa seis perspectivas que antes estavam misturadas:

1. **routing** — dialogue act, domínio e capability;
2. **context** — entidade ativa, pronome, ordinal, pending, mudança e retorno de tópico;
3. **knowledge** — documentos/chunks selecionados e knowledge miss;
4. **execution** — executor real com handlers-fixture tipados;
5. **response/localization** — ViewModel, texto pt-BR, erro seguro e ausência de enum/mojibake;
6. **end-to-end conversation** — aprovação integral de cada conversa multi-turno.

O conjunto legado de 400 casos single-turn continua disponível como métrica de routing, mas não compõe uma média geral. Assim ele não pode ocultar regressões de contexto, execução ou resposta.

## Golden dataset

`lib/cos/evals/conversations/golden.ts` contém 50 conversas multi-turno escritas explicitamente, com 111 turnos e expectativas independentes para:

- Clientes;
- Imóveis;
- Propostas;
- Compromissos;
- Contratos;
- Financeiro;
- Desempenho;
- Studio IA;
- conhecimento do EME;
- troca/retorno de contexto;
- confirmações, ambiguidades e instruções maliciosas.

Os casos não são gerados por permutação de nome/valor. Estado de banco necessário para referência e ambiguidade é representado por fixtures versionadas de entidade, selection set, tópico e pending.

## Execution eval

O runner chama `executeCosExecutionPlan` real com handlers-fixture injetados no contrato oficial. Ele cobre:

- criação;
- consulta;
- edição;
- confirmação;
- cancelamento antes da execução;
- awaiting input;
- erro tipado;
- propagação de dependência;
- bloqueio de dependência após falha;
- exceção de handler sem falso sucesso.

Essa abordagem valida o executor sem depender de credenciais, provider ou dados pessoais. Ainda não substitui testes transacionais contra uma base de teste isolada.

## Knowledge e response

Knowledge eval chama o retrieval local real do Livro e confere IDs de documentos e evidências textuais esperadas. Isso inclui a diferença Catálogo/Marketplace, a nuance entre contratos importados e o gerador legado e a ausência de assinatura digital nativa ICP-Brasil. Response eval usa o ViewModel real, inclusive erro, pending, confirmação, capability question e multi-step. A localização valida vocabulário pt-BR e rejeita status técnico/mojibake.

## Métricas

O relatório publica separadamente:

- dialogue act accuracy;
- domain accuracy;
- capability accuracy;
- reference resolution;
- context continuity;
- knowledge retrieval;
- execution correctness;
- response correctness;
- localization;
- safety invariants;
- end-to-end conversation;
- routing legado.

Falhas permanecem visíveis em `docs/cos/COS_EVAL_REPORT.md`; o runner não muda o esperado para atingir 100%.

### Baseline registrado em 15/08/2026

| Métrica | Resultado |
|---|---:|
| Dialogue act | 65/111 (58,56%) |
| Domínio | 81/111 (72,97%) |
| Capability | 40/111 (36,04%) |
| Referência | 27/48 (56,25%) |
| Continuidade contextual | 19/86 (22,09%) |
| Knowledge retrieval | 6/19 (31,58%) |
| Execução | 10/10 (100%) |
| Resposta | 12/12 (100%) |
| Localização | 5/5 (100%) |
| Invariantes de segurança | 55/94 (58,51%) |
| Conversa ponta a ponta | 1/50 (2%) |
| Routing legado | 158/400 (39,5%) |

O baseline baixo em roteamento/contexto não foi corrigido nesta etapa de avaliação. Ele demonstra que os testes unitários A–J e da Decision Layer cobrem caminhos construídos, mas o conjunto linguístico mais diverso ainda encontra lacunas importantes em cadastro natural, continuidade, seleção, confirmação e escolha de capability. O descriptor `lead.delete` também continua sem `requiresSelection`, embora confirme e o handler faça resolução própria; a suíte registra essa dívida em vez de alterar a policy fora do escopo da Etapa 6.

## Execução

```bash
npm run cos:eval
```

O alias anterior `npm run cos:evals` permanece compatível. O comando grava:

- `reports/cos-evals/latest.json`;
- `reports/cos-evals/latest.md`;
- `docs/cos/COS_EVAL_REPORT.md`.

Para CI estrito:

```bash
COS_EVALS_STRICT=true npm run cos:eval
```

Por padrão, o comando reporta falhas e termina normalmente para permitir diagnóstico durante a evolução. Não há provider externo no CI.

## Validação

- `npm run cos:eval`: executado; gerou o baseline versionado de 400 casos legados, 50 conversas/111 turnos, 10 fixtures de execução, 12 de resposta e 5 de localização.
- `npx playwright test` nas 10 suítes estruturais diretamente relacionadas: **113/113 passaram**.
- `tests/e2e/cos-conversational-evals.spec.ts`: **3/3 passaram** dentro do conjunto acima.
- `npm run lint`: passou.
- `npx tsc --noEmit`: passou.
- `npm run build`: passou; 98 páginas estáticas geradas.
- Next.js manteve o warning preexistente de múltiplos lockfiles e inferiu `C:\Users\mateu` como workspace root.

## Limitações

- A suite conversa usa snapshots/fixtures explícitos; não cria registros reais em banco.
- O execution eval cobre o contrato e as dependências, não integra Prisma.
- Naturalidade é verificada por invariantes determinísticos, não por julgamento de LLM.
- Testes autenticados do portal continuam dependendo de uma sessão válida no ambiente local.
- O E2E autenticado `cos-core.spec.ts` não foi repetido na Etapa 6: na Etapa 5 ele atingiu o timeout de 240 segundos preso em `/login`, sem falha de assertion do COS. As suítes estruturais que não dependem dessa sessão foram executadas integralmente.
