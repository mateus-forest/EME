---
id: imoveis
title: Imóveis
domains: [property]
aliases: [carteira de imoveis, cadastro de imovel, propriedades]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure]
---

# Imóveis

## O que é

Imóvel é o cadastro privado (`Property`) de uma unidade da carteira. Publicação é um estado/ato; Catálogo e Marketplace são superfícies públicas distintas.

## Para que serve

Guardar identificação, descrição, preço, localização, tipo, finalidade, características, mídia, dados jurídicos/documentais e vínculos comerciais.

## Entidades relacionadas

Corretor, imobiliária, cliente, compromisso, documento, contrato, campanha Studio, conversa Marketplace e eventos de catálogo.

## O que o usuário pode fazer

Criar manualmente ou por importação/IA, editar, adicionar mídia, buscar, pausar, excluir e controlar publicação no catálogo e Marketplace.

## O que o COS pode fazer

Criar rascunho, buscar, consultar detalhe, melhorar descrição, publicar/despublicar no catálogo, atualizar mídia, sugerir preço e excluir mediante as regras do Registry.

## Fluxos principais

Cadastro → revisão dos dados/mídias → publicação → atendimento e documentos. Studio IA pode usar uma fotografia válida do imóvel como fonte.

## Regras de negócio

- `published`/status do catálogo e `marketplacePublished` são controles diferentes.
- Sugestão de preço é operacional e baseada na carteira; não é laudo de avaliação.
- Exclusão remove o cadastro e exige confirmação.
- O preço é persistido em centavos como número inteiro; formatação monetária pertence à apresentação.
- A API atual aceita até seis imagens por imóvel.

## Estados e status

`DRAFT` = rascunho; `PUBLISHED` = publicado; `PAUSED` = pausado. `marketplacePublished` controla separadamente a presença no Marketplace.

## Relação com outros módulos

Imóveis alimentam [Catálogo](04-catalogo.md), [Marketplace](05-marketplace.md), [Propostas](06-propostas.md), [Contratos](07-contratos.md), compromissos e [Studio IA](11-studio.md).

## Limitações atuais

Nem todos os dados jurídicos possuem colunas próprias; parte fica em JSON. Áudio e imagens dependem de armazenamento válido; gravação direta de áudio ainda não está disponível, embora upload funcione. A capability de “melhorar descrição” atualmente devolve/pede a base existente e não persiste uma geração por IA. A sugestão de preço usa comparáveis da própria carteira e não dados externos. Publicação não substitui revisão de qualidade.

## Termos oficiais

Imóvel; cadastro; rascunho; publicado; pausado; mídia; finalidade de venda ou locação. Evitar usar “anúncio” como sinônimo de todo o cadastro.

## Exemplos de perguntas

- “Quantos metros tem esse imóvel?”
- “Quais imóveis tenho em Gramado?”

## Exemplos de pedidos operacionais

- “Crie um imóvel em rascunho.”
- “Publique o segundo imóvel no catálogo.”
