---
id: desempenho
title: Desempenho
domains: [analytics]
aliases: [analytics operacional, metricas comerciais, performance da operacao]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, rule]
---

# Desempenho

## O que é

Desempenho reúne métricas operacionais e comerciais derivadas de clientes, imóveis, catálogo, buscas e documentos.

## Para que serve

Dar visibilidade sobre carteira, pipeline, publicação, interação pública e ritmo comercial.

## Entidades relacionadas

Clientes, imóveis, `CatalogEvent`, `SearchEvent`, documentos, conversas e telemetria. Cada indicador precisa manter sua fonte real.

## O que o usuário pode fazer

Consultar painéis e acompanhar recortes disponíveis de clientes, imóveis, vendas e catálogo.

## O que o COS pode fazer

Consultar resumo geral, performance, vendas, imóveis, clientes e saúde operacional pelas capabilities de analytics/operação.

## Fluxos principais

Eventos e registros operacionais → agregação → indicador → leitura contextual. Não há mutação de desempenho pelo COS.

## Regras de negócio

- Avaliação pública de cliente não é performance operacional.
- Média pública não deve ser combinada com tempo de resposta, leads, imóveis, propostas ou vendas.
- Métrica sem evento/dado suficiente deve ser apresentada como indisponível, não inventada.

## Estados e status

Indicadores são valores calculados; não possuem um ciclo único de status. Status de origem permanecem nos módulos correspondentes.

## Relação com outros módulos

Agrega dados de Clientes, Imóveis, Catálogo e operação. Avaliações do [Marketplace](05-marketplace.md) permanecem separadas.

## Limitações atuais

Cobertura varia conforme instrumentação e volume. A API da tela possui períodos, origens e separação Catálogo/Marketplace, mas capabilities diferentes do COS calculam conjuntos distintos: algumas são all-time, uma usa contexto limitado a 20 registros e certos labels podem agregar eventos de fontes diferentes. Não são séries históricas completas nem auditoria financeira.

## Termos oficiais

Desempenho; indicador; métrica operacional; visualização; lead; conversão. Evitar usar “nota” pública como score operacional.

## Exemplos de perguntas

- “Como está a performance da minha carteira?”
- “Quantos imóveis estão publicados?”

## Exemplos de pedidos operacionais

- “Analise minha operação.”
- “Mostre o desempenho dos clientes.”
