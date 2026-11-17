"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { money, simulate, offers, offerNames, type Offer } from "@/lib/partners/contract"
import styles from "./broker-partners.module.css"

export function PartnerSimulator() {
  const [offer, setOffer] = useState<Offer>("TEAM")
  const [quantity, setQuantity] = useState("10")
  const seats = Number(quantity)
  const valid = quantity !== "" && Number.isInteger(seats) && seats >= (offer === "TEAM" ? 3 : 1) && seats <= 1000
  const result = valid ? simulate({ offer, seats }) : null
  return <section className={styles.panel} aria-labelledby="partner-simulator-title">
    <div className={styles.sectionHeading}><h2 id="partner-simulator-title">Simule seu potencial</h2><span className={styles.badge}>Estimativa</span></div>
    <p className={styles.muted}>20% sobre assinaturas elegíveis efetivamente recebidas, por 12 meses.</p>
    <div className={styles.formGrid}>
      <label>Modalidade<select aria-label="Modalidade" value={offer} onChange={e => { const next = e.target.value as Offer; setOffer(next); if (next === "TEAM" && seats < 3) setQuantity("3") }}>
        {offers.map(o => <option key={o} value={o}>{offerNames[o]}</option>)}
      </select></label>
      <label>{offer === "TEAM" ? "Acessos da mesma equipe" : "Assinaturas individuais"}
        <Input type="number" min={offer === "TEAM" ? 3 : 1} max={1000} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} />
      </label>
    </div>
    <div aria-live="polite" aria-atomic="true">
      {result ? <>
        <div className={styles.simulation}><span>Comissão mensal estimada</span><strong>{money(result.commissionCents)}</strong>
          <span>{seats} × {money(result.unitCents)} × 20%</span></div>
        <dl className={styles.breakdown}>
          <div><dt>Total mensal das assinaturas</dt><dd>{money(result.monthlyCents)}</dd></div>
          <div><dt>Comissão estimada em {result.periodMonths} meses</dt><dd>{money(result.periodCommissionCents)}</dd></div>
        </dl>
        {offer === "AGREEMENT" && <p className={styles.note}>Meses 1 a 3: R$ 119 por conta. Meses 4 a 12: R$ 129, com comissão de {money(result.regularCommissionCents)}/mês nesta simulação.</p>}
        {offer === "TEAM" && <p className={styles.note}>Preço de equipe proposto por 6 meses. A comissão tem prazo de 12 meses; os valores dos meses 7 a 12 dependem da condição comercial renovada e não estão somados nesta projeção.</p>}
      </> : <p role="alert">Informe um número inteiro entre {offer === "TEAM" ? 3 : 1} e 1.000.</p>}
    </div>
    <p className={styles.note}>Não representa saldo, pagamento confirmado ou renda garantida. Extras não geram comissão. Condições de equipe e convênio sujeitas à aprovação comercial.</p>
  </section>
}

