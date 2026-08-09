import { formatCurrencyBRLFromCents, parseCurrencyInputToCents } from "@/lib/currency"
import {
  DocumentBullets,
  DocumentCard,
  DocumentCheckboxGroup,
  DocumentColumns,
  DocumentCover,
  DocumentFieldGrid,
  DocumentInput,
  DocumentNotice,
  DocumentPage,
  DocumentSection,
  DocumentSignatureBlock,
  DocumentStack,
  DocumentTable,
  documentToken,
  renderDocumentHtml,
} from "@/lib/document-template"

export const contractTypeOptions = [
  "Compra e venda",
  "Locacao residencial",
  "Locacao comercial",
  "Autorizacao de venda",
  "Exclusividade",
  "Termo de visita",
  "Reserva",
  "Aditivo",
  "Distrato",
] as const

export type ContractType = (typeof contractTypeOptions)[number]

// Apenas estes 3 modelos ficam disponiveis para a criação de novos contratos gerados pelo EME.
// Os demais modelos em contractTypeOptions continuam suportados (exibição, edição, filtro e anexo
// de documentos externos) para não quebrar contratos já criados com eles.
export const creatableContractTypeOptions = [
  "Compra e venda",
  "Locacao residencial",
  "Locacao comercial",
] as const satisfies readonly ContractType[]

export const contractStatuses = ["draft", "awaiting_signature", "signed", "cancelled", "completed"] as const
export type ContractStatus = (typeof contractStatuses)[number]

const legacyContractStatusMap = {
  generated: "awaiting_signature",
  archived: "completed",
} as const

type ContractParty = {
  id?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
  cpfCnpj?: string | null
  rg?: string | null
  maritalStatus?: string | null
  profession?: string | null
  nationality?: string | null
  addressLine?: string | null
}

type ContractProperty = {
  id?: string | null
  publicCode?: number | null
  title?: string | null
  city?: string | null
  neighborhood?: string | null
  type?: string | null
  purpose?: string | null
  price?: number | null
  bedrooms?: number | null
  parkingSpots?: number | null
  ownerName?: string | null
  addressLine?: string | null
  state?: string | null
  cep?: string | null
  registryNumber?: string | null
  registryOffice?: string | null
  municipalRegistration?: string | null
  privateArea?: string | null
  totalArea?: string | null
}

type ContractFinancial = {
  amountLabel?: string | null
  amountCents?: number | null
  commissionPercent?: string | null
  commissionLabel?: string | null
  startDate?: string | null
  endDate?: string | null
  dueDate?: string | null
  validity?: string | null
  paymentMethod?: string | null
  guaranteeType?: string | null
  inspectionReport?: string | null
  commercialPurpose?: string | null
  adjustmentTerm?: string | null
  worksScope?: string | null
  fitOutScope?: string | null
  additionalConditions?: string | null
}

export type ContractSource = "generated" | "external"

export type ContractAttachment = {
  fileName: string
  fileUrl: string
  mimeType: string
  fileSize: number | null
  notes?: string | null
}

export type ContractContent = {
  version: number
  kind: ContractType
  status: ContractStatus
  source?: ContractSource
  title: string
  authorName: string
  authorEmail?: string | null
  authorPhone?: string | null
  authorCreci?: string | null
  authorAgencyName?: string | null
  createdAt: string
  updatedAt: string
  lead: ContractParty | null
  property: ContractProperty | null
  financial: ContractFinancial
  clauses: string[]
  reviewNotes: string[]
  attachment?: ContractAttachment | null
  html: string
}

function valueOrFallback(value?: string | number | null, fallback = "Não informado") {
  if (value === 0) return "0"
  return value ? String(value) : fallback
}

