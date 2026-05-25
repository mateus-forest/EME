import { formatCurrencyBRLFromCents } from "@/lib/currency"

type ProposalLead = {
  name?: string | null
  phone?: string | null
  email?: string | null
} | null

type ProposalProperty = {
  id?: string | null
  title?: string | null
  city?: string | null
  neighborhood?: string | null
  price?: number | null
  purpose?: string | null
  type?: string | null
  area?: string | null
  bedrooms?: number | null
  parkingSpots?: number | null
} | null

type ProposalBroker = {
  name?: string | null
  phone?: string | null
  creci?: string | null
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

export function buildProposalHtml(input: {
  lead?: ProposalLead
  property?: ProposalProperty
  broker?: ProposalBroker
  conditions?: {
    entry?: string | null
    installments?: string | null
    notes?: string | null
    validity?: string | null
  } | string
  notes?: string
}) {
  const property = input.property
  const lead = input.lead
  const broker = input.broker
  const propertyAddress = [property?.neighborhood, property?.city].filter(Boolean).join(", ") || "Não informado"
  const price = property?.price ? formatCurrencyBRLFromCents(property.price) : "Não informado"
  const generatedAt = new Date().toLocaleDateString("pt-BR")
  const conditions = typeof input.conditions === "string" ? { notes: input.conditions } : input.conditions

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Proposta de Compra/Locação</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; background: #f3f4f3; color: #101311; font-family: Arial, Helvetica, sans-serif; }
    .page { max-width: 920px; margin: 0 auto; padding: 36px; }
    .sheet { overflow: hidden; border-radius: 24px; background: #fff; box-shadow: 0 24px 70px rgba(0,0,0,.12); }
    .hero { padding: 34px; color: #fff; background: linear-gradient(135deg, #0B0B0B, #111 62%, #00C853); }
    .brand { font-size: 14px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #69F0AE; }
    h1 { margin: 14px 0 0; font-size: 34px; line-height: 1.08; }
    .date { margin-top: 10px; color: rgba(255,255,255,.7); }
    .content { display: grid; gap: 22px; padding: 30px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .card { border: 1px solid #e7ebe8; border-radius: 18px; padding: 18px; background: #fbfcfb; }
    .section-title { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; }
    .section-title:before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: #00C853; box-shadow: 0 0 0 5px rgba(0,200,83,.12); }
    .card h2 { margin: 0 0 14px; font-size: 15px; letter-spacing: .08em; text-transform: uppercase; color: #536158; }
    .section-title h2 { margin: 0; }
    .item { margin-top: 10px; }
    .label { font-size: 12px; color: #7b857f; }
    .value { margin-top: 3px; font-size: 15px; font-weight: 700; color: #111; }
    .price { border-color: rgba(0,200,83,.25); background: #effbf3; }
    .price .value { font-size: 26px; color: #087a38; }
    .footer { padding: 20px 30px 28px; color: #68736c; font-size: 12px; border-top: 1px solid #edf0ee; }
    @media (max-width: 680px) {
      .page { padding: 14px; }
      .hero, .content { padding: 22px; }
      .grid { grid-template-columns: 1fr; }
      h1 { font-size: 27px; }
    }
    @media print {
      body { background: #fff; }
      .page { max-width: none; padding: 0; }
      .sheet { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="sheet">
      <header class="hero">
        <div class="brand">EME</div>
        <h1>Proposta de Compra/Locação</h1>
        <div class="date">Gerada em ${escapeHtml(generatedAt)}</div>
      </header>
      <section class="content">
        <div class="grid">
          <div class="card">
            <div class="section-title"><h2>Cliente</h2></div>
            <div class="item"><div class="label">Nome</div><div class="value">${escapeHtml(lead?.name)}</div></div>
            <div class="item"><div class="label">Telefone</div><div class="value">${escapeHtml(lead?.phone)}</div></div>
            <div class="item"><div class="label">E-mail</div><div class="value">${escapeHtml(lead?.email)}</div></div>
          </div>
          <div class="card price">
            <div class="section-title"><h2>Valor</h2></div>
            <div class="item"><div class="label">Valor</div><div class="value">${escapeHtml(price)}</div></div>
            <div class="item"><div class="label">Finalidade</div><div class="value">${escapeHtml(propertyPurposeLabel(property?.purpose))}</div></div>
          </div>
        </div>
        <div class="card">
          <div class="section-title"><h2>Imóvel</h2></div>
          <div class="grid">
            <div class="item"><div class="label">Título</div><div class="value">${escapeHtml(property?.title)}</div></div>
            <div class="item"><div class="label">Código/ID</div><div class="value">${escapeHtml(property?.id)}</div></div>
            <div class="item"><div class="label">Tipo</div><div class="value">${escapeHtml(property?.type)}</div></div>
            <div class="item"><div class="label">Bairro/Cidade</div><div class="value">${escapeHtml(propertyAddress)}</div></div>
            <div class="item"><div class="label">Metragem</div><div class="value">${escapeHtml(property?.area)}</div></div>
            <div class="item"><div class="label">Dormitórios</div><div class="value">${escapeHtml(property?.bedrooms)}</div></div>
            <div class="item"><div class="label">Vagas</div><div class="value">${escapeHtml(property?.parkingSpots)}</div></div>
          </div>
        </div>
        <div class="card">
          <div class="section-title"><h2>Condições</h2></div>
          <div class="grid">
            <div class="item"><div class="label">Entrada</div><div class="value">${escapeHtml(conditions?.entry)}</div></div>
            <div class="item"><div class="label">Parcelamento</div><div class="value">${escapeHtml(conditions?.installments)}</div></div>
            <div class="item"><div class="label">Validade da proposta</div><div class="value">${escapeHtml(conditions?.validity)}</div></div>
            <div class="item"><div class="label">Observações</div><div class="value">${escapeHtml(conditions?.notes || input.notes)}</div></div>
          </div>
        </div>
        <div class="card">
          <div class="section-title"><h2>Corretor</h2></div>
          <div class="grid">
            <div class="item"><div class="label">Nome</div><div class="value">${escapeHtml(broker?.name)}</div></div>
            <div class="item"><div class="label">Telefone</div><div class="value">${escapeHtml(broker?.phone)}</div></div>
            <div class="item"><div class="label">CRECI</div><div class="value">${escapeHtml(broker?.creci)}</div></div>
          </div>
        </div>
      </section>
      <footer class="footer">Documento gerado pelo EME.</footer>
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
