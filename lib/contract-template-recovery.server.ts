import "server-only"

import type { ContractTemplateVersion } from "@prisma/client"

import { readBrokerContractTemplateFile } from "@/lib/broker-document-storage"
import { extractContractTemplateText } from "@/lib/contract-document-parser.server"
import {
  buildTextOnlyContractTemplateStructure,
  contractTemplateStructureSchema,
  type ContractTemplateStructure,
} from "@/lib/contract-template-engine"
import { prisma, type PrismaTransaction } from "@/lib/prisma"

type StoredVersion = Pick<
  ContractTemplateVersion,
  "id" | "sourceStoragePath" | "sourceFileName" | "sourceMimeType" | "sourceFileSize" | "originalText" | "structure" | "analysisMetadata"
>

export function hasUsableStoredContractTemplate(version: Pick<StoredVersion, "originalText" | "structure">) {
  const parsed = contractTemplateStructureSchema.safeParse(version.structure)
  return Boolean(version.originalText.trim()) && parsed.success && parsed.data.blocks.length > 0
}

export async function recoverStoredContractTemplateVersion(
  version: StoredVersion,
  options?: { tx?: PrismaTransaction; templateTitle?: string },
): Promise<{ originalText: string; structure: ContractTemplateStructure; recovered: boolean }> {
  const parsed = contractTemplateStructureSchema.safeParse(version.structure)
  if (version.originalText.trim() && parsed.success && parsed.data.blocks.length > 0) {
    return { originalText: version.originalText, structure: parsed.data, recovered: false }
  }
  if (!version.sourceStoragePath) {
    throw new Error("O arquivo original deste modelo não está disponível para recuperar o conteúdo.")
  }

  const stored = await readBrokerContractTemplateFile(version.sourceStoragePath)
  const file = new File([new Uint8Array(stored.buffer)], version.sourceFileName, {
    type: version.sourceMimeType || stored.mimeType,
  })
  const extracted = await extractContractTemplateText(file)
  const structure = buildTextOnlyContractTemplateStructure({
    text: extracted.text,
    title: parsed.success ? parsed.data.title || options?.templateTitle : options?.templateTitle,
    warning: "Campos automáticos precisam ser revistos. O conteúdo real foi recuperado do arquivo original.",
  })
  const client = options?.tx ?? prisma
  const metadata = version.analysisMetadata && typeof version.analysisMetadata === "object" && !Array.isArray(version.analysisMetadata)
    ? version.analysisMetadata
    : {}
  await client.contractTemplateVersion.update({
    where: { id: version.id },
    data: {
      originalText: extracted.text,
      structure,
      analysisMetadata: {
        ...metadata,
        contentRecoveredAt: new Date().toISOString(),
        contentRecovery: "source-file-text",
      },
    },
  })
  return { originalText: extracted.text, structure, recovered: true }
}

