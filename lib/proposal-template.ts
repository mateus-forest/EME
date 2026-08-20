import { formatCurrencyBRLFromCents } from "./currency"

type ProposalLead = {
  name?: string | null
  phone?: string | null
  email?: string | null
  cpfCnpj?: string | null
  documents?: Array<{
    label?: string | null
    name?: string | null
  }>
} | null

type ProposalProperty = {
  id?: string | null
  publicCode?: number | null
  title?: string | null
  description?: string | null
  city?: string | null
  neighborhood?: string | null
  price?: number | null
  purpose?: string | null
  type?: string | null
  area?: string | null
  imageUrl?: string | null
  bedrooms?: number | null
  parkingSpots?: number | null
} | null

type ProposalBroker = {
  name?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  creci?: string | null
  photoUrl?: string | null
} | null

export function calculateFixedInstallmentCents(
  financedValueCents: number,
  installmentCount: number | null,
  monthlyInterestRate: number,
) {
  const principal = Math.max(0, Number.isFinite(financedValueCents) ? financedValueCents : 0)
  const count = Math.max(0, Math.trunc(installmentCount ?? 0))
  if (count < 1) return null
  if (principal === 0) return 0

  const rate = Math.max(0, Number.isFinite(monthlyInterestRate) ? monthlyInterestRate : 0) / 100
  if (rate === 0) return Math.round(principal / count)

  const compoundFactor = Math.pow(1 + rate, count)
  const denominator = compoundFactor - 1
  if (!Number.isFinite(compoundFactor) || denominator <= 0) return null

  const payment = principal * ((rate * compoundFactor) / denominator)
  return Number.isFinite(payment) ? Math.round(payment) : null
}

const INTERNAL_ATTACHMENT_CONTEXT = [
  /\s*IMPORTANTE:\s*os anexos s[aã]o a fonte principal de informa[cç][aã]o\.[\s\S]*$/i,
  /\s*O texto do usu[aá]rio descreve apenas a inten[cç][aã]o operacional\.[\s\S]*$/i,
  /\s*N[aã]o use o prompt como t[ií]tulo, descri[cç][aã]o ou conte[uú]do[\s\S]*$/i,
]

export function sanitizeProposalDisplayText(value: string) {
  return INTERNAL_ATTACHMENT_CONTEXT
    .reduce((current, pattern) => current.replace(pattern, ""), value)
    .trim()
}

export function sanitizeProposalDocumentContent(content: string) {
  if (!/<!doctype html|<html|<main|<section/i.test(content)) {
    return sanitizeProposalDisplayText(content)
  }

  return content.replace(/>([^<]*)</g, (match, text: string) => {
    const sanitized = sanitizeProposalDisplayText(text)
    return `>${sanitized}<`
  })
}

function valueOrFallback(value?: string | number | null) {
  if (value === 0) return "0"
  if (!value) return "—"
  const sanitized = sanitizeProposalDisplayText(String(value))
  return sanitized || "—"
}

