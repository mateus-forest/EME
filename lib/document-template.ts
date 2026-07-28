type DocumentTone = "default" | "soft" | "accent"

type DocumentFieldItem = {
  label: string
  value: string
  span?: 1 | 2 | 3
}

type DocumentCheckboxItem = {
  label: string
  checked?: boolean
}

type DocumentTableCell = {
  value: string
  align?: "left" | "center" | "right"
}

type DocumentTableRow = DocumentTableCell[]

type DocumentPageInput = {
  pageNumber: number
  totalPages: number
  children: string
}

type DocumentCoverInput = {
  title: string
  subtitle: string
  description: string
  versionLabel: string
  footerLabel: string
  highlights: string[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ")
}

export function documentToken(name: string) {
  return `{{${name}}}`
}

export function renderDocumentStyles() {
  return `
    :root {
      --doc-page: #f6f4ee;
      --doc-paper: #fffdfa;
      --doc-surface: #fbfaf6;
      --doc-surface-soft: #f7f8f4;
      --doc-line: rgba(10, 18, 14, 0.08);
      --doc-line-soft: rgba(10, 18, 14, 0.05);
      --doc-text: #102117;
      --doc-text-soft: #5f6c63;
      --doc-text-muted: #8d978f;
      --doc-green: #0d7a43;
      --doc-green-strong: #0b6a3a;
      --doc-green-soft: rgba(13, 122, 67, 0.08);
      --doc-green-surface: rgba(13, 122, 67, 0.12);
      --doc-shadow: 0 28px 60px rgba(16, 33, 23, 0.08);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Geist", "Geist Fallback", "Segoe UI", Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(13,122,67,0.07), transparent 26%),
        linear-gradient(180deg, #f7f5ef 0%, #f2efe8 100%);
      color: var(--doc-text);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .document-shell {
      max-width: 920px;
      margin: 0 auto;
      padding: 28px 20px 52px;
    }
    .document-page {
      position: relative;
      min-height: 1122px;
      background: var(--doc-paper);
      border: 1px solid var(--doc-line-soft);
      border-radius: 28px;
      box-shadow: var(--doc-shadow);
      margin-bottom: 22px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .document-page:last-child {
      margin-bottom: 0;
    }
    .document-page--cover {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,247,0.98)),
        var(--doc-paper);
    }
    .document-cover {
      min-height: 1122px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: 40px 44px 34px;
    }
    .document-cover__top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    .document-brand {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .document-brand__logo {
      display: inline-flex;
      align-items: center;
    }
    .document-brand__logo-image {
      height: 34px;
      width: auto;
      display: block;
    }
    .document-brand__eyebrow {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      border-radius: 999px;
      padding: 8px 14px;
      background: var(--doc-green-soft);
      color: var(--doc-green);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .document-brand__micro {
      color: var(--doc-text-muted);
      font-size: 10px;
      line-height: 1.6;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      text-align: right;
    }
    .document-cover__hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) 280px;
      gap: 36px;
      align-items: end;
      padding: 40px 0 32px;
    }
    .document-cover__title {
      margin: 0;
      font-size: 58px;
      line-height: 0.98;
      letter-spacing: -0.07em;
      font-weight: 750;
      color: var(--doc-green-strong);
      max-width: 560px;
    }
    .document-cover__subtitle {
      margin: 0 0 16px;
      color: var(--doc-text-soft);
      font-size: 15px;
      line-height: 1.85;
      max-width: 420px;
    }
    .document-cover__meta {
      display: grid;
      gap: 12px;
      align-content: end;
      justify-items: start;
    }
    .document-version {
      color: var(--doc-text-muted);
      font-size: 11px;
      line-height: 1.7;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .document-cover__visual {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 18px;
      align-items: end;
    }
    .document-cover__panel {
      min-height: 290px;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid var(--doc-line-soft);
      background:
        radial-gradient(circle at 22% 20%, rgba(13,122,67,0.18), transparent 24%),
        linear-gradient(145deg, rgba(255,255,255,0.96), rgba(243,247,241,0.94));
      position: relative;
    }
    .document-cover__panel::before {
      content: "";
      position: absolute;
      inset: 20px 20px 86px;
      border-radius: 18px;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.94), rgba(235,242,236,0.94));
      border: 1px solid rgba(13,122,67,0.07);
    }
    .document-cover__panel::after {
      content: "";
      position: absolute;
      left: 28px;
      right: 28px;
      bottom: 28px;
      height: 42px;
      border-radius: 999px;
      background: linear-gradient(90deg, rgba(13,122,67,0.06), rgba(255,255,255,0.1));
    }
    .document-cover__highlights {
      display: grid;
      gap: 12px;
    }
    .document-highlight {
      border-radius: 18px;
      border: 1px solid var(--doc-line-soft);
      background: white;
      padding: 16px 16px 15px;
    }
    .document-highlight__title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--doc-green-strong);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .document-highlight__title::before {
      content: "";
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--doc-green);
      flex: 0 0 auto;
    }
    .document-cover__footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      border-top: 1px solid var(--doc-line-soft);
      padding-top: 16px;
      color: var(--doc-text-muted);
      font-size: 11px;
      line-height: 1.7;
    }
    .document-page__content {
      display: grid;
      gap: 22px;
      padding: 34px 38px 74px;
      flex: 1;
      align-content: start;
    }
    .document-section {
      display: grid;
      gap: 16px;
    }
    .document-section__header {
      display: grid;
      gap: 10px;
    }
    .document-section__title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(13,122,67,0.28);
    }
    .document-section__icon {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid rgba(13,122,67,0.18);
      color: var(--doc-green);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      background: rgba(13,122,67,0.04);
      flex: 0 0 auto;
    }
    .document-section__title {
      margin: 0;
      color: var(--doc-green-strong);
      font-size: 28px;
      line-height: 1.08;
      letter-spacing: -0.04em;
      font-weight: 750;
    }
    .document-section__description {
      color: var(--doc-text-soft);
      font-size: 14px;
      line-height: 1.8;
    }
    .document-card {
      display: grid;
      gap: 12px;
      border-radius: 22px;
      border: 1px solid var(--doc-line-soft);
      background: white;
      padding: 18px 18px 16px;
    }
    .document-card--soft {
      background: linear-gradient(180deg, rgba(250,250,247,0.98), rgba(245,247,242,0.98));
    }
    .document-card--accent {
      background: linear-gradient(180deg, rgba(13,122,67,0.08), rgba(244,248,243,0.98));
      border-color: rgba(13,122,67,0.12);
    }
    .document-card__title {
      color: var(--doc-green-strong);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .document-field-grid {
      display: grid;
      gap: 14px 18px;
    }
    .document-field-grid--2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .document-field-grid--3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .document-field {
      display: grid;
      gap: 7px;
      min-width: 0;
    }
    .document-field--span-2 {
      grid-column: span 2;
    }
    .document-field--span-3 {
      grid-column: span 3;
    }
    .document-field__label {
      color: var(--doc-text-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .document-input {
      min-height: 30px;
      border-bottom: 1px solid rgba(16,33,23,0.18);
      color: var(--doc-text);
      font-size: 13px;
      line-height: 1.65;
      padding: 0 0 6px;
      overflow-wrap: anywhere;
    }
    .document-input--block {
      min-height: 92px;
      border: 1px solid var(--doc-line-soft);
      border-radius: 18px;
      padding: 14px 15px;
      background: var(--doc-surface);
    }
    .document-checkboxes {
      display: grid;
      gap: 12px;
    }
    .document-checkbox-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      color: var(--doc-text-soft);
      font-size: 13px;
      line-height: 1.75;
    }
    .document-checkbox-box {
      width: 18px;
      height: 18px;
      border: 1px solid rgba(16,33,23,0.18);
      border-radius: 5px;
      flex: 0 0 auto;
      margin-top: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--doc-green);
      font-size: 12px;
      background: white;
    }
    .document-notice {
      display: flex;
      gap: 12px;
      border-radius: 18px;
      padding: 14px 16px;
      border: 1px solid rgba(13,122,67,0.1);
      background: linear-gradient(180deg, rgba(13,122,67,0.08), rgba(245,249,244,0.98));
      color: var(--doc-text-soft);
      font-size: 13px;
      line-height: 1.75;
    }
    .document-notice__icon {
      width: 20px;
      height: 20px;
      border-radius: 999px;
      border: 1px solid rgba(13,122,67,0.14);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--doc-green);
      font-size: 12px;
      font-weight: 700;
      flex: 0 0 auto;
      margin-top: 1px;
      background: white;
    }
    .document-bullets {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 8px;
      color: var(--doc-text-soft);
      font-size: 13px;
      line-height: 1.75;
    }
    .document-table {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
      font-size: 12px;
      line-height: 1.7;
    }
    .document-table thead th {
      text-align: left;
      color: var(--doc-text-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 0 0 10px;
      border-bottom: 1px solid rgba(16,33,23,0.1);
    }
    .document-table tbody td {
      padding: 10px 0;
      border-bottom: 1px solid rgba(16,33,23,0.06);
      color: var(--doc-text-soft);
      vertical-align: top;
    }
    .document-table td[data-align="center"],
    .document-table th[data-align="center"] {
      text-align: center;
    }
    .document-table td[data-align="right"],
    .document-table th[data-align="right"] {
      text-align: right;
    }
    .document-signature-grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .document-signature {
      display: grid;
      gap: 10px;
      border-radius: 20px;
      border: 1px solid var(--doc-line-soft);
      background: white;
      padding: 18px;
    }
    .document-signature__role {
      color: var(--doc-green-strong);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .document-page__footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 18px 38px 20px;
      color: var(--doc-text-muted);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: linear-gradient(180deg, rgba(255,253,250,0), rgba(255,253,250,0.96) 26%, rgba(255,253,250,1));
    }
    .document-page__footer strong {
      color: var(--doc-green);
      font-weight: 700;
    }
    .document-columns {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .document-stack {
      display: grid;
      gap: 18px;
    }
    @media (max-width: 900px) {
      .document-shell {
        padding: 14px 10px 30px;
      }
      .document-page,
      .document-cover {
        min-height: auto;
      }
      .document-cover {
        padding: 28px 22px 22px;
      }
      .document-cover__hero,
      .document-cover__visual,
      .document-columns,
      .document-signature-grid,
      .document-field-grid--2,
      .document-field-grid--3 {
        grid-template-columns: 1fr;
      }
      .document-page__content {
        padding: 24px 22px 70px;
      }
      .document-cover__title {
        font-size: 42px;
      }
      .document-section__title {
        font-size: 24px;
      }
      .document-field--span-2,
      .document-field--span-3 {
        grid-column: span 1;
      }
    }
    @media print {
      body {
        background: white;
      }
      .document-shell {
        max-width: none;
        padding: 0;
      }
      .document-page {
        min-height: calc(297mm - 24mm);
        margin: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        page-break-after: always;
      }
      .document-page:last-child {
        page-break-after: auto;
      }
    }
    @page {
      size: A4;
      margin: 12mm;
    }
  `
}

export function DocumentCover(input: DocumentCoverInput) {
  return `
    <section class="document-page document-page--cover">
      <div class="document-cover">
        <div class="document-cover__top">
          <div class="document-brand">
            <div class="document-brand__logo">
              <img src="/eme-logo-3d.svg" alt="EME" class="document-brand__logo-image" />
            </div>
            <div class="document-brand__eyebrow">Template oficial EME</div>
          </div>
          <div class="document-brand__micro">Sistema operacional<br />imobiliario</div>
        </div>

        <div class="document-cover__hero">
          <div>
            <p class="document-cover__subtitle">${escapeHtml(input.subtitle)}</p>
            <h1 class="document-cover__title">${escapeHtml(input.title)}</h1>
          </div>
          <div class="document-cover__meta">
            <div class="document-version">${escapeHtml(input.versionLabel)}</div>
            <div class="document-cover__subtitle">${escapeHtml(input.description)}</div>
          </div>
        </div>

        <div class="document-cover__visual">
          <div class="document-cover__panel"></div>
          <div class="document-cover__highlights">
            ${input.highlights
              .map(
                (item) => `
                  <div class="document-highlight">
                    <div class="document-highlight__title">${escapeHtml(item)}</div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>

        <div class="document-cover__footer">
          <span>${escapeHtml(input.footerLabel)}</span>
          <span>01</span>
        </div>
      </div>
    </section>
  `
}

export function DocumentPage(input: DocumentPageInput) {
  return `
    <section class="document-page">
      <div class="document-page__content">
        ${input.children}
      </div>
      <footer class="document-page__footer">
        <span>V1.0 <strong>Template oficial EME</strong></span>
        <span>${String(input.pageNumber).padStart(2, "0")} / ${String(input.totalPages).padStart(2, "0")}</span>
      </footer>
    </section>
  `
}

export function DocumentSection(input: {
  icon: string
  title: string
  description?: string
  children: string
}) {
  return `
    <section class="document-section">
      <header class="document-section__header">
        <div class="document-section__title-row">
          <span class="document-section__icon">${escapeHtml(input.icon)}</span>
          <h2 class="document-section__title">${escapeHtml(input.title)}</h2>
        </div>
        ${input.description ? `<div class="document-section__description">${escapeHtml(input.description)}</div>` : ""}
      </header>
      ${input.children}
    </section>
  `
}

export function DocumentCard(input: {
  title?: string
  tone?: DocumentTone
  children: string
}) {
  return `
    <div class="${joinClasses(
      "document-card",
      input.tone === "soft" && "document-card--soft",
      input.tone === "accent" && "document-card--accent",
    )}">
      ${input.title ? `<div class="document-card__title">${escapeHtml(input.title)}</div>` : ""}
      ${input.children}
    </div>
  `
}

export function DocumentFieldGrid(input: {
  columns?: 1 | 2 | 3
  items: DocumentFieldItem[]
}) {
  const columns = input.columns ?? 2
  return `
    <div class="${joinClasses(
      "document-field-grid",
      columns === 2 && "document-field-grid--2",
      columns === 3 && "document-field-grid--3",
    )}">
      ${input.items.map((item) => DocumentField(item)).join("")}
    </div>
  `
}

export function DocumentField(input: DocumentFieldItem) {
  return `
    <div class="${joinClasses(
      "document-field",
      input.span === 2 && "document-field--span-2",
      input.span === 3 && "document-field--span-3",
    )}">
      <div class="document-field__label">${escapeHtml(input.label)}</div>
      <div class="document-input">${escapeHtml(input.value)}</div>
    </div>
  `
}

export function DocumentInput(input: { label: string; value: string; block?: boolean }) {
  return `
    <div class="document-field">
      <div class="document-field__label">${escapeHtml(input.label)}</div>
      <div class="${joinClasses("document-input", input.block && "document-input--block")}">${escapeHtml(input.value)}</div>
    </div>
  `
}

export function DocumentCheckboxGroup(items: DocumentCheckboxItem[]) {
  return `
    <div class="document-checkboxes">
      ${items
        .map(
          (item) => `
            <div class="document-checkbox-row">
              <span class="document-checkbox-box">${item.checked ? "x" : ""}</span>
              <span>${escapeHtml(item.label)}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `
}

export function DocumentTable(input: { headers: DocumentTableCell[]; rows: DocumentTableRow[] }) {
  return `
    <table class="document-table">
      <thead>
        <tr>
          ${input.headers
            .map(
              (header) => `
                <th${header.align ? ` data-align="${header.align}"` : ""}>${escapeHtml(header.value)}</th>
              `,
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${input.rows
          .map(
            (row) => `
              <tr>
                ${row
                  .map(
                    (cell) => `
                      <td${cell.align ? ` data-align="${cell.align}"` : ""}>${escapeHtml(cell.value)}</td>
                    `,
                  )
                  .join("")}
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `
}

export function DocumentNotice(value: string) {
  return `
    <div class="document-notice">
      <span class="document-notice__icon">i</span>
      <span>${escapeHtml(value)}</span>
    </div>
  `
}

export function DocumentBullets(items: string[]) {
  return `
    <ul class="document-bullets">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `
}

export function DocumentSignatureBlock(input: {
  role: string
  fields: Array<{ label: string; value: string }>
}) {
  return `
    <div class="document-signature">
      <div class="document-signature__role">${escapeHtml(input.role)}</div>
      ${input.fields.map((field) => DocumentField({ label: field.label, value: field.value })).join("")}
    </div>
  `
}

export function DocumentColumns(...children: string[]) {
  return `<div class="document-columns">${children.join("")}</div>`
}

export function DocumentStack(...children: string[]) {
  return `<div class="document-stack">${children.join("")}</div>`
}

export function renderDocumentHtml(input: { title: string; pages: string[] }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>${renderDocumentStyles()}</style>
</head>
<body>
  <main class="document-shell">
    ${input.pages.join("")}
  </main>
</body>
</html>`
}
