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

function valueOrFallback(value?: string | number | null, fallback = "Nao informado") {
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
  if (!bytes || bytes <= 0) return "Tamanho nao informado"
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
  if (kind === "Compra e venda") return "Template mestre do EME para operacoes de compra e venda de imoveis."
  if (kind === "Locacao residencial") return "Template oficial EME para locacoes residenciais com preview editorial, PDF e sincronizacao em tempo real."
  if (kind === "Locacao comercial") return "Template oficial EME para locacoes comerciais com foco em operacao, adequacoes do ponto e regras financeiras recorrentes."
  if (kind === "Autorizacao de venda") return "Template oficial EME para autorizacao de venda com foco em intermediar, validar prazo, comissao e condicoes da captacao."
  if (kind === "Exclusividade") return "Template oficial EME para exclusividade de venda com foco em prazo, comissao, direitos e obrigacoes da intermediacao exclusiva."
  if (kind === "Termo de visita") return "Template oficial EME para termo de visita com foco em ciencia da intermediacao, declaracoes e registro da visita ao imovel."
  if (kind === "Reserva") return "Template oficial EME para reserva de imovel com foco em interessado, proprietario, conversao da reserva e sincronizacao do preview em tempo real."
  if (kind === "Aditivo") return "Template oficial EME para aditivos contratuais com foco em referencia ao contrato original, clausulas modificadas, vigencia e sincronizacao em tempo real."
  return "Template oficial EME para distratos com foco em encerramento consensual, quitacao, obrigacoes remanescentes e sincronizacao do preview em tempo real."
}

