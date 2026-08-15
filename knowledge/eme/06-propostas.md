---
id: propostas
title: Propostas
domains: [proposal]
aliases: [documento de proposta, oferta comercial, negociacao proposta]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure]
---

# Propostas

## O que é

Proposta é um documento comercial persistido como `BrokerDocument` do tipo `proposal`, normalmente associado a cliente e imóvel.

## Para que serve

Registrar uma oferta para revisão e continuidade da negociação antes de eventual contrato.

## Entidades relacionadas

Documento do corretor, cliente, imóvel e, por continuidade comercial, contrato. Não existe modelo Prisma exclusivo de proposta.

## O que o usuário pode fazer

Criar, consultar/listar, marcar assinatura manual na interface documental e usar a referência da proposta em atendimentos compatíveis do Marketplace. Conteúdo e status ficam no documento; o PDF é obtido pela impressão do preview no navegador, sem consumo de crédito na rota atual.

## O que o COS pode fazer

Criar uma proposta em rascunho e listar/resumir propostas existentes. A criação resolve cliente e imóvel e pode pedir seleção.

## Fluxos principais

Resolver cliente e imóvel → informar condições/valor → criar rascunho → revisar → usar na negociação → criar contrato quando apropriado.

## Regras de negócio

- O COS não inventa cliente, imóvel ou condição ausente.
- Valor corrigido durante workflow deve substituir o slot atual, não iniciar outro domínio.
- A existência de proposta não cria automaticamente um contrato.

## Estados e status

O status é string do `BrokerDocument`. A API/UI documental trabalha com `draft`, `generated`, `signed` e `archived`; o COS cria `draft`, enquanto a criação manual atual usa `generated`. Não há enum formal ou aceite/rejeição persistidos.

## Relação com outros módulos

Depende de [Clientes](02-clientes.md) e [Imóveis](03-imoveis.md); pode anteceder [Contratos](07-contratos.md) e ser compartilhada no chat Marketplace quando compatível.

## Limitações atuais

Não há cálculo automático universal de financiamento, comissão ou aceite. O modelo documental genérico limita uma taxonomia formal de estados. A UI coleta condições comerciais mais detalhadas do que o handler atual do COS, e não existe relação proposta→contrato além dos vínculos comuns a cliente/imóvel.

## Termos oficiais

Proposta; oferta; valor da proposta; rascunho; cliente; imóvel.

## Exemplos de perguntas

- “Quais propostas estão em rascunho?”
- “Qual o valor dessa proposta?”

## Exemplos de pedidos operacionais

- “Crie uma proposta de 850 mil para esse imóvel.”
- “Liste minhas propostas.”
