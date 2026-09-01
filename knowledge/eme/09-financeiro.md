---
id: financeiro
title: Financeiro
domains: [finance]
aliases: [visao financeira, comissoes, fluxo de caixa]
version: 2.0.0
updated_at: 2026-08-31
knowledge_type: [module, rule]
---

# Financeiro

## O que é

Financeiro é o controle operacional básico da carteira, recebimentos, despesas e comissões do corretor; não é escrituração contábil.

## Para que serve

Registrar lançamentos essenciais e apresentar recebidos, despesas, resultado do mês, valores a receber, atrasados e próximos recebimentos.

## Entidades relacionadas

`BrokerFinancialConfig`, `BrokerFinancialEntry`, `BrokerFinancialCommission`, imóveis, clientes, propostas, contratos, locações e pagamentos de locação. As relações reutilizam as entidades já existentes no EME.

## O que o usuário pode fazer

Registrar recebimentos, despesas e comissões, vincular cliente/imóvel/origem existentes, atualizar liquidação e consultar os indicadores.

## O que o COS pode fazer

Somente consultar resumo, carteira, recebidos, despesas, resultado, recebíveis, comissões e próximos vencimentos. O COS não cria nem altera lançamentos nesta etapa.

## Fluxos principais

Registrar lançamento na tela → vincular entidades do EME quando aplicável → atualizar status → consultar resumo e próximos vencimentos.

## Regras de negócio

- Valor da carteira soma os imóveis ativos, imóveis disponíveis para locação e valores mensais das locações ativas.
- Imóveis `DRAFT` e `PUBLISHED` permanecem na carteira operacional; somente `PAUSED` fica fora do valuation.
- Uma locação `ACTIVE` prevalece sobre venda/locação disponível para que o mesmo imóvel não seja contado duas vezes.
- Imóveis sem valor informado permanecem nas contagens, mas não acrescentam zero artificial à soma.
- Valor da carteira é indicador operacional e nunca entra no cálculo de receita ou resultado.
- Entradas do mês consideram somente recebimentos com data de liquidação no mês.
- Saídas do mês consideram somente despesas pagas no mês.
- Comissões são calculadas automaticamente por `valor da operação × percentual`.
- Pagamentos de locação existentes aparecem como fonte integrada somente leitura no Financeiro.

## Estados e status

Recebimentos e comissões usam `EXPECTED`, `RECEIVED` e `OVERDUE`; despesas usam `PENDING` e `PAID`. Um título não recebido com data anterior ao dia atual é apresentado como atrasado.

## Relação com outros módulos

Usa imóveis, clientes, propostas, contratos e locações sem duplicar essas entidades e alimenta análises de [Desempenho](10-desempenho.md).

## Limitações atuais

Não substitui sistema contábil, conciliação bancária ou controle fiscal. Não integra bancos, PIX, boleto, nota fiscal ou DRE. Não se mistura ao faturamento da assinatura EME. A precisão depende da atualização dos lançamentos operacionais.

## Termos oficiais

Recebimento; despesa; comissão; previsto; recebido; atrasado; pago; valor da carteira; fluxo de caixa operacional.

## Exemplos de perguntas

- “Quanto recebi este mês?”
- “Quanto tenho a receber?”
- “Quais comissões estão atrasadas?”
- “Quanto gastei este mês?”
- “Qual o valor da minha carteira?”
- “Quais são meus próximos recebimentos?”

## Exemplos de pedidos operacionais

- “Mostre os recebíveis.”
- “Analise meu resumo financeiro.”
