---
id: marketplace
title: Marketplace
domains: [marketplace]
aliases: [portal publico agregado, busca publica de imoveis, corretores publicos]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, rule]
---

# Marketplace

## O que é

Marketplace é o ambiente público agregado do EME para descoberta de imóveis, regiões e corretores. Ele não é o catálogo individual.

## Para que serve

Conectar pessoas interessadas ao inventário publicado e ao corretor responsável, com busca, matching e continuidade do atendimento dentro do EME.

## Entidades relacionadas

Corretor e perfil público, imóvel com `marketplacePublished`, região, busca, lead, conversa, mensagem, proposta compartilhada, avaliação e mídia regional.

## O que o usuário pode fazer

Buscar e filtrar imóveis, navegar por regiões/corretores, abrir perfis e detalhes, iniciar “Falar agora”, continuar conversa e avaliar atendimento quando aplicável.

## O que o COS pode fazer

O Registry atual não possui domínio operacional próprio de Marketplace. Perguntas explicativas usam ajuda/conhecimento; o assistente público de busca é uma integração distinta das capabilities privadas do COS.

## Fluxos principais

Descoberta → imóvel/corretor → conversa persistida → criação ou enriquecimento de lead → atendimento → encerramento → solicitação de avaliação → moderação administrativa.

## Regras de negócio

- Somente imóveis marcados para Marketplace compõem o inventário público agregado.
- Um corretor público precisa estar ativo e ter ao menos um imóvel publicado no Marketplace; CRECI ausente afeta o selo de verificação, não impede sozinho o perfil.
- Conversa pode estar ligada a corretor, imóvel e lead.
- No chat, anexos estruturados aceitos são imóvel publicado e proposta compatível; não é área documental.
- Avaliação nasce `PENDING_REVIEW`; somente `APPROVED` aparece e entra na média.
- O corretor avaliado não aprova sua própria avaliação.
- Avaliação pública não é performance operacional.
- Telefone do avaliador não é público; pode verificar vínculo com conversa/lead.

## Estados e status

Conversa: `OPEN` = aberta; `CLOSED` = encerrada. Avaliação: `PENDING_REVIEW` = em análise; `APPROVED` = aprovada; `REJECTED` = rejeitada. Mensagens: texto, imóvel ou proposta.

## Relação com outros módulos

Usa [Imóveis](03-imoveis.md), [Clientes](02-clientes.md), propostas, perfil do corretor e moderação administrativa. É separado de [Catálogo](04-catalogo.md).

## Limitações atuais

Não há regra comercial/monetização do Marketplace definida neste Livro. O matching não pondera diretamente especialidade declarada, prazo ou financiamento; pesquisar corretores não cria lead até a conversa começar. O Assistente público filtra o inventário carregado localmente e não é o runtime privado do COS. O mapa do detalhe é real/aproximado, mas o mapa da listagem ainda é ilustrativo. Imagens de região admitem mídia específica cadastrada e fallback neutro, sem banco nacional ou gestão administrativa confirmada. Avaliação sem vínculo não é bloqueada, mas fica sinalizada para moderação.

## Termos oficiais

Marketplace; perfil público; Falar agora; conversa; avaliação verificada; em análise. Evitar chamar Marketplace de catálogo.

## Exemplos de perguntas

- “Qual a diferença entre meu Catálogo e o Marketplace?”
- “Como uma avaliação aparece no meu perfil?”

## Exemplos de pedidos operacionais

- “Mostre imóveis publicados no Marketplace em determinada região.”
- “Quero falar agora com o corretor deste imóvel.”
