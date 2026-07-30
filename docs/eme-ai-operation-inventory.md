# EME AI Operation Inventory

Data de referencia: 2026-07-30

## Premissas

- Fonte de verdade: codigo atual do EME.
- Cambio usado para conversao USD -> BRL: 5.1005 (referencia 2026-07-27).
- Precos de OpenAI e Luma considerados conforme tabela oficial consultada nesta sprint.

## Operacoes mapeadas

| Operacao | Modulo | Provider | Modelo | Unidade | Creditos sugeridos |
| --- | --- | --- | --- | --- | --- |
| `cos.message` | COS | OpenAI | `gpt-5-mini` | request | 1 |
| `cos.ai_orchestrator` | COS | OpenAI | `gpt-5-mini` | request | 2 |
| `property.generate_copy` | Imoveis | OpenAI | `gpt-5-mini` | request | 2 |
| `property.import_text` | Imoveis | OpenAI | `gpt-5-mini` | request | 4 |
| `property.import_image` | Imoveis | OpenAI | `gpt-5-mini` | request | 5 |
| `broker.assistant` | Corretor EME | OpenAI | `gpt-5-mini` | request | 1 |
| `assessor.whatsapp.reply` | Assessor EME | OpenAI | `gpt-5-mini` | request | 1 |
| `corretor_eme.reply` | Corretor EME | OpenAI | `gpt-5-mini` | request | 1 |
| `studio.instagram` | Studio IA | OpenAI | `gpt-5-mini` | request | 6 |
| `studio.buyers` | Studio IA | OpenAI | `gpt-5-mini` | request | 5 |
| `studio.owners` | Studio IA | OpenAI | `gpt-5-mini` | request | 5 |
| `studio.sell_property` | Studio IA | OpenAI | `gpt-5-mini` | request | 5 |
| `studio.construction_image` | Studio IA | OpenAI | `gpt-image-1` | image | 12 |
| `studio.video.preview` | Studio IA | Luma | `uni-1` | image | 12 |
| `studio.video.preview_regeneration` | Studio IA | Luma | `uni-1` | image | 12 |
| `studio.video.final` | Studio IA | Luma | `ray-3.2` | video | 38 |
| `document.proposal_pdf` | Documentos | Internal | `browser-print` | document | 1 |
| `document.contract_pdf` | Contratos | Internal | `browser-print` | document | 1 |

## Instrumentacao

- Persistencia central: `AiOperationTelemetry`.
- Contexto operacional por request: `AsyncLocalStorage` em `lib/ai-operation-context.ts`.
- Wrapper OpenAI: `lib/openai-telemetry.ts`.
- Registro estimado para Luma: `recordEstimatedCatalogTelemetry`.

## Observacoes

- Operacoes internas de PDF permanecem com custo externo zero e entram mais como controle de consumo do produto do que como custo de API.
- Operacoes de video usam fallback conservador quando o ambiente estiver configurado com modelos legados da Luma.
