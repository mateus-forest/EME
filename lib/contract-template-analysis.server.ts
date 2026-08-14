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

type ExtractedContractTemplate = {
  text: string
  mimeType: string | null
  fileSize: number
}

export function describeContractTemplateAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (/^(Envie um arquivo|O arquivo)/.test(message)) {
    return { message, status: 400 }
  }
  if (/^(Não foi possível ler|O PDF|O DOCX|O documento)/.test(message)) {
    return { message, status: 422 }
  }
  if (message.startsWith("A preparação")) return { message, status: 503 }
  if (message.startsWith("A análise") || message.startsWith("Não foi possível identificar")) {
    return { message, status: 502 }
  }
  return {
    message: "Não foi possível analisar este modelo agora. Tente novamente; o arquivo e a última versão válida foram preservados.",
    status: 500,
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
- Priorize os campos centrais que realmente variam: nome e identificação das partes, CPF/CNPJ, RG, endereço, imóvel, matrícula e cartório, valores, datas, prazo, vencimento, pagamento, garantia, comissão e local de assinatura.
- Não classifique rótulos, títulos de cláusula ou frases inteiras como campo. exactText deve conter somente o valor variável presente no documento.
- Quando o mesmo dado aparecer mais de uma vez, registre cada ocorrência literal com occurrenceIndex correto para que todas possam ser preenchidas.
- Use partyKey vazio quando o campo não pertencer a uma parte.
- Use binding "none" quando não existir binding conhecido seguro.
- Marque needsReview quando a classificação não for inequívoca.
- Não faça interpretação ou recomendação jurídica.

DOCUMENTO INDEXADO:
${indexed}`
}

export async function analyzeExtractedContractTemplate(input: ExtractedContractTemplate): Promise<ContractTemplateAnalysisResult> {
  const { text } = input
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
    metadata: { blockCount: blocks.length, fileType: input.mimeType, fileSize: input.fileSize },
    request: {
      model,
      max_output_tokens: 16_000,
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

export async function analyzeContractTemplate(file: File): Promise<ContractTemplateAnalysisResult> {
  const extracted = await extractContractTemplateText(file)
  return analyzeExtractedContractTemplate({
    text: extracted.text,
    mimeType: detectContractTemplateMime(file),
    fileSize: file.size,
  })
}
