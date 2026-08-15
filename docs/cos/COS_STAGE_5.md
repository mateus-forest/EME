# COS — Etapa 5: Response Layer e localização

Data: 15/08/2026  
Escopo: runtime do COS no portal/PWA. O runtime do WhatsApp não foi alterado.

## Resultado

A apresentação deixou de depender de inferências sobre o texto da resposta. O executor continua sendo a fonte factual e tipada (`success`, `awaiting_input` ou `error`); a nova Response Layer converte esse resultado em um `CosResponseViewModel` aditivo, mantendo o campo legado `response` para compatibilidade.

## Response View Model

`lib/cos/response-view-model.ts` define `CosResponseViewModel` versão 1 e os estados de apresentação:

- `success`;
- `error`;
- `awaiting_input`;
- `confirmation_required`;
- `query_result`;
- `explanation`;
- `selection`;
- `partial_result`;
- `warning`;
- `cancelled`.

O modelo pode carregar pending, opções, confirmação, etapas concluídas e código interno de erro separado do texto seguro. A classificação considera o resultado tipado e o dialogue act; não procura palavras como “sucesso” ou “qual” na resposta.

## Fluxo no portal

```text
handler -> resultado factual tipado -> executor
        -> CosResponseViewModel -> texto pt-BR + estrutura de UI
        -> response (compatibilidade) + responseView
        -> persistência em metadata -> API de histórico -> hook/UI
```

A rota do portal persiste e devolve `responseView`. A API de histórico o restaura quando presente. Conversas anteriores, sem o novo campo, continuam usando `response` e o adapter estrito de encoding legado.

Confirmações agora fornecem `prompt`, `confirmLabel` e `cancelLabel` estruturados no servidor. O parser por regex do cliente permanece apenas como compatibilidade para mensagens antigas.

## Localização

`lib/cos/localization.ts` centraliza:

- nomes dos domínios conforme o glossário do Livro do EME;
- labels de interação;
- status de runtime, action, workflow, cliente, imóvel, compromisso, contrato, documento e Studio IA;
- reparo exclusivamente de sequências de mojibake conhecidas em conteúdo legado.

Status desconhecido não é devolvido cru. Os handlers de clientes, compromissos, contratos e documentos passaram a localizar os status antes de formar texto para o usuário.

## Encoding e compatibilidade

Os literais corrompidos foram corrigidos na origem em workflow, planner, fast actions e Studio. O antigo `repairCosText`, que substituía palavras comuns e podia alterar nomes legítimos como “Naomi”, foi removido do cliente. `repairLegacyCosText` reconhece apenas sequências inequivocamente corrompidas e só é usado na hidratação/fallback de conteúdo antigo.

`formatCosCapabilityResponse` continua com o comportamento anterior porque é compartilhado com o WhatsApp. A centralização nova ocorre em `formatCosExecutionPlanResponse` e na rota do portal; assim o canal fora do escopo não mudou.

## Respostas multi-step e erros

- Execuções completas resumem os fatos confirmados das etapas, sem expor nomes de actions.
- Execução parcial preserva os fatos já concluídos e apresenta somente a pergunta/erro da etapa interrompida.
- Erros tipados nunca são convertidos em sucesso.
- Códigos internos permanecem estruturados e não entram no texto.
- Stack traces, erros Prisma, JSON de provider e actions técnicas são rejeitados como texto de falha.

Não foi adicionado novo uso de LLM para NLG. A apresentação é determinística; perguntas explicativas continuam usando os chunks selecionados pela Knowledge Layer antes de chegar ao ViewModel.

## Testes

- `tests/e2e/cos-response-layer.spec.ts`: criação/sucesso, consulta, explicação, capability question, erro, pending, seleção, confirmação, cancelamento, parcial, multi-step, parser e compatibilidade do formatter.
- `tests/e2e/cos-localization.spec.ts`: domínios, status por namespace, labels, adapter legado, ausência de mojibake no runtime e ausência de status técnicos em labels finais.
- Regressão estrutural das Etapas 1–5: 110/110 testes passaram.
- `npm run lint`, `npx tsc --noEmit` e `npm run build`: passaram; o build gerou 98 páginas estáticas.
- A tentativa de `tests/e2e/cos-core.spec.ts` foi encerrada pelo limite externo de 240 segundos sem produzir resultado. Esse conjunto depende da sessão/autenticação do portal e já havia permanecido em `/login` na Etapa 4; nenhuma falha de assertion da Response Layer foi emitida antes do timeout.

## Limitações restantes

- `actionStatus="processing"` ainda representa workflow `awaiting_input` na persistência legada. A UI nova usa `responseView.kind`; alterar o campo legado exigiria migração compatível.
- Handlers ainda produzem parte da prosa factual. A Response Layer não reescreve fatos com LLM e deliberadamente não tenta corrigir conteúdo operacional incorreto por heurística.
- O parser de confirmação por texto no cliente permanece somente para histórico anterior à versão 1 do ViewModel.
- A localização é pt-BR central e intencionalmente não é um framework internacional de i18n.
