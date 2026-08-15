---
id: contratos
title: Contratos
domains: [contract]
aliases: [modelo contratual, instancia de contrato, documento contratual]
version: 1.0.0
updated_at: 2026-08-14
knowledge_type: [module, procedure, rule]
---

# Contratos

## O que é

Contratos combina modelos importados e versionados com instâncias preenchidas. A estrutura atual usa `ContractTemplate`, `ContractTemplateVersion`, `ContractTemplateInstance` e, quando aplicável, `BrokerDocument` vinculado.

## Para que serve

Preservar o conteúdo de um documento de origem, identificar campos variáveis, preencher dados do corretor/cliente/imóvel, revisar, gerar preview/PDF e registrar etapas externas.

## Entidades relacionadas

Modelo, versão, instância, documento, corretor, cliente, imóvel, valores, partes adicionais, prontidão, arquivo original e metadados de análise.

## O que o usuário pode fazer

Importar e reanalisar modelo, revisar estrutura, usar modelo, preencher instância, visualizar, gerar PDF, marcar envio/assinatura externa, cancelar e excluir quando permitido.

## O que o COS pode fazer

Criar rascunho documental legado, listar, consultar, abrir preview, atualizar, marcar envio, registrar assinatura, cancelar, preparar download e consultar histórico. O Registry determina confirmação e seleção. O handler atual de criação não cria uma `ContractTemplateInstance` do motor novo.

## Fluxos principais

Importação → extração → versão do modelo → revisão/pronto → criar instância → preencher → preview → PDF → envio externo → registro de assinatura ou cancelamento.

## Regras de negócio

- No motor de modelos importados, o EME não inventa conteúdo jurídico nem cláusulas: conteúdo original e estrutura devem ser preservados; IA pode extrair/organizar, não substituir a fonte jurídica.
- O gerador legado ainda monta cláusulas programáticas. Isso é uma divergência atual e não deve ser apresentado como preservação literal ou validação jurídica.
- Envio, assinatura registrada e cancelamento exigem contrato resolvido e confirmação.
- “Assinado” registra uma assinatura externa; não equivale a assinatura digital nativa ICP-Brasil.
- Modelo vinculado a instância pode ter restrição de exclusão.

## Estados e status

Modelos/versões usam `ANALYZING`, `REVIEW_REQUIRED`, `READY` e `FAILED`. Instâncias usam `draft`, `awaiting_signature`, `signed` e `cancelled`. Contratos legados também reconhecem `completed` e normalizam valores históricos. A apresentação deve traduzir o status real sem criar estado novo.

## Relação com outros módulos

Usa dados de [Clientes](02-clientes.md), [Imóveis](03-imoveis.md) e pode suceder [Propostas](06-propostas.md). PDFs e arquivos dependem de armazenamento/documentos.

## Limitações atuais

O EME não presta validação jurídica nem fornece assinatura certificada nativa. A qualidade da extração depende do arquivo original e da análise concluída. O COS ainda opera documentos legados; alterações de envio/assinatura/cancelamento no documento espelho não sincronizam integralmente status, `signedAt`, nota ou prontidão da instância nova.

## Termos oficiais

Modelo; versão; instância; contrato; conteúdo original; campo variável; preview; PDF; assinatura externa registrada.

## Exemplos de perguntas

- “O EME cria uma cláusula para mim?”
- “Qual o status desse contrato?”

## Exemplos de pedidos operacionais

- “Crie o contrato para esse cliente e imóvel.”
- “Abra o preview do contrato.”
