---
id: eme
title: EME
domains: [general]
aliases: [sistema eme, portal eme, sistema operacional do corretor]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module]
---

# EME

## O que é

O EME é um sistema operacional para a atividade imobiliária. O portal reúne a operação privada do corretor e superfícies públicas; o COS é a interface conversacional capaz de consultar e acionar parte dessa operação.

## Para que serve

Centralizar clientes, imóveis, compromissos, documentos comerciais, contratos, catálogo, Marketplace, Studio IA, indicadores e conta em uma operação vinculada ao corretor autenticado.

## Entidades relacionadas

Usuário, corretor, imobiliária, cliente (`Lead`), imóvel (`Property`), compromisso (`AgendaEvent`), documento (`BrokerDocument`), contrato, campanha, catálogo, conversa pública e avaliação.

## O que o usuário pode fazer

- Administrar sua carteira privada no portal.
- Publicar imóveis no catálogo individual e, separadamente, no Marketplace agregado.
- Usar o Studio IA e acompanhar créditos.
- Consultar métricas operacionais e manter documentos e compromissos.
- Conversar com o COS dentro do portal.

## O que o COS pode fazer

O COS executa apenas capabilities registradas e disponíveis para a superfície atual. A lista oficial é gerada em [Capacidades do COS](15-capacidades-cos.md).

## Fluxos principais

Cadastro e atendimento de clientes; criação e publicação de imóveis; propostas e contratos; compromissos; divulgação pública; geração de conteúdo; consultas operacionais.

## Regras de negócio

- Dados privados são sempre limitados ao corretor autenticado.
- Catálogo e Marketplace são produtos públicos distintos.
- Texto de resposta não determina se uma ação teve sucesso.
- Capability, permissão, confirmação e validação determinística prevalecem sobre interpretação por IA.

## Estados e status

Cada módulo possui estados próprios. Estados técnicos devem ser apresentados em português por uma camada de resposta, sem alterar o valor persistido.

## Relação com outros módulos

Clientes e imóveis alimentam propostas, contratos e compromissos. Imóveis também alimentam Catálogo, Marketplace e Studio IA. Veja [Regras de negócio](13-regras-negocio.md).

## Limitações atuais

Nem toda ação disponível na interface possui capability conversacional. O Livro descreve o produto atual; não representa roadmap ou promessa comercial.

## Termos oficiais

EME; Portal do Corretor; COS; Marketplace; Studio IA. Consulte o [Glossário](14-glossario.md).

## Exemplos de perguntas

- “Como o Catálogo se relaciona com o Marketplace?”
- “Quais áreas fazem parte da minha operação?”

## Exemplos de pedidos operacionais

- “Mostre meus clientes.”
- “Busque meus imóveis publicados.”