export function buildContractClauses(kind: ContractType, input: {
  lead?: ContractParty | null
  property?: ContractProperty | null
  financial?: ContractFinancial
}): string[] {
  const amount = input.financial?.amountLabel || (input.financial?.amountCents ? formatCurrencyBRLFromCents(input.financial.amountCents) : "Nao informado")
  const propertyRef = input.property?.title || "imovel em referencia"
  const personName = input.lead?.name || "cliente"
  const commission = input.financial?.commissionLabel || (input.financial?.commissionPercent ? `${input.financial.commissionPercent}%` : "Nao informada")

  if (kind === "Compra e venda") {
    return [
      `Partes previstas: vendedor ${p("VENDEDOR")} e comprador ${p("COMPRADOR")}, com intermediacao de ${p("CORRETOR")}.`,
      `Objeto principal: ${p("IMOVEL")} com matricula ${p("MATRICULA")} e valor base ${p("VALOR")}.`,
      `Forma de pagamento prevista: entrada, parcelas, financiamento, FGTS e recursos proprios conforme cronograma contratual.`,
      `Corretagem de referencia: ${commission}. Revisar responsabilidade, vencimento e base de calculo antes da assinatura.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  if (isResidentialLeaseContract(kind)) {
    return [
      `Partes previstas: locador ${p("LOCADOR")}, locatario ${p("LOCATARIO")} e intermediacao de ${p("CORRETOR")}.`,
      `Imovel locado: ${p("IMOVEL")} no endereco ${p("IMOVEL_ENDERECO")}, matricula ${p("MATRICULA")} e foro em ${p("CIDADE")}.`,
      `Condicoes financeiras atuais: aluguel mensal ${p("VALOR_ALUGUEL")}, vencimento ${p("DIA_VENCIMENTO")} e forma de pagamento ${p("FORMA_PAGAMENTO")}.`,
      `Garantia prevista: ${p("TIPO_GARANTIA")}. Laudo de vistoria vinculado: ${p("LAUDO_VISTORIA")}.`,
      `Prazo da locacao: inicio ${p("DATA_INICIO")}, termino ${p("DATA_FIM")} e referencia comercial ${p("PRAZO_LOCACAO")}.`,
    ]
  }

  if (isCommercialLeaseContract(kind)) {
    return [
      `Partes previstas: locador ${p("LOCADOR")}, locatario ${p("LOCATARIO")} e intermediacao de ${p("CORRETOR")}.`,
      `Imovel comercial: ${p("IMOVEL_COMERCIAL")} no endereco ${p("IMOVEL_ENDERECO")}, destinado a ${p("FINALIDADE_COMERCIAL")}.`,
      `Condicoes financeiras atuais: aluguel ${p("VALOR_ALUGUEL")}, vencimento ${p("DIA_VENCIMENTO")}, reajuste ${p("REAJUSTE_LOCACAO")} e forma de pagamento ${p("FORMA_PAGAMENTO")}.`,
      `Garantia prevista: ${p("TIPO_GARANTIA")}. Encargos e repasses operacionais em ${p("CRONOGRAMA_OBSERVACOES")}.`,
      `Obras e adequacoes combinadas: ${p("OBRAS_LOCACAO")} / ${p("ADEQUACOES_LOCACAO")}.`,
    ]
  }

  if (isSaleAuthorizationContract(kind)) {
    return [
      `Partes previstas: proprietario ${p("PROPRIETARIO")} e corretor ${p("CORRETOR")}, com intermediacao vinculada a ${p("IMOBILIARIA")}.`,
      `Imovel autorizado para venda: ${p("IMOVEL")} no endereco ${p("IMOVEL_ENDERECO")}, matricula ${p("MATRICULA")} e valor autorizado ${p("VALOR_AUTORIZADO")}.`,
      `Prazo da autorizacao: inicio ${p("DATA_INICIO")} e termino ${p("DATA_FIM")}, referencia comercial ${p("PRAZO_AUTORIZACAO")}.`,
      `Comissao prevista: ${p("COMISSAO_AUTORIZACAO")}. Condicoes da intermediacao registradas em ${p("CONDICOES_INTERMEDIACAO")}.`,
      `Foro eleito: ${p("COMARCA")}. Revogacao e obrigacoes devem ser revisadas antes da assinatura final.`,
    ]
  }

  if (isExclusivityContract(kind)) {
    return [
      `Partes previstas: proprietario ${p("PROPRIETARIO")} e corretor ${p("CORRETOR")}, com intermediacao exclusiva vinculada a ${p("IMOBILIARIA")}.`,
      `Imovel em exclusividade: ${p("IMOVEL")} no endereco ${p("IMOVEL_ENDERECO")}, matricula ${p("MATRICULA")} e valor de referencia ${p("VALOR_AUTORIZADO")}.`,
      `Prazo de exclusividade: inicio ${p("DATA_INICIO")} e termino ${p("DATA_FIM")}, referencia comercial ${p("PRAZO_EXCLUSIVIDADE")}.`,
      `Comissao prevista: ${p("COMISSAO_EXCLUSIVIDADE")}. Direitos, obrigacoes e condicoes da intermediacao registrados em ${p("CONDICOES_EXCLUSIVIDADE")}.`,
      `Foro eleito: ${p("COMARCA")}. Rescisao e regras de exclusividade devem ser revisadas antes da assinatura final.`,
    ]
  }

  if (isVisitTermContract(kind)) {
    return [
      `Partes previstas: visitante ${p("VISITANTE")} e corretor ${p("CORRETOR")}, vinculados ao imovel ${p("IMOVEL_VISITADO")}.`,
      `Registro de visita: data ${p("DATA_VISITA")} e hora ${p("HORA_VISITA")}, no endereco ${p("IMOVEL_ENDERECO")}.`,
      `Ciencia da intermediacao registrada em ${p("CIENCIA_INTERMEDIACAO")} e declaracoes complementares em ${p("DECLARACOES_VISITA")}.`,
      `As partes reconhecem a visita mediada pelo corretor responsavel ${p("CORRETOR")} sob o contexto operacional do EME.`,
    ]
  }

  if (isReservationContract(kind)) {
    return [
      `Partes previstas: interessado ${p("INTERESSADO")}, proprietario ${p("PROPRIETARIO")} e intermediacao de ${p("CORRETOR")}${p("IMOBILIARIA") ? ` com apoio de ${p("IMOBILIARIA")}` : ""}.`,
      `Imovel reservado: ${p("IMOVEL")} no endereco ${p("IMOVEL_ENDERECO")}, matricula ${p("MATRICULA")} e foro em ${p("COMARCA")}.`,
      `Condicoes comerciais atuais: valor da reserva ${p("VALOR_RESERVA")}, prazo ${p("PRAZO_RESERVA")} e conversao prevista ate ${p("CONVERSAO_RESERVA")}.`,
      `Condicoes adicionais registradas em ${p("CONDICOES_RESERVA")}. Revisar conversao da reserva, prazo, devolucao e penalidades antes da assinatura.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  if (isAmendmentContract(kind)) {
    return [
      `Aditivo vinculado a ${p("CONTRATO_ORIGINAL_REFERENCIA")}, mantendo como partes de apoio ${p("COMPRADOR")} e a intermediacao de ${p("CORRETOR")}.`,
      `Imovel de referencia: ${p("IMOVEL")} no endereco ${p("IMOVEL_ENDERECO")}, matricula ${p("MATRICULA")} e foro ${p("FORO_ADITIVO")}.`,
      `Clausulas modificadas: ${p("CLAUSULAS_MODIFICADAS")}. Alteracoes consolidadas em ${p("ALTERACOES_ADITIVO")}.`,
      `Vigencia do aditivo: de ${p("VIGENCIA_INICIO_ADITIVO")} ate ${p("VIGENCIA_FIM_ADITIVO")}.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  if (isTerminationContract(kind)) {
    return [
      `Distrato vinculado a ${p("REFERENCIA_DISTRATO")}, mantendo como partes de apoio ${p("COMPRADOR")} e a intermediacao de ${p("CORRETOR")}.`,
      `Imovel de referencia: ${p("IMOVEL")} no endereco ${p("IMOVEL_ENDERECO")}, matricula ${p("MATRICULA")} e foro ${p("FORO_DISTRATO")}.`,
      `Motivo do encerramento: ${p("MOTIVO_ENCERRAMENTO")}. Quitacao registrada em ${p("QUITACAO_DISTRATO")}.`,
      `Obrigacoes remanescentes: ${p("OBRIGACOES_REMANESCENTES")}.`,
      `Dados comerciais atuais vinculados ao rascunho: ${personName}, ${propertyRef}, ${amount}.`,
    ]
  }

  const exhaustiveKind: never = kind
  return [
    `${String(exhaustiveKind)}: minuta base preparada para ${personName}, vinculada ao ativo ${propertyRef}.`,
    `Valor principal de referencia: ${amount}. Condicoes financeiras definitivas devem ser conferidas antes da assinatura.`,
    `Comissao prevista: ${commission}. Validar regra comercial, gatilho de pagamento e responsabilidade entre as partes.`,
    "Este rascunho organiza dados comerciais, partes e prazos, mas nao substitui revisao juridica das clausulas essenciais.",
  ]
}

export function buildContractReviewNotes(kind: ContractType): string[] {
  if (kind === "Compra e venda") {
    return [
      "Confirmar se todos os placeholders obrigatorios foram substituidos antes do envio ao cliente.",
      "Revisar matricula, endereco, cronograma financeiro, arras, corretagem e regras de posse.",
      "Validar reparticao de tributos, despesas cartorarias e eventuais condicoes suspensivas.",
      "Manter o documento como rascunho ate a validacao comercial e juridica final.",
    ]
  }

  if (isResidentialLeaseContract(kind)) {
    return [
      "Validar se locador, locatario, imovel, garantia e vencimento estao consistentes antes do envio para assinatura.",
      "Conferir laudo de vistoria, encargos locaticios, prazo da locacao e regras de conservacao do imovel.",
      "Revisar clausulas de rescisao, benfeitorias, foro e obrigacoes recorrentes com suporte juridico quando necessario.",
      "Manter o documento como rascunho ate a confirmacao comercial, documental e juridica final.",
    ]
  }

  if (isCommercialLeaseContract(kind)) {
    return [
      "Validar ponto comercial, finalidade de uso, reajuste, garantia e responsabilidades operacionais antes do envio para assinatura.",
      "Conferir matricula, cartorio, laudo, obras, adequacoes e encargos recorrentes da locacao.",
      "Revisar clausulas de rescisao, prazo, uso comercial permitido e riscos operacionais com suporte juridico quando necessario.",
      "Manter o documento como rascunho ate a confirmacao comercial, documental e juridica final.",
    ]
  }

  if (isSaleAuthorizationContract(kind)) {
    return [
      "Validar proprietario, corretor, imovel, valor autorizado e prazo antes do envio para assinatura.",
      "Conferir matricula, cartorio, comissao, condicoes da intermediacao e obrigacoes operacionais da autorizacao.",
      "Revisar regras de revogacao, foro e alcance da captacao com suporte juridico quando necessario.",
      "Manter o documento como rascunho ate a confirmacao comercial, documental e juridica final.",
    ]
  }

  if (isExclusivityContract(kind)) {
    return [
      "Validar proprietario, corretor, imovel, prazo de exclusividade e comissao antes do envio para assinatura.",
      "Conferir matricula, cartorio, condicoes da intermediacao exclusiva, direitos e obrigacoes operacionais.",
      "Revisar regras de rescisao, foro e alcance da exclusividade com suporte juridico quando necessario.",
      "Manter o documento como rascunho ate a confirmacao comercial, documental e juridica final.",
    ]
  }

  if (isVisitTermContract(kind)) {
    return [
      "Validar visitante, corretor, imovel visitado, data e hora antes do envio para assinatura.",
      "Conferir ciencia da intermediacao, declaracoes do visitante e dados minimos da visita.",
      "Manter o termo como rascunho ate a confirmacao operacional e documental final.",
    ]
  }

  if (isReservationContract(kind)) {
    return [
      "Validar interessado, proprietario, imovel e prazo da reserva antes do envio para assinatura.",
      "Conferir matricula, cartorio, valor da reserva, condicoes da conversao e responsabilidades das partes.",
      "Revisar regras de rescisao, devolucao, foro e conversao da reserva com suporte juridico quando necessario.",
      "Manter o documento como rascunho ate a confirmacao comercial, documental e juridica final.",
    ]
  }

  if (isAmendmentContract(kind)) {
    return [
      "Validar a referencia ao contrato original, as clausulas modificadas e a vigencia do aditivo antes do envio para assinatura.",
      "Conferir se as alteracoes registradas refletem exatamente o ajuste negociado pelas partes.",
      "Revisar foro, assinaturas e eventual impacto juridico no instrumento principal com suporte especializado quando necessario.",
      "Manter o documento como rascunho ate a confirmacao comercial, documental e juridica final.",
    ]
  }

  if (isTerminationContract(kind)) {
    return [
      "Validar a referencia ao contrato original, o motivo do encerramento e a quitacao antes do envio para assinatura.",
      "Conferir se as obrigacoes remanescentes estao descritas de forma objetiva e suficiente para evitar ambiguidades.",
      "Revisar foro, assinaturas e efeitos juridicos do encerramento com suporte especializado quando necessario.",
      "Manter o documento como rascunho ate a confirmacao comercial, documental e juridica final.",
    ]
  }

  const exhaustiveKind: never = kind
  return [
    `Revisar a minuta de ${String(exhaustiveKind).toLowerCase()} antes de compartilhar com o cliente.`,
    "Confirmar clausulas obrigatorias, dados cadastrais e anexos com o suporte juridico ou modelo oficial da operacao.",
    "Manter o documento como rascunho ate a validacao final das condicoes comerciais e dos prazos.",
  ]
}

function buildOfficialSaleContractHtml(content: ContractContent) {
  const totalPages = 7

  const cover = DocumentCover({
    title: "Contrato Particular de Compra e Venda de Imovel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para operacoes imobiliarias premium, preparado para revisao comercial, juridica e futura substituicao automatica de placeholders pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
    highlights: ["Seguro", "Personalizavel", "Juridicamente revisavel"],
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
                { label: "Profissao", value: p("VENDEDOR_PROFISSAO") },
                { label: "Nacionalidade", value: p("VENDEDOR_NACIONALIDADE") },
                { label: "Endereco", value: p("VENDEDOR_ENDERECO"), span: 2 },
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
                { label: "Profissao", value: p("COMPRADOR_PROFISSAO") },
                { label: "Nacionalidade", value: p("COMPRADOR_NACIONALIDADE") },
                { label: "Endereco", value: p("COMPRADOR_ENDERECO"), span: 2 },
                { label: "Telefone", value: p("COMPRADOR_TELEFONE") },
                { label: "E-mail", value: p("COMPRADOR_EMAIL") },
              ],
            }),
          }),
          DocumentCard({
            title: "Corretor responsavel",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliaria", value: p("IMOBILIARIA") },
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
        description: "Constitui objeto deste contrato a compra e venda do imovel abaixo identificado.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Codigo interno", value: p("CODIGO_INTERNO") },
                { label: "Tipo do imovel", value: p("TIPO_IMOVEL") },
                { label: "Finalidade", value: p("FINALIDADE") },
                { label: "Endereco completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matricula", value: p("MATRICULA") },
                { label: "Cartorio de registro", value: p("CARTORIO_REGISTRO") },
                { label: "Inscricao imobiliaria", value: p("INSCRICAO_IMOBILIARIA") },
                { label: "Area privativa", value: p("AREA_PRIVATIVA") },
                { label: "Area total", value: p("AREA_TOTAL") },
                { label: "Numero de vagas", value: p("VAGAS") },
                { label: "Benfeitorias existentes", value: p("BENFEITORIAS"), span: 2 },
                { label: "Unidade / complemento", value: p("UNIDADE_COMPLEMENTO"), span: 2 },
              ],
            }),
          }),
          DocumentNotice("O vendedor declara ser legitimo proprietario do imovel e possuir poderes para aliena-lo."),
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
        title: "Estado do Imovel",
        description: "O comprador declara ter vistoriado o imovel e conhecer plenamente seu estado de conservacao.",
        children: DocumentStack(
          DocumentCard({
            tone: "accent",
            children: DocumentInput({
              label: "Descricao do estado atual",
              value: p("ESTADO_IMOVEL"),
              block: true,
            }),
          }),
          DocumentNotice("Salvo disposicao expressa neste contrato, o imovel sera entregue no estado em que se encontra na data da assinatura."),
        ),
      }),
      DocumentSection({
        icon: "4",
        title: "Preco e Forma de Pagamento",
        children: DocumentStack(
          DocumentCard({
            title: "Valor total da negociacao",
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
              { label: "Recursos proprios" },
            ]),
          }),
          DocumentCard({
            title: "Cronograma financeiro",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Entrada", value: p("ENTRADA") },
                { label: "Parcelas", value: p("PARCELAS") },
                { label: "Banco / instituicao", value: p("BANCO_FINANCIAMENTO") },
                { label: "FGTS", value: p("FGTS") },
                { label: "Recursos proprios", value: p("RECURSOS_PROPRIOS") },
                { label: "Demais condicoes", value: p("CRONOGRAMA_OBSERVACOES"), span: 2 },
              ],
            }),
          }),
        ),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "5",
          title: "Arras (Sinal)",
          description: "Quando houver pagamento de sinal, este sera considerado principio de pagamento.",
          children: DocumentCard({
            children: DocumentBullets([
              `Valor das arras: ${p("ARRAS_VALOR")}.`,
              "Em caso de desistencia injustificada pelo comprador, aplicam-se as consequencias legais e contratuais cabiveis.",
              "Em caso de desistencia injustificada pelo vendedor, aplicam-se as consequencias legais e contratuais cabiveis.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "6",
          title: "Comissao de Corretagem",
          children: DocumentStack(
            DocumentCard({
              children: DocumentFieldGrid({
                columns: 2,
                items: [
                  { label: "Percentual", value: p("COMISSAO") },
                  { label: "Responsavel pelo pagamento", value: p("RESPONSAVEL_COMISSAO") },
                  { label: "Forma de pagamento", value: p("FORMA_PAGAMENTO_COMISSAO") },
                  { label: "Momento do pagamento", value: p("MOMENTO_COMISSAO") },
                ],
              }),
            }),
            DocumentNotice("As partes reconhecem a intermediacao imobiliaria realizada pelo corretor qualificado, nos termos aplicaveis."),
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
          title: "Declaracoes do Vendedor",
          children: DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "E legitimo proprietario do imovel." },
              { label: "Possui plena capacidade para aliena-lo." },
              { label: "O imovel encontra-se livre de onus reais, salvo os expressamente informados." },
              { label: "Nao ha litigios judiciais ou administrativos envolvendo o imovel, salvo os informados." },
              { label: "Nao existem debitos de IPTU ou condominio vencidos, salvo os informados." },
              { label: "Forneceu ao comprador todas as informacoes necessarias e verdadeiras." },
            ]),
          }),
        }),
        DocumentSection({
          icon: "8",
          title: "Obrigacoes do Comprador",
          children: DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "Efetuar os pagamentos nas datas e condicoes pactuadas." },
              { label: "Fornecer a documentacao necessaria." },
              { label: "Providenciar financiamento, quando aplicavel." },
              { label: "Comparecer aos atos necessarios para conclusao da operacao." },
              { label: "Cumprir todas as demais obrigacoes previstas neste instrumento." },
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
                  { label: "Condicao da entrega", value: p("CONDICAO_ENTREGA"), span: 2 },
                ],
              }),
            }),
            DocumentCheckboxGroup([
              { label: "Imediata" },
              { label: "Apos quitacao" },
              { label: "Conforme condicao suspensiva da clausula 12" },
              { label: "Outra forma descrita neste instrumento" },
            ]),
            DocumentNotice("As chaves serao entregues na data da posse, mediante quitacao das condicoes pactuadas."),
          ),
        }),
        DocumentSection({
          icon: "10",
          title: "Escritura e Registro",
          children: DocumentCard({
            children: DocumentBullets([
              "As partes comprometem-se a praticar todos os atos necessarios para lavratura da escritura publica, quando exigivel.",
              "As partes comprometem-se a providenciar o respectivo registro perante o Cartorio de Registro de Imoveis competente.",
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
        description: "As despesas e tributos incidentes sobre a presente negociacao serao distribuidos na forma abaixo.",
        children: DocumentStack(
          DocumentCard({
            children: DocumentTable({
              headers: [
                { value: "Despesa" },
                { value: "Responsavel" },
                { value: "Observacao" },
              ],
              rows: [
                [{ value: "ITBI" }, { value: p("RESP_ITBI") }, { value: p("OBS_ITBI") }],
                [{ value: "Escritura" }, { value: p("RESP_ESCRITURA") }, { value: p("OBS_ESCRITURA") }],
                [{ value: "Registro" }, { value: p("RESP_REGISTRO") }, { value: p("OBS_REGISTRO") }],
                [{ value: "Certidoes" }, { value: p("RESP_CERTIDOES") }, { value: p("OBS_CERTIDOES") }],
                [{ value: "Despesas bancarias" }, { value: p("RESP_BANCARIAS") }, { value: p("OBS_BANCARIAS") }],
                [{ value: "Condominio (ate a posse)" }, { value: p("RESP_CONDOMINIO") }, { value: p("OBS_CONDOMINIO") }],
                [{ value: "IPTU (ate a posse)" }, { value: p("RESP_IPTU") }, { value: p("OBS_IPTU") }],
                [{ value: "Outras taxas" }, { value: p("RESP_OUTRAS_TAXAS") }, { value: p("OBS_OUTRAS_TAXAS") }],
              ],
            }),
          }),
          DocumentInput({
            label: "Observacoes complementares",
            value: p("OBS_TRIBUTOS_DESPESAS"),
            block: true,
          }),
        ),
      }),
      DocumentColumns(
        DocumentSection({
          icon: "12",
          title: "Condicoes Suspensivas",
          description: "Este contrato somente produzira efeitos plenos se atendidas as condicoes abaixo.",
          children: DocumentStack(
            DocumentCard({
              children: DocumentCheckboxGroup([
                { label: "Aprovacao de financiamento pelo comprador." },
                { label: "Apresentacao de documentacao necessaria." },
                { label: "Regularizacao documental ou registral do imovel." },
                { label: "Emissao de certidoes negativas." },
                { label: `Outras: ${p("OUTRAS_CONDICOES_SUSPENSIVAS")}` },
              ]),
            }),
            DocumentNotice("Nao atendidas as condicoes dentro do prazo acordado, o contrato sera reavaliado conforme as regras deste instrumento."),
          ),
        }),
        DocumentSection({
          icon: "13",
          title: "Inadimplemento",
          children: DocumentCard({
            children: DocumentBullets([
              `Multa contratual de ${p("MULTA_INADIMPLEMENTO")} sobre o valor do contrato, quando aplicavel.`,
              `Juros de ${p("JUROS_INADIMPLEMENTO")} ao mes.`,
              `Correcao monetaria pelo indice ${p("INDICE_CORRECAO")}.`,
              "Perdas e danos, honorarios advocaticios e demais medidas legais cabiveis.",
            ]),
          }),
        }),
      ),
      DocumentSection({
        icon: "14",
        title: "Rescisao",
        children: DocumentStack(
          DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "Por mutuo acordo entre as partes." },
              { label: "Por descumprimento de qualquer clausula." },
              { label: "Por impossibilidade juridica da operacao." },
              { label: "Por nao atendimento das condicoes suspensivas." },
            ]),
          }),
          DocumentNotice("A parte que der causa a rescisao arcara com eventuais prejuizos comprovados a outra parte, nos limites legais e contratuais."),
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
          title: "Protecao de Dados (LGPD)",
          children: DocumentCard({
            children: DocumentBullets([
              "As partes autorizam o tratamento de seus dados pessoais para execucao deste contrato, cumprimento de obrigacoes legais e regulatórias.",
              "Os dados serao utilizados somente para finalidades ligadas a negociacao, assinatura, registro e arquivo deste instrumento.",
              `Canal para assuntos de privacidade: ${p("CANAL_PRIVACIDADE")}.`,
            ]),
          }),
        }),
        DocumentSection({
          icon: "16",
          title: "Comunicacoes",
          children: DocumentStack(
            DocumentCard({
              title: "Vendedor",
              children: DocumentFieldGrid({
                columns: 1,
                items: [
                  { label: "E-mail", value: p("VENDEDOR_EMAIL") },
                  { label: "Telefone / WhatsApp", value: p("VENDEDOR_TELEFONE") },
                  { label: "Endereco", value: p("VENDEDOR_ENDERECO") },
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
                  { label: "Endereco", value: p("COMPRADOR_ENDERECO") },
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
                  { label: "Endereco profissional", value: p("CORRETOR_ENDERECO") },
                ],
              }),
            }),
          ),
        }),
      ),
      DocumentColumns(
        DocumentSection({
          icon: "17",
          title: "Assinatura Eletronica",
          children: DocumentCard({
            children: DocumentBullets([
              "As partes concordam que este instrumento podera ser assinado eletronicamente.",
              "A assinatura eletrônica produzira os mesmos efeitos juridicos da assinatura fisica, nos termos da legislacao aplicavel.",
              `Plataforma prevista: ${p("PLATAFORMA_ASSINATURA")}.`,
            ]),
          }),
        }),
        DocumentSection({
          icon: "18",
          title: "Disposicoes Gerais",
          children: DocumentCard({
            children: DocumentCheckboxGroup([
              { label: "Este contrato constitui o inteiro acordo entre as partes." },
              { label: "Alteracoes somente terao validade se feitas por escrito e assinadas." },
              { label: "A tolerancia de uma parte quanto ao descumprimento da outra nao implicara novacao." },
              { label: "Se qualquer clausula for considerada nula ou invalida, as demais permanecerao validas." },
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
    title: "Contrato de Locacao Residencial",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para locacoes residenciais, preparado para sincronizar dados de cliente, imovel e corretor com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
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
                { label: "Profissao", value: p("LOCADOR_PROFISSAO") },
                { label: "Endereco", value: p("LOCADOR_ENDERECO"), span: 2 },
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
                { label: "Profissao", value: p("LOCATARIO_PROFISSAO") },
                { label: "Endereco", value: p("LOCATARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Corretor responsavel",
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
        title: "Do Imovel",
        description: "Objeto da locacao residencial e identificacao das informacoes principais do ativo.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imovel", value: p("IMOVEL") },
                { label: "Tipo do imovel", value: p("TIPO_IMOVEL") },
                { label: "Endereco completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matricula", value: p("MATRICULA") },
                { label: "Cartorio de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O imovel destina-se exclusivamente a uso residencial, vedada a alteracao de finalidade sem autorizacao expressa do locador."),
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
              "O locatario compromete-se a utilizar o imovel de forma compativel com a destinacao pactuada.",
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
                { label: "Inicio", value: p("DATA_INICIO") },
                { label: "Termino", value: p("DATA_FIM") },
                { label: "Prazo da locacao", value: p("PRAZO_LOCACAO"), span: 2 },
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
            title: "Condicoes financeiras",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Aluguel mensal", value: p("VALOR_ALUGUEL") },
                { label: "Vencimento", value: p("DIA_VENCIMENTO") },
                { label: "Forma de pagamento", value: p("FORMA_PAGAMENTO"), span: 2 },
              ],
            }),
          }),
          DocumentNotice("Os valores e prazos devem refletir exatamente a negociacao confirmada entre locador e locatario."),
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
                { label: "Observacoes comerciais", value: p("CRONOGRAMA_OBSERVACOES") },
              ],
            }),
          }),
        }),
        DocumentSection({
          icon: "7",
          title: "Encargos",
          children: DocumentCard({
            children: DocumentBullets([
              "Responsabilidade pelo pagamento de IPTU, condominio, agua, energia, gas e internet conforme negociacao.",
              "Despesas extraordinarias e ajustes futuros deverao respeitar a legislacao aplicavel e o texto final deste instrumento.",
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
            DocumentNotice("O imovel sera entregue conforme laudo de vistoria inicial, que integra a negociacao como anexo de referencia."),
          ),
        }),
        DocumentSection({
          icon: "9",
          title: "Conservacao",
          children: DocumentCard({
            children: DocumentBullets([
              "O locatario compromete-se a conservar o imovel durante toda a locacao.",
              "Qualquer dano decorrente de uso inadequado devera ser reparado conforme previsao legal e contratual.",
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
              "Benfeitorias somente poderao ser realizadas mediante autorizacao do locador.",
              "A eventual indenizacao ou retencao dependera da natureza da benfeitoria e das regras deste contrato.",
            ]),
          }),
          DocumentInput({
            label: "Observacoes complementares",
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
          title: "Rescisao",
          children: DocumentCard({
            children: DocumentBullets([
              "Aplicam-se as penalidades previstas em lei e neste contrato em caso de rescisao antecipada ou inadimplemento.",
              "O descumprimento de obrigacoes essenciais podera ensejar multa, perdas e danos e demais medidas cabiveis.",
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
          DocumentNotice("Template oficial EME para locacao residencial. Recomenda-se revisao juridica final antes do envio para assinatura eletronica."),
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
    title: "Contrato de Locacao Comercial",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para locacoes comerciais, preparado para sincronizar dados de cliente, imovel, corretor e imobiliaria com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
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
                { label: "Profissao", value: p("LOCADOR_PROFISSAO") },
                { label: "Endereco", value: p("LOCADOR_ENDERECO"), span: 2 },
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
                { label: "Profissao", value: p("LOCATARIO_PROFISSAO") },
                { label: "Endereco", value: p("LOCATARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediacao",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliaria", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imovel Comercial",
        description: "Identificacao do ativo comercial e das informacoes documentais principais da locacao.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imovel comercial", value: p("IMOVEL_COMERCIAL") },
                { label: "Tipo do imovel", value: p("TIPO_IMOVEL") },
                { label: "Endereco completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matricula", value: p("MATRICULA") },
                { label: "Cartorio de registro", value: p("CARTORIO_REGISTRO") },
                { label: "Inscricao imobiliaria", value: p("INSCRICAO_IMOBILIARIA") },
              ],
            }),
          }),
          DocumentNotice("O imovel destina-se exclusivamente a uso comercial compativel com a atividade acordada entre as partes."),
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
            DocumentNotice("A atividade exercida no local deve respeitar licencas, normas condominiais, urbanisticas e a destinacao comercial pactuada."),
          ),
        }),
        DocumentSection({
          icon: "4",
          title: "Prazo",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Inicio", value: p("DATA_INICIO") },
                { label: "Termino", value: p("DATA_FIM") },
                { label: "Prazo da locacao", value: p("PRAZO_LOCACAO"), span: 2 },
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
            title: "Condicoes financeiras",
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
          DocumentNotice("Os indices e criterios de reajuste devem refletir a negociacao comercial validada pelas partes."),
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
                { label: "Encargos e observacoes", value: p("CRONOGRAMA_OBSERVACOES") },
              ],
            }),
          }),
        }),
        DocumentSection({
          icon: "7",
          title: "Encargos",
          children: DocumentCard({
            children: DocumentBullets([
              "IPTU, condominio, agua, energia, gas, internet e taxas operacionais seguem a negociacao comercial pactuada.",
              "Despesas extraordinarias, licencas e exigencias do ponto comercial devem ser definidas de forma expressa entre as partes.",
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
            DocumentNotice("Qualquer obra estrutural ou operacional deve observar autorizacoes, responsabilidade financeira e normas do imovel."),
          ),
        }),
        DocumentSection({
          icon: "9",
          title: "Adequacoes",
          children: DocumentStack(
            DocumentCard({
              children: DocumentInput({
                label: "Adequacoes do ponto comercial",
                value: p("ADEQUACOES_LOCACAO"),
                block: true,
              }),
            }),
            DocumentNotice("Adequacoes tecnicas, visuais ou operacionais devem respeitar o uso aprovado para o ponto."),
          ),
        }),
      ),
      DocumentSection({
        icon: "10",
        title: "Vistoria e Conservacao",
        children: DocumentStack(
          DocumentCard({
            children: DocumentFieldGrid({
              columns: 1,
              items: [{ label: "Laudo de vistoria inicial", value: p("LAUDO_VISTORIA") }],
            }),
          }),
          DocumentCard({
            children: DocumentBullets([
              "O locatario compromete-se a conservar o imovel comercial e responder por danos decorrentes de uso inadequado.",
              "A devolucao do ponto observara o estado convencionado entre as partes e as adequacoes autorizadas.",
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
          title: "Rescisao",
          children: DocumentCard({
            children: DocumentBullets([
              "Aplicam-se as penalidades previstas em lei e neste contrato em caso de rescisao antecipada, inadimplemento ou uso indevido do ponto comercial.",
              "As partes podem estabelecer multa, prazo de desocupacao e responsabilidades por obras e adequacoes pendentes.",
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
          DocumentNotice("Template oficial EME para locacao comercial. Recomenda-se revisao juridica final antes do envio para assinatura eletronica."),
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
    title: "Autorizacao de Venda de Imovel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para autorizacao de venda, preparado para sincronizar proprietario, imovel, corretor e imobiliaria com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
    highlights: ["Captacao", "Editorial", "Sincronizado"],
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
            title: "Proprietario",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("PROPRIETARIO") },
                { label: "CPF/CNPJ", value: p("PROPRIETARIO_CPF_CNPJ") },
                { label: "RG", value: p("PROPRIETARIO_RG") },
                { label: "Estado civil", value: p("PROPRIETARIO_ESTADO_CIVIL") },
                { label: "Profissao", value: p("PROPRIETARIO_PROFISSAO") },
                { label: "Endereco", value: p("PROPRIETARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediacao",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliaria", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imovel",
        description: "Identificacao do imovel autorizado para intermediar a venda.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imovel", value: p("IMOVEL") },
                { label: "Tipo do imovel", value: p("TIPO_IMOVEL") },
                { label: "Endereco completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matricula", value: p("MATRICULA") },
                { label: "Cartorio de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O proprietario declara possuir legitimidade para autorizar a intermediacao da venda do imovel descrito neste instrumento."),
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
          title: "Comissao",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Percentual", value: p("COMISSAO_AUTORIZACAO") },
                { label: "Responsavel pela intermediacao", value: p("CORRETOR") },
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
              { label: "Inicio", value: p("DATA_INICIO") },
              { label: "Termino", value: p("DATA_FIM") },
              { label: "Prazo da autorizacao", value: p("PRAZO_AUTORIZACAO"), span: 2 },
            ],
          }),
        }),
      }),
      DocumentSection({
        icon: "6",
        title: "Condicoes da Intermediacao",
        children: DocumentStack(
          DocumentCard({
            children: DocumentInput({
              label: "Condicoes acordadas",
              value: p("CONDICOES_INTERMEDIACAO"),
              block: true,
            }),
          }),
          DocumentNotice("As condicoes da intermediacao devem refletir o escopo comercial aprovado entre proprietario, corretor e imobiliaria."),
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
          title: "Obrigacoes",
          children: DocumentCard({
            children: DocumentBullets([
              "O proprietario compromete-se a fornecer informacoes veridicas, documentacao minima e acesso necessario para a intermediacao.",
              "O corretor compromete-se a conduzir a captacao, apresentacao e negociacao do imovel com diligencia profissional.",
              "As partes devem respeitar o valor autorizado, as condicoes comerciais e os limites definidos nesta autorizacao.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "8",
          title: "Revogacao",
          children: DocumentCard({
            children: DocumentBullets([
              "A autorizacao pode ser revogada conforme as regras deste instrumento e da legislacao aplicavel.",
              "A revogacao nao afasta direitos ja constituídos por negociacoes iniciadas validamente dentro do prazo autorizado, conforme ajuste entre as partes.",
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
        description: "Por estarem justas e acordadas, as partes assinam a presente autorizacao.",
        children: DocumentStack(
          `<div class="document-signature-grid">
            ${DocumentSignatureBlock({
              role: "Proprietario",
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
          DocumentNotice("Template oficial EME para autorizacao de venda. Recomenda-se revisao juridica final antes do envio para assinatura eletronica."),
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
      "Documento base modular para exclusividade de venda, preparado para sincronizar proprietario, imovel, corretor e imobiliaria com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
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
            title: "Proprietario",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Nome completo", value: p("PROPRIETARIO") },
                { label: "CPF/CNPJ", value: p("PROPRIETARIO_CPF_CNPJ") },
                { label: "RG", value: p("PROPRIETARIO_RG") },
                { label: "Estado civil", value: p("PROPRIETARIO_ESTADO_CIVIL") },
                { label: "Profissao", value: p("PROPRIETARIO_PROFISSAO") },
                { label: "Endereco", value: p("PROPRIETARIO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediacao exclusiva",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliaria", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imovel",
        description: "Identificacao do imovel objeto da intermediacao exclusiva.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imovel", value: p("IMOVEL") },
                { label: "Tipo do imovel", value: p("TIPO_IMOVEL") },
                { label: "Endereco completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matricula", value: p("MATRICULA") },
                { label: "Cartorio de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O proprietario declara possuir legitimidade para contratar a intermediacao exclusiva da venda do imovel descrito neste instrumento."),
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
                { label: "Inicio", value: p("DATA_INICIO") },
                { label: "Termino", value: p("DATA_FIM") },
                { label: "Prazo contratado", value: p("PRAZO_EXCLUSIVIDADE"), span: 2 },
              ],
            }),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Comissao",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Percentual", value: p("COMISSAO_EXCLUSIVIDADE") },
                { label: "Corretor responsavel", value: p("CORRETOR") },
              ],
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Valor e Condicoes da Intermediacao",
        children: DocumentStack(
          DocumentCard({
            title: "Bases comerciais",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Valor de referencia", value: p("VALOR_AUTORIZADO") },
                { label: "Finalidade", value: p("FINALIDADE") },
                { label: "Condicoes da intermediacao", value: p("CONDICOES_EXCLUSIVIDADE"), span: 2 },
              ],
            }),
          }),
          DocumentNotice("As condicoes da exclusividade devem refletir o escopo comercial aprovado entre proprietario, corretor e imobiliaria."),
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
          title: "Direitos e Obrigacoes",
          children: DocumentCard({
            children: DocumentBullets([
              "O proprietario compromete-se a respeitar a exclusividade durante o prazo contratado e a fornecer informacoes veridicas sobre o imovel.",
              "O corretor compromete-se a conduzir a captacao, divulgacao e negociacao do imovel com diligencia profissional.",
              "As partes devem observar o valor de referencia, a comissao pactuada e as demais condicoes comerciais deste instrumento.",
            ]),
          }),
        }),
        DocumentSection({
          icon: "7",
          title: "Rescisao",
          children: DocumentCard({
            children: DocumentBullets([
              "A rescisao observara as regras deste instrumento e a legislacao aplicavel, inclusive quanto a eventuais penalidades.",
              "O encerramento antecipado nao afasta direitos ja constituídos por negociacoes iniciadas validamente dentro do prazo de exclusividade, conforme ajuste entre as partes.",
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
              role: "Proprietario",
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
          DocumentNotice("Template oficial EME para exclusividade de venda. Recomenda-se revisao juridica final antes do envio para assinatura eletronica."),
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
    title: "Termo de Visita ao Imovel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para registrar visitas a imoveis, preparado para sincronizar visitante, imovel e corretor com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
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
                { label: "Endereco", value: p("VISITANTE_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Corretor responsavel",
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
        title: "Do Imovel Visitado",
        description: "Identificacao do imovel apresentado ao visitante nesta visita.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imovel visitado", value: p("IMOVEL_VISITADO") },
                { label: "Tipo do imovel", value: p("TIPO_IMOVEL") },
                { label: "Endereco completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
              ],
            }),
          }),
          DocumentNotice("O visitante declara que conheceu o imovel por intermédio do corretor responsavel indicado neste termo."),
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
          title: "Ciencia da Intermediacao",
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
        title: "Declaracoes",
        children: DocumentStack(
          DocumentCard({
            children: DocumentBullets([
              "O visitante declara ter conhecido o imovel por intermédio do corretor acima identificado.",
              "O visitante reconhece a ciencia da intermediacao imobiliaria prestada nesta visita.",
              "O visitante compromete-se a respeitar a intermediacao em eventual proposta ou negociacao futura referente ao imovel visitado.",
            ]),
          }),
          DocumentCard({
            tone: "soft",
            children: DocumentInput({
              label: "Declaracoes complementares",
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
          DocumentNotice("Template oficial EME para termo de visita. Recomenda-se revisao operacional final antes do envio para assinatura eletronica."),
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
    title: "Contrato de Reserva de Imovel",
    subtitle: "Template oficial EME",
    description:
      "Documento base modular para reserva de imovel, preparado para sincronizar interessado, proprietario, imovel, corretor e imobiliaria com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
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
                { label: "Endereco", value: p("INTERESSADO_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Proprietario e intermediacao",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Proprietario", value: p("PROPRIETARIO") },
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliaria", value: p("IMOBILIARIA") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Do Imovel",
        description: "Identificacao do imovel vinculado ao compromisso de reserva.",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Imovel", value: p("IMOVEL") },
                { label: "Tipo do imovel", value: p("TIPO_IMOVEL") },
                { label: "Endereco completo", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Bairro", value: p("BAIRRO") },
                { label: "Cidade", value: p("CIDADE") },
                { label: "Estado", value: p("ESTADO") },
                { label: "CEP", value: p("CEP") },
                { label: "Matricula", value: p("MATRICULA") },
                { label: "Cartorio de registro", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentNotice("O proprietario declara ter disponibilidade para negociar o imovel nas condicoes registradas neste instrumento de reserva."),
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
                { label: "Inicio", value: p("DATA_INICIO") },
                { label: "Prazo da reserva", value: p("PRAZO_RESERVA") },
                { label: "Conversao ate", value: p("CONVERSAO_RESERVA"), span: 2 },
              ],
            }),
          }),
        }),
      ),
      DocumentSection({
        icon: "5",
        title: "Condicoes",
        children: DocumentStack(
          DocumentCard({
            children: DocumentInput({
              label: "Condicoes da reserva",
              value: p("CONDICOES_RESERVA"),
              block: true,
            }),
          }),
          DocumentNotice("As condicoes devem refletir sinal, aprovacao documental, prazo de analise e demais premissas comerciais acordadas."),
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
          title: "Conversao da Reserva",
          children: DocumentStack(
            DocumentCard({
              children: DocumentInput({
                label: "Condicao de conversao",
                value: p("CONVERSAO_RESERVA"),
                block: true,
              }),
            }),
            DocumentCard({
              tone: "soft",
              children: DocumentBullets([
                "A reserva devera ser convertida em instrumento definitivo dentro do prazo comercial acordado entre as partes.",
                "A intermediacao devera acompanhar a validacao documental, a confirmacao financeira e a eventual formalizacao do negocio.",
              ]),
            }),
          ),
        }),
        DocumentSection({
          icon: "7",
          title: "Rescisao",
          children: DocumentCard({
            children: DocumentBullets([
              "O descumprimento das condicoes de reserva pode ensejar cancelamento, devolucao ou retencao conforme o ajuste entre as partes e a legislacao aplicavel.",
              "A liberacao do imovel para novos interessados depende da extincao formal da reserva ou do termino do prazo estipulado.",
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
        description: "Por estarem cientes das condicoes da reserva, as partes assinam o presente instrumento.",
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
              role: "Proprietario",
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
          DocumentNotice("Template oficial EME para reserva de imovel. Recomenda-se revisao juridica final antes do envio para assinatura eletronica."),
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
      "Documento base modular para aditivos contratuais, preparado para sincronizar cliente, imovel, corretor e contrato original com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
    highlights: ["Aditivo", "Editorial", "Sincronizado"],
  })

  const page2 = DocumentPage({
    pageNumber: 2,
    totalPages,
    children: DocumentStack(
      DocumentSection({
        icon: "1",
        title: "Referencia ao Contrato Original",
        children: DocumentStack(
          DocumentCard({
            tone: "soft",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Referencia", value: p("CONTRATO_ORIGINAL_REFERENCIA"), span: 2 },
                { label: "Cliente vinculado", value: p("COMPRADOR") },
                { label: "Imovel", value: p("IMOVEL") },
                { label: "Endereco", value: p("IMOVEL_ENDERECO"), span: 2 },
                { label: "Matricula", value: p("MATRICULA") },
                { label: "Cartorio", value: p("CARTORIO_REGISTRO") },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediacao",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliaria", value: p("IMOBILIARIA") },
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
        title: "Alteracoes",
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
          title: "Clausulas Modificadas",
          children: DocumentCard({
            children: DocumentInput({
              label: "Clausulas afetadas",
              value: p("CLAUSULAS_MODIFICADAS"),
              block: true,
            }),
          }),
        }),
        DocumentSection({
          icon: "4",
          title: "Vigencia",
          children: DocumentCard({
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Inicio", value: p("VIGENCIA_INICIO_ADITIVO") },
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
        title: "Consolidacao",
        children: DocumentStack(
          DocumentCard({
            children: DocumentBullets([
              "Permanecem inalteradas e em pleno vigor as demais clausulas do contrato original nao expressamente modificadas neste aditivo.",
              "As partes reconhecem que este instrumento complementa o contrato principal, preservando sua integridade juridica.",
              "As alteracoes aqui registradas produzem efeitos a partir da vigencia indicada neste documento.",
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
        description: "Por estarem cientes das alteracoes aqui consolidadas, as partes assinam o presente aditivo.",
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
          DocumentNotice("Template oficial EME para aditivos contratuais. Recomenda-se revisao juridica final antes do envio para assinatura eletronica."),
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
      "Documento base modular para distratos contratuais, preparado para sincronizar cliente, imovel, corretor e contrato original com preview editorial, PDF e futura automacao pelo COS.",
    versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
    footerLabel: "Documento institucional desenvolvido para impressao A4, PDF e assinatura eletronica.",
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
                { label: "Endereco", value: p("COMPRADOR_ENDERECO"), span: 2 },
              ],
            }),
          }),
          DocumentCard({
            title: "Intermediacao",
            children: DocumentFieldGrid({
              columns: 2,
              items: [
                { label: "Corretor", value: p("CORRETOR") },
                { label: "CRECI", value: p("CORRETOR_CRECI") },
                { label: "Imobiliaria", value: p("IMOBILIARIA") },
                { label: "Contato", value: p("CORRETOR_TELEFONE") },
              ],
            }),
          }),
        ),
      }),
      DocumentSection({
        icon: "2",
        title: "Referencia ao Contrato Original",
        children: DocumentCard({
          tone: "soft",
          children: DocumentFieldGrid({
            columns: 2,
            items: [
              { label: "Referencia", value: p("REFERENCIA_DISTRATO"), span: 2 },
              { label: "Imovel", value: p("IMOVEL") },
              { label: "Matricula", value: p("MATRICULA") },
              { label: "Endereco", value: p("IMOVEL_ENDERECO"), span: 2 },
              { label: "Cartorio", value: p("CARTORIO_REGISTRO") },
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
          title: "Quitacao",
          children: DocumentCard({
            children: DocumentInput({
              label: "Quitacao entre as partes",
              value: p("QUITACAO_DISTRATO"),
              block: true,
            }),
          }),
        }),
        DocumentSection({
          icon: "5",
          title: "Obrigacoes Remanescentes",
          children: DocumentCard({
            children: DocumentInput({
              label: "Obrigacoes apos o distrato",
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
        title: "Consolidacao",
        children: DocumentStack(
          DocumentCard({
            children: DocumentBullets([
              "As partes declaram, conforme a quitacao pactuada, que o contrato original fica encerrado na forma deste instrumento.",
              "As obrigacoes remanescentes aqui descritas permanecem exigiveis ate seu integral cumprimento.",
              "O presente distrato consolida a extincao consensual da relacao contratual principal, sem prejuizo das obrigacoes expressamente preservadas.",
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
        description: "Por estarem cientes do encerramento e das obrigacoes remanescentes, as partes assinam o presente distrato.",
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
          DocumentNotice("Template oficial EME para distratos contratuais. Recomenda-se revisao juridica final antes do envio para assinatura eletronica."),
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
    (financial.amountCents ? formatCurrencyBRLFromCents(financial.amountCents) : "Nao informado")

  return renderDocumentHtml({
    title: content.title,
    pages: [
      DocumentCover({
        title: content.title,
        subtitle: content.kind,
        description: getContractHeadline(content.kind),
        versionLabel: `Versao ${content.version}  |  ${contractStatusLabel(content.status)}`,
        footerLabel: "Base visual oficial do EME para documentos contratuais.",
        highlights: ["Modular", "Revisavel", "Pronto para evolucao"],
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
                { label: "Imovel", value: property?.title },
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
            title: "Clausulas Base",
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
            title: "Notas para Revisao",
            children: DocumentCard({
              tone: "soft",
              children: DocumentBullets(content.reviewNotes),
            }),
          }),
          DocumentSection({
            icon: "D",
            title: "Condicoes Comerciais",
            children: renderInfoCard("Financeiro", [
              { label: "Valor", value: amountLabel },
              { label: "Comissao", value: financial.commissionLabel || financial.commissionPercent },
              { label: "Inicio", value: financial.startDate },
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

export function buildContractHtml(content: ContractContent) {
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

export function isExternalContractContent(content: Pick<ContractContent, "source" | "attachment"> | null | undefined) {
  return content?.source === "external" && Boolean(content.attachment?.fileUrl)
}

export function buildExternalContractAttachmentHtml(content: ContractContent) {
  const attachment = content.attachment
  const leadName = content.lead?.name || "Cliente nao vinculado"
  const propertyName = content.property?.title || "Imovel nao vinculado"
  const notes = attachment?.notes || content.financial.additionalConditions || "Sem observacoes complementares."
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
            <div class="label">Imovel</div>
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
            <div class="label">Observacoes</div>
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
