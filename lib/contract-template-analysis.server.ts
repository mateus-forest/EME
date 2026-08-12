import "server-only"

import { zodTextFormat } from "openai/helpers/zod"

import { detectContractTemplateMime, extractContractTemplateText } from "@/lib/contract-document-parser.server"
import {
  buildContractTemplateStructure,
  contractAnalysisSchema,
  splitContractTextIntoBlocks,
  type ContractTemplateStructure,
} from "@/lib/contract-template-engine"
import { getOpenAIEnv } from "@/lib/env.server"
import { getOpenAIClient } from "@/lib/openai-server"
import { createOpenAIResponse } from "@/lib/openai-telemetry"

export type ContractTemplateAnalysisResult = {
  originalText: string
  structure: ContractTemplateStructure
  metadata: {
    provider: "openai"
    model: string
    requestId: string
    durationMs: number
    costUsd: null
    creditsConsumed: null
  }
}

function buildAnalysisPrompt(blocks: ReturnType<typeof splitContractTextIntoBlocks>) {
  const indexed = blocks.map((block, index) => `[BLOCO ${index}] ${block.text}`).join("\n\n")
  return `Analise o modelo de contrato abaixo exclusivamente como extrator e classificador.

REGRAS OBRIGATÓRIAS:
- Não crie, corrija, resuma, remova nem reescreva cláusulas.
- O servidor preserva o texto jurídico; você só identifica estrutura e valores que variam entre operações.
- exactText deve ser uma cópia literal e contínua do BLOCO indicado. Nunca parafraseie.
- occurrenceIndex começa em 0 e identifica qual ocorrência literal dentro do bloco.
- Se houver dúvida entre texto fixo e variável, preserve como texto fixo, adicione um warning e não crie o campo.
- Identifique partes pela função existente no documento, sem limitar a locador/locatário/comprador/vendedor.
- Use partyKey vazio quando o campo não pertencer a uma parte.
- Use binding "none" quando não existir binding conhecido seguro.
- Marque needsReview quando a classificação não for inequívoca.
- Não faça interpretação ou recomendação jurídica.

DOCUMENTO INDEXADO:
${indexed}`
}

export async function analyzeContractTemplate(file: File): Promise<ContractTemplateAnalysisResult> {
  const { text } = await extractContractTemplateText(file)
  const blocks = splitContractTextIntoBlocks(text)
  if (blocks.length === 0) throw new Error("Não foi possível identificar a estrutura textual do documento.")

  const client = getOpenAIClient()
  if (!client) throw new Error("A preparação de modelos ainda não está configurada neste ambiente.")
  const { model } = getOpenAIEnv()
  const startedAt = Date.now()
  const response = await createOpenAIResponse({
    client,
    operationKey: "contracts.template_analysis",
    options: { timeout: 90_000, maxRetries: 0 },
    metadata: { blockCount: blocks.length, fileType: detectContractTemplateMime(file), fileSize: file.size },
    request: {
      model,
      max_output_tokens: 8000,
      reasoning: { effort: "minimal" },
      instructions:
        "Você prepara modelos contratuais sem atuar como advogado. Extraia somente estrutura e campos variáveis, preserve literalmente o documento e responda no schema solicitado em português do Brasil.",
      input: buildAnalysisPrompt(blocks),
      text: {
        verbosity: "low",
        format: zodTextFormat(contractAnalysisSchema, "contract_template_analysis"),
      },
    },
  })

  if (response.status === "incomplete") {
    throw new Error("A análise não foi concluída. Revise o arquivo e tente uma reanálise explícita.")
  }
  if (!response.output_text?.trim()) throw new Error("A análise não retornou uma estrutura utilizável.")

  let raw: unknown
  try {
    raw = JSON.parse(response.output_text)
  } catch {
    throw new Error("A análise retornou uma estrutura inválida. Tente novamente mais tarde.")
  }
  const parsed = contractAnalysisSchema.safeParse(raw)
  if (!parsed.success) throw new Error("A análise retornou campos incompatíveis com o modelo esperado.")

  return {
    originalText: text,
    structure: buildContractTemplateStructure(blocks, parsed.data),
    metadata: {
      provider: "openai",
      model,
      requestId: response.id,
      durationMs: Date.now() - startedAt,
      costUsd: null,
      creditsConsumed: null,
    },
  }
}