function escapeHtml(value?: string | number | null, fallback?: string) {
  return valueOrFallback(value, fallback)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttachmentHtml(value?: string | number | null, fallback = "") {
  return valueOrFallback(value, fallback)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatAttachmentSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "Tamanho não informado"
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function propertyTypeLabel(type?: string | null) {
  if (type === "HOUSE" || type === "Casa") return "Casa"
  if (type === "COMMERCIAL" || type === "Comercial") return "Comercial"
  if (type === "LAND" || type === "Terreno") return "Terreno"
  if (type === "OFFICE" || type === "Sala comercial") return "Sala comercial"
  if (type === "STORE" || type === "Loja") return "Loja"
  if (type === "PENTHOUSE" || type === "Cobertura") return "Cobertura"
  return type || "Apartamento"
}

function propertyPurposeLabel(purpose?: string | null) {
  if (purpose === "RENT" || purpose === "Locacao" || purpose === "Locação") return "Locacao"
  return "Venda"
}

function p(name: string) {
  return documentToken(name)
}

function contractStatusLabel(status: ContractStatus) {
  if (status === "awaiting_signature") return "Aguardando assinatura"
  if (status === "signed") return "Assinado"
  if (status === "cancelled") return "Cancelado"
  if (status === "completed") return "Finalizado"
  return "Rascunho"
}

function isResidentialLeaseContract(kind: ContractType) {
  return kind === "Locacao residencial"
}

function isCommercialLeaseContract(kind: ContractType) {
  return kind === "Locacao comercial"
}

function isSaleAuthorizationContract(kind: ContractType) {
  return kind === "Autorizacao de venda"
}

function isExclusivityContract(kind: ContractType) {
  return kind === "Exclusividade"
}

function isVisitTermContract(kind: ContractType) {
  return kind === "Termo de visita"
}

function isReservationContract(kind: ContractType) {
  return kind === "Reserva"
}

function isAmendmentContract(kind: ContractType) {
  return kind === "Aditivo"
}

function isTerminationContract(kind: ContractType) {
  return kind === "Distrato"
}

export function normalizeContractStatus(value: unknown): ContractStatus | null {
  if (typeof value !== "string") return null
  if (value in legacyContractStatusMap) {
    return legacyContractStatusMap[value as keyof typeof legacyContractStatusMap]
  }
  return contractStatuses.includes(value as ContractStatus) ? (value as ContractStatus) : null
}

function getContractHeadline(kind: ContractType) {
  if (kind === "Compra e venda") return "Template mestre do EME para operações de compra e venda de imóveis."
  if (kind === "Locacao residencial") return "Template oficial EME para locações residenciais com preview editorial, PDF e sincronização em tempo real."
  if (kind === "Locacao comercial") return "Template oficial EME para locações comerciais com foco em operação, adequações do ponto e regras financeiras recorrentes."
  if (kind === "Autorizacao de venda") return "Template oficial EME para autorização de venda com foco em intermediar, validar prazo, comissão e condições da captação."
  if (kind === "Exclusividade") return "Template oficial EME para exclusividade de venda com foco em prazo, comissão, direitos e obrigações da intermediação exclusiva."
  if (kind === "Termo de visita") return "Template oficial EME para termo de visita com foco em ciência da intermediação, declarações e registro da visita ao imóvel."
  if (kind === "Reserva") return "Template oficial EME para reserva de imóvel com foco em interessado, proprietário, conversão da reserva e sincronização do preview em tempo real."
  if (kind === "Aditivo") return "Template oficial EME para aditivos contratuais com foco em referência ao contrato original, cláusulas modificadas, vigência e sincronização em tempo real."
  return "Template oficial EME para distratos com foco em encerramento consensual, quitação, obrigações remanescentes e sincronização do preview em tempo real."
}

export function buildContractClauses(kind: ContractType, input: {
  lead?: ContractParty | null
  property?: ContractProperty | null
  financial?: ContractFinancial
}): string[] {
  const amount = input.financial?.amountLabel || (input.financial?.amountCents ? formatCurrencyBRLFromCents(input.financial.amountCents) : "Não informado")
  const propertyRef = input.property?.title || "imóvel em referência"
  const personName = input.lead?.name || "cliente"
  const commission = input.financial?.commissionLabel || (input.financial?.commissionPercent ? `${input.financial.commissionPercent}%` : "Não informada")

  if (kind === "Compra e venda") {
    return [
      `Partes previstas: vendedor ${p("VENDEDOR")} e comprador ${p("COMPRADOR")}, com intermediação de ${p("CORRETOR")}.`,
      `Objeto principal: ${p("IMOVEL")} com matrícula ${p("MATRICULA")} e valor base ${p("VALOR")}.`,
      `Forma de pagamento prevista: entrada, parcelas, financiamento, FGTS e recursos próprios conforme cronograma contratual.`,
      `Corretagem de referência: ${commission}. Revisar responsabilidade, vencimento e base de calculo antes da assinatura.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  if (isResidentialLeaseContract(kind)) {
    return [
      `Partes previstas: locador ${p("LOCADOR")}, locatario ${p("LOCATARIO")} e intermediação de ${p("CORRETOR")}.`,
      `Imóvel locado: ${p("IMOVEL")} no endereço ${p("IMOVEL_ENDERECO")}, matrícula ${p("MATRICULA")} e foro em ${p("CIDADE")}.`,
      `Condições financeiras atuais: aluguel mensal ${p("VALOR_ALUGUEL")}, vencimento ${p("DIA_VENCIMENTO")} e forma de pagamento ${p("FORMA_PAGAMENTO")}.`,
      `Garantia prevista: ${p("TIPO_GARANTIA")}. Laudo de vistoria vinculado: ${p("LAUDO_VISTORIA")}.`,
      `Prazo da locação: início ${p("DATA_INICIO")}, término ${p("DATA_FIM")} e referência comercial ${p("PRAZO_LOCACAO")}.`,
    ]
  }

  if (isCommercialLeaseContract(kind)) {
    return [
      `Partes previstas: locador ${p("LOCADOR")}, locatario ${p("LOCATARIO")} e intermediação de ${p("CORRETOR")}.`,
      `Imóvel comercial: ${p("IMOVEL_COMERCIAL")} no endereço ${p("IMOVEL_ENDERECO")}, destinado a ${p("FINALIDADE_COMERCIAL")}.`,
      `Condições financeiras atuais: aluguel ${p("VALOR_ALUGUEL")}, vencimento ${p("DIA_VENCIMENTO")}, reajuste ${p("REAJUSTE_LOCACAO")} e forma de pagamento ${p("FORMA_PAGAMENTO")}.`,
      `Garantia prevista: ${p("TIPO_GARANTIA")}. Encargos e repasses operacionais em ${p("CRONOGRAMA_OBSERVACOES")}.`,
      `Obras e adequações combinadas: ${p("OBRAS_LOCACAO")} / ${p("ADEQUACOES_LOCACAO")}.`,
    ]
  }

  if (isSaleAuthorizationContract(kind)) {
    return [
      `Partes previstas: proprietário ${p("PROPRIETARIO")} e corretor ${p("CORRETOR")}, com intermediação vinculada a ${p("IMOBILIARIA")}.`,
      `Imóvel autorizado para venda: ${p("IMOVEL")} no endereço ${p("IMOVEL_ENDERECO")}, matrícula ${p("MATRICULA")} e valor autorizado ${p("VALOR_AUTORIZADO")}.`,
      `Prazo da autorização: início ${p("DATA_INICIO")} e término ${p("DATA_FIM")}, referência comercial ${p("PRAZO_AUTORIZACAO")}.`,
      `Comissão prevista: ${p("COMISSAO_AUTORIZACAO")}. Condições da intermediação registradas em ${p("CONDICOES_INTERMEDIACAO")}.`,
      `Foro eleito: ${p("COMARCA")}. Revogação e obrigações devem ser revisadas antes da assinatura final.`,
    ]
  }

  if (isExclusivityContract(kind)) {
    return [
      `Partes previstas: proprietário ${p("PROPRIETARIO")} e corretor ${p("CORRETOR")}, com intermediação exclusiva vinculada a ${p("IMOBILIARIA")}.`,
      `Imóvel em exclusividade: ${p("IMOVEL")} no endereço ${p("IMOVEL_ENDERECO")}, matrícula ${p("MATRICULA")} e valor de referência ${p("VALOR_AUTORIZADO")}.`,
      `Prazo de exclusividade: início ${p("DATA_INICIO")} e término ${p("DATA_FIM")}, referência comercial ${p("PRAZO_EXCLUSIVIDADE")}.`,
      `Comissão prevista: ${p("COMISSAO_EXCLUSIVIDADE")}. Direitos, obrigações e condições da intermediação registrados em ${p("CONDICOES_EXCLUSIVIDADE")}.`,
      `Foro eleito: ${p("COMARCA")}. Rescisão e regras de exclusividade devem ser revisadas antes da assinatura final.`,
    ]
  }

  if (isVisitTermContract(kind)) {
    return [
      `Partes previstas: visitante ${p("VISITANTE")} e corretor ${p("CORRETOR")}, vinculados ao imóvel ${p("IMOVEL_VISITADO")}.`,
      `Registro de visita: data ${p("DATA_VISITA")} e hora ${p("HORA_VISITA")}, no endereço ${p("IMOVEL_ENDERECO")}.`,
      `Ciência da intermediação registrada em ${p("CIENCIA_INTERMEDIACAO")} e declarações complementares em ${p("DECLARACOES_VISITA")}.`,
      `As partes reconhecem a visita mediada pelo corretor responsável ${p("CORRETOR")} sob o contexto operacional do EME.`,
    ]
  }

  if (isReservationContract(kind)) {
    return [
      `Partes previstas: interessado ${p("INTERESSADO")}, proprietário ${p("PROPRIETARIO")} e intermediação de ${p("CORRETOR")}${p("IMOBILIARIA") ? ` com apoio de ${p("IMOBILIARIA")}` : ""}.`,
      `Imóvel reservado: ${p("IMOVEL")} no endereço ${p("IMOVEL_ENDERECO")}, matrícula ${p("MATRICULA")} e foro em ${p("COMARCA")}.`,
      `Condições comerciais atuais: valor da reserva ${p("VALOR_RESERVA")}, prazo ${p("PRAZO_RESERVA")} e conversão prevista ate ${p("CONVERSAO_RESERVA")}.`,
      `Condições adicionais registradas em ${p("CONDICOES_RESERVA")}. Revisar conversão da reserva, prazo, devolução e penalidades antes da assinatura.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  if (isAmendmentContract(kind)) {
    return [
      `Aditivo vinculado a ${p("CONTRATO_ORIGINAL_REFERENCIA")}, mantendo como partes de apoio ${p("COMPRADOR")} e a intermediação de ${p("CORRETOR")}.`,
      `Imóvel de referência: ${p("IMOVEL")} no endereço ${p("IMOVEL_ENDERECO")}, matrícula ${p("MATRICULA")} e foro ${p("FORO_ADITIVO")}.`,
      `Cláusulas modificadas: ${p("CLAUSULAS_MODIFICADAS")}. Alterações consolidadas em ${p("ALTERACOES_ADITIVO")}.`,
      `Vigência do aditivo: de ${p("VIGENCIA_INICIO_ADITIVO")} ate ${p("VIGENCIA_FIM_ADITIVO")}.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  if (isTerminationContract(kind)) {
    return [
      `Distrato vinculado a ${p("REFERENCIA_DISTRATO")}, mantendo como partes de apoio ${p("COMPRADOR")} e a intermediação de ${p("CORRETOR")}.`,
      `Imóvel de referência: ${p("IMOVEL")} no endereço ${p("IMOVEL_ENDERECO")}, matrícula ${p("MATRICULA")} e foro ${p("FORO_DISTRATO")}.`,
      `Motivo do encerramento: ${p("MOTIVO_ENCERRAMENTO")}. Quitação registrada em ${p("QUITACAO_DISTRATO")}.`,
      `Obrigações remanescentes: ${p("OBRIGACOES_REMANESCENTES")}.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  const exhaustiveKind: never = kind
  return [
    `${String(exhaustiveKind)}: minuta base preparada para ${personName}, vinculada ao ativo ${propertyRef}.`,
    `Valor principal de referência: ${amount}. Condições financeiras definitivas devem ser conferidas antes da assinatura.`,
    `Comissão prevista: ${commission}. Validar regra comercial, gatilho de pagamento e responsabilidade entre as partes.`,
    "Este rascunho organiza dados comerciais, partes e prazos, mas não substitui revisão jurídica das cláusulas essenciais.",
  ]
}

export function buildContractReviewNotes(kind: ContractType): string[] {
  if (kind === "Compra e venda") {
    return [
      "Confirmar se todos os placeholders obrigatorios foram substituidos antes do envio ao cliente.",
      "Revisar matrícula, endereço, cronograma financeiro, arras, corretagem e regras de posse.",
      "Validar repartição de tributos, despesas cartorarias e eventuais condições suspensivas.",
      "Manter o documento como rascunho ate a validação comercial e jurídica final.",
    ]
  }

  if (isResidentialLeaseContract(kind)) {
    return [
      "Validar se locador, locatario, imóvel, garantia e vencimento estao consistentes antes do envio para assinatura.",
      "Conferir laudo de vistoria, encargos locatícios, prazo da locação e regras de conservação do imóvel.",
      "Revisar cláusulas de rescisão, benfeitorias, foro e obrigações recorrentes com suporte jurídico quando necessário.",
      "Manter o documento como rascunho ate a confirmação comercial, documental e jurídica final.",
    ]
  }

  if (isCommercialLeaseContract(kind)) {
    return [
      "Validar ponto comercial, finalidade de uso, reajuste, garantia e responsabilidades operacionais antes do envio para assinatura.",
      "Conferir matrícula, cartório, laudo, obras, adequações e encargos recorrentes da locação.",
      "Revisar cláusulas de rescisão, prazo, uso comercial permitido e riscos operacionais com suporte jurídico quando necessário.",
      "Manter o documento como rascunho ate a confirmação comercial, documental e jurídica final.",
    ]
  }

  if (isSaleAuthorizationContract(kind)) {
    return [
      "Validar proprietário, corretor, imóvel, valor autorizado e prazo antes do envio para assinatura.",
      "Conferir matrícula, cartório, comissão, condições da intermediação e obrigações operacionais da autorização.",
      "Revisar regras de revogação, foro e alcance da captação com suporte jurídico quando necessário.",
      "Manter o documento como rascunho ate a confirmação comercial, documental e jurídica final.",
    ]
  }

  if (isExclusivityContract(kind)) {
    return [
      "Validar proprietário, corretor, imóvel, prazo de exclusividade e comissão antes do envio para assinatura.",
      "Conferir matrícula, cartório, condições da intermediação exclusiva, direitos e obrigações operacionais.",
      "Revisar regras de rescisão, foro e alcance da exclusividade com suporte jurídico quando necessário.",
      "Manter o documento como rascunho ate a confirmação comercial, documental e jurídica final.",
    ]
  }

  if (isVisitTermContract(kind)) {
    return [
      "Validar visitante, corretor, imóvel visitado, data e hora antes do envio para assinatura.",
      "Conferir ciência da intermediação, declarações do visitante e dados minimos da visita.",
      "Manter o termo como rascunho ate a confirmação operacional e documental final.",
    ]
  }

  if (isReservationContract(kind)) {
    return [
      "Validar interessado, proprietário, imóvel e prazo da reserva antes do envio para assinatura.",
      "Conferir matrícula, cartório, valor da reserva, condições da conversão e responsabilidades das partes.",
      "Revisar regras de rescisão, devolução, foro e conversão da reserva com suporte jurídico quando necessário.",
      "Manter o documento como rascunho ate a confirmação comercial, documental e jurídica final.",
    ]
  }

  if (isAmendmentContract(kind)) {
    return [
      "Validar a referência ao contrato original, as cláusulas modificadas e a vigência do aditivo antes do envio para assinatura.",
      "Conferir se as alterações registradas refletem exatamente o ajuste negociado pelas partes.",
      "Revisar foro, assinaturas e eventual impacto jurídico no instrumento principal com suporte especializado quando necessário.",
      "Manter o documento como rascunho ate a confirmação comercial, documental e jurídica final.",
    ]
  }

  if (isTerminationContract(kind)) {
    return [
      "Validar a referência ao contrato original, o motivo do encerramento e a quitação antes do envio para assinatura.",
      "Conferir se as obrigações remanescentes estao descritas de forma objetiva e suficiente para evitar ambiguidades.",
      "Revisar foro, assinaturas e efeitos jurídicos do encerramento com suporte especializado quando necessário.",
      "Manter o documento como rascunho ate a confirmação comercial, documental e jurídica final.",
    ]
  }

  const exhaustiveKind: never = kind
  return [
    `Revisar a minuta de ${String(exhaustiveKind).toLowerCase()} antes de compartilhar com o cliente.`,
    "Confirmar cláusulas obrigatorias, dados cadastrais e anexos com o suporte jurídico ou modelo oficial da operação.",
    "Manter o documento como rascunho ate a validação final das condições comerciais e dos prazos.",
  ]
}

function buildOfficialSaleContractHtml(content: ContractContent) {
  const totalPages = 7

  const cover = DocumentCover({
    title: "Contrato Particular de Compra e Venda de Imóvel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para operações imobiliárias premium, preparado para revisão comercial, jurídica e futura substituição automática de placeholders pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Seguro", "Personalizável", "Juridicamente revisável"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Das Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Vendedor",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("VENDEDOR") },
                { label: "CPF/CNPJ", value: p("VENDEDOR_CPF_CNPJ") },
                { label: "RG", value: p("VENDEDOR_RG") },
                { label: "Estado civil", value: p("VENDEDOR_ESTADO_CIVIL") },
                { label: "Profissão", value: p("VENDEDOR_PROFISSAO") },
                { label: "Nacionalidade", value: p("VENDEDOR_NACIONALIDADE") },
                { label: "Endereço", value: p("VENDEDOR_ENDERECO"), span: 2 },
                { label: "Telefone", value: p("VENDEDOR_TELEFONE") },
                { label: "E-mail", value: p("VENDEDOR_EMAIL") },
              ],
            }),
          }),
          DocumentCard({
            title: "Comprador",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("COMPRADOR") },
                { label: "CPF/CNPJ", value: p("COMPRADOR_CPF_CNPJ") },
                { label: "RG", value: p("COMPRADOR_RG") },
                { label: "Estado civil", value: p("COMPRADOR_ESTADO_CIVIL") },
                { label: "Profissão", value: p("COMPRADOR_PROFISSAO") },
                { label: "Nacionalidade", value: p("COMPRADOR_NACIONALIDADE") },
                { label: "Endereço", value: p("COMPRADOR_ENDERECO"), span: 2 },
                { label: "Telefone", value: p("COMPRADOR_TELEFONE") },
                { label: "E-mail", value: p("COMPRADOR_EMAIL") },
              ],
            }),
          }),
          DocumentCard({
            title: "Corretor responsável",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliária", value: p("IMOBILIARIA") },
                { label: "Telefone", value: p("CORRETOR_TELEFONE") },
                { label: "E-mail", value: p("CORRETOR_EMAIL") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Objeto",
        description: "Constitui objeto deste contrato a compra e venda do imóvel abaixo identificado.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Código interno", value: p("CODIGO_INTERNO") },
                { label: "Tipo do imóvel", value: p("TIPO_IMOVEL") },
                { label: "Finalidade", value: p("FINALIDADE") },
                { label: "Endereço completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matrícula", value: p("MATRICULA") },
                { label: "Cartório de registro", value: p("CARTORIO_REGISTRO") },
                { label: "Inscrição imobiliária", value: p("INSCRICAO_IMOBILIARIA") },
                { label: "Área privativa", value: p("AREA_PRIVATIVA") },
                { label: "Área total", value: p("AREA_TOTAL") },
                { label: "Número de vagas", value: p("VAGAS") },
                { label: "Benfeitorias existentes", value: p("BENFEITORIAS"), span: 2 },
                { label: "Unidade / complemento", value: p("UNIDADE_COMPLEMENTO"), span: 2 },
              ],
            }),
          }),
          DocumentNotice("O vendedor declara ser legítimo proprietário do imóvel e possuir poderes para aliena-lo."),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "3",
        title: "Estado do Imóvel",
        description: "O comprador declara ter vistoriado o imóvel e conhecer plenamente seu estado de conservação.",
        children: DocumentStack(
          DocumentCard({
            tone: "accent",
            children: DocumentInput({
              label: "Descrição do estado atual",
              value: p("ESTADO_IMOVEL"),
              block: true,
            }),
          }),
          DocumentNotice("Salvo disposição expressa neste contrato, o imóvel será entregue no estado em que se encontra na data da assinatura."),
        ),
      }),
      DocumentSection({
        icon: "4",
        title: "Preço e Forma de Pagamento",
        children: DocumentStack(
          DocumentCard({
            title: "Valor total da negociação",
            tone: "soft",
            children: DocumentInput({ label: "Valor", value: p("VALOR") }),
          }),
          DocumentCard({
            title: "Forma de pagamento",
            children: DocumentCheckboxGroup([
              { label: "A vista" },
              { label: "Financiamento" },
              { label: "Parcelado" },
              { label: "FGTS" },
              { label: "Recursos próprios" },
            ]),
          }),
          DocumentCard({
            title: "Cronograma financeiro",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Entrada", value: p("ENTRADA") },
                { label: "Parcelas", value: p("PARCELAS") },
                { label: "Banco / instituição", value: p("BANCO_FINANCIAMENTO") },
                { label: "FGTS", value: p("FGTS") },
                { label: "Recursos próprios", value: p("RECURSOS_PROPRIOS") },
                { label: "Demais condições", value: p("CRONOGRAMA_OBSERVACOES"), span: 2 },
              ],
            }),
          }),
        ),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "5",
          title: "Arras (Sinal)",
          description: "Quando houver pagamento de sinal, este será considerado princípio de pagamento.",
          children: DocumentCard({
            children: DocumentBullets([
              `Valor das arras: ${p("ARRAS_VALOR")}.`,
              "Em caso de desistência injustificada pelo comprador, aplicam-se as consequencias legais e contratuais cabíveis.",
              "Em caso de desistência injustificada pelo vendedor, aplicam-se as consequencias legais e contratuais cabíveis.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "6",
          title: "Comissão de Corretagem",
          children: DocumentStack(
            DocumentCard({
              children: DocumentFieldGrid({
                columns: 2,
                items: [
                  { label: "Percentual", value: p("COMISSAO") },
                  { label: "Responsável pelo pagamento", value: p("RESPONSAVEL_COMISSAO") },
                  { label: "Forma de pagamento", value: p("FORMA_PAGAMENTO_COMISSAO") },
                  { label: "Momento do pagamento", value: p("MOMENTO_COMISSAO") },
                ],
              }),
            }),
            DocumentNotice("As partes reconhecem a intermediação imobiliária realizada pelo corretor qualificado, nos termos aplicaveis."),
          ),
        }),
      ),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "7",
          title: "Declarações do Vendedor",
          children: DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "E legítimo proprietário do imóvel." },
              { label: "Possui plena capacidade para aliena-lo." },
              { label: "O imóvel encontra-se livre de ônus reais, salvo os expressamente informados." },
              { label: "Não ha litígios judiciais ou administrativos envolvendo o imóvel, salvo os informados." },
              { label: "Não existem débitos de IPTU ou condominio vencidos, salvo os informados." },
              { label: "Forneceu ao comprador todas as informações necessárias e verdadeiras." },
            ]),
          }),
        }),
        DocumentSection({
          icon: "8",
          title: "Obrigações do Comprador",
          children: DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "Efetuar os pagamentos nas datas e condições pactuadas." },
              { label: "Fornecer a documentação necessária." },
              { label: "Providenciar financiamento, quando aplicável." },
              { label: "Comparecer aos atos necessários para conclusão da operação." },
              { label: "Cumprir todas as demais obrigações previstas neste instrumento." },
            ]),
          }),
        }),
      ),
      DocumentColumns(
        DocumentSection({
          icon: "9",
          title: "Posse",
          children: DocumentStack(
            DocumentCard({
              children: DocumentFieldGrid({
                columns: 2,
                items: [
                  { label: "Data prevista para entrega da posse", value: p("DATA_POSSE") },
                  { label: "Forma de entrega", value: p("FORMA_ENTREGA_POSSE") },
                  { label: "Condição da entrega", value: p("CONDICAO_ENTREGA"), span: 2 },
                ],
              }),
            }),
            DocumentCheckboxGroup([
              { label: "Imediata" },
              { label: "Apos quitação" },
              { label: "Conforme condição suspensiva da cláusula 12" },
              { label: "Outra forma descrita neste instrumento" },
            ]),
            DocumentNotice("As chaves serao entregues na data da posse, mediante quitação das condições pactuadas."),
          ),
        }),
        DocumentSection({
          icon: "10",
          title: "Escritura e Registro",
          children: DocumentCard({
            children: DocumentBullets([
              "As partes comprometem-se a praticar todos os atos necessários para lavratura da escritura pública, quando exigivel.",
              "As partes comprometem-se a providenciar o respectivo registro perante o Cartório de Registro de Imóveis competente.",
              `Prazo estimado para escritura: ${p("PRAZO_ESCRITURA")}.`,
              `Prazo estimado para registro: ${p("PRAZO_REGISTRO")}.`,
            ]),
          }),
        }),
      ),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "11",
        title: "Tributos e Despesas",
        description: "As despesas e tributos incidentes sobre a presente negociação serao distribuidos na forma abaixo.",
        children: DocumentStack(
          DocumentCard({
            children: DocumentTable({
              headers: [
                { value: "Despesa" },
                { value: "Responsável" },
                { value: "Observação" },
              ],
              rows: [
                [{ value: "ITBI" }, { value: p("RESP_ITBI") }, { value: p("OBS_ITBI") }],
                [{ value: "Escritura" }, { value: p("RESP_ESCRITURA") }, { value: p("OBS_ESCRITURA") }],
                [{ value: "Registro" }, { value: p("RESP_REGISTRO") }, { value: p("OBS_REGISTRO") }],
                [{ value: "Certidões" }, { value: p("RESP_CERTIDOES") }, { value: p("OBS_CERTIDOES") }],
                [{ value: "Despesas bancárias" }, { value: p("RESP_BANCARIAS") }, { value: p("OBS_BANCARIAS") }],
                [{ value: "Condominio (ate a posse)" }, { value: p("RESP_CONDOMINIO") }, { value: p("OBS_CONDOMINIO") }],
                [{ value: "IPTU (ate a posse)" }, { value: p("RESP_IPTU") }, { value: p("OBS_IPTU") }],
                [{ value: "Outras taxas" }, { value: p("RESP_OUTRAS_TAXAS") }, { value: p("OBS_OUTRAS_TAXAS") }],
              ],
            }),
          }),
          DocumentInput({
            label: "Observações complementares",
            value: p("OBS_TRIBUTOS_DESPESAS"),
            block: true,
          }),
        ),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "12",
          title: "Condições Suspensivas",
          description: "Este contrato somente produzira efeitos plenos se atendidas as condições abaixo.",
          children: DocumentStack(
            DocumentCard({
              children: DocumentCheckboxGroup([
                { label: "Aprovação de financiamento pelo comprador." },
                { label: "Apresentação de documentação necessária." },
                { label: "Regularização documental ou registral do imóvel." },
                { label: "Emissão de certidões negativas." },
                { label: `Outras: ${p("OUTRAS_CONDICOES_SUSPENSIVAS")}` },
              ]),
            }),
            DocumentNotice("Não atendidas as condições dentro do prazo acordado, o contrato será reavaliado conforme as regras deste instrumento."),
          ),
        }),
        DocumentSection({
          icon: "13",
          title: "Inadimplemento",
          children: DocumentCard({
            children: DocumentBullets([
              `Multa contratual de ${p("MULTA_INADIMPLEMENTO")} sobre o valor do contrato, quando aplicável.`,
              `Juros de ${p("JUROS_INADIMPLEMENTO")} ao mes.`,
              `Correção monetaria pelo índice ${p("INDICE_CORRECAO")}.`,
              "Perdas e danos, honorários advocatícios e demais medidas legais cabíveis.",
            ]),
          }),
        }),
      ),
      DocumentSection({
        icon: "14",
        title: "Rescisão",
        children: DocumentStack(
          DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "Por mútuo acordo entre as partes." },
              { label: "Por descumprimento de qualquer cláusula." },
              { label: "Por impossibilidade jurídica da operação." },
              { label: "Por não atendimento das condições suspensivas." },
            ]),
          }),
          DocumentNotice("A parte que der causa a rescisão arcara com eventuais prejuizos comprovados a outra parte, nos limites legais e contratuais."),
        ),
      }),
    ),
  })

  const page6 = DocumentPage({
    pageNumber: 6,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "15",
          title: "Proteção de Dados (LGPD)",
          children: DocumentCard({
            children: DocumentBullets([
              "As partes autorizam o tratamento de seus dados pessoais para execução deste contrato, cumprimento de obrigações legais e regulatórias.",
              "Os dados serao utilizados somente para finalidades ligadas a negociação, assinatura, registro e arquivo deste instrumento.",
              `Canal para assuntos de privacidade: ${p("CANAL_PRIVACIDADE")}.`,
            ]),
          }),
        }),
        DocumentSection({
          icon: "16",
          title: "Comunicações",
          children: DocumentStack(
            DocumentCard({
              title: "Vendedor",
              children: DocumentFieldGrid({
                columns: 1,
                items: [
                  { label: "E-mail", value: p("VENDEDOR_EMAIL") },
                  { label: "Telefone / WhatsApp", value: p("VENDEDOR_TELEFONE") },
                  { label: "Endereço", value: p("VENDEDOR_ENDERECO") },
                ],
              }),
            }),
            DocumentCard({
              title: "Comprador",
              children: DocumentFieldGrid({
                columns: 1,
                items: [
                  { label: "E-mail", value: p("COMPRADOR_EMAIL") },
                  { label: "Telefone / WhatsApp", value: p("COMPRADOR_TELEFONE") },
                  { label: "Endereço", value: p("COMPRADOR_ENDERECO") },
                ],
              }),
            }),
            DocumentCard({
              title: "Corretor",
              children: DocumentFieldGrid({
                columns: 1,
                items: [
                  { label: "E-mail", value: p("CORRETOR_EMAIL") },
                  { label: "Telefone / WhatsApp", value: p("CORRETOR_TELEFONE") },
                  { label: "Endereço profissional", value: p("CORRETOR_ENDERECO") },
                ],
              }),
            }),
          ),
        }),
      ),
      DocumentColumns(
        DocumentSection({
          icon: "17",
          title: "Assinatura Eletrônica",
          children: DocumentCard({
            children: DocumentBullets([
              "As partes concordam que este instrumento poderá ser assinado eletronicamente.",
              "A assinatura eletrônica produzira os mesmos efeitos jurídicos da assinatura física, nos termos da legislação aplicável.",
              `Plataforma prevista: ${p("PLATAFORMA_ASSINATURA")}.`,
            ]),
          }),
        }),
        DocumentSection({
          icon: "18",
          title: "Disposições Gerais",
          children: DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "Este contrato constitui o inteiro acordo entre as partes." },
              { label: "Alterações somente terao validade se feitas por escrito e assinadas." },
              { label: "A tolerância de uma parte quanto ao descumprimento da outra não implicara novação." },
              { label: "Se qualquer cláusula for considerada nula ou inválida, as demais permanecerao válidas." },
            ]),
          }),
        }),
      ),
      DocumentSection({
        icon: "19",
        title: "Foro",
        children: DocumentCard({
          children: DocumentInput({
            label: "Comarca eleita",
            value: p("COMARCA"),
          }),
        }),
      }),
    ),
  })

  const page7 = DocumentPage({
    pageNumber: 7,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "20",
        title: "Assinaturas",
        description: "Por estarem justas e contratadas, as partes assinam o presente instrumento.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("LOCAL_ASSINATURA") },
                { label: "Data", value: p("DATA_ASSINATURA") },
              ],
            }),
          }),
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Vendedor",
              fields: [
                { label: "Nome", value: p("VENDEDOR") },
                { label: "Assinatura", value: p("ASSINATURA_VENDEDOR") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Comprador",
              fields: [
                { label: "Nome", value: p("COMPRADOR") },
                { label: "Assinatura", value: p("ASSINATURA_COMPRADOR") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Corretor",
              fields: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Testemunha 1",
              fields: [
                { label: "Nome", value: p("TESTEMUNHA_1") },
                { label: "CPF", value: p("TESTEMUNHA_1_CPF") },
                { label: "Assinatura", value: p("ASSINATURA_TESTEMUNHA_1") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Testemunha 2",
              fields: [
                { label: "Nome", value: p("TESTEMUNHA_2") },
                { label: "CPF", value: p("TESTEMUNHA_2_CPF") },
                { label: "Assinatura", value: p("ASSINATURA_TESTEMUNHA_2") },
              ],
            })}
          </div>`,
          DocumentNotice("Documento desenvolvido pelo EME. Este template deve ser revisado e preenchido antes do envio final para assinatura."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5, page6, page7],
  })
}

function buildOfficialResidentialLeaseContractHtml(content: ContractContent) {
  const totalPages = 6

  const cover = DocumentCover({
    title: "Contrato de Locação Residencial",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para locações residenciais, preparado para sincronizar dados de cliente, imóvel e corretor com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Residencial", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Das Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Locador",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("LOCADOR") },
                { label: "CPF/CNPJ", value: p("LOCADOR_CPF_CNPJ") },
                { label: "RG", value: p("LOCADOR_RG") },
                { label: "Estado civil", value: p("LOCADOR_ESTADO_CIVIL") },
                { label: "Profissão", value: p("LOCADOR_PROFISSAO") },
                { label: "Endereço", value: p("LOCADOR_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Locatario",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("LOCATARIO") },
                { label: "CPF/CNPJ", value: p("LOCATARIO_CPF_CNPJ") },
                { label: "RG", value: p("LOCATARIO_RG") },
                { label: "Estado civil", value: p("LOCATARIO_ESTADO_CIVIL") },
                { label: "Profissão", value: p("LOCATARIO_PROFISSAO") },
                { label: "Endereço", value: p("LOCATARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Corretor responsável",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Telefone", value: p("CORRETOR_TELEFONE") },
                { label: "E-mail", value: p("CORRETOR_EMAIL") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imóvel",
        description: "Objeto da locação residencial e identificação das informações principais do ativo.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imóvel", value: p("IMOVEL") },
                { label: "Tipo do imóvel", value: p("TIPO_IMOVEL") },
                { label: "Endereço completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matrícula", value: p("MATRICULA") },
                { label: "Cartório de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O imóvel destina-se exclusivamente a uso residencial, vedada a alteração de finalidade sem autorização expressa do locador."),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "3",
          title: "Finalidade",
          children: DocumentCard({
            tone: "accent",
            children: DocumentBullets([
              "Uso exclusivamente residencial.",
              "O locatario compromete-se a utilizar o imóvel de forma compatível com a destinação pactuada.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Prazo",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Início", value: p("DATA_INICIO") },
                { label: "Término", value: p("DATA_FIM") },
                { label: "Prazo da locação", value: p("PRAZO_LOCACAO"), span: 2 },
              ],
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Valor",
        children: DocumentStack(
          DocumentCard({
            title: "Condições financeiras",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Aluguel mensal", value: p("VALOR_ALUGUEL") },
                { label: "Vencimento", value: p("DIA_VENCIMENTO") },
                { label: "Forma de pagamento", value: p("FORMA_PAGAMENTO"), span: 2 },
              ],
            }),
          }),
          DocumentNotice("Os valores e prazos devem refletir exatamente a negociação confirmada entre locador e locatario."),
        ),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "6",
          title: "Garantia",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 1,
              items: [
                { label: "Tipo de garantia", value: p("TIPO_GARANTIA") },
                { label: "Observações comerciais", value: p("CRONOGRAMA_OBSERVACOES") },
              ],
            }),
          }),
        }),
        DocumentSection({
          icon: "7",
          title: "Encargos",
          children: DocumentCard({
            children: DocumentBullets([
              "Responsabilidade pelo pagamento de IPTU, condominio, água, energia, gás e internet conforme negociação.",
              "Despesas extraordinárias e ajustes futuros deverao respeitar a legislação aplicável e o texto final deste instrumento.",
            ]),
          }),
        }),
      ),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "8",
          title: "Vistoria",
          children: DocumentStack(
            DocumentCard({
              children: DocumentFieldGrid({
                columns: 1,
                items: [{ label: "Laudo de vistoria inicial", value: p("LAUDO_VISTORIA") }],
              }),
            }),
            DocumentNotice("O imóvel será entregue conforme laudo de vistoria inicial, que integra a negociação como anexo de referência."),
          ),
        }),
        DocumentSection({
          icon: "9",
          title: "Conservação",
          children: DocumentCard({
            children: DocumentBullets([
              "O locatario compromete-se a conservar o imóvel durante toda a locação.",
              "Qualquer dano decorrente de uso inadequado deverá ser reparado conforme previsão legal e contratual.",
            ]),
          }),
        }),
      ),
      DocumentSection({
        icon: "10",
        title: "Benfeitorias",
        children: DocumentStack(
          DocumentCard({
            children: DocumentBullets([
              "Benfeitorias somente poderão ser realizadas mediante autorização do locador.",
              "A eventual indenização ou retenção dependera da natureza da benfeitoria e das regras deste contrato.",
            ]),
          }),
          DocumentInput({
            label: "Observações complementares",
            value: p("ADICIONAIS_LOCACAO"),
            block: true,
          }),
        ),
      }),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "11",
          title: "Rescisão",
          children: DocumentCard({
            children: DocumentBullets([
              "Aplicam-se as penalidades previstas em lei e neste contrato em caso de rescisão antecipada ou inadimplemento.",
              "O descumprimento de obrigações essenciais poderá ensejar multa, perdas e danos e demais medidas cabíveis.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "12",
          title: "Foro",
          children: DocumentCard({
            children: DocumentInput({
              label: "Comarca eleita",
              value: p("CIDADE"),
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "13",
        title: "Assinaturas",
        description: "Por estarem justas e acordadas, as partes assinam o presente instrumento.",
        children: `<div class="document-signature-grid">
          ${DocumentSignatureBlock({
            role: "Locador",
            fields: [
              { label: "Nome", value: p("LOCADOR") },
              { label: "Assinatura", value: p("ASSINATURA_LOCADOR") },
            ],
          })}
          ${DocumentSignatureBlock({
            role: "Locatario",
            fields: [
              { label: "Nome", value: p("LOCATARIO") },
              { label: "Assinatura", value: p("ASSINATURA_LOCATARIO") },
            ],
          })}
          ${DocumentSignatureBlock({
            role: "Corretor",
            fields: [
              { label: "Nome", value: p("CORRETOR") },
              { label: "CRECI", value: p("CORRETOR_CRECI") },
              { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
            ],
          })}
        </div>`,
      }),
    ),
  })

  const page6 = DocumentPage({
    pageNumber: 6,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "14",
        title: "Fechamento",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para locação residencial. Recomenda-se revisão jurídica final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5, page6],
  })
}

function buildOfficialCommercialLeaseContractHtml(content: ContractContent) {
  const totalPages = 6

  const cover = DocumentCover({
    title: "Contrato de Locação Comercial",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para locações comerciais, preparado para sincronizar dados de cliente, imóvel, corretor e imobiliária com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Comercial", "Editorial", "Operacional"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Das Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Locador",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("LOCADOR") },
                { label: "CPF/CNPJ", value: p("LOCADOR_CPF_CNPJ") },
                { label: "RG", value: p("LOCADOR_RG") },
                { label: "Estado civil", value: p("LOCADOR_ESTADO_CIVIL") },
                { label: "Profissão", value: p("LOCADOR_PROFISSAO") },
                { label: "Endereço", value: p("LOCADOR_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Locatario",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("LOCATARIO") },
                { label: "CPF/CNPJ", value: p("LOCATARIO_CPF_CNPJ") },
                { label: "RG", value: p("LOCATARIO_RG") },
                { label: "Estado civil", value: p("LOCATARIO_ESTADO_CIVIL") },
                { label: "Profissão", value: p("LOCATARIO_PROFISSAO") },
                { label: "Endereço", value: p("LOCATARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediação",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliária", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imóvel Comercial",
        description: "Identificação do ativo comercial e das informações documentais principais da locação.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imóvel comercial", value: p("IMOVEL_COMERCIAL") },
                { label: "Tipo do imóvel", value: p("TIPO_IMOVEL") },
                { label: "Endereço completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matrícula", value: p("MATRICULA") },
                { label: "Cartório de registro", value: p("CARTORIO_REGISTRO") },
                { label: "Inscrição imobiliária", value: p("INSCRICAO_IMOBILIARIA") },
              ],
            }),
          }),
          DocumentNotice("O imóvel destina-se exclusivamente a uso comercial compatível com a atividade acordada entre as partes."),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "3",
          title: "Finalidade Comercial",
          children: DocumentStack(
            DocumentCard({
              tone: "accent",
              children: DocumentInput({
                label: "Atividade permitida",
                value: p("FINALIDADE_COMERCIAL"),
                block: true,
              }),
            }),
            DocumentNotice("A atividade exercida no local deve respeitar licencas, normas condominiais, urbanisticas e a destinação comercial pactuada."),
          ),
        }),
        DocumentSection({
          icon: "4",
          title: "Prazo",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Início", value: p("DATA_INICIO") },
                { label: "Término", value: p("DATA_FIM") },
                { label: "Prazo da locação", value: p("PRAZO_LOCACAO"), span: 2 },
              ],
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Valor e Reajuste",
        children: DocumentStack(
          DocumentCard({
            title: "Condições financeiras",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Aluguel", value: p("VALOR_ALUGUEL") },
                { label: "Vencimento", value: p("DIA_VENCIMENTO") },
                { label: "Forma de pagamento", value: p("FORMA_PAGAMENTO"), span: 2 },
                { label: "Reajuste", value: p("REAJUSTE_LOCACAO"), span: 2 },
              ],
            }),
          }),
          DocumentNotice("Os indices e criterios de reajuste devem refletir a negociação comercial validada pelas partes."),
        ),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "6",
          title: "Garantia",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 1,
              items: [
                { label: "Tipo de garantia", value: p("TIPO_GARANTIA") },
                { label: "Encargos e observações", value: p("CRONOGRAMA_OBSERVACOES") },
              ],
            }),
          }),
        }),
        DocumentSection({
          icon: "7",
          title: "Encargos",
          children: DocumentCard({
            children: DocumentBullets([
              "IPTU, condominio, água, energia, gás, internet e taxas operacionais seguem a negociação comercial pactuada.",
              "Despesas extraordinárias, licencas e exigencias do ponto comercial devem ser definidas de forma expressa entre as partes.",
            ]),
          }),
        }),
      ),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "8",
          title: "Obras",
          children: DocumentStack(
            DocumentCard({
              children: DocumentInput({
                label: "Obras previstas",
                value: p("OBRAS_LOCACAO"),
                block: true,
              }),
            }),
            DocumentNotice("Qualquer obra estrutural ou operacional deve observar autorizações, responsabilidade financeira e normas do imóvel."),
          ),
        }),
        DocumentSection({
          icon: "9",
          title: "Adequações",
          children: DocumentStack(
            DocumentCard({
              children: DocumentInput({
                label: "Adequações do ponto comercial",
                value: p("ADEQUACOES_LOCACAO"),
                block: true,
              }),
            }),
            DocumentNotice("Adequações tecnicas, visuais ou operacionais devem respeitar o uso aprovado para o ponto."),
          ),
        }),
      ),
      DocumentSection({
        icon: "10",
        title: "Vistoria e Conservação",
        children: DocumentStack(
          DocumentCard({
            children: DocumentFieldGrid({
              columns: 1,
              items: [{ label: "Laudo de vistoria inicial", value: p("LAUDO_VISTORIA") }],
            }),
          }),
          DocumentCard({
            children: DocumentBullets([
              "O locatario compromete-se a conservar o imóvel comercial e responder por danos decorrentes de uso inadequado.",
              "A devolução do ponto observara o estado convencionado entre as partes e as adequações autorizadas.",
            ]),
          }),
        ),
      }),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "11",
          title: "Rescisão",
          children: DocumentCard({
            children: DocumentBullets([
              "Aplicam-se as penalidades previstas em lei e neste contrato em caso de rescisão antecipada, inadimplemento ou uso indevido do ponto comercial.",
              "As partes podem estabelecer multa, prazo de desocupação e responsabilidades por obras e adequações pendentes.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "12",
          title: "Foro",
          children: DocumentCard({
            children: DocumentInput({
              label: "Comarca eleita",
              value: p("CIDADE"),
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "13",
        title: "Assinaturas",
        description: "Por estarem justas e acordadas, as partes assinam o presente instrumento.",
        children: `<div class="document-signature-grid">
          ${DocumentSignatureBlock({
            role: "Locador",
            fields: [
              { label: "Nome", value: p("LOCADOR") },
              { label: "Assinatura", value: p("ASSINATURA_LOCADOR") },
            ],
          })}
          ${DocumentSignatureBlock({
            role: "Locatario",
            fields: [
              { label: "Nome", value: p("LOCATARIO") },
              { label: "Assinatura", value: p("ASSINATURA_LOCATARIO") },
            ],
          })}
          ${DocumentSignatureBlock({
            role: "Corretor",
            fields: [
              { label: "Nome", value: p("CORRETOR") },
              { label: "CRECI", value: p("CORRETOR_CRECI") },
              { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
            ],
          })}
        </div>`,
      }),
    ),
  })

  const page6 = DocumentPage({
    pageNumber: 6,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "14",
        title: "Fechamento",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para locação comercial. Recomenda-se revisão jurídica final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5, page6],
  })
}

function buildOfficialSaleAuthorizationContractHtml(content: ContractContent) {
  const totalPages = 5

  const cover = DocumentCover({
    title: "Autorização de Venda de Imóvel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para autorização de venda, preparado para sincronizar proprietário, imóvel, corretor e imobiliária com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Captação", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Das Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Proprietário",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("PROPRIETARIO") },
                { label: "CPF/CNPJ", value: p("PROPRIETARIO_CPF_CNPJ") },
                { label: "RG", value: p("PROPRIETARIO_RG") },
                { label: "Estado civil", value: p("PROPRIETARIO_ESTADO_CIVIL") },
                { label: "Profissão", value: p("PROPRIETARIO_PROFISSAO") },
                { label: "Endereço", value: p("PROPRIETARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediação",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliária", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imóvel",
        description: "Identificação do imóvel autorizado para intermediar a venda.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imóvel", value: p("IMOVEL") },
                { label: "Tipo do imóvel", value: p("TIPO_IMOVEL") },
                { label: "Endereço completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matrícula", value: p("MATRICULA") },
                { label: "Cartório de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O proprietário declara possuir legitimidade para autorizar a intermediação da venda do imóvel descrito neste instrumento."),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "3",
          title: "Valor Autorizado",
          children: DocumentCard({
            tone: "accent",
            children: DocumentInput({
              label: "Valor autorizado para venda",
              value: p("VALOR_AUTORIZADO"),
            }),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Comissão",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Percentual", value: p("COMISSAO_AUTORIZACAO") },
                { label: "Responsável pela intermediação", value: p("CORRETOR") },
              ],
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Prazo",
        children: DocumentCard({
          children: DocumentFieldGrid({
            columns: 2,
            items: [
              { label: "Início", value: p("DATA_INICIO") },
              { label: "Término", value: p("DATA_FIM") },
              { label: "Prazo da autorização", value: p("PRAZO_AUTORIZACAO"), span: 2 },
            ],
          }),
        }),
      }),
      DocumentSection({
        icon: "6",
        title: "Condições da Intermediação",
        children: DocumentStack(
          DocumentCard({
            children: DocumentInput({
              label: "Condições acordadas",
              value: p("CONDICOES_INTERMEDIACAO"),
              block: true,
            }),
          }),
          DocumentNotice("As condições da intermediação devem refletir o escopo comercial aprovado entre proprietário, corretor e imobiliária."),
        ),
      }),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "7",
          title: "Obrigações",
          children: DocumentCard({
            children: DocumentBullets([
              "O proprietário compromete-se a fornecer informações veridicas, documentação minima e acesso necessário para a intermediação.",
              "O corretor compromete-se a conduzir a captação, apresentação e negociação do imóvel com diligência profissional.",
              "As partes devem respeitar o valor autorizado, as condições comerciais e os limites definidos nesta autorização.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "8",
          title: "Revogação",
          children: DocumentCard({
            children: DocumentBullets([
              "A autorização pode ser revogada conforme as regras deste instrumento e da legislação aplicável.",
              "A revogação não afasta direitos já constituídos por negociações iniciadas validamente dentro do prazo autorizado, conforme ajuste entre as partes.",
            ]),
          }),
        }),
      ),
      DocumentSection({
        icon: "9",
        title: "Foro",
        children: DocumentCard({
          children: DocumentInput({
            label: "Comarca eleita",
            value: p("COMARCA"),
          }),
        }),
      }),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "10",
        title: "Assinaturas",
        description: "Por estarem justas e acordadas, as partes assinam a presente autorização.",
        children: DocumentStack(
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Proprietário",
              fields: [
                { label: "Nome", value: p("PROPRIETARIO") },
                { label: "Assinatura", value: p("ASSINATURA_PROPRIETARIO") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Corretor",
              fields: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
              ],
            })}
          </div>`,
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para autorização de venda. Recomenda-se revisão jurídica final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5],
  })
}

function buildOfficialExclusivityContractHtml(content: ContractContent) {
  const totalPages = 5

  const cover = DocumentCover({
    title: "Contrato de Exclusividade de Venda",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para exclusividade de venda, preparado para sincronizar proprietário, imóvel, corretor e imobiliária com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Exclusividade", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Das Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Proprietário",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("PROPRIETARIO") },
                { label: "CPF/CNPJ", value: p("PROPRIETARIO_CPF_CNPJ") },
                { label: "RG", value: p("PROPRIETARIO_RG") },
                { label: "Estado civil", value: p("PROPRIETARIO_ESTADO_CIVIL") },
                { label: "Profissão", value: p("PROPRIETARIO_PROFISSAO") },
                { label: "Endereço", value: p("PROPRIETARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediação exclusiva",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliária", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imóvel",
        description: "Identificação do imóvel objeto da intermediação exclusiva.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imóvel", value: p("IMOVEL") },
                { label: "Tipo do imóvel", value: p("TIPO_IMOVEL") },
                { label: "Endereço completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matrícula", value: p("MATRICULA") },
                { label: "Cartório de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O proprietário declara possuir legitimidade para contratar a intermediação exclusiva da venda do imóvel descrito neste instrumento."),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "3",
          title: "Prazo de Exclusividade",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Início", value: p("DATA_INICIO") },
                { label: "Término", value: p("DATA_FIM") },
                { label: "Prazo contratado", value: p("PRAZO_EXCLUSIVIDADE"), span: 2 },
              ],
            }),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Comissão",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Percentual", value: p("COMISSAO_EXCLUSIVIDADE") },
                { label: "Corretor responsável", value: p("CORRETOR") },
              ],
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Valor e Condições da Intermediação",
        children: DocumentStack(
          DocumentCard({
            title: "Bases comerciais",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Valor de referência", value: p("VALOR_AUTORIZADO") },
                { label: "Finalidade", value: p("FINALIDADE") },
                { label: "Condições da intermediação", value: p("CONDICOES_EXCLUSIVIDADE"), span: 2 },
              ],
            }),
          }),
          DocumentNotice("As condições da exclusividade devem refletir o escopo comercial aprovado entre proprietário, corretor e imobiliária."),
        ),
      }),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "6",
          title: "Direitos e Obrigações",
          children: DocumentCard({
            children: DocumentBullets([
              "O proprietário compromete-se a respeitar a exclusividade durante o prazo contratado e a fornecer informações veridicas sobre o imóvel.",
              "O corretor compromete-se a conduzir a captação, divulgação e negociação do imóvel com diligência profissional.",
              "As partes devem observar o valor de referência, a comissão pactuada e as demais condições comerciais deste instrumento.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "7",
          title: "Rescisão",
          children: DocumentCard({
            children: DocumentBullets([
              "A rescisão observara as regras deste instrumento e a legislação aplicável, inclusive quanto a eventuais penalidades.",
              "O encerramento antecipado não afasta direitos já constituídos por negociações iniciadas validamente dentro do prazo de exclusividade, conforme ajuste entre as partes.",
            ]),
          }),
        }),
      ),
      DocumentSection({
        icon: "8",
        title: "Foro",
        children: DocumentCard({
          children: DocumentInput({
            label: "Comarca eleita",
            value: p("COMARCA"),
          }),
        }),
      }),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "9",
        title: "Assinaturas",
        description: "Por estarem justas e acordadas, as partes assinam o presente contrato de exclusividade.",
        children: DocumentStack(
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Proprietário",
              fields: [
                { label: "Nome", value: p("PROPRIETARIO") },
                { label: "Assinatura", value: p("ASSINATURA_PROPRIETARIO") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Corretor",
              fields: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
              ],
            })}
          </div>`,
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para exclusividade de venda. Recomenda-se revisão jurídica final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5],
  })
}

function buildOfficialVisitTermContractHtml(content: ContractContent) {
  const totalPages = 4

  const cover = DocumentCover({
    title: "Termo de Visita ao Imóvel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para registrar visitas a imóveis, preparado para sincronizar visitante, imóvel e corretor com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Visita", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Das Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Visitante",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("VISITANTE") },
                { label: "CPF/CNPJ", value: p("VISITANTE_CPF_CNPJ") },
                { label: "RG", value: p("VISITANTE_RG") },
                { label: "Telefone", value: p("VISITANTE_TELEFONE") },
                { label: "E-mail", value: p("VISITANTE_EMAIL") },
                { label: "Endereço", value: p("VISITANTE_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Corretor responsável",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Telefone", value: p("CORRETOR_TELEFONE") },
                { label: "E-mail", value: p("CORRETOR_EMAIL") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imóvel Visitado",
        description: "Identificação do imóvel apresentado ao visitante nesta visita.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imóvel visitado", value: p("IMOVEL_VISITADO") },
                { label: "Tipo do imóvel", value: p("TIPO_IMOVEL") },
                { label: "Endereço completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
              ],
            }),
          }),
          DocumentNotice("O visitante declara que conheceu o imóvel por intermédio do corretor responsável indicado neste termo."),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "3",
          title: "Data e Hora",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Data da visita", value: p("DATA_VISITA") },
                { label: "Hora da visita", value: p("HORA_VISITA") },
              ],
            }),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Ciência da Intermediação",
          children: DocumentCard({
            children: DocumentInput({
              label: "Registro",
              value: p("CIENCIA_INTERMEDIACAO"),
              block: true,
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Declarações",
        children: DocumentStack(
          DocumentCard({
            children: DocumentBullets([
              "O visitante declara ter conhecido o imóvel por intermédio do corretor acima identificado.",
              "O visitante reconhece a ciência da intermediação imobiliária prestada nesta visita.",
              "O visitante compromete-se a respeitar a intermediação em eventual proposta ou negociação futura referente ao imóvel visitado.",
            ]),
          }),
          DocumentCard({
            tone: "soft",
            children: DocumentInput({
              label: "Declarações complementares",
              value: p("DECLARACOES_VISITA"),
              block: true,
            }),
          }),
        ),
      }),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "6",
        title: "Assinaturas",
        description: "Por estarem cientes da visita realizada, as partes assinam o presente termo.",
        children: DocumentStack(
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Visitante",
              fields: [
                { label: "Nome", value: p("VISITANTE") },
                { label: "Assinatura", value: p("ASSINATURA_VISITANTE") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Corretor",
              fields: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
              ],
            })}
          </div>`,
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para termo de visita. Recomenda-se revisão operacional final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4],
  })
}

