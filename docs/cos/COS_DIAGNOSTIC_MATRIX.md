# Matriz diagnóstica conversacional do COS

Data: 14/08/2026. Os resultados abaixo caracterizam o runtime atual. Não expressam o comportamento desejado e nenhuma regra de produção foi alterada.

## Cenários A–J

| Cenário | Entrada/estado | Decisão observada | Efeito provável | Diagnóstico |
|---|---|---|---|---|
| A — criação simples | “Cadastre o cliente João da Silva.” | `createLead`, `start_new` | O handler pede telefone antes de criar. | A classificação inicial funciona; o nome sozinho não atende o mínimo do handler. |
| B — continuidade | “Cadastre a Marina.” → “Telefone 54…” | A segunda mensagem continua `createLead` por ser curta e haver workflow ativo. | Marina é criada quando nome e telefone chegam ao handler. | Continuidade depende do pending, não de compreensão do histórico. |
| B — continuidade após conclusão | “Coloca marina@email.com também.” + memória com `leadId` | `CREATE_PROPOSAL`, confiança baixa/média, e não `UPDATE_LEAD`. | Pode abrir esclarecimento ou proposta; não atualiza com segurança a Marina. | A entidade recém-criada não basta para entender a elipse. |
| C — correção | Proposta pendente com preço 900 mil → “Na verdade coloca R$ 850 mil.” | `LIST_DOCUMENTS`, `start_new`. | Abandona/substitui o workflow de proposta; preço corrigido não é aplicado. | Não existe operação conversacional de correção sobre slots já extraídos. |
| D — busca + ordinal | Busca com pending de duas opções → “O segundo.” | Continua `searchProperties`. | O handler pode escolher a segunda opção enquanto as opções estão no pending. | Ordinal funciona somente no estado local de seleção. |
| D — pronome após seleção | Memória aponta para o segundo imóvel → “Quantos metros ele tem?” | `GET_ANALYTICS_PROPERTIES`. | Responde métricas do portfólio, não a área do imóvel. | Não há resolução semântica de “ele” nem capability de detalhe do imóvel nessa camada. |
| E — consulta de agenda | “Tenho compromisso amanhã?” | `CREATE_AGENDA_EVENT`, confiança 0,54. | Pode perguntar horário para criar evento em vez de listar. | O Intent Resolver não oferece as actions de listagem da agenda como candidatas. |
| E — troca de assunto | Agenda pendente → “E quantos leads entraram essa semana?” | `getLeadsSummary`, `start_new`. | Troca de domínio funciona; o workflow anterior deixa de ser o ativo. | Troca é possível, mas não existe pilha para voltar ao workflow anterior. |
| F — retorno | Após clientes: “Voltando aos imóveis, abre o primeiro.” | `GET_ANALYTICS_PROPERTIES`. | Não abre a lista/imóvel anterior. | A ordem da busca anterior e o tópico anterior não são persistidos. |
| G — conhecimento | “Qual a diferença entre catálogo e Marketplace?” | `SHARE_CATALOG`, `start_new`. | Pode devolver link do catálogo em vez de explicar a diferença. | O conhecimento só é carregado depois que uma intent de ajuda já foi escolhida; Marketplace nem possui manual. |
| H — capacidade | “Você consegue cadastrar um cliente para mim?” | `createLead`, `start_new`. | Começa a execução e pergunta dados. | Não distingue pergunta sobre capacidade de ordem de execução. |
| I — ambiguidade | “manda aquele” sem estado | sem action, `none`. | Cai na conversa geral/planejador de IA conforme a rota e configuração. | Não há referente recuperável ou pedido estruturado de desambiguação. |
| J — linguagem | Formatter/workflow/status | Há literais com dupla codificação, enums em inglês e metadata técnica. | Texto corrompido ou status técnico pode chegar à UI. | Não existe camada central de localização; há reparos ad hoc no cliente. |

Os dez testes de caracterização estão em `tests/e2e/cos-audit-diagnostics.spec.ts`. Eles são puros: não autenticam, não executam handlers e não escrevem no banco.

## Frases isoladas pedidas na auditoria

Resultado de `resolveCosIntent` sem workspace, memória ou workflow ativo:

| Frase | Action atual | Decisão/confiança | Leitura |
|---|---|---|---|
| “sim” | nenhuma | `none`, 0 | Só tem significado se houver workflow ativo. |
| “não” | nenhuma | `none`, 0 | Fora do workflow não é cancelamento operacional. |
| “esse” | nenhuma | `none`, 0 | Sem referente. |
| “o segundo” | nenhuma | `none`, 0 | Sem lista/pending persistido. |
| “ele” | nenhuma | `none`, 0 | Sem resolução de pronome. |
| “ela” | nenhuma | `none`, 0 | Sem resolução de pronome. |
| “esse imóvel” | `GET_ANALYTICS_PROPERTIES` | `start_new`, 0,56 | Palavra “imóvel” ganha candidato estatístico mesmo sem pergunta quantitativa. |
| “aquele cliente” | `getLeadsSummary` | `start_new`, 0,56 | Palavra “cliente” ganha resumo; não resolve pessoa. |
| “agora muda o valor” | nenhuma | `none`, 0 | Não existe slot/campo ativo fora do pending. |
| “coloca o telefone também” | nenhuma | `none`, 0 | Não associa ao último cliente. |
| “não, deixa” | nenhuma | `none`, 0 | Regex de cancelamento exige forma exata. |
| “faz com aquele” | nenhuma | `none`, 0 | Não há entidade nem ação recuperável. |
| “o de ontem” | nenhuma | `none`, 0 | Referência temporal não é geral. |
| “pode criar” | `createPropertyDraft` | `start_new`, 0,52 | Empate com `createLead`; a ordem de registro decide por imóvel. |
| “manda” | nenhuma | `none`, 0 | Verbo não está no vocabulário de envio (`enviar`/`envie`). |
| “e amanhã?” | `CREATE_AGENDA_EVENT` | `start_new`, 0,38 | Sinal temporal isolado vira criação de evento. |
| “e os leads?” | `getLeadsSummary` | `start_new`, 0,56 | Consulta genérica de leads. |
| “agora uma proposta” | `LIST_DOCUMENTS` | `start_new`, 0,74 | O bônus de consulta/proposta vence `CREATE_PROPOSAL`. |
| “volta naquele imóvel” | `GET_ANALYTICS_PROPERTIES` | `start_new`, 0,56 | “volta” não recupera tópico; “imóvel” ativa analytics. |

Com workflow ativo, a regra muda: `sim` e `não` recebem score de continuidade 0,99; qualquer resposta de até quatro palavras recebe 0,70; uma opção numérica/label em pending de seleção recebe 0,96. A rota só cancela de modo inequívoco quando o cliente envia o flag `cancel`; portanto “não” pode retomar o handler como valor do campo pendente.

## Limites desta bateria

- Não valida banco, autenticação, crédito, persistência nem retorno real dos handlers.
- Não chama OpenAI e, portanto, mantém o resultado determinístico e reproduzível.
- Não corrige os resultados caracterizados.
- O script legado `scripts/run-cos-planner-scenarios.cjs` também foi executado e falhou no cenário “Quanto tenho de comissão prevista?”: esperado `getFinancialSummary`, observado `general`. Essa falha preexistente é registrada no relatório principal.
