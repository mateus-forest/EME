---
id: financeiro
title: Financeiro
domains: [finance]
aliases: [visao financeira, comissoes, fluxo de caixa]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, rule]
---

# Financeiro

## O que é

Financeiro é uma visão operacional calculada a partir da carteira, documentos e configuração de comissão do corretor; não é escrituração contábil.

## Para que serve

Apresentar resumos de recebíveis, pagamentos, previsão, comissão e fluxo de caixa conforme os dados disponíveis.

## Entidades relacionadas

`BrokerFinancialConfig`, imóveis, clientes e documentos. A configuração registra percentual de comissão e filtros de cálculo/visualização.

## O que o usuário pode fazer

Consultar indicadores e configurar parâmetros de comissão e filtros na tela financeira.

## O que o COS pode fazer

Gerar resumo/análise financeira e consultar recebíveis, pagamentos, previsão, comissão e fluxo de caixa pelas capabilities atuais.

## Fluxos principais

Configurar percentual/filtros → consultar dados elegíveis → apresentar valores calculados e seu contexto.

## Regras de negócio

- Previsão e comissão calculada são estimativas operacionais.
- Não apresentar estimativa como valor contábil, liquidado ou garantido.
- A fonte e o filtro do cálculo precisam permanecer identificáveis.

## Estados e status

Não há ledger financeiro formal nem enum de liquidação no schema atual; os handlers derivam agrupamentos de documentos/status e configuração. “A pagar” e “fluxo de caixa” do COS usam custos fixos heurísticos por contrato, não despesas persistidas.

## Relação com outros módulos

Usa imóveis, clientes/documentos e alimenta análises de [Desempenho](10-desempenho.md).

## Limitações atuais

Não substitui sistema contábil, conciliação bancária ou controle fiscal. A precisão depende da atualização dos dados operacionais. O resumo do COS não aplica todos os filtros financeiros salvos; recebível, previsão e caixa são projeções ad hoc sobre imóveis/leads/contratos, e não títulos financeiros reais.

## Termos oficiais

Estimativa; comissão prevista; recebível; pagamento; previsão; fluxo de caixa operacional.

## Exemplos de perguntas

- “Quanto tenho de comissão prevista?”
- “Qual é meu fluxo de caixa operacional?”

## Exemplos de pedidos operacionais

- “Mostre os recebíveis.”
- “Analise meu resumo financeiro.”