function buildOfficialReservationContractHtml(content: ContractContent) {
  const totalPages = 5

  const cover = DocumentCover({
    title: "Contrato de Reserva de Imóvel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para reserva de imóvel, preparado para sincronizar interessado, proprietário, imóvel, corretor e imobiliária com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Reserva", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Das Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Interessado",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("INTERESSADO") },
                { label: "CPF/CNPJ", value: p("INTERESSADO_CPF_CNPJ") },
                { label: "RG", value: p("INTERESSADO_RG") },
                { label: "Telefone", value: p("INTERESSADO_TELEFONE") },
                { label: "E-mail", value: p("INTERESSADO_EMAIL") },
                { label: "Endereço", value: p("INTERESSADO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Proprietário e intermediação",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Proprietário", value: p("PROPRIETARIO") },
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliária", value: p("IMOBILIARIA") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imóvel",
        description: "Identificação do imóvel vinculado ao compromisso de reserva.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imóvel", value: p("IMOVEL") },
                { label: "Tipo do imóvel", value: p("TIPO_IMOVEL") },
                { label: "Endereço completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matrícula", value: p("MATRICULA") },
                { label: "Cartório de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O proprietário declara ter disponibilidade para negociar o imóvel nas condições registradas neste instrumento de reserva."),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "3",
          title: "Valor da Reserva",
          children: DocumentCard({
            tone: "accent",
            children: DocumentInput({
              label: "Valor comprometido para a reserva",
              value: p("VALOR_RESERVA"),
            }),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Prazo",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Início", value: p("DATA_INICIO") },
                { label: "Prazo da reserva", value: p("PRAZO_RESERVA") },
                { label: "Conversão ate", value: p("CONVERSAO_RESERVA"), span: 2 },
              ],
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Condições",
        children: DocumentStack(
          DocumentCard({
            children: DocumentInput({
              label: "Condições da reserva",
              value: p("CONDICOES_RESERVA"),
              block: true,
            }),
          }),
          DocumentNotice("As condições devem refletir sinal, aprovação documental, prazo de analise e demais premissas comerciais acordadas."),
        ),
      }),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentColumns(
        DocumentSection({
          icon: "6",
          title: "Conversão da Reserva",
          children: DocumentStack(
            DocumentCard({
              children: DocumentInput({
                label: "Condição de conversão",
                value: p("CONVERSAO_RESERVA"),
                block: true,
              }),
            }),
            DocumentCard({
              tone: "soft",
              children: DocumentBullets([
                "A reserva deverá ser convertida em instrumento definitivo dentro do prazo comercial acordado entre as partes.",
                "A intermediação deverá acompanhar a validação documental, a confirmação financeira e a eventual formalização do negócio.",
              ]),
            }),
          ),
        }),
        DocumentSection({
          icon: "7",
          title: "Rescisão",
          children: DocumentCard({
            children: DocumentBullets([
              "O descumprimento das condições de reserva pode ensejar cancelamento, devolução ou retenção conforme o ajuste entre as partes e a legislação aplicável.",
              "A liberação do imóvel para novos interessados depende da extinção formal da reserva ou do término do prazo estipulado.",
            ]),
          }),
        }),
      ),
      DocumentSection({
        icon: "8",
        title: "Foro",
        children: DocumentCard({
          children: DocumentInput({
            label: "Comarca eleita",
            value: p("COMARCA"),
          }),
        }),
      }),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "9",
        title: "Assinaturas",
        description: "Por estarem cientes das condições da reserva, as partes assinam o presente instrumento.",
        children: DocumentStack(
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Interessado",
              fields: [
                { label: "Nome", value: p("INTERESSADO") },
                { label: "Assinatura", value: p("ASSINATURA_INTERESSADO") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Proprietário",
              fields: [
                { label: "Nome", value: p("PROPRIETARIO") },
                { label: "Assinatura", value: p("ASSINATURA_PROPRIETARIO") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Corretor",
              fields: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
              ],
            })}
          </div>`,
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para reserva de imóvel. Recomenda-se revisão jurídica final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5],
  })
}

function buildOfficialAmendmentContractHtml(content: ContractContent) {
  const totalPages = 5

  const cover = DocumentCover({
    title: "Aditivo Contratual",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para aditivos contratuais, preparado para sincronizar cliente, imóvel, corretor e contrato original com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Aditivo", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Referência ao Contrato Original",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Referência", value: p("CONTRATO_ORIGINAL_REFERENCIA"), span: 2 },
                { label: "Cliente vinculado", value: p("COMPRADOR") },
                { label: "Imóvel", value: p("IMOVEL") },
                { label: "Endereço", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Matrícula", value: p("MATRICULA") },
                { label: "Cartório", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediação",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliária", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "2",
        title: "Alterações",
        children: DocumentCard({
          children: DocumentInput({
            label: "Escopo do aditivo",
            value: p("ALTERACOES_ADITIVO"),
            block: true,
          }),
        }),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "3",
          title: "Cláusulas Modificadas",
          children: DocumentCard({
            children: DocumentInput({
              label: "Cláusulas afetadas",
              value: p("CLAUSULAS_MODIFICADAS"),
              block: true,
            }),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Vigência",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Início", value: p("VIGENCIA_INICIO_ADITIVO") },
                { label: "Fim", value: p("VIGENCIA_FIM_ADITIVO") },
              ],
            }),
          }),
        }),
      ),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "5",
        title: "Consolidação",
        children: DocumentStack(
          DocumentCard({
            children: DocumentBullets([
              "Permanecem inalteradas e em pleno vigor as demais cláusulas do contrato original não expressamente modificadas neste aditivo.",
              "As partes reconhecem que este instrumento complementa o contrato principal, preservando sua integridade jurídica.",
              "As alterações aqui registradas produzem efeitos a partir da vigência indicada neste documento.",
            ]),
          }),
          DocumentSection({
            icon: "6",
            title: "Foro",
            children: DocumentCard({
              children: DocumentInput({
                label: "Comarca eleita",
                value: p("FORO_ADITIVO"),
              }),
            }),
          }),
        ),
      }),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "7",
        title: "Assinaturas",
        description: "Por estarem cientes das alterações aqui consolidadas, as partes assinam o presente aditivo.",
        children: DocumentStack(
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Cliente",
              fields: [
                { label: "Nome", value: p("COMPRADOR") },
                { label: "Assinatura", value: p("ASSINATURA_COMPRADOR") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Corretor",
              fields: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
              ],
            })}
          </div>`,
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para aditivos contratuais. Recomenda-se revisão jurídica final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5],
  })
}

