---
id: studio
title: Studio IA
domains: [studio]
aliases: [studio de conteudo, criacao com ia, campanhas de imoveis]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure]
---

# Studio IA

## O que é

Studio IA é o conjunto de fluxos de geração e transformação de conteúdo imobiliário, persistidos como campanhas e peças quando aplicável.

## Para que serve

Criar textos e materiais para divulgação, campanhas, preparação visual de imóvel, visualização de obra/projeto e vídeo.

## Entidades relacionadas

`StudioCampaign`, assets, imóvel/fotografia de origem, corretor ou imobiliária, provider/modelo, prompt, status e créditos.

## O que o usuário pode fazer

Criar campanha para Instagram, atrair compradores, captar proprietários, vender imóvel, preparar fotografia, visualizar projeto/obra, gerar vídeo e revisar/aprovar peças conforme o fluxo.

## O que o COS pode fazer

O COS atual produz descrição/texto determinístico, registra campanhas com assets de texto, cria roteiro/registro de vídeo e clona campanha em regeneração. Ele não dispara todos os pipelines reais de imagem/vídeo das telas Studio: por exemplo, a capability de vídeo não renderiza via Luma. A disponibilidade efetiva depende do handler, dados e créditos.

## Fluxos principais

Selecionar objetivo e imóvel/fonte → validar mídia/provider/créditos → gerar campanha/asset → revisar → aprovar, rejeitar ou publicar quando suportado.

## Regras de negócio

- Uma peça que usa fotografia de imóvel deve usar mídia válida daquele imóvel.
- Falha de provider não deve ser registrada como sucesso nem trocar silenciosamente de provider.
- Resultado gerado não altera fatos do imóvel.
- Custos variam por operação; a política específica do fluxo pode prevalecer sobre custo genérico.

## Estados e status

Campanha: rascunho, processando, em revisão, aprovada, rejeitada, publicada ou falha. Assets possuem estados equivalentes, sem `PROCESSING` no enum próprio.

## Relação com outros módulos

Usa [Imóveis](03-imoveis.md), créditos/planos e telemetria de IA. Campanhas podem produzir imagens, vídeo, carrossel, Story, Reel, texto ou thumbnail.

## Limitações atuais

Provider/modelo variam por fluxo e credencial; “adapter pronto” não garante disponibilidade do provider. Geração real depende de mídia, MIME/tamanho, serviço externo e armazenamento. Preparar imóvel e visualizar projeto não registram cobrança universal de créditos hoje. O pending compartilhado dos handlers COS ainda pode identificar toda seleção como campanha. O COS não expõe todos os controles nem equivale aos pipelines das páginas Studio.

## Termos oficiais

Studio IA; campanha; peça; asset; preparação de imóvel; visualização de projeto; vídeo; provider quando necessário em suporte técnico.

## Exemplos de perguntas

- “O que o Studio IA consegue criar?”
- “Por que preciso selecionar uma foto do imóvel?”

## Exemplos de pedidos operacionais

- “Crie uma campanha para esse imóvel.”
- “Melhore este texto no Studio IA.”
