---
id: cos
title: COS
domains: [help, general]
aliases: [assistente cos, assistente eme, conversa operacional]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure]
---

# COS

## O que é

O COS é a camada conversacional operacional do portal EME. Ele interpreta o ato da conversa, usa contexto recente, escolhe capabilities do Registry e delega execução aos handlers determinísticos.

## Para que serve

Permitir consultas, orientações e operações do corretor em linguagem natural sem substituir as regras, permissões e validações do portal.

## Entidades relacionadas

Conversa, mensagens recentes, workflow, pending input, referências de entidades, tópicos, resultados estruturados, capability e execução.

## O que o usuário pode fazer

Perguntar, consultar dados, solicitar ações, corrigir um dado do fluxo, confirmar, rejeitar, cancelar, selecionar resultados, mudar e retomar tópicos.

## O que o COS pode fazer

Somente as capabilities validadas do Registry. O COS pode consultar, criar, atualizar, publicar, gerar e orientar conforme o descriptor e o handler de cada capability.

## Fluxos principais

```text
mensagem + ConversationSnapshot
→ Dialogue Decision
→ domínio/referências/objetivo
→ capability e plano
→ workflow/executor
→ resultado factual tipado
→ resposta
```

## Regras de negócio

- Perguntar se o COS consegue fazer algo não executa a ação.
- Mutação ambígua exige entidade resolvida ou seleção.
- Confirmação vem do descriptor da capability.
- Resultado pode ser sucesso, espera de dado ou erro; a mensagem textual não muda esse estado.
- IA não executa diretamente no banco.

## Estados e status

Workflows podem estar em execução, aguardando dado, aguardando confirmação, concluídos, falhos ou cancelados. Esses nomes são internos; a resposta ao usuário deve ser natural.

## Relação com outros módulos

O COS usa o Registry como fonte de capacidades e os dados dos módulos sob o escopo do corretor. A interface visual continua disponível independentemente do COS.

## Limitações atuais

Não possui memória infinita, não mantém múltiplos workflows mutantes simultâneos e não deve prometer uma capability ausente. O canal WhatsApp possui runtime separado e não é descrito como paridade do portal.

## Termos oficiais

COS; conversa; ação; consulta; confirmação; seleção. Evitar expor `workflow`, action enums ou status técnicos.

## Exemplos de perguntas

- “Você consegue criar uma proposta?”
- “Qual cliente está ativo nesta conversa?”

## Exemplos de pedidos operacionais

- “Cadastre a Marina.”
- “Na verdade, corrige o valor para 850 mil.”
