import { formatCurrencyBRLFromCents, parseCurrencyInputToCents } from "@/lib/currency"

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

export const contractStatuses = ["draft", "generated", "signed", "archived"] as const
export type ContractStatus = (typeof contractStatuses)[number]

export type ContractParty = {
  id?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
}

export type ContractProperty = {
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

export type ContractFinancial = {
  amountLabel?: string | null
  amountCents?: number | null
  commissionPercent?: string | null
  commissionLabel?: string | null
  startDate?: string | null
  endDate?: string | null
  dueDate?: string | null
  validity?: string | null
  additionalConditions?: string | null
}

export type ContractContent = {
  version: number
  kind: ContractType
  status: ContractStatus
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

function renderInfoItem(label: string, value?: string | number | null) {
  return `
    <div class="info-card">
      <div class="info-label">${escapeHtml(label)}</div>
      <div class="info-value">${escapeHtml(value)}</div>
    </div>
  `
}

function getContractHeadline(kind: ContractType) {
  if (kind === "Compra e venda") return "Instrumento base para negociação de compra e venda."
  if (kind === "Locacao residencial") return "Minuta base para locação residencial em revisão."
  if (kind === "Locacao comercial") return "Minuta base para locação comercial em revisão."
  if (kind === "Autorizacao de venda") return "Autorização comercial estruturada para captação."
  if (kind === "Exclusividade") return "Minuta base para exclusividade de intermediação."
  if (kind === "Termo de visita") return "Termo base para registro e confirmação de visita."
  if (kind === "Reserva") return "Documento base para reserva de imóvel e condições iniciais."
  if (kind === "Aditivo") return "Estrutura inicial para aditivo contratual."
  return "Estrutura inicial para distrato e encerramento da relação contratual."
}

export function buildContractClauses(kind: ContractType, input: {
  lead?: ContractParty | null
  property?: ContractProperty | null
  financial?: ContractFinancial
}) {
  const amount = input.financial?.amountLabel || (input.financial?.amountCents ? formatCurrencyBRLFromCents(input.financial.amountCents) : "Nao informado")
  const propertyRef = input.property?.title || "imovel em referencia"
  const personName = input.lead?.name || "cliente"
  const commission = input.financial?.commissionLabel || (input.financial?.commissionPercent ? `${input.financial.commissionPercent}%` : "Nao informada")

  return [
    `${kind}: minuta base preparada para ${personName}, vinculada ao ativo ${propertyRef}.`,
    `Valor principal de referencia: ${amount}. Condicoes financeiras definitivas devem ser conferidas antes da assinatura.`,
    `Comissao prevista: ${commission}. Validar regra comercial, gatilho de pagamento e responsabilidade entre as partes.`,
    "Este rascunho organiza dados comerciais, partes e prazos, mas nao substitui revisao juridica das clausulas essenciais.",
  ]
}

export function buildContractReviewNotes(kind: ContractType) {
  return [
    `Revisar a minuta de ${kind.toLowerCase()} antes de compartilhar com o cliente.`,
    "Confirmar clausulas obrigatorias, dados cadastrais e anexos com o suporte juridico ou modelo oficial da operacao.",
    "Manter o documento como rascunho ate a validacao final das condicoes comerciais e dos prazos.",
  ]
}

export function buildContractHtml(content: ContractContent) {
  const property = content.property
  const lead = content.lead
  const financial = content.financial
  const amountLabel =
    financial.amountLabel ||
    (financial.amountCents ? formatCurrencyBRLFromCents(financial.amountCents) : "Nao informado")

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.title)}</title>
  <style>
    :root {
      --page: #f5f4ef;
      --sheet: #fffdfa;
      --surface: #f7f6f0;
      --line: rgba(15, 23, 42, 0.08);
      --line-soft: rgba(15, 23, 42, 0.05);
      --text: #132018;
      --text-soft: #607166;
      --muted: #8c978f;
      --green: #009b3a;
      --green-soft: rgba(0, 155, 58, 0.08);
      --shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Geist", "Segoe UI", Arial, sans-serif;
      background: radial-gradient(circle at top left, rgba(0,155,58,0.06), transparent 24%), linear-gradient(180deg, #f7f5ef 0%, #f1eee7 100%);
      color: var(--text);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { max-width: 1040px; margin: 0 auto; padding: 24px; }
    .sheet { background: var(--sheet); border: 1px solid var(--line-soft); border-radius: 28px; box-shadow: var(--shadow); overflow: hidden; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--line-soft); }
    .eyebrow { color: var(--green); font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
    .title { margin: 8px 0 0; font-size: 40px; line-height: .96; letter-spacing: -.05em; font-weight: 700; }
    .subtitle { margin: 12px 0 0; color: var(--text-soft); font-size: 14px; line-height: 1.7; max-width: 620px; }
    .meta { min-width: 220px; padding: 14px 16px; border-radius: 18px; border: 1px solid var(--line-soft); background: var(--surface); }
    .meta strong { display: block; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
    .meta span { display: block; margin-top: 6px; font-size: 13px; font-weight: 600; }
    .content { padding: 28px; display: grid; gap: 24px; }
    .hero { display: grid; grid-template-columns: minmax(0,1.1fr) 320px; gap: 24px; }
    .hero-card, .section, .note-card { border-radius: 24px; border: 1px solid var(--line); background: white; padding: 20px; }
    .hero-card { background: linear-gradient(180deg, rgba(0,155,58,0.03), rgba(255,255,255,1)); }
    .hero-grid, .grid-3 { display: grid; gap: 14px; }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .info-card { border-radius: 18px; border: 1px solid var(--line-soft); background: var(--surface); padding: 14px; }
    .info-label { font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); }
    .info-value { margin-top: 8px; font-size: 14px; font-weight: 600; line-height: 1.6; color: var(--text); overflow-wrap: anywhere; }
    .section-title { margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -.02em; }
    .section-text { margin: 8px 0 0; font-size: 13px; line-height: 1.8; color: var(--text-soft); }
    .clause-list { display: grid; gap: 12px; margin-top: 18px; }
    .clause-item { padding: 14px 16px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line-soft); font-size: 13px; line-height: 1.8; color: var(--text-soft); }
    .note-card { background: linear-gradient(180deg, rgba(0,155,58,0.04), rgba(247,246,240,1)); }
    .note-list { display: grid; gap: 10px; margin-top: 16px; }
    .note-item { padding: 14px 16px; border-radius: 18px; background: white; border: 1px solid var(--line-soft); font-size: 13px; line-height: 1.8; color: var(--text-soft); }
    .footer { padding: 0 28px 28px; color: var(--muted); font-size: 11px; line-height: 1.7; text-align: center; }
    @media (max-width: 900px) {
      .page { padding: 12px; }
      .hero, .grid-3, .topbar { grid-template-columns: 1fr; display: grid; }
      .content, .footer { padding-left: 18px; padding-right: 18px; }
      .title { font-size: 32px; }
    }
    @page { size: A4; margin: 12mm; }
  </style>
</head>
<body>
  <main class="page">
    <section class="sheet">
      <header class="topbar">
        <div>
          <div class="eyebrow">Contrato em rascunho</div>
          <h1 class="title">${escapeHtml(content.title)}</h1>
          <p class="subtitle">${escapeHtml(getContractHeadline(content.kind))}</p>
        </div>
        <div class="meta">
          <strong>Versao e autoria</strong>
          <span>Versao ${content.version} • ${escapeHtml(content.authorName)}</span>
          <span>${escapeHtml(new Date(content.updatedAt).toLocaleDateString("pt-BR"))}</span>
        </div>
      </header>

      <section class="content">
        <section class="hero">
          <div class="hero-card">
            <div class="eyebrow">${escapeHtml(content.kind)}</div>
            <div class="hero-grid" style="margin-top:16px;">
              ${renderInfoItem("Cliente", lead?.name)}
              ${renderInfoItem("Imovel", property?.title)}
              ${renderInfoItem("Valor de referencia", amountLabel)}
              ${renderInfoItem("Inicio", financial.startDate)}
              ${renderInfoItem("Fim", financial.endDate)}
              ${renderInfoItem("Comissao", financial.commissionLabel || financial.commissionPercent)}
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Resumo do ativo</h2>
            <div class="hero-grid" style="margin-top:16px;">
              ${renderInfoItem("Codigo", property?.publicCode ?? property?.id)}
              ${renderInfoItem("Tipo", propertyTypeLabel(property?.type))}
              ${renderInfoItem("Finalidade", propertyPurposeLabel(property?.purpose))}
              ${renderInfoItem("Cidade", property?.city)}
              ${renderInfoItem("Bairro", property?.neighborhood)}
            </div>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Partes e referencias</h2>
          <div class="grid-3" style="margin-top:18px;">
            ${renderInfoItem("Cliente", lead?.name)}
            ${renderInfoItem("Telefone", lead?.phone)}
            ${renderInfoItem("E-mail", lead?.email)}
            ${renderInfoItem("Corretor responsavel", content.authorName)}
            ${renderInfoItem("E-mail do corretor", content.authorEmail)}
            ${renderInfoItem("Data do rascunho", new Date(content.createdAt).toLocaleDateString("pt-BR"))}
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Estrutura base do documento</h2>
          <p class="section-text">O contrato foi organizado com dados reais da operacao, mas segue como rascunho ate revisao comercial e juridica.</p>
          <div class="clause-list">
            ${content.clauses.map((clause) => `<div class="clause-item">${escapeHtml(clause)}</div>`).join("")}
          </div>
        </section>

        <section class="note-card">
          <h2 class="section-title">Notas para revisao antes de enviar</h2>
          <div class="note-list">
            ${content.reviewNotes.map((note) => `<div class="note-item">${escapeHtml(note)}</div>`).join("")}
            ${financial.additionalConditions ? `<div class="note-item">${escapeHtml(financial.additionalConditions)}</div>` : ""}
          </div>
        </section>
      </section>

      <footer class="footer">
        Documento em rascunho gerado automaticamente pelo EME • Revisar clausulas essenciais, anexos e validacoes juridicas antes de assinatura.
      </footer>
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
    status: input.status ?? "draft",
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
      additionalConditions: financial.additionalConditions ?? null,
    },
    clauses: buildContractClauses(input.kind, { lead: input.lead, property: input.property, financial }),
    reviewNotes: buildContractReviewNotes(input.kind),
    html: "",
  }

  content.html = buildContractHtml(content)
  return content
}
