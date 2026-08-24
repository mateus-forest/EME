---
id: catalogo
title: Catálogo
domains: [catalog]
aliases: [catalogo publico individual, link do corretor, vitrine individual]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure]
---

# Catálogo

## O que é

Catálogo é o catálogo público individual do corretor ou da imobiliária, identificado por uma URL própria. Não é o Marketplace agregado do EME.

## Para que serve

Apresentar uma vitrine pública compartilhável dos imóveis publicados daquele proprietário do catálogo.

## Entidades relacionadas

`Catalog`, corretor ou imobiliária, slug público, imóveis e `CatalogEvent` para visualizações/interações.

## O que o usuário pode fazer

Configurar apresentação, visualizar preview, copiar/abrir/compartilhar a URL e controlar quais imóveis aparecem por publicação.

## O que o COS pode fazer

Resumir e analisar catálogo, publicar ou remover imóvel, fornecer link e consultar estatísticas.

## Fluxos principais

Configurar catálogo → publicar imóveis → compartilhar URL → receber visualizações e contatos → acompanhar estatísticas. A página pública consulta ao vivo o perfil e os imóveis publicados; não há rotina de cópia/sincronização do inventário.

## Regras de negócio

- Catálogo = vitrine pública individual.
- Marketplace = ambiente público agregado.
- O corretor e o mesmo imóvel podem estar nos dois canais ao mesmo tempo; as publicações no Catálogo e no Marketplace são independentes.
- Remover do catálogo não apaga o imóvel privado.
- Publicar requer um imóvel resolvido e confirmação conforme Registry.

## Estados e status

A disponibilidade pública decorre do catálogo/slug e da publicação dos imóveis; o modelo `Catalog` não possui enum próprio de status.

## Relação com outros módulos

Usa [Imóveis](03-imoveis.md), identidade do corretor/imobiliária e eventos em [Desempenho](10-desempenho.md). Compare com [Marketplace](05-marketplace.md).

## Limitações atuais

As métricas dependem dos eventos efetivamente registrados. Badges “ativo” e “sincronizado” são informativos na UI, não estados persistidos. Nome/foto são dados globais do usuário e também podem aparecer no Marketplace. Configurações exclusivas do Marketplace não pertencem à gestão de Catálogo.

## Termos oficiais

Catálogo; catálogo público individual; link do catálogo; preview do catálogo. Evitar “Marketplace do corretor”.

## Exemplos de perguntas

- “Qual é o link do meu catálogo?”
- “Quantos imóveis estão publicados no catálogo?”

## Exemplos de pedidos operacionais

- “Publique esse imóvel no catálogo.”
- “Compartilhe meu catálogo.”