function buildOfficialTerminationContractHtml(content: ContractContent) {
  const totalPages = 5

  const cover = DocumentCover({
    title: "Distrato Contratual",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para distratos contratuais, preparado para sincronizar cliente, imóvel, corretor e contrato original com preview editorial, PDF e futura automação pelo COS.",
    versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressão A4, PDF e assinatura eletrônica.",
    highlights: ["Distrato", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Partes",
        children: DocumentStack(
          DocumentCard({
            title: "Cliente vinculado",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("COMPRADOR") },
                { label: "CPF/CNPJ", value: p("COMPRADOR_CPF_CNPJ") },
                { label: "RG", value: p("COMPRADOR_RG") },
                { label: "Telefone", value: p("COMPRADOR_TELEFONE") },
                { label: "E-mail", value: p("COMPRADOR_EMAIL") },
                { label: "Endereço", value: p("COMPRADOR_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediação",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliária", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Referência ao Contrato Original",
        children: DocumentCard({
          tone: "soft",
          children: DocumentFieldGrid({
            columns: 2,
            items: [
              { label: "Referência", value: p("REFERENCIA_DISTRATO"), span: 2 },
              { label: "Imóvel", value: p("IMOVEL") },
              { label: "Matrícula", value: p("MATRICULA") },
              { label: "Endereço", value: p("IMOVEL_ENDERECO"), span: 2 },
              { label: "Cartório", value: p("CARTORIO_REGISTRO") },
              { label: "Cidade", value: p("CIDADE") },
            ],
          }),
        }),
      }),
    ),
  })

  const page3 = DocumentPage({
    pageNumber: 3,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "3",
        title: "Motivo do Encerramento",
        children: DocumentCard({
          children: DocumentInput({
            label: "Contexto do distrato",
            value: p("MOTIVO_ENCERRAMENTO"),
            block: true,
          }),
        }),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "4",
          title: "Quitação",
          children: DocumentCard({
            children: DocumentInput({
              label: "Quitação entre as partes",
              value: p("QUITACAO_DISTRATO"),
              block: true,
            }),
          }),
        }),
        DocumentSection({
          icon: "5",
          title: "Obrigações Remanescentes",
          children: DocumentCard({
            children: DocumentInput({
              label: "Obrigações apos o distrato",
              value: p("OBRIGACOES_REMANESCENTES"),
              block: true,
            }),
          }),
        }),
      ),
    ),
  })

  const page4 = DocumentPage({
    pageNumber: 4,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "6",
        title: "Consolidação",
        children: DocumentStack(
          DocumentCard({
            children: DocumentBullets([
              "As partes declaram, conforme a quitação pactuada, que o contrato original fica encerrado na forma deste instrumento.",
              "As obrigações remanescentes aqui descritas permanecem exigiveis ate seu integral cumprimento.",
              "O presente distrato consolida a extinção consensual da relação contratual principal, sem prejuizo das obrigações expressamente preservadas.",
            ]),
          }),
          DocumentSection({
            icon: "7",
            title: "Foro",
            children: DocumentCard({
              children: DocumentInput({
                label: "Comarca eleita",
                value: p("FORO_DISTRATO"),
              }),
            }),
          }),
        ),
      }),
    ),
  })

  const page5 = DocumentPage({
    pageNumber: 5,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "8",
        title: "Assinaturas",
        description: "Por estarem cientes do encerramento e das obrigações remanescentes, as partes assinam o presente distrato.",
        children: DocumentStack(
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Cliente",
              fields: [
                { label: "Nome", value: p("COMPRADOR") },
                { label: "Assinatura", value: p("ASSINATURA_COMPRADOR") },
              ],
            })}
            ${DocumentSignatureBlock({
              role: "Corretor",
              fields: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Assinatura", value: p("ASSINATURA_CORRETOR") },
              ],
            })}
          </div>`,
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Local", value: p("CIDADE") },
                { label: "Data", value: p("DATA_DOCUMENTO") },
              ],
            }),
          }),
          DocumentNotice("Template oficial EME para distratos contratuais. Recomenda-se revisão jurídica final antes do envio para assinatura eletrônica."),
        ),
      }),
    ),
  })

  return renderDocumentHtml({
    title: content.title,
    pages: [cover, page2, page3, page4, page5],
  })
}

function renderInfoCard(title: string, items: Array<{ label: string; value?: string | number | null }>) {
  return DocumentCard({
    title,
    children: DocumentFieldGrid({
      columns: 2,
      items: items.map((item) => ({
        label: item.label,
        value: valueOrFallback(item.value),
      })),
    }),
  })
}

function buildGenericContractHtml(content: ContractContent) {
  const property = content.property
  const lead = content.lead
  const financial = content.financial
  const amountLabel =
    financial.amountLabel ||
    (financial.amountCents ? formatCurrencyBRLFromCents(financial.amountCents) : "Não informado")

  return renderDocumentHtml({
    title: content.title,
    pages: [
      DocumentCover({
        title: content.title,
        subtitle: content.kind,
        description: getContractHeadline(content.kind),
        versionLabel: `Versão ${content.version}  |  ${contractStatusLabel(content.status)}`,
        footerLabel: "Base visual oficial do EME para documentos contratuais.",
        highlights: ["Modular", "Revisável", "Pronto para evolução"],
      }),
      DocumentPage({
        pageNumber: 2,
        totalPages: 3,
        children: DocumentStack(
          DocumentSection({
            icon: "A",
            title: "Resumo do Rascunho",
            children: DocumentColumns(
              renderInfoCard("Partes", [
                { label: "Cliente", value: lead?.name },
                { label: "Telefone", value: lead?.phone },
                { label: "E-mail", value: lead?.email },
                { label: "Corretor", value: content.authorName },
              ]),
              renderInfoCard("Ativo", [
                { label: "Imóvel", value: property?.title },
                { label: "Tipo", value: propertyTypeLabel(property?.type) },
                { label: "Finalidade", value: propertyPurposeLabel(property?.purpose) },
                { label: "Cidade", value: property?.city },
                { label: "Bairro", value: property?.neighborhood },
                { label: "Valor", value: amountLabel },
              ]),
            ),
          }),
          DocumentSection({
            icon: "B",
            title: "Cláusulas Base",
            children: DocumentCard({
              children: DocumentBullets(content.clauses),
            }),
          }),
        ),
      }),
      DocumentPage({
        pageNumber: 3,
        totalPages: 3,
        children: DocumentStack(
          DocumentSection({
            icon: "C",
            title: "Notas para Revisão",
            children: DocumentCard({
              tone: "soft",
              children: DocumentBullets(content.reviewNotes),
            }),
          }),
          DocumentSection({
            icon: "D",
            title: "Condições Comerciais",
            children: renderInfoCard("Financeiro", [
              { label: "Valor", value: amountLabel },
              { label: "Comissão", value: financial.commissionLabel || financial.commissionPercent },
              { label: "Início", value: financial.startDate },
              { label: "Fim", value: financial.endDate },
              { label: "Vencimento", value: financial.dueDate },
              { label: "Validade", value: financial.validity },
            ]),
          }),
          DocumentNotice("Os demais templates herdam esta mesma arquitetura visual e os mesmos componentes modulares."),
        ),
      }),
    ],
  })
}

// Papel que o cliente (content.lead) e o proprietario (content.property.ownerName) ocupam nos
// placeholders {{TOKEN}} de cada modelo, usado para preencher automaticamente os dados que o EME
// ja conhece em vez de deixar o token cru no documento. Contratos de captacao/exclusividade tratam
// o cliente vinculado como o proprio proprietario (quem autoriza a intermediacao).
function getContractPartyRoles(kind: ContractType): { clientToken: string | null; ownerToken: string | null } {
  if (kind === "Compra e venda") return { clientToken: "COMPRADOR", ownerToken: "VENDEDOR" }
  if (isResidentialLeaseContract(kind) || isCommercialLeaseContract(kind)) {
    return { clientToken: "LOCATARIO", ownerToken: "LOCADOR" }
  }
  if (isSaleAuthorizationContract(kind) || isExclusivityContract(kind)) {
    return { clientToken: "PROPRIETARIO", ownerToken: null }
  }
  if (isVisitTermContract(kind)) return { clientToken: "VISITANTE", ownerToken: null }
  if (isReservationContract(kind)) return { clientToken: "INTERESSADO", ownerToken: "PROPRIETARIO" }
  return { clientToken: "COMPRADOR", ownerToken: null }
}

function formatDateBRSafe(value?: string | null) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
}

function buildContractTokenMap(content: ContractContent): Record<string, string> {
  const lead = content.lead
  const property = content.property
  const financial = content.financial
  const map: Record<string, string> = {}

  const set = (key: string, value?: string | number | null) => {
    if (value === null || value === undefined) return
    const text = String(value).trim()
    if (text) map[key] = text
  }

  const { clientToken, ownerToken } = getContractPartyRoles(content.kind)
  if (clientToken) {
    set(clientToken, lead?.name || (clientToken === "PROPRIETARIO" ? property?.ownerName : null))
    set(`${clientToken}_TELEFONE`, lead?.phone)
    set(`${clientToken}_EMAIL`, lead?.email)
    set(`${clientToken}_CPF_CNPJ`, lead?.cpfCnpj)
    set(`${clientToken}_RG`, lead?.rg)
    set(`${clientToken}_ESTADO_CIVIL`, lead?.maritalStatus)
    set(`${clientToken}_PROFISSAO`, lead?.profession)
    set(`${clientToken}_NACIONALIDADE`, lead?.nationality)
    set(`${clientToken}_ENDERECO`, lead?.addressLine)
  }
  if (ownerToken) {
    set(ownerToken, property?.ownerName)
  }

  set("CORRETOR", content.authorName)
  set("CORRETOR_EMAIL", content.authorEmail)
  set("CORRETOR_TELEFONE", content.authorPhone)
  set("CORRETOR_CRECI", content.authorCreci)
  set("IMOBILIARIA", content.authorAgencyName)

  set("IMOVEL", property?.title)
  set("IMOVEL_COMERCIAL", property?.title)
  set("IMOVEL_VISITADO", property?.title)
  set("TIPO_IMOVEL", property?.type)
  set("CODIGO_INTERNO", property?.publicCode)
  set("BAIRRO", property?.neighborhood)
  set("CIDADE", property?.city)
  set("ESTADO", property?.state)
  set("CEP", property?.cep)
  set("VAGAS", property?.parkingSpots)
  set("IMOVEL_ENDERECO", property?.addressLine)
  set("MATRICULA", property?.registryNumber)
  set("CARTORIO_REGISTRO", property?.registryOffice)
  set("INSCRICAO_IMOBILIARIA", property?.municipalRegistration)
  set("AREA_PRIVATIVA", property?.privateArea)
  set("AREA_TOTAL", property?.totalArea)

  set("VALOR", financial.amountLabel)
  set("VALOR_ALUGUEL", financial.amountLabel)
  set("VALOR_AUTORIZADO", financial.amountLabel)
  set("VALOR_RESERVA", financial.amountLabel)
  set("COMISSAO", financial.commissionLabel)
  set("COMISSAO_AUTORIZACAO", financial.commissionLabel)
  set("COMISSAO_EXCLUSIVIDADE", financial.commissionLabel)
  set("DATA_INICIO", formatDateBRSafe(financial.startDate))
  set("DATA_FIM", formatDateBRSafe(financial.endDate))
  set("DIA_VENCIMENTO", financial.dueDate)
  set("FORMA_PAGAMENTO", financial.paymentMethod)
  set("TIPO_GARANTIA", financial.guaranteeType)
  set("LAUDO_VISTORIA", financial.inspectionReport)
  set("FINALIDADE_COMERCIAL", financial.commercialPurpose)
  set("REAJUSTE_LOCACAO", financial.adjustmentTerm)
  set("OBRAS_LOCACAO", financial.worksScope)
  set("ADEQUACOES_LOCACAO", financial.fitOutScope)
  set("CRONOGRAMA_OBSERVACOES", financial.additionalConditions)
  set("OBS_TRIBUTOS_DESPESAS", financial.additionalConditions)
  set("CONDICOES_INTERMEDIACAO", financial.additionalConditions)
  set("CONDICOES_EXCLUSIVIDADE", financial.additionalConditions)
  set("CONDICOES_RESERVA", financial.additionalConditions)
  set("DECLARACOES_VISITA", financial.additionalConditions)
  set("ADICIONAIS_LOCACAO", financial.additionalConditions)

  set("DATA_DOCUMENTO", formatDateBRSafe(content.updatedAt))

  return map
}

function escapeTokenValue(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Substitui {{TOKEN}} pelo dado real ja conhecido pelo EME (cliente, imovel, corretor, condicoes
// comerciais). Quando o dado nao existe em nenhuma fonte oficial, mostra um indicador visual de
// pendencia em vez do token cru, para o documento nunca parecer um esqueleto malformado.
function applyContractTokens(html: string, tokenMap: Record<string, string>) {
  return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, tokenName: string) => {
    const value = tokenMap[tokenName]
    if (value) return escapeTokenValue(value)
    return '<span class="document-pending">a preencher</span>'
  })
}

function buildRawContractHtml(content: ContractContent) {
  if (content.source === "external" && content.attachment) {
    return buildExternalContractAttachmentHtml(content)
  }

  if (content.kind === "Compra e venda") {
    return buildOfficialSaleContractHtml(content)
  }

  if (isResidentialLeaseContract(content.kind)) {
    return buildOfficialResidentialLeaseContractHtml(content)
  }

  if (isCommercialLeaseContract(content.kind)) {
    return buildOfficialCommercialLeaseContractHtml(content)
  }

  if (isSaleAuthorizationContract(content.kind)) {
    return buildOfficialSaleAuthorizationContractHtml(content)
  }

  if (isExclusivityContract(content.kind)) {
    return buildOfficialExclusivityContractHtml(content)
  }

  if (isVisitTermContract(content.kind)) {
    return buildOfficialVisitTermContractHtml(content)
  }

  if (isReservationContract(content.kind)) {
    return buildOfficialReservationContractHtml(content)
  }

  if (isAmendmentContract(content.kind)) {
    return buildOfficialAmendmentContractHtml(content)
  }

  if (isTerminationContract(content.kind)) {
    return buildOfficialTerminationContractHtml(content)
  }

  return buildGenericContractHtml(content)
}

export function buildContractHtml(content: ContractContent) {
  return applyContractTokens(buildRawContractHtml(content), buildContractTokenMap(content))
}

export function isExternalContractContent(content: Pick<ContractContent, "source" | "attachment"> | null | undefined) {
  return content?.source === "external" && Boolean(content.attachment?.fileUrl)
}

export function buildExternalContractAttachmentHtml(content: ContractContent) {
  const attachment = content.attachment
  const leadName = content.lead?.name || "Cliente não vinculado"
  const propertyName = content.property?.title || "Imóvel não vinculado"
  const notes = attachment?.notes || content.financial.additionalConditions || "Sem observações complementares."
  const mimeLabel = attachment?.mimeType || "Documento externo"
  const fileName = attachment?.fileName || "Arquivo anexado"
  const fileSize = formatAttachmentSize(attachment?.fileSize)

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeAttachmentHtml(content.title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #f3f5f2;
        color: #0f1720;
      }
      .page {
        width: 100%;
        min-height: 100vh;
        padding: 40px 28px;
      }
      .sheet {
        max-width: 920px;
        margin: 0 auto;
        background: white;
        border-radius: 28px;
        padding: 48px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.08);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        border-radius: 999px;
        padding: 10px 16px;
        background: rgba(0, 155, 58, 0.08);
        color: #009b3a;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 22px 0 10px;
        font-size: 40px;
        line-height: 1.04;
        letter-spacing: -0.06em;
      }
      p {
        margin: 0;
        color: #5f6b7a;
        line-height: 1.7;
      }
      .grid {
        display: grid;
        gap: 16px;
        margin-top: 32px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .card {
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 22px;
        padding: 22px;
        background: #fcfcfa;
      }
      .label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #8b95a1;
        margin-bottom: 10px;
      }
      .value {
        font-size: 19px;
        font-weight: 600;
        color: #050505;
        line-height: 1.4;
      }
      .notes {
        margin-top: 16px;
        white-space: pre-wrap;
      }
      @media print {
        body { background: white; }
        .page { padding: 0; }
        .sheet {
          box-shadow: none;
          border-radius: 0;
          max-width: none;
          min-height: 100vh;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="sheet">
        <span class="eyebrow">Contrato anexado</span>
        <h1>${escapeAttachmentHtml(content.title)}</h1>
        <p>Documento externo armazenado na biblioteca de contratos do EME, disponivel para busca, historico e acesso pelo COS.</p>
        <div class="grid">
          <article class="card">
            <div class="label">Cliente</div>
            <div class="value">${escapeAttachmentHtml(leadName)}</div>
          </article>
          <article class="card">
            <div class="label">Imóvel</div>
            <div class="value">${escapeAttachmentHtml(propertyName)}</div>
          </article>
          <article class="card">
            <div class="label">Tipo</div>
            <div class="value">${escapeAttachmentHtml(content.kind)}</div>
          </article>
          <article class="card">
            <div class="label">Status</div>
            <div class="value">${escapeAttachmentHtml(contractStatusLabel(content.status))}</div>
          </article>
          <article class="card">
            <div class="label">Arquivo</div>
            <div class="value">${escapeAttachmentHtml(fileName)}</div>
            <p class="notes">${escapeAttachmentHtml(mimeLabel)} • ${escapeAttachmentHtml(fileSize)}</p>
          </article>
          <article class="card">
            <div class="label">Observações</div>
            <p class="notes">${escapeAttachmentHtml(notes)}</p>
          </article>
        </div>
      </section>
    </main>
  </body>
</html>`
}

