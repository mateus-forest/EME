---
id: compromissos
title: Compromissos
domains: [agenda]
aliases: [agenda operacional, eventos da agenda, lembretes]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure]
---

# Compromissos

## O que é

Compromisso é o termo de apresentação para a entidade técnica `AgendaEvent` e para o domínio interno `agenda`.

## Para que serve

Organizar tarefas, visitas e lembretes por data/horário, opcionalmente vinculados a cliente e imóvel.

## Entidades relacionadas

Compromisso, corretor, cliente e imóvel. Dados principais: título, tipo, data, hora, notas e status.

## O que o usuário pode fazer

Criar, consultar, editar, concluir, cancelar e reabrir compromissos; filtrar por hoje, amanhã, próximos sete dias ou todos na interface.

## O que o COS pode fazer

Criar, listar por filtro, consultar hoje/semana/mês, concluir, atualizar e cancelar.

## Fluxos principais

Criar compromisso → acompanhar na agenda → remarcar ou concluir; cancelamento mantém o registro e histórico.

## Regras de negócio

- Pergunta sobre agenda é consulta, não criação.
- Criação exige instrução de execução e dados temporais suficientes; horário pode virar pending.
- Atualização/cancelamento precisam de alvo resolvido; cancelamento exige confirmação.

## Estados e status

O padrão técnico é `pending`. Os handlers também trabalham com conclusão e cancelamento. Na apresentação use “pendente”, “concluído” e “cancelado”.

## Relação com outros módulos

Pode se vincular a [Clientes](02-clientes.md) e [Imóveis](03-imoveis.md). O COS usa contexto temporal para hoje, amanhã, semana e mês.

## Limitações atuais

O modelo atual não é integração com calendário externo e não possui recorrência formal no schema. Embora o descriptor do COS diga que atualização cobre data, o handler atual atualiza principalmente título, horário e notas. A UI não expõe os vínculos opcionais com cliente/imóvel, e a rota precisa de validação adicional desses IDs no escopo do corretor.

## Termos oficiais

Compromisso; visita; tarefa; lembrete. “Agenda” pode nomear a área, mas não deve substituir “compromisso” em uma frase ao usuário.

## Exemplos de perguntas

- “Tenho compromisso amanhã?”
- “Como está minha semana?”

## Exemplos de pedidos operacionais

- “Crie um compromisso sexta às 15h.”
- “Cancele a visita de amanhã.”
