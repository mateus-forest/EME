import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

// Adapter legado mantido para superfícies que ainda não recebem CosKnowledgeContext. No portal e
// no COS Home, knowledge/eme é a fonte oficial. Este caminho permanece isolado para não alterar o
// runtime do WhatsApp nesta etapa.
const HELP_DOCS_DIR = path.join(process.cwd(), "docs", "help")

export type HelpTopic =
  | "first_steps"
  | "use_cos"
  | "register_properties"
  | "manage_clients"
  | "contracts_proposals"
  | "marketing_studio"
  | "general_question"

const ALL_HELP_DOCS = [
  "README.md",
  "primeiros-passos.md",
  "como-usar-o-cos.md",
  "clientes.md",
  "imoveis.md",
  "catalogo.md",
  "contratos.md",
  "propostas.md",
  "studio-ia.md",
  "compromissos.md",
  "financeiro.md",
  "desempenho.md",
  "configuracoes.md",
  "planos.md",
  "faq.md",
]

// Each topic only loads the file(s) it actually needs — "Tirar uma dúvida" (general_question) is
// the one open-ended entry point, so it loads the full manual; the other 6 stay scoped to their
// own module, keeping the prompt (and its cost) small for the common case.
const HELP_TOPIC_FILES: Record<HelpTopic, string[]> = {
  first_steps: ["primeiros-passos.md"],
  use_cos: ["como-usar-o-cos.md"],
  register_properties: ["imoveis.md"],
  manage_clients: ["clientes.md"],
  contracts_proposals: ["contratos.md", "propostas.md"],
  marketing_studio: ["studio-ia.md"],
  general_question: ALL_HELP_DOCS,
}

const docCache = new Map<string, string>()

async function readHelpDoc(filename: string): Promise<string> {
  const cached = docCache.get(filename)
  if (cached !== undefined) return cached

  const content = await readFile(path.join(HELP_DOCS_DIR, filename), "utf8")
  docCache.set(filename, content)
  return content
}

export async function loadHelpManualContext(topic: HelpTopic): Promise<string> {
  const files = HELP_TOPIC_FILES[topic]
  const sections = await Promise.all(files.map((file) => readHelpDoc(file)))
  return sections.join("\n\n---\n\n")
}