export function stringifyContractContent(content: ContractContent) {
  return JSON.stringify(content)
}

export function parseContractContent(value: string) {
  const parsed = JSON.parse(value) as ContractContent
  return parsed
}

export function contractHtmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function normalizeContractType(value: unknown): ContractType | null {
  if (typeof value !== "string") return null
  return contractTypeOptions.includes(value as ContractType) ? (value as ContractType) : null
}

export function parseContractAmount(value: unknown) {
  return parseCurrencyInputToCents(value)
}

export function createContractContent(input: {
  kind: ContractType
  title: string
  status?: ContractStatus
  version?: number
  lead?: ContractParty | null
  property?: ContractProperty | null
  financial?: ContractFinancial
  authorName: string
  authorEmail?: string | null
  authorPhone?: string | null
  authorCreci?: string | null
  authorAgencyName?: string | null
  createdAt?: string
  updatedAt?: string
}) {
  const createdAt = input.createdAt || new Date().toISOString()
  const updatedAt = input.updatedAt || createdAt
  const financial = input.financial || {}
  const content: ContractContent = {
    version: input.version ?? 1,
    kind: input.kind,
    status: normalizeContractStatus(input.status) ?? "draft",
    title: input.title,
    authorName: input.authorName,
    authorEmail: input.authorEmail ?? null,
    authorPhone: input.authorPhone ?? null,
    authorCreci: input.authorCreci ?? null,
    authorAgencyName: input.authorAgencyName ?? null,
    createdAt,
    updatedAt,
    lead: input.lead ?? null,
    property: input.property ?? null,
    financial: {
      amountLabel:
        financial.amountLabel ||
        (financial.amountCents ? formatCurrencyBRLFromCents(financial.amountCents) : null),
      amountCents: financial.amountCents ?? null,
      commissionPercent: financial.commissionPercent ?? null,
      commissionLabel:
        financial.commissionLabel ||
        (financial.commissionPercent ? `${financial.commissionPercent}%` : null),
      startDate: financial.startDate ?? null,
      endDate: financial.endDate ?? null,
      dueDate: financial.dueDate ?? null,
      validity: financial.validity ?? null,
      paymentMethod: financial.paymentMethod ?? null,
      guaranteeType: financial.guaranteeType ?? null,
      inspectionReport: financial.inspectionReport ?? null,
      commercialPurpose: financial.commercialPurpose ?? null,
      adjustmentTerm: financial.adjustmentTerm ?? null,
      worksScope: financial.worksScope ?? null,
      fitOutScope: financial.fitOutScope ?? null,
      additionalConditions: financial.additionalConditions ?? null,
    },
    clauses: buildContractClauses(input.kind, { lead: input.lead, property: input.property, financial }),
    reviewNotes: buildContractReviewNotes(input.kind),
    html: "",
  }

  content.html = buildContractHtml(content)
  return content
}