export function PartnerGuide() {
  const [copied, setCopied] = useState("")
  const rows = [
    ["Free", "R$ 0", "Sem comissão", "—", "20 imóveis · 30 créditos IA/mês"],
    ["Pro individual", "R$ 129/mês", "R$ 25,80/mês", "12 meses", "150 imóveis · 500 créditos IA/mês"],
    ["Scale individual", "R$ 389/mês", "R$ 77,80/mês", "12 meses", "1.000 imóveis · 2.000 créditos IA/mês"],
    ["Corretor conveniado", "R$ 119 nos meses 1–3; depois R$ 129", "R$ 23,80; depois R$ 25,80/mês", "12 meses", "Limites do Pro por conta"],
    ["Equipe: 3–4 acessos", "R$ 119/acesso/mês", "R$ 23,80/acesso/mês", "Comissão: 12 meses; preço: 6 meses", "3 acessos: R$ 357 → comissão R$ 71,40/mês"],
    ["Equipe: 5–9 acessos", "R$ 109/acesso/mês", "R$ 21,80/acesso/mês", "Comissão: 12 meses; preço: 6 meses", "5 acessos: R$ 545 → comissão R$ 109/mês"],
    ["Equipe: 10+ acessos", "R$ 99/acesso/mês", "R$ 19,80/acesso/mês", "Comissão: 12 meses; preço: 6 meses", "10 acessos: R$ 990 → comissão R$ 198/mês"],
  ]
  return <div className={styles.stack}>
    <section className={styles.panel}>
      <div className={styles.sectionHeading}><h2>Colinha da parceria</h2><Button variant="outline" size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText("Parceiros EME — referência comercial de 21/09/2026\n" + rows.map(r => r.join(" | ")).join("\n") + "\n20% por 12 meses sobre pagamentos elegíveis recebidos. Extras excluídos. Equipes e convênio: proposta sujeita à aprovação comercial. Prorrogação somente após avaliação e novo acordo. Não inclui gestão de equipe já disponível."); setCopied("Tabela copiada.") }
        catch { setCopied("Não foi possível copiar. Selecione o texto da tabela.") }
      }}>Copiar tabela</Button></div>
      <p className={styles.muted}>Referência de 21/09/2026. Planos individuais atuais; equipe e convênio são propostas comerciais. Esta tabela não altera assinaturas ou preços no checkout.</p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Tabela de planos e comissões, role horizontalmente em telas pequenas">
        <table><caption className="sr-only">Valores, comissões e prazos por modalidade</caption><thead><tr>{["Plano / modalidade", "Cliente paga", "Você ganha (20%)", "Prazo", "Capacidade / exemplo"].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div><p role="status" className={styles.note}>{copied}</p>
    </section>
    <div className={styles.twoColumns}>
      <section className={styles.panel}><h2>Como a imobiliária participa</h2><ul className={styles.list}>
        <li><strong>Patrocinadora:</strong> paga os acessos da equipe e recebe condição por volume. Quem originou esse contrato recebe 20%.</li>
        <li><strong>Conveniada:</strong> cada corretor paga sua conta; a imobiliária recebe 20% pelas indicações elegíveis que originou.</li>
        <li><strong>Parceira:</strong> pode indicar corretores externos e outras imobiliárias, com a mesma comissão de 20%.</li>
        <li>Sem comissão sobre compra própria, comissão em cadeia ou duas comissões sobre a mesma assinatura.</li>
        <li>Cada acesso mantém os limites do Pro. O painel de gestão da imobiliária ainda não está incluído no produto atual.</li>
      </ul></section>
      <section className={styles.panel}><h2>Prorrogar e evoluir</h2><p>Ao final do prazo, a parceria pode ser reavaliada considerando clientes pagantes, permanência, qualidade das indicações e divulgação realizada.</p>
        <ul className={styles.list}><li>Possibilidade de prorrogar a comissão mediante novo acordo escrito.</li><li>Possibilidade de campanhas conjuntas, materiais e acompanhamento comercial.</li><li>Condições especiais podem ser negociadas conforme resultado e margem.</li></ul>
        <p className={styles.note}>Não há prorrogação automática, comissão vitalícia ou aumento garantido de percentual. O prazo inicial é de 12 meses a partir do primeiro pagamento elegível confirmado.</p>
      </section>
    </div>
    <section className={styles.panel}><h2>Pacotes extras — sem comissão</h2><div className={styles.twoColumns}>
      <div><h3>Créditos IA • compra avulsa</h3><p>250: R$ 29 · 750: R$ 79 · 1.500: R$ 139 · 3.000: R$ 249.</p></div>
      <div><h3>Capacidade adicional • mensal</h3><p>100 imóveis: R$ 59 · 250 imóveis: R$ 119 · 500 imóveis: R$ 199.</p></div>
    </div><p className={styles.note}>Disponíveis a partir do Pro. Preços e funcionamento atuais preservados, sem descontos de equipe sobre extras.</p></section>
    <section className={styles.panel}><h2>O que confirma uma comissão</h2><p>Indicação atribuída e aprovada, contratação elegível e pagamento recebido após descontos, excluindo reembolsos e estornos. Cadastros gratuitos, contas já existentes e adesões apenas informadas não confirmam comissão.</p>
      <p className={styles.note}>Esta primeira versão organiza as indicações e simula valores. Atribuição comercial definitiva, conciliação de pagamentos e repasses ainda dependem da validação do EME. Registrar uma indicação não cria conta, envia convite ou reserva comissão.</p>
    </section>
  </div>
}
