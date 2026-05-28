import { formatCurrencyBRLFromCents } from "@/lib/currency"

type ProposalLead = {
  name?: string | null
  phone?: string | null
  email?: string | null
} | null

type ProposalProperty = {
  id?: string | null
  publicCode?: number | null
  title?: string | null
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

function valueOrFallback(value?: string | number | null) {
  if (value === 0) return "0"
  return value ? String(value) : "Não informado"
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
  const parts = valueOrFallback(value)
    .split(/\s+/)
    .filter((part) => part && part !== "Não" && part !== "informado")
  return (parts[0]?.[0] ?? "E") + (parts[1]?.[0] ?? "M")
}

export function buildProposalHtml(input: {
  lead?: ProposalLead
  property?: ProposalProperty
  broker?: ProposalBroker
  conditions?: {
    entry?: string | null
    installments?: string | null
    paymentMethod?: string | null
    notes?: string | null
    validity?: string | null
  } | string
  notes?: string
}) {
  const property = input.property
  const lead = input.lead
  const broker = input.broker
  const price = property?.price ? formatCurrencyBRLFromCents(property.price) : "Não informado"
  const generatedAt = new Date().toLocaleDateString("pt-BR")
  const conditions = typeof input.conditions === "string" ? { notes: input.conditions } : input.conditions
  const validity = conditions?.validity || "Não informado"
  const brokerName = valueOrFallback(broker?.name)
  const leadName = valueOrFallback(lead?.name)
  const purpose = propertyPurposeLabel(property?.purpose)
  const propertyType = propertyTypeLabel(property?.type)
  const brokerPhoto = broker?.photoUrl?.trim()
  const propertyImage = property?.imageUrl?.trim()

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Proposta Comercial</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #050705;
      --panel: rgba(14, 17, 15, .92);
      --panel-soft: rgba(255, 255, 255, .035);
      --line: rgba(255, 255, 255, .105);
      --line-strong: rgba(0, 200, 83, .28);
      --green: #00C853;
      --green-soft: #69F0AE;
      --text: #F6F8F6;
      --muted: rgba(246, 248, 246, .62);
      --muted-2: rgba(246, 248, 246, .42);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 18% 18%, rgba(0, 200, 83, .16), transparent 25%),
        radial-gradient(circle at 82% 8%, rgba(105, 240, 174, .10), transparent 24%),
        #030503;
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;
    }
    .page { max-width: 1120px; margin: 0 auto; padding: 28px; }
    .sheet {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr);
      min-height: 980px;
      border: 1px solid var(--line);
      border-radius: 28px;
      background: linear-gradient(135deg, rgba(12, 14, 13, .98), rgba(4, 7, 5, .98));
      box-shadow: 0 28px 90px rgba(0, 0, 0, .45);
    }
    .sheet:before {
      content: "";
      position: absolute;
      inset: -90px -120px auto 280px;
      height: 280px;
      background:
        repeating-linear-gradient(165deg, rgba(0, 200, 83, .18) 0 1px, transparent 1px 12px);
      opacity: .34;
      transform: rotate(-5deg);
      pointer-events: none;
    }
    .sidebar {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 28px;
      padding: 54px 28px 32px;
      border-right: 1px solid var(--line);
      background:
        linear-gradient(180deg, rgba(255,255,255,.025), rgba(0,0,0,.05)),
        rgba(8, 10, 9, .82);
      z-index: 1;
    }
    .brand-logo { width: 172px; max-width: 100%; height: auto; display: block; margin: 0 auto; }
    .tagline {
      margin-top: 6px;
      color: rgba(255,255,255,.72);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .32em;
      text-align: center;
      text-transform: uppercase;
    }
    .broker-card, .validity-card {
      border: 1px solid var(--line);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
      padding: 22px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    }
    .avatar-wrap { display: grid; place-items: center; margin-top: 18px; }
    .avatar {
      display: grid;
      place-items: center;
      width: 142px;
      height: 142px;
      overflow: hidden;
      border: 1px solid rgba(0, 200, 83, .46);
      border-radius: 999px;
      background:
        radial-gradient(circle at 50% 35%, rgba(105, 240, 174, .28), rgba(0, 200, 83, .12) 45%, rgba(0,0,0,.22)),
        #0d1710;
      color: var(--green-soft);
      font-size: 40px;
      font-weight: 850;
      box-shadow: 0 0 0 18px rgba(0, 200, 83, .05), 0 0 55px rgba(0, 200, 83, .22);
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .eyebrow { color: var(--muted-2); font-size: 13px; }
    .broker-name { margin: 8px 0 4px; font-size: 22px; font-weight: 800; }
    .creci { color: var(--green); font-size: 13px; font-weight: 700; }
    .contact { display: grid; gap: 12px; margin-top: 24px; }
    .contact-item { display: flex; gap: 10px; align-items: center; color: rgba(255,255,255,.78); font-size: 14px; }
    .contact-item span:first-child { color: var(--green); width: 18px; text-align: center; }
    .quote { margin-top: auto; color: var(--muted); font-size: 14px; line-height: 1.7; }
    .quote strong { display: block; color: var(--green); font-size: 38px; line-height: .7; }
    .validity-card { margin-top: 12px; }
    .validity-card .big { margin-top: 6px; color: var(--green); font-size: 24px; font-weight: 850; }
    .content {
      position: relative;
      z-index: 1;
      padding: 52px 34px 34px;
    }
    .hero {
      display: grid;
      gap: 24px;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      margin-bottom: 28px;
    }
    .hero-kicker { color: rgba(255,255,255,.88); font-size: 25px; letter-spacing: .02em; text-transform: uppercase; }
    h1 { margin: 8px 0 0; color: var(--text); font-size: clamp(32px, 4.5vw, 48px); line-height: 1.02; letter-spacing: -.035em; }
    .subtitle { margin-top: 8px; color: var(--green); font-size: clamp(19px, 2.4vw, 27px); font-weight: 850; letter-spacing: -.02em; }
    .hero p { max-width: 540px; margin: 18px 0 0; color: var(--muted); font-size: 16px; line-height: 1.65; }
    .date-card {
      min-width: 188px;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
      background: rgba(0,0,0,.24);
    }
    .date-card .label { margin: 0; color: var(--muted-2); }
    .date-card .value { margin-top: 5px; font-size: 15px; }
    .stack { display: grid; gap: 16px; }
    .card {
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 22px;
      background:
        linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.024)),
        rgba(6, 9, 7, .68);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
    }
    .card-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 16px;
      background: rgba(0, 200, 83, .16);
      color: var(--green);
      font-size: 21px;
      box-shadow: inset 0 0 0 1px rgba(0, 200, 83, .18);
    }
    h2 { margin: 0; color: var(--text); font-size: 15px; letter-spacing: .05em; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
    .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .item { min-width: 0; }
    .label { color: var(--muted-2); font-size: 13px; }
    .value { margin-top: 7px; color: var(--text); font-size: 16px; font-weight: 680; line-height: 1.35; overflow-wrap: anywhere; }
    .pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 12px;
      background: rgba(0, 200, 83, .16);
      color: var(--green-soft);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .price-value { color: var(--green); font-size: 30px; font-weight: 900; letter-spacing: -.03em; }
    .property-card-grid { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 22px; align-items: stretch; }
    .property-photo {
      min-height: 180px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255,255,255,.035);
    }
    .property-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .notes { color: rgba(255,255,255,.72); line-height: 1.7; }
    .footer {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 22px;
      padding-top: 22px;
      border-top: 1px solid var(--line-strong);
    }
    .footer-item { display: flex; gap: 12px; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .footer-item b { display: block; color: var(--text); font-size: 13px; }
    .footer-mark { margin-top: 24px; color: var(--muted-2); font-size: 12px; }
    .footer-mark strong { color: var(--green); }
    @media (max-width: 860px) {
      .page { padding: 10px; }
      .sheet { grid-template-columns: 1fr; border-radius: 22px; }
      .sidebar { border-right: 0; border-bottom: 1px solid var(--line); padding: 34px 22px; }
      .content { padding: 34px 22px; }
      .hero { grid-template-columns: 1fr; }
      .date-card { width: 100%; }
      .grid, .grid.two, .footer, .property-card-grid { grid-template-columns: 1fr; }
      .quote { margin-top: 0; }
    }
    @media print {
      body { background: #050705; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { max-width: none; padding: 0; }
      .sheet { min-height: 100vh; border-radius: 0; box-shadow: none; }
      .card, .broker-card, .validity-card, .date-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="sheet">
      <aside class="sidebar">
        <div>
          <img class="brand-logo" src="/images/eme-logo.png" alt="EME" />
          <div class="tagline">Soluções imobiliárias</div>
        </div>

        <div class="avatar-wrap">
          <div class="avatar">${brokerPhoto ? `<img src="${escapeHtml(brokerPhoto)}" alt="${escapeHtml(brokerName)}" />` : escapeHtml(initials(broker?.name))}</div>
        </div>

        <section class="broker-card">
          <div class="eyebrow">Corretor responsável</div>
          <div class="broker-name">${escapeHtml(brokerName)}</div>
          <div class="creci">${escapeHtml(broker?.creci)}</div>
          <div class="contact">
            <div class="contact-item"><span>☎</span><span>${escapeHtml(broker?.phone)}</span></div>
            <div class="contact-item"><span>✉</span><span>${escapeHtml(broker?.email)}</span></div>
            <div class="contact-item"><span>⌖</span><span>${escapeHtml(broker?.city || property?.city)}</span></div>
          </div>
        </section>

        <section class="validity-card">
          <div class="eyebrow">Proposta válida por</div>
          <div class="big">${escapeHtml(validity)}</div>
          <div class="eyebrow" style="margin-top:18px">Data da proposta</div>
          <div class="value">${escapeHtml(generatedAt)}</div>
        </section>

        <div class="quote">
          <strong>“</strong>
          Transformamos imóveis em oportunidades e sonhos em realidade.
        </div>
        <div class="footer-mark">Documento gerado pelo <strong>EME</strong>.</div>
      </aside>

      <section class="content">
        <header class="hero">
          <div>
            <h1>Proposta Comercial</h1>
            <div class="subtitle">Compra ou locação de imóvel</div>
            <p>Apresentamos esta proposta com condições organizadas para análise e negociação.</p>
          </div>
          <div class="date-card">
            <div class="label">Data da proposta</div>
            <div class="value">${escapeHtml(generatedAt)}</div>
          </div>
        </header>

        <div class="stack">
          <section class="card">
            <div class="card-header"><div class="icon">♙</div><h2>Dados do cliente</h2></div>
            <div class="grid">
              <div class="item"><div class="label">Nome</div><div class="value">${escapeHtml(leadName)}</div></div>
              <div class="item"><div class="label">Telefone</div><div class="value">${escapeHtml(lead?.phone)}</div></div>
              <div class="item"><div class="label">E-mail</div><div class="value">${escapeHtml(lead?.email)}</div></div>
            </div>
          </section>

          <section class="card">
            <div class="card-header"><div class="icon">▥</div><h2>Dados do imóvel</h2></div>
            <div class="property-card-grid">
              <div class="grid">
                <div class="item"><div class="label">Imóvel</div><div class="value">${escapeHtml(property?.title)}</div></div>
                <div class="item"><div class="label">Código</div><div class="value">${escapeHtml(property?.publicCode ?? property?.id)}</div></div>
                <div class="item"><div class="label">Tipo</div><div class="value">${escapeHtml(propertyType)}</div></div>
                <div class="item"><div class="label">Finalidade</div><div class="value"><span class="pill">${escapeHtml(purpose)}</span></div></div>
                <div class="item"><div class="label">Bairro</div><div class="value">${escapeHtml(property?.neighborhood)}</div></div>
                <div class="item"><div class="label">Cidade</div><div class="value">${escapeHtml(property?.city)}</div></div>
                <div class="item"><div class="label">Metragem</div><div class="value">${escapeHtml(property?.area)}</div></div>
                <div class="item"><div class="label">Dormitórios</div><div class="value">${escapeHtml(property?.bedrooms)}</div></div>
                <div class="item"><div class="label">Vagas</div><div class="value">${escapeHtml(property?.parkingSpots)}</div></div>
                <div class="item"><div class="label">Valor do imóvel</div><div class="price-value">${escapeHtml(price)}</div></div>
              </div>
              ${propertyImage ? `<div class="property-photo"><img src="${escapeHtml(propertyImage)}" alt="${escapeHtml(property?.title)}" /></div>` : ""}
            </div>
          </section>

          <section class="card">
            <div class="card-header"><div class="icon">▤</div><h2>Condições da proposta</h2></div>
            <div class="grid">
              <div class="item"><div class="label">Entrada</div><div class="value">${escapeHtml(conditions?.entry)}</div></div>
              <div class="item"><div class="label">Parcelamento</div><div class="value">${escapeHtml(conditions?.installments)}</div></div>
              <div class="item"><div class="label">Forma de pagamento</div><div class="value">${escapeHtml(conditions?.paymentMethod)}</div></div>
            </div>
            <div class="item" style="margin-top:24px"><div class="label">Observações</div><div class="value notes">${escapeHtml(conditions?.notes || input.notes)}</div></div>
          </section>

        </div>

        <footer class="footer">
          <div class="footer-item"><span class="icon" style="width:34px;height:34px;font-size:15px">✓</span><span><b>Segurança</b>Informações claras e verificáveis.</span></div>
          <div class="footer-item"><span class="icon" style="width:34px;height:34px;font-size:15px">◎</span><span><b>Transparência</b>Condições organizadas para negociação.</span></div>
          <div class="footer-item"><span class="icon" style="width:34px;height:34px;font-size:15px">♡</span><span><b>Compromisso</b>Documento profissional para decisão.</span></div>
        </footer>
      </section>
    </section>
  </main>
</body>
</html>`
}

export function proposalHtmlToText(html: string) {
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
