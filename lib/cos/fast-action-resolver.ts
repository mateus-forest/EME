import type { AssessorAction } from "@/lib/eme-backend"

import { evaluateCosDecisionSecurity } from "@/lib/cos/decision-security"
import type { CosNormalizedContext, CosWorkspaceContext } from "@/lib/cos/types"

export type FastActionOption = {
  id: string
  label: string
}

export type FastActionResolution =
  | {
      kind: "none"
      confidence: number
    }
  | {
      kind: "workflow_action"
      action: AssessorAction
      confidence: number
      reply: string
      reason: string
    }
  | {
      kind: "workflow_details"
      action: "workflow_details"
      confidence: number
      reply: string
      reason: string
    }
  | {
      kind: "navigation"
      href: string
      label: string
      confidence: number
      reply: string
      reason: string
    }
  | {
      kind: "clarify"
      confidence: number
      reply: string
      options: FastActionOption[]
      reason: string
    }

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function countWords(value: string) {
  return normalizeText(value).split(/\s+/).filter(Boolean).length
}

function includesAny(normalizedMessage: string, tokens: string[]) {
  return tokens.some((token) => normalizedMessage.includes(token))
}

function isExactCommand(normalizedMessage: string, commands: string[]) {
  return commands.some((command) => normalizedMessage === command)
}

function buildCurrentEntityEditAction(
  workspace: CosWorkspaceContext | null | undefined,
  context: CosNormalizedContext | null | undefined,
): FastActionResolution | null {
  const entity = workspace?.entity ?? null
  const hasPropertySelected = Boolean(context?.selectedEntityIds.property || workspace?.entityId)
  const hasLeadSelected = Boolean(context?.selectedEntityIds.lead || workspace?.entityId)
  const hasContractSelected = Boolean(context?.selectedEntityIds.contract || workspace?.entityId)

  if (entity === "contract" && hasContractSelected) {
    return {
      kind: "workflow_action",
      action: "UPDATE_CONTRACT" as AssessorAction,
      confidence: 0.96,
      reply: "Claro.\n\nVou editar o contrato selecionado.",
      reason: "editar em contexto de contrato selecionado",
    }
  }

  if (entity === "lead" && hasLeadSelected) {
    return {
      kind: "workflow_action",
      action: "UPDATE_LEAD" as AssessorAction,
      confidence: 0.96,
      reply: "Claro.\n\nVou editar o cliente selecionado.",
      reason: "editar em contexto de cliente selecionado",
    }
  }

  if (entity === "agenda") {
    return {
      kind: "workflow_action",
      action: "UPDATE_AGENDA_EVENT" as AssessorAction,
      confidence: 0.9,
      reply: "Claro.\n\nVou editar o compromisso selecionado.",
      reason: "editar em contexto de agenda",
    }
  }

  if (entity === "property" && hasPropertySelected) {
    return {
      kind: "clarify",
      confidence: 0.58,
      reply: "Escolha a ação para este imóvel.",
      options: [
        { id: "editar_midias", label: "Atualizar mídias" },
        { id: "melhorar_descricao", label: "Melhorar descrição" },
        { id: "publicar_imovel", label: "Publicar imóvel" },
      ],
      reason: "editar em contexto de imovel sem acao unica equivalente",
    }
  }

  return null
}

const NAVIGATION_COMMANDS = [
  { href: "/corretor", label: "COS", commands: ["cos", "abrir cos", "voltar para o cos"] },
  { href: "/corretor/clientes", label: "Clientes", commands: ["clientes", "abrir clientes", "mostrar clientes", "minha carteira de clientes", "meus clientes"] },
  { href: "/corretor/imoveis", label: "Imóveis", commands: ["imoveis", "abrir imoveis", "mostrar imoveis", "meus imoveis", "minha carteira de imoveis"] },
  { href: "/corretor/catalogo", label: "Catálogo", commands: ["catalogo", "abrir catalogo", "meu catalogo", "catalogo publico"] },
  { href: "/corretor/studio-ia", label: "Studio IA", commands: ["studio", "studio ia", "abrir studio", "abrir studio ia"] },
  { href: "/corretor/documentos/contratos", label: "Contratos", commands: ["contratos", "abrir contratos", "meus contratos", "mostrar contratos"] },
  { href: "/corretor/documentos", label: "Propostas", commands: ["propostas", "abrir propostas", "abrir proposta"] },
  { href: "/corretor/agenda", label: "Compromissos", commands: ["agenda", "compromissos", "abrir agenda", "abrir compromissos", "minha agenda"] },
  { href: "/corretor/financeiro", label: "Financeiro", commands: ["financeiro", "abrir financeiro"] },
  { href: "/corretor/analytics", label: "Desempenho", commands: ["desempenho", "analytics", "abrir desempenho", "performance"] },
  { href: "/corretor/historico", label: "Histórico", commands: ["historico", "histórico", "abrir historico", "abrir histórico"] },
  { href: "/corretor/conta", label: "Configurações", commands: ["configuracoes", "configurações", "abrir configuracoes", "abrir configurações"] },
]