function escapeHtml(value?: string | number | null) {
  return valueOrFallback(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function propertyPurposeLabel(purpose?: string | null) {
  return purpose === "RENT" ? "Locação" : "Venda"
}

function propertyTypeLabel(type?: string | null) {
  if (type === "HOUSE") return "Casa"
  if (type === "COMMERCIAL") return "Comercial"
  if (type === "LAND") return "Terreno"
  if (type === "OFFICE") return "Sala comercial"
  if (type === "STORE") return "Loja"
  if (type === "PENTHOUSE") return "Cobertura"
  if (type === "APARTMENT") return "Apartamento"
  return type || null
}

function initials(value?: string | null) {
  const resolved = valueOrFallback(value)
  if (resolved === "—") return "EM"

  const parts = resolved
    .split(/\s+/)
    .filter((part) => part && part !== "—")
  return (parts[0]?.[0] ?? "E") + (parts[1]?.[0] ?? "M")
}

function digitsOnly(value?: string | null) {
  return (value || "").replace(/\D+/g, "")
}

function buildWhatsAppUrl(phone?: string | null) {
  const digits = digitsOnly(phone)
  if (!digits) return ""
  return `https://wa.me/${digits}`
}

function buildQrCodeUrl(value: string) {
  if (!value) return ""
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(value)}`
}

function extractPropertyHighlights(description?: string | null) {
  const text = (description || "").toLowerCase()
  if (!text) return []

  const candidates = [
    { label: "Vista para o mar", pattern: /\bvista para o mar\b/ },
    { label: "Piscina", pattern: /\bpiscina\b/ },
    { label: "Área gourmet", pattern: /\b(?:area|\u00e1rea) gourmet\b|\bgourmet\b/ },
    { label: "Suíte", pattern: /\bsu(?:ite|\u00edte)\b/ },
    { label: "Sacada", pattern: /\bsacada\b/ },
    { label: "Churrasqueira", pattern: /\bchurrasqueira\b/ },
    { label: "Academia", pattern: /\bacademia\b/ },
    { label: "Condomínio clube", pattern: /\bcondom(?:inio|\u00ednio) clube\b/ },
  ]

  return candidates.filter((item) => item.pattern.test(text)).map((item) => item.label)
}

function renderDataItem(label: string, value?: string | number | null, emphasis = false) {
  return `
    <div class="data-item ${emphasis ? "data-item-emphasis" : ""}">
      <div class="data-label">${escapeHtml(label)}</div>
      <div class="data-value">${escapeHtml(value)}</div>
    </div>
  `
}

export function buildProposalHtml(input: {
  lead?: ProposalLead
  property?: ProposalProperty
  broker?: ProposalBroker
  conditions?: {
    entry?: string | null
    financing?: string | null
    installments?: string | null
    installmentCount?: number | null
    monthlyInterestRate?: number | null
    installmentValue?: string | null
    paymentMethod?: string | null
    notes?: string | null
    validity?: string | null
  } | string
  notes?: string
}) {
  const property = input.property
  const lead = input.lead
  const broker = input.broker
  const price = property?.price ? formatCurrencyBRLFromCents(property.price) : "—"
  const generatedAt = new Date().toLocaleDateString("pt-BR")
  const conditions = typeof input.conditions === "string" ? { notes: input.conditions } : input.conditions
  const validity = conditions?.validity || "—"
  const brokerName = valueOrFallback(broker?.name)
  const leadName = valueOrFallback(lead?.name)
  const purpose = propertyPurposeLabel(property?.purpose)
  const propertyType = propertyTypeLabel(property?.type)
  const brokerPhoto = broker?.photoUrl?.trim()
  const propertyImage = property?.imageUrl?.trim()
  const brokerWhatsappUrl = buildWhatsAppUrl(broker?.phone)
  const brokerQrCodeUrl = buildQrCodeUrl(brokerWhatsappUrl)
  const proposalOnlineUrl = ""
  const proposalQrCodeUrl = buildQrCodeUrl(proposalOnlineUrl)
  const finalNotes = conditions?.notes || input.notes || "—"
  const installmentSummary = conditions?.installmentCount ? `${conditions.installmentCount}x` : conditions?.installments
  const monthlyInterestSummary = typeof conditions?.monthlyInterestRate === "number"
    ? `${conditions.monthlyInterestRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.m.`
    : ""
  const propertyHighlights = extractPropertyHighlights(property?.description)

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Proposta Comercial</title>
  <style>
    :root {
      --page: #f5f3ee;
      --sheet: #fffdfa;
      --sheet-soft: #f8f6f1;
      --surface: #f4f1ea;
      --line: rgba(30, 42, 33, 0.06);
      --line-soft: rgba(30, 42, 33, 0.04);
      --text: #142018;
      --text-soft: #5f6f63;
      --text-muted: #8a958d;
      --green: #009b3a;
      --green-deep: #0b6b33;
      --green-soft: rgba(0, 155, 58, 0.08);
      --shadow: 0 16px 46px rgba(23, 35, 27, 0.055);
      --card-shadow: 0 8px 20px rgba(23, 35, 27, 0.03);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background:
        radial-gradient(circle at top left, rgba(0, 155, 58, 0.05), transparent 28%),
        linear-gradient(180deg, #f8f6f1 0%, #f2efe8 100%);
      color: var(--text);
      font-family: "Geist", "Geist Fallback", "Segoe UI", Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
      padding: 30px;
    }
    .sheet {
      background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(250,248,243,.98));
      border: 1px solid var(--line-soft);
      border-radius: 28px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 15px 24px;
      border-bottom: 1px solid var(--line-soft);
      background: rgba(255,255,255,.78);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand img {
      width: 106px;
      height: auto;
      display: block;
    }
    .brand-copy {
      display: grid;
      gap: 2px;
    }
    .eyebrow {
      color: var(--green-deep);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .brand-subtitle {
      color: var(--text-soft);
      font-size: 10px;
      line-height: 1.5;
    }
    .meta-card {
      min-width: 156px;
      padding: 9px 13px;
      border: 1px solid rgba(30, 42, 33, 0.05);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(244,241,234,.9));
      text-align: right;
    }
    .meta-label {
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .meta-value {
      margin-top: 4px;
      color: var(--text);
      font-size: 13px;
      font-weight: 650;
    }
    .content {
      padding: 30px 32px 36px;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.12fr) minmax(390px, 1fr);
      gap: 30px;
      align-items: stretch;
    }
    .hero-copy {
      display: grid;
      gap: 22px;
      align-content: start;
      padding-top: 6px;
    }
    .hero-title {
      margin: 0;
      font-size: 17px;
      line-height: 1.18;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: var(--text-soft);
    }
    .property-name {
      margin: 6px 0 0;
      font-size: 50px;
      line-height: 0.96;
      font-weight: 720;
      letter-spacing: -0.055em;
      color: var(--text);
      max-width: 560px;
    }
    .property-location {
      margin-top: 14px;
      color: var(--text-soft);
      font-size: 14px;
      font-weight: 460;
      line-height: 1.7;
    }
    .price-highlight {
      display: grid;
      gap: 9px;
      width: fit-content;
      min-width: 340px;
      padding: 24px 26px;
      border: 1px solid rgba(0, 155, 58, 0.07);
      border-radius: 24px;
      background:
        linear-gradient(180deg, rgba(0, 155, 58, 0.035), rgba(255,255,255,0.99)),
        #ffffff;
      box-shadow: var(--card-shadow);
    }
    .price-label {
      color: rgba(11, 107, 51, 0.6);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .price-value {
      margin: 0;
      color: var(--green-deep);
      font-size: 50px;
      line-height: 0.9;
      font-weight: 760;
      letter-spacing: -0.065em;
    }
    .price-caption {
      color: var(--text-soft);
      font-size: 11px;
      line-height: 1.7;
    }
    .hero-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 7px 13px;
      border-radius: 999px;
      background: #ffffff;
      border: 1px solid rgba(30, 42, 33, 0.05);
      color: var(--text-soft);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.03em;
    }
    .badge-strong {
      color: var(--green-deep);
      background: var(--green-soft);
      border-color: rgba(0, 155, 58, 0.12);
    }
    .property-photo {
      min-height: 490px;
      border-radius: 26px;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(0, 155, 58, 0.08), rgba(244,241,234,0.9)),
        var(--surface);
      border: 1px solid rgba(30, 42, 33, 0.045);
      box-shadow: 0 6px 18px rgba(23, 35, 27, 0.025);
    }
    .property-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .property-photo-empty {
      height: 100%;
      min-height: 490px;
      display: grid;
      place-items: center;
      color: var(--text-muted);
      font-size: 14px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .section-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 30px;
      margin-top: 34px;
    }
    .main-stack,
    .side-stack {
      display: grid;
      gap: 24px;
      align-content: start;
    }
    .section,
    .broker-card,
    .footer-panel {
      border-radius: 24px;
      background: rgba(255,255,255,.82);
      border: 1px solid rgba(30, 42, 33, 0.055);
    }
    .section {
      padding: 25px 25px 23px;
    }
    .section-heading {
      display: grid;
      gap: 7px;
      margin-bottom: 20px;
    }
    .section-title {
      margin: 0;
      font-size: 17px;
      line-height: 1.22;
      font-weight: 670;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .section-subtitle {
      margin: 0;
      color: var(--text-soft);
      font-size: 10px;
      line-height: 1.7;
    }
    .property-data-grid,
    .condition-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px 22px;
    }
    .data-item {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .data-label {
      color: var(--text-muted);
      font-size: 8px;
      font-weight: 650;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .data-value {
      color: var(--text);
      font-size: 15px;
      font-weight: 620;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .data-item-emphasis .data-value {
      color: var(--green-deep);
      font-weight: 730;
    }
    .highlights {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid var(--line-soft);
    }
    .highlight-list {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-top: 10px;
    }
    .highlight-pill {
      display: inline-flex;
      align-items: center;
      padding: 8px 13px;
      border-radius: 999px;
      background: rgba(0, 155, 58, 0.07);
      color: var(--green-deep);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .client-card {
      display: grid;
      gap: 11px;
      padding: 17px 18px;
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(246,243,238,.9), rgba(255,255,255,.7));
      border: 1px solid rgba(30, 42, 33, 0.04);
    }
    .broker-card {
      display: grid;
      gap: 18px;
      padding: 24px;
      background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(244,241,234,.88));
    }
    .broker-top {
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr);
      gap: 18px;
      align-items: center;
    }
    .broker-avatar {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      overflow: hidden;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(0, 155, 58, 0.18), rgba(0, 155, 58, 0.08));
      color: var(--green-deep);
      font-size: 24px;
      font-weight: 800;
      border: 1px solid rgba(0, 155, 58, 0.15);
    }
    .broker-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .broker-role {
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .broker-name {
      margin: 6px 0 0;
      font-size: 24px;
      line-height: 1.12;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .broker-creci {
      margin-top: 8px;
      color: var(--green-deep);
      font-size: 11px;
      font-weight: 600;
    }
    .broker-list {
      display: grid;
      gap: 11px;
    }
    .broker-row {
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .broker-row-label {
      color: var(--text-muted);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .broker-row-value {
      color: var(--text-soft);
      font-size: 12px;
      font-weight: 520;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }
    .notes-block {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid var(--line-soft);
    }
    .notes-text {
      margin: 0;
      color: var(--text-soft);
      font-size: 14px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    .footer-panel {
      margin-top: 26px;
      padding: 24px 26px 26px;
      background: linear-gradient(180deg, rgba(244,241,234,.94), rgba(255,255,255,.92));
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .footer-column {
      display: grid;
      gap: 11px;
      min-width: 0;
    }
    .footer-title {
      color: var(--text-muted);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .footer-value {
      color: var(--text);
      font-size: 18px;
      font-weight: 680;
      line-height: 1.35;
    }
    .footer-note {
      color: var(--text-soft);
      font-size: 12px;
      line-height: 1.65;
      white-space: pre-wrap;
    }
    .qr-card {
      display: grid;
      gap: 10px;
      justify-items: start;
      padding: 14px;
      border-radius: 18px;
      background: rgba(255,255,255,.72);
      border: 1px solid rgba(30, 42, 33, 0.045);
    }
    .qr-title {
      color: var(--text);
      font-size: 11px;
      font-weight: 640;
      line-height: 1.5;
    }
    .qr-box {
      width: 118px;
      height: 118px;
      padding: 8px;
      border-radius: 16px;
      border: 1px solid rgba(30, 42, 33, 0.05);
      background: #ffffff;
      display: grid;
      place-items: center;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .qr-empty {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.7;
    }
    .footer-link {
      color: var(--green-deep);
      font-size: 12px;
      line-height: 1.55;
      word-break: break-word;
    }
    .signature-line {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid rgba(20, 32, 24, 0.08);
      color: var(--text-muted);
      font-size: 10px;
      line-height: 1.75;
      text-align: center;
      letter-spacing: 0.03em;
    }
    @media (max-width: 900px) {
      .page { padding: 12px; }
      .topbar,
      .content { padding-left: 18px; padding-right: 18px; }
      .topbar,
      .hero,
      .section-grid,
      .footer-grid,
      .broker-top,
      .property-data-grid,
      .condition-grid { grid-template-columns: 1fr; }
      .meta-card { width: 100%; text-align: left; }
      .price-highlight { min-width: 0; width: 100%; }
      .property-photo,
      .property-photo-empty { min-height: 320px; }
      .broker-row { grid-template-columns: 1fr; gap: 4px; }
    }
    @page {
      size: A4;
      margin: 12mm;
    }
    @media print {
      body { background: #f5f3ee; }
      .page { max-width: none; padding: 0; }
      .sheet { box-shadow: none; }
      .hero,
      .section,
      .broker-card,
      .footer-panel { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="sheet">
      <header class="topbar">
        <div class="brand">
          <img src="/images/eme-logo.png" alt="EME" />
          <div class="brand-copy">
            <div class="eyebrow">Proposta comercial</div>
            <div class="brand-subtitle">EME &bull; Solucoes Imobiliarias</div>
          </div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Data da proposta</div>
          <div class="meta-value">${escapeHtml(generatedAt)}</div>
        </div>
      </header>

      <section class="content">
        <section class="hero">
          <div class="hero-copy">
            <div>
              <div class="eyebrow">Proposta comercial</div>
              <p class="property-name">${escapeHtml(property?.title)}</p>
              <div class="property-location">${escapeHtml(property?.neighborhood)}${property?.neighborhood && property?.city ? " &bull; " : ""}${escapeHtml(property?.city)}</div>
            </div>

            <div>
              <h1 class="hero-title">Proposta Comercial</h1>
            </div>

            <div class="price-highlight">
              <div class="price-label">Valor do imóvel</div>
              <p class="price-value">${escapeHtml(price)}</p>
              <div class="price-caption">Valor apresentado de forma objetiva para leitura comercial imediata.</div>
            </div>

            <div class="hero-badges">
              <span class="badge badge-strong">${escapeHtml(purpose)}</span>
              <span class="badge">${escapeHtml(propertyType)}</span>
              <span class="badge">Código ${escapeHtml(property?.publicCode ?? property?.id)}</span>
            </div>
          </div>

          <div class="property-photo">
            ${propertyImage ? `<img src="${escapeHtml(propertyImage)}" alt="${escapeHtml(property?.title)}" />` : `<div class="property-photo-empty">Imagem principal não informada</div>`}
          </div>
        </section>

        <section class="section-grid">
          <div class="main-stack">
            <section class="section">
              <div class="section-heading">
                <h2 class="section-title">Informações do imóvel</h2>
                <p class="section-subtitle">Dados organizados com leitura clara, leve e comercial.</p>
              </div>
              <div class="property-data-grid">
                ${renderDataItem("Imóvel", property?.title, true)}
                ${renderDataItem("Código", property?.publicCode ?? property?.id)}
                ${renderDataItem("Finalidade", purpose)}
                ${renderDataItem("Tipo", propertyType)}
                ${renderDataItem("Bairro", property?.neighborhood)}
                ${renderDataItem("Cidade", property?.city)}
                ${renderDataItem("Metragem", property?.area)}
                ${renderDataItem("Dormitórios", property?.bedrooms)}
                ${renderDataItem("Vagas", property?.parkingSpots)}
              </div>
              ${
                propertyHighlights.length > 0
                  ? `
                <div class="highlights">
                  <div class="data-label">Diferenciais do imóvel</div>
                  <div class="highlight-list">
                    ${propertyHighlights.map((item) => `<span class="highlight-pill">${escapeHtml(item)}</span>`).join("")}
                  </div>
                </div>
              `
                  : ""
              }
            </section>

            <section class="section">
              <div class="section-heading">
                <h2 class="section-title">Condições da proposta</h2>
                <p class="section-subtitle">Estrutura comercial com foco em clareza e negociação.</p>
              </div>
              <div class="condition-grid">
                ${renderDataItem("Valor", price, true)}
                ${renderDataItem("Entrada", conditions?.entry, true)}
                ${renderDataItem("Financiamento", conditions?.financing, true)}
                ${renderDataItem("Parcelas", installmentSummary, true)}
                ${renderDataItem("Juros mensais", monthlyInterestSummary, true)}
                ${renderDataItem("Valor estimado da parcela", conditions?.installmentValue, true)}
                ${renderDataItem("Forma de pagamento", conditions?.paymentMethod, true)}
              </div>
              <div class="notes-block">
                <div class="data-label">Observações finais</div>
                <p class="notes-text">${escapeHtml(finalNotes)}</p>
              </div>
            </section>
          </div>

          <div class="side-stack">
            <section class="section">
              <div class="section-heading">
                <h2 class="section-title">Cliente</h2>
                <p class="section-subtitle">Informacoes apresentadas de forma enxuta e objetiva.</p>
              </div>
              <div class="client-card">
                ${renderDataItem("Nome", leadName, true)}
                ${renderDataItem("Telefone", lead?.phone)}
                ${renderDataItem("E-mail", lead?.email)}
                ${renderDataItem("CPF / CNPJ", lead?.cpfCnpj)}
                ${renderDataItem("Documentos", lead?.documents?.map((document) => document.label || document.name).filter(Boolean).join(", "))}
              </div>
            </section>

            <section class="broker-card">
              <div class="section-heading" style="margin-bottom:0">
                <h2 class="section-title">Corretor responsável</h2>
                <p class="section-subtitle">Presença profissional com informações de contato em segundo plano visual.</p>
              </div>

              <div class="broker-top">
                <div class="broker-avatar">${brokerPhoto ? `<img src="${escapeHtml(brokerPhoto)}" alt="${escapeHtml(brokerName)}" />` : escapeHtml(initials(broker?.name))}</div>
                <div>
                  <div class="broker-role">Atendimento EME</div>
                  <div class="broker-name">${escapeHtml(brokerName)}</div>
                  <div class="broker-creci">${escapeHtml(broker?.creci)}</div>
                </div>
              </div>

              <div class="broker-list">
                <div class="broker-row">
                  <div class="broker-row-label">Telefone</div>
                  <div class="broker-row-value">${escapeHtml(broker?.phone)}</div>
                </div>
                <div class="broker-row">
                  <div class="broker-row-label">E-mail</div>
                  <div class="broker-row-value">${escapeHtml(broker?.email)}</div>
                </div>
                <div class="broker-row">
                  <div class="broker-row-label">Cidade</div>
                  <div class="broker-row-value">${escapeHtml(broker?.city || property?.city)}</div>
                </div>
                <div class="broker-row">
                  <div class="broker-row-label">CRECI</div>
                  <div class="broker-row-value">${escapeHtml(broker?.creci)}</div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <footer class="footer-panel">
          <div class="footer-grid">
            <div class="footer-column">
              <div class="footer-title">Validade da proposta</div>
              <div class="footer-value">${escapeHtml(validity)}</div>
              <div class="footer-note">${escapeHtml(finalNotes)}</div>
            </div>

            <div class="footer-column">
              <div class="footer-title">Visualizar proposta online</div>
              ${
                proposalOnlineUrl
                  ? `
                <div class="qr-card">
                  <div class="qr-title">Acesse a proposta online</div>
                  <div class="qr-box"><img src="${proposalQrCodeUrl}" alt="QR Code da proposta" /></div>
                  <div class="footer-note">Acesse a proposta digitalmente.</div>
                  <div class="footer-link">${escapeHtml(proposalOnlineUrl)}</div>
                </div>
              `
                  : `<div class="qr-empty">Visualização online não disponível nesta geração.</div>`
              }
            </div>

            <div class="footer-column">
              <div class="footer-title">Fale diretamente com o corretor</div>
              ${
                brokerWhatsappUrl
                  ? `
                <div class="qr-card">
                  <div class="qr-title">Fale diretamente com o corretor</div>
                  <div class="qr-box"><img src="${brokerQrCodeUrl}" alt="QR Code para falar com o corretor" /></div>
                  <div class="footer-note">Converse diretamente com o corretor responsável.</div>
                  <div class="footer-link">${escapeHtml(brokerWhatsappUrl)}</div>
                </div>
              `
                  : `<div class="qr-empty">Contato instantâneo indisponível sem telefone do corretor.</div>`
              }
            </div>
          </div>
          <div class="signature-line">Documento gerado automaticamente pelo EME &bull; Soluções Imobiliárias</div>
        </footer>
      </section>
    </section>
  </main>
</body>
</html>`
}

export function proposalHtmlToText(html: string) {
  return sanitizeProposalDocumentContent(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
