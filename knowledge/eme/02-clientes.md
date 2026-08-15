---
id: clientes
title: Clientes
domains: [lead]
aliases: [crm de clientes, carteira de clientes, atendimento de leads]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure]
---

# Clientes

## O que é

Clientes é a apresentação do cadastro técnico `Lead`. “Lead” continua legítimo para origem comercial, funil, métricas e integrações; para uma pessoa já identificada na interface, prefira “cliente”.

## Para que serve

Registrar dados de contato, origem, interesse, vínculo com imóvel, histórico e andamento comercial.

## Entidades relacionadas

`Lead` pode se relacionar a imóvel, corretor ou imobiliária, usuário, mensagens, compromissos, documentos, contratos, conversas e avaliações do Marketplace.

## O que o usuário pode fazer

Cadastrar, localizar, editar, excluir, converter, consultar timeline e vincular documento. A tela mantém dados pessoais, contato, interesse e histórico quando existentes.

## O que o COS pode fazer

Criar/atualizar por conversa, resumir, localizar, editar, excluir com segurança, consultar timeline, converter e anexar documento. O Registry define seleção e confirmação.

## Fluxos principais

Cadastro → complementação dos dados → acompanhamento → negociação → ganho, perda ou arquivamento. No cadastro manual, telefone/e-mail já existentes para o corretor podem atualizar o registro correspondente; entradas públicas não compartilham necessariamente a mesma deduplicação. Um cliente pode ser associado a proposta, contrato, imóvel e compromisso.

## Regras de negócio

- Uma mutação sem cliente inequívoco não pode escolher silenciosamente o registro mais recente.
- Exclusão é permanente e exige confirmação explícita.
- Telefone pode ajudar a identificar e evitar duplicidade, mas máscara visual não substitui validação.

## Estados e status

`NEW` = novo; `CONTACTED` = contatado; `NEGOTIATING` = em negociação; `WON` = convertido/ganho; `LOST` = perdido; `ARCHIVED` = arquivado.

## Relação com outros módulos

Clientes podem estar ligados a [Imóveis](03-imoveis.md), [Propostas](06-propostas.md), [Contratos](07-contratos.md), [Compromissos](08-compromissos.md) e Marketplace.

## Limitações atuais

Campos são opcionais no banco; o COS pode precisar pedir nome, telefone ou seleção conforme a ação. Não há garantia de unicidade por nome. A indicação visual “visita agendada” é hoje inferida de texto e não garante um `AgendaEvent`; algumas origens podem aparecer com chave técnica se não houver label normalizada.

## Termos oficiais

Cliente na apresentação; lead ao falar de captação, origem ou funil; atendimento para interação comercial.

## Exemplos de perguntas

- “Qual é o telefone da Marina?”
- “Quantos leads entraram esta semana?”

## Exemplos de pedidos operacionais

- “Cadastre o cliente João da Silva.”
- “Atualize o telefone dela.”
