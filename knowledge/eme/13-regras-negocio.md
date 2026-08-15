---
id: regras-negocio
title: Regras de negócio
domains: [general]
aliases: [politicas operacionais, regras transversais, invariantes eme]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [rule]
---

# Regras de negócio

## Identidade e escopo

- Dados operacionais privados pertencem ao corretor autenticado; IDs recebidos precisam ser revalidados no `brokerId`.
- IA pode interpretar e apresentar, mas Registry, permissões, broker scope, confirmação e handlers determinísticos governam a execução.
- Uma capability anunciada como executável precisa ter action única e handler registrado.

## Conversa e execução

- Perguntar sobre uma capacidade não autoriza executá-la.
- Falha não pode ser persistida ou apresentada como sucesso.
- Pending é estado estruturado; texto de resposta não controla workflow.
- Mutação exige entidade resolvida. “Registro mais recente” não é evidência suficiente para editar, excluir, publicar, enviar, assinar ou cancelar.
- Confirmação segue exclusivamente a policy do descriptor. Exclusões e operações sensíveis confirmáveis não podem ser bypassadas por IA.
- Uma negação simples, um cancelamento e uma correção são atos diferentes.

## Produto e publicação

- [Catálogo](04-catalogo.md) é a vitrine pública individual; [Marketplace](05-marketplace.md) é o ambiente público agregado.
- Publicação no catálogo e publicação no Marketplace são controles separados.
- Remover um imóvel de uma superfície pública não equivale a excluir o cadastro privado.

## Documentos e contratos

- Proposta não vira contrato automaticamente.
- O motor de modelos importados não inventa conteúdo jurídico ou cláusulas. O gerador legado ainda existe e deve ser tratado como dívida técnica, nunca como validação jurídica.
- Marcar contrato como assinado registra um evento externo; não declara assinatura digital nativa certificada.

## Avaliação e desempenho

- Avaliação pública de atendimento não é performance operacional.
- Avaliações nascem em análise; somente as aprovadas entram na média pública.
- O corretor avaliado não modera sua própria avaliação.

## Financeiro e IA

- Estimativas, forecast e comissão prevista não são valores contábeis definitivos.
- Falha de provider não autoriza fallback silencioso para outro provider.
- Texto/imagem gerados não podem alterar fatos estruturados do imóvel.
- Créditos e limites seguem a configuração vigente; custo ausente não deve ser inventado na documentação.

## Apresentação

- Status técnico não deve ser exibido cru quando houver termo oficial em português.
- Marcas EME, COS, Marketplace e Studio IA não são traduzidas.
- O [Glossário](14-glossario.md) define termos preferidos e termos a evitar.
