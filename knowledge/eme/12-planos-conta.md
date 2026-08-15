---
id: planos-conta
title: Planos e conta
domains: [general]
aliases: [conta do corretor, creditos de ia, assinatura eme]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, rule]
---

# Planos e conta

## O que é

Conta reúne identidade, acesso, vínculo de corretor/imobiliária e estado do plano. Planos controlam limites de imóveis e créditos de IA conforme a configuração atual.

## Para que serve

Gerenciar dados do usuário, segurança, assinatura, consumo e capacidade contratada.

## Entidades relacionadas

Usuário, corretor, `BrokerPlanAccount`, `Subscription`, transações de crédito, compras extras e Stripe nas rotas específicas de cobrança.

## O que o usuário pode fazer

Consultar plano/uso, editar conta e segurança, contratar Pro/Scale ou pacotes quando o checkout estiver configurado, criar PIN de seis dígitos, usar dispositivo confiável/biometria compatível e revogar dispositivos.

## O que o COS pode fazer

Pode orientar por ajuda geral. Não possui capability dedicada para alterar plano, cobrar ou modificar assinatura.

## Fluxos principais

Conta criada → plano associado → concessão/consumo de créditos → renovação ou pacote extra conforme operação disponível.

## Regras de negócio

- Configuração atual: Free, EME Pro e EME Scale.
- Free: 5 imóveis e 30 créditos mensais/iniciais.
- Pro: 150 imóveis e 500 créditos mensais/iniciais.
- Scale: 1.000 imóveis e 2.000 créditos mensais/iniciais.
- Valores mensais atuais no código: Free R$ 0; Pro R$ 129; Scale R$ 389.
- O checkout atual configura Pro/Scale como assinatura mensal e pacotes como pagamento único, quando Stripe está disponível.
- Créditos mensais não utilizados expiram na renovação; créditos extras são carregados. A capacidade extra de imóveis só é aplicada a plano pago com assinatura ativa.
- Os três planos declaram o mesmo conjunto geral de features; a diferença atual é preço, capacidade e créditos, não bloqueio de módulos.
- `growth` armazenado é normalizado para Scale por compatibilidade.
- Não inferir regra de monetização para Marketplace.

## Estados e status

Assinatura: em teste, ativa, em atraso ou cancelada. Conta do corretor: pendente, ativa ou inativa. A camada de cobrança também mantém status ativo/inativo no usuário.

## Relação com outros módulos

Créditos são consumidos por COS e Studio conforme tabela/política da ação. Limite de imóveis afeta publicação/carteira conforme enforcement atual.

## Limitações atuais

Preços, limites e custos são configuração de produto sujeita a mudança; este capítulo reflete o código em 14/08/2026. A UI bloqueia pacote extra no Free, mas essa regra não está igualmente validada na rota de checkout. Existe branch legado com mensagem de PIN de quatro dígitos, embora a validação atual exija seis. Não descreva benefício ou cobrança não confirmados.

## Termos oficiais

Plano Free; Plano EME Pro; Plano EME Scale; créditos de IA; limite de imóveis; pacote extra.

## Exemplos de perguntas

- “Quantos créditos tenho?”
- “Qual é o limite de imóveis do meu plano?”

## Exemplos de pedidos operacionais

- “Explique meu consumo de créditos.”
- “Mostre onde consulto meu plano.”