export function resolveFastCosAction(input: {
  message: string
  workspace: CosWorkspaceContext | null
  context?: CosNormalizedContext | null
}): FastActionResolution {
  const securityAudit = evaluateCosDecisionSecurity({
    message: input.message,
    attachments: (input.context?.attachments ?? []).map((attachment) => ({
      name: attachment.name,
      textContent: attachment.textContent,
    })),
  })
  const normalizedMessage = normalizeText(input.message)
  const shortMessage = countWords(input.message) <= 4
  const entity = input.workspace?.entity ?? null
  const page = input.workspace?.page ?? null
  const hasPropertySelected = Boolean(input.context?.selectedEntityIds.property || (entity === "property" && input.workspace?.entityId))
  const hasLeadSelected = Boolean(input.context?.selectedEntityIds.lead || (entity === "lead" && input.workspace?.entityId))
  const hasContractSelected = Boolean(input.context?.selectedEntityIds.contract || (entity === "contract" && input.workspace?.entityId))
  const hasImage = Boolean(input.context?.attachments.some((attachment) => attachment.category === "image"))
  const hasDocument = Boolean(input.context?.attachments.some((attachment) => attachment.category === "document"))

  if (!normalizedMessage) {
    return { kind: "none", confidence: 0 }
  }

  if (securityAudit.flagged) {
    return {
      kind: "clarify",
      confidence: 0.18,
      reply: "Escolha a frente que deseja abrir.",
      options: [
        { id: "security_clarify_property", label: "Imóveis" },
        { id: "security_clarify_lead", label: "Clientes" },
        { id: "security_clarify_contract", label: "Contratos" },
      ],
      reason: `security_guard:${securityAudit.reasons.join(",")}`,
    }
  }

  if (isExactCommand(normalizedMessage, ["ver detalhes da operacao", "ver detalhes da operação", "operacao", "operação", "minha operacao", "minha operação", "resumo da operacao", "resumo da operação"])) {
    return {
      kind: "workflow_details",
      action: "workflow_details",
      confidence: 0.99,
      reply: "Claro.\n\nAbrindo os detalhes da operação...",
      reason: "comando direto para detalhes da operacao",
    }
  }

  for (const item of NAVIGATION_COMMANDS) {
    if (isExactCommand(normalizedMessage, item.commands)) {
      return {
        kind: "navigation",
        href: item.href,
        label: item.label,
        confidence: 0.99,
        reply: `Claro.\n\nAbrindo ${item.label.toLowerCase()}...`,
        reason: `comando direto para abrir ${item.label.toLowerCase()}`,
      }
    }
  }

  if (isExactCommand(normalizedMessage, ["novo contrato", "criar contrato", "gerar contrato", "anexar contrato", "contrato novo", "fazer contrato"])) {
    return {
      kind: "workflow_action",
      action: "CREATE_CONTRACT",
      confidence: 0.97,
      reply: "Perfeito.\n\nVou iniciar a criação do contrato.",
      reason: "comando canonico para criar contrato",
    }
  }

  if (isExactCommand(normalizedMessage, ["nova proposta", "criar proposta", "gerar proposta", "proposta nova", "fazer proposta"])) {
    return {
      kind: "workflow_action",
      action: "CREATE_PROPOSAL",
      confidence: 0.97,
      reply: "Perfeito.\n\nVou iniciar a criação da proposta.",
      reason: "comando canonico para criar proposta",
    }
  }

  if (isExactCommand(normalizedMessage, ["buscar imoveis", "buscar imóveis", "procurar imoveis", "procurar imóveis"])) {
    return {
      kind: "workflow_action",
      action: "searchProperties",
      confidence: 0.98,
      reply: "Perfeito.\n\nVou iniciar a busca de imóveis.",
      reason: "comando canonico para busca de imoveis",
    }
  }

  if (isExactCommand(normalizedMessage, ["compartilhar catalogo", "compartilhar catálogo", "gerar link do catalogo", "gerar link do catálogo", "copiar link do catalogo", "copiar link do catálogo"])) {
    return {
      kind: "workflow_action",
      action: "SHARE_CATALOG",
      confidence: 0.97,
      reply: "Perfeito.\n\nVou preparar o compartilhamento do catálogo.",
      reason: "comando canonico para compartilhamento de catalogo",
    }
  }

  if (isExactCommand(normalizedMessage, ["compartilhar imovel", "compartilhar imóvel", "compartilhe este imovel", "compartilhe este imóvel", "gerar compartilhamento deste imovel", "gerar compartilhamento deste imóvel"])) {
    return {
      kind: "workflow_action",
      action: hasPropertySelected ? "SHARE_CATALOG" : "PUBLISH_CATALOG",
      confidence: 0.97,
      reply: "Perfeito.\n\nVou preparar o compartilhamento deste imóvel.",
      reason: "comando canonico para compartilhamento de imovel",
    }
  }

  if (isExactCommand(normalizedMessage, ["publicar imovel", "publicar imóvel", "publique este imovel", "publique este imóvel"])) {
    return {
      kind: "workflow_action",
      action: "PUBLISH_PROPERTY",
      confidence: 0.97,
      reply: "Perfeito.\n\nVou publicar este imóvel.",
      reason: "comando canonico para publicar imovel",
    }
  }

  if (isExactCommand(normalizedMessage, ["excluir cliente", "excluir este cliente", "remover cliente"])) {
    return {
      kind: "workflow_action",
      action: "DELETE_LEAD",
      confidence: 0.97,
      reply: "Perfeito.\n\nVou iniciar a exclusão do cliente.",
      reason: "comando canonico para excluir cliente",
    }
  }

  if (isExactCommand(normalizedMessage, ["excluir imovel", "excluir imóvel", "remover este imovel", "remover este imóvel"])) {
    return {
      kind: "workflow_action",
      action: "ARCHIVE_PROPERTY",
      confidence: 0.97,
      reply: "Perfeito.\n\nVou iniciar a exclusão do imóvel.",
      reason: "comando canonico para excluir imovel",
    }
  }

  if (isExactCommand(normalizedMessage, ["criar imovel", "criar imóvel", "novo imovel", "novo imóvel"])) {
    return {
      kind: "workflow_action",
      action: "createPropertyDraft",
      confidence: hasImage ? 0.99 : 0.95,
      reply: hasImage
        ? "Perfeito.\n\nVou criar o imóvel utilizando essa imagem."
        : "Perfeito.\n\nVou iniciar o cadastro do imóvel.",
      reason: "comando direto para criar imovel",
    }
  }

  if (
    (includesAny(normalizedMessage, [
      "crie um imovel com essa imagem",
      "criar imovel com essa imagem",
      "criar imovel com esta imagem",
      "crie um imovel com esta imagem",
      "cadastrar imovel usando esta foto",
      "novo imovel a partir dessa imagem",
      "use essa imagem para criar o imovel",
      "cadastre um imovel com essa foto",
    ]) ||
      (hasImage && includesAny(normalizedMessage, ["crie um imovel", "criar imovel", "cadastre um imovel", "cadastro de imovel", "novo imovel"])))
  ) {
    return {
      kind: "workflow_action",
      action: "createPropertyDraft",
      confidence: 0.99,
      reply: "Perfeito.\n\nVou criar o imóvel utilizando essa imagem.",
      reason: "imagem anexada com pedido direto de cadastro de imovel",
    }
  }

  if (
    hasDocument &&
    hasLeadSelected &&
    includesAny(normalizedMessage, ["anexar", "anexe", "anexe este pdf", "anexar documento", "anexar contrato", "vincular contrato", "junte este arquivo"])
  ) {
    return {
      kind: "workflow_action",
      action: "ATTACH_LEAD_DOCUMENT",
      confidence: 0.96,
      reply: "Claro.\n\nVou anexar esse documento ao cliente selecionado.",
      reason: "documento anexado com cliente selecionado",
    }
  }

  if (isExactCommand(normalizedMessage, ["editar", "editar imovel", "editar imóvel", "abrir"])) {
    const contextualEdit = buildCurrentEntityEditAction(input.workspace, input.context)
    if (contextualEdit) {
      return contextualEdit
    }

    if (normalizedMessage === "abrir" && entity === "contract" && hasContractSelected) {
      return {
        kind: "workflow_action",
        action: "GET_CONTRACT",
        confidence: 0.94,
        reply: "Claro.\n\nVou abrir o contrato selecionado.",
        reason: "abrir em contexto de contrato selecionado",
      }
    }
  }

  if (hasLeadSelected && isExactCommand(normalizedMessage, ["editar cliente", "atualizar cliente selecionado", "corrigir dados do cliente", "ajustar cadastro do cliente"])) {
    return {
      kind: "workflow_action",
      action: "UPDATE_LEAD",
      confidence: 0.98,
      reply: "Claro.\n\nVou editar o cliente selecionado.",
      reason: "comando direto para editar cliente selecionado",
    }
  }

  if (
    hasPropertySelected &&
    includesAny(normalizedMessage, ["editar imovel", "editar imóvel", "ajustar este imovel", "ajustar este imóvel", "atualizar dados do imovel", "atualizar dados do imóvel"])
  ) {
    return {
      kind: "clarify",
      confidence: 0.72,
      reply: "Escolha a ação para este imóvel.",
      options: [
        { id: "editar_midias", label: "Atualizar mídias" },
        { id: "melhorar_descricao", label: "Melhorar descrição" },
        { id: "publicar_imovel", label: "Publicar imóvel" },
      ],
      reason: "pedido de edicao de imovel exige desambiguacao",
    }
  }

  if (hasContractSelected && isExactCommand(normalizedMessage, ["enviar contrato", "assinar contrato", "cancelar contrato", "abrir contrato"])) {
    const action =
      normalizedMessage === "enviar contrato"
        ? ("SEND_CONTRACT" as AssessorAction)
        : normalizedMessage === "assinar contrato"
          ? ("SIGN_CONTRACT" as AssessorAction)
          : normalizedMessage === "cancelar contrato"
            ? ("CANCEL_CONTRACT" as AssessorAction)
            : ("GET_CONTRACT" as AssessorAction)

    return {
      kind: "workflow_action",
      action,
      confidence: 0.98,
      reply: "Claro.\n\nVou seguir com o contrato selecionado.",
      reason: "comando direto para contrato selecionado",
    }
  }

  if (
    page?.startsWith("studio_ia") &&
    isExactCommand(normalizedMessage, [
      "gerar campanha",
      "criar campanha instagram",
      "gerar post para instagram",
      "criar story para este imovel",
      "gerar video do imovel",
      "criar video vertical para este imovel",
    ])
  ) {
    const action =
      normalizedMessage.includes("campanha")
        ? ("STUDIO_GENERATE_CAMPAIGN" as AssessorAction)
        : includesAny(normalizedMessage, ["post", "story", "instagram"])
          ? ("STUDIO_GENERATE_INSTAGRAM" as AssessorAction)
          : includesAny(normalizedMessage, ["video"])
            ? ("STUDIO_GENERATE_VIDEO" as AssessorAction)
            : ("STUDIO_GENERATE_CAMPAIGN" as AssessorAction)

    return {
      kind: "workflow_action",
      action,
      confidence: 0.97,
      reply: "Perfeito.\n\nVou iniciar essa geração no Studio IA.",
      reason: "comando direto em contexto do studio ia",
    }
  }

  if (shortMessage && isExactCommand(normalizedMessage, ["abrir", "editar"])) {
    return {
      kind: "clarify",
      confidence: 0.42,
      reply: "Escolha o módulo que deseja abrir.",
      options: [
        { id: "abrir_clientes", label: "Clientes" },
        { id: "abrir_imoveis", label: "Imóveis" },
        { id: "abrir_contratos", label: "Contratos" },
      ],
      reason: `comando curto sem contexto suficiente na pagina ${page ?? "desconhecida"}`,
    }
  }

  return { kind: "none", confidence: 0 }
}
