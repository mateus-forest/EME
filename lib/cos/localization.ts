export type CosStatusScope =
  | "runtime"
  | "action"
  | "workflow"
  | "lead"
  | "property"
  | "agenda"
  | "contract"
  | "document"
  | "studio"

const STATUS_LABELS: Record<CosStatusScope, Record<string, string>> = {
  runtime: {
    success: "Concluído",
    awaiting_input: "Aguardando informação",
    error: "Não concluído",
  },
  action: {
    idle: "Pronto",
    processing: "Em andamento",
    needs_clarification: "Preciso de mais informações",
    needs_confirmation: "Aguardando confirmação",
    success: "Concluído",
    error: "Não concluído",
    cancelled: "Cancelado",
    unsupported: "Indisponível",
  },
  workflow: {
    created: "Criado",
    processing: "Em andamento",
    running: "Em andamento",
    awaiting_input: "Aguardando informação",
    completed: "Concluído",
    failed: "Não concluído",
    cancelled: "Cancelado",
    paused: "Pausado",
  },
  lead: {
    NEW: "Novo",
    CONTACTED: "Em atendimento",
    NEGOTIATING: "Em negociação",
    WON: "Convertido",
    LOST: "Perdido",
    ARCHIVED: "Arquivado",
  },
  property: {
    DRAFT: "Rascunho",
    PUBLISHED: "Publicado",
    PAUSED: "Pausado",
  },
  agenda: {
    pending: "Pendente",
    done: "Concluído",
    cancelled: "Cancelado",
  },
  contract: {
    draft: "Rascunho",
    awaiting_signature: "Aguardando assinatura",
    signed: "Assinado",
    cancelled: "Cancelado",
    completed: "Finalizado",
  },
  document: {
    draft: "Rascunho",
    generated: "Gerado",
    signed: "Assinado",
    archived: "Arquivado",
  },
  studio: {
    DRAFT: "Rascunho",
    PROCESSING: "Em processamento",
    PENDING_REVIEW: "Em análise",
    APPROVED: "Aprovado",
    REJECTED: "Rejeitado",
    PUBLISHED: "Publicado",
    FAILED: "Não concluído",
  },
}

const DOMAIN_LABELS: Record<string, string> = {
  general: "Geral",
  help: "Ajuda",
  lead: "Clientes",
  property: "Imóveis",
  proposal: "Propostas",
  contract: "Contratos",
  agenda: "Compromissos",
  catalog: "Catálogo",
  marketplace: "Marketplace",
  finance: "Financeiro",
  analytics: "Desempenho",
  studio: "Studio IA",
  operation: "Operação",
  document: "Documentos",
}

const INTERACTION_LABELS: Record<string, string> = {
  confirmation: "Confirmação",
  selection: "Seleção",
  navigation: "Navegação",
  wizard: "Próximo passo",
  preview: "Prévia",
  summary: "Resumo",
  result: "Resultado",
}

const LEGACY_TEXT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["NÃƒÂ£o", "Não"],
  ["nÃƒÂ£o", "não"],
  ["imÃƒÂ³vel", "imóvel"],
  ["ImÃƒÂ³vel", "Imóvel"],
  ["OperaÃƒÂ§ÃƒÂ£o", "Operação"],
  ["operaÃƒÂ§ÃƒÂ£o", "operação"],
  ["Ã¢â‚¬â€œ", "–"],
  ["Ã¢â‚¬â€", "—"],
  ["NÃ£o", "Não"],
  ["nÃ£o", "não"],
  ["possÃ­vel", "possível"],
  ["histÃ³rico", "histórico"],
  ["operaÃ§Ã£o", "operação"],
  ["operaÃ§Ãµes", "operações"],
  ["VocÃª", "Você"],
  ["vocÃª", "você"],
  ["Ãšltimos", "Últimos"],
  ["Ãºltimos", "últimos"],
  ["tÃ­tulo", "título"],
  ["interaÃ§Ã£o", "interação"],
  ["crÃ©ditos", "créditos"],
  ["crÃ©dito", "crédito"],
  ["Ã§", "ç"],
  ["Ã£", "ã"],
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ãª", "ê"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ã´", "ô"],
  ["Ãº", "ú"],
  ["â€¢", "•"],
  ["âœ”", "✔"],
  ["âš ", "⚠"],
  ["â³", "⏳"],
  ["â¬œ", "⬜"],
]

function lookupLabel(labels: Record<string, string>, value: string) {
  return labels[value] ?? labels[value.toUpperCase()] ?? labels[value.toLowerCase()] ?? null
}

export function getCosStatusLabel(scope: CosStatusScope, status: string | null | undefined) {
  if (!status) return "Status não informado"
  return lookupLabel(STATUS_LABELS[scope], status.trim()) ?? "Status não reconhecido"
}

export function getCosDomainLabel(domain: string | null | undefined) {
  if (!domain) return "Geral"
  return DOMAIN_LABELS[domain.trim().toLowerCase()] ?? "Geral"
}

export function getCosInteractionLabel(interaction: string | null | undefined) {
  if (!interaction) return null
  return INTERACTION_LABELS[interaction.trim().toLowerCase()] ?? null
}

/**
 * Compatibilidade exclusiva para conteúdo antigo já persistido. As substituições
 * só reconhecem sequências inequivocamente corrompidas; texto novo não deve passar
 * por correções genéricas de palavras ou acentos.
 */
export function repairLegacyCosText(value: string) {
  return LEGACY_TEXT_REPLACEMENTS.reduce(
    (text, [encoded, decoded]) => text.replaceAll(encoded, decoded),
    value,
  )
}
