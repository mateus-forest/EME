import type { CosWorkspaceContext } from "@/lib/cos/types"

export type CosOperationalIntentId =
  | "consult"
  | "create"
  | "edit"
  | "delete"
  | "share"
  | "publish"
  | "unpublish"
  | "navigate"
  | "statistics"
  | "help"
  | "analysis"
  | "search"
  | "unknown"

export type CosOperationalIntentResolution = {
  id: CosOperationalIntentId
  confidence: number
  reason: string
  signals: {
    hasCountLanguage: boolean
    hasListLanguage: boolean
    hasDestructiveLanguage: boolean
    hasShareLanguage: boolean
    hasPublishLanguage: boolean
    hasSearchLanguage: boolean
    hasHelpLanguage: boolean
    hasAnalysisLanguage: boolean
    workspacePage: string | null
  }
}

function hasAny(normalizedMessage: string, tokens: string[]) {
  return tokens.some((token) => normalizedMessage.includes(token))
}

function hasCatalogRemovalLanguage(normalizedMessage: string) {
  return /(?:tirar|remover)\s+.+\s+do\s+cat[aá]logo/.test(normalizedMessage)
}

export function resolveCosOperationalIntent(input: {
  normalizedMessage: string
  workspace: CosWorkspaceContext | null
}): CosOperationalIntentResolution {
  const message = input.normalizedMessage
  const workspacePage = input.workspace?.page ?? null

  const hasCountLanguage = hasAny(message, ["quantos", "quantas", "numero de", "número de", "total de", "total"])
  const hasListLanguage = hasAny(message, ["quais", "listar", "lista", "mostrar", "mostre", "ver", "consultar"])
  const hasDestructiveLanguage = hasAny(message, ["excluir", "exclua", "remover", "remova", "apagar", "apague", "deletar"])
  const hasShareLanguage = hasAny(message, ["compartilhar", "compartilhe", "compartilhamento", "link", "copiar link", "enviar link"])
  const hasPublishLanguage = hasAny(message, ["publicar", "publique", "anunciar", "anuncie", "colocar no catalogo", "colocar no catálogo"]) && !message.includes("despublicar")
  const hasUnpublishLanguage =
    hasAny(message, ["despublicar", "pausar", "pause", "tirar do catalogo", "tirar do catálogo", "remover do catalogo", "remover do catálogo"]) ||
    hasCatalogRemovalLanguage(message)
  const hasSearchLanguage = hasAny(message, ["buscar", "busque", "encontre", "localize", "procurar", "procure"])
  const hasHelpLanguage = hasAny(message, ["como", "ajuda", "me explique", "quero aprender"])
  const hasAnalysisLanguage = hasAny(message, ["analise", "análise", "desempenho", "performance", "saude", "saúde", "resumo"])
  const hasCreateLanguage = hasAny(message, ["criar", "crie", "cadastrar", "cadastre", "gerar", "gere", "novo", "nova", "registrar", "registre", "montar", "monte"])
  const hasEditLanguage = hasAny(message, ["editar", "edite", "atualizar", "atualize", "ajustar", "ajuste", "corrigir", "corrija", "melhorar", "melhore", "alterar", "altere", "reagendar"])
  const hasNavigationLanguage = hasAny(message, ["abrir", "ir para", "mostrar tela", "abrir modulo", "abrir módulo"])

  if (hasHelpLanguage) {
    return {
      id: "help",
      confidence: 0.96,
      reason: "pedido de ajuda/orientacao",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasDestructiveLanguage) {
    return {
      id: "delete",
      confidence: 0.98,
      reason: "linguagem destrutiva explicita",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasShareLanguage) {
    return {
      id: "share",
      confidence: 0.95,
      reason: "pedido explicito de compartilhamento",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasPublishLanguage) {
    return {
      id: "publish",
      confidence: 0.95,
      reason: "pedido explicito de publicacao",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasUnpublishLanguage) {
    return {
      id: "unpublish",
      confidence: 0.95,
      reason: "pedido explicito de pausa/despublicacao",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasCountLanguage) {
    return {
      id: "statistics",
      confidence: 0.97,
      reason: "pergunta quantitativa/estatistica",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasAnalysisLanguage) {
    return {
      id: "analysis",
      confidence: 0.9,
      reason: "pedido de analise ou resumo",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasSearchLanguage) {
    return {
      id: "search",
      confidence: 0.92,
      reason: "pedido explicito de busca/localizacao",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasCreateLanguage) {
    return {
      id: "create",
      confidence: 0.9,
      reason: "pedido explicito de criacao",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasEditLanguage) {
    return {
      id: "edit",
      confidence: 0.88,
      reason: "pedido explicito de edicao",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasNavigationLanguage) {
    return {
      id: "navigate",
      confidence: 0.86,
      reason: "pedido explicito de navegacao",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  if (hasListLanguage) {
    return {
      id: "consult",
      confidence: 0.76,
      reason: "pedido de consulta/listagem",
      signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
    }
  }

  return {
    id: "unknown",
    confidence: 0.2,
    reason: "nenhum sinal operacional forte",
    signals: { hasCountLanguage, hasListLanguage, hasDestructiveLanguage, hasShareLanguage, hasPublishLanguage, hasSearchLanguage, hasHelpLanguage, hasAnalysisLanguage, workspacePage },
  }
}
