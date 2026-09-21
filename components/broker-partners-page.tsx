"use client"

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Handshake, Plus, RefreshCw, Copy, ArrowRight } from "lucide-react"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { PartnerGuide, PartnerSimulator } from "@/components/broker-partners-guide"
import { offers, offerNames, stages, stageNames, type Referral, type ReferralList, type Offer, type Stage } from "@/lib/partners/contract"
import styles from "./broker-partners.module.css"

const base = "/api/brokers/partners"
async function api<T>(url: string, method = "GET", payload?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: "include", cache: "no-store",
    headers: payload ? { "Content-Type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir esta ação.")
  return data as T
}
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value))
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.field}>{label}{children}</label> }
const localDate = (value: string | null) => { if (!value) return ""; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function BrokerPartnersPage() {
  const { profile } = useBrokerProfile()
  const [tab, setTab] = useState("overview")
  const [result, setResult] = useState<ReferralList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [selected, setSelected] = useState<Referral | "new" | null>(null)
  const load = useCallback(async (offset = 0) => {
    setLoading(true); setError("")
    try {
      const data = await api<ReferralList>(`${base}?offset=${offset}`)
      setResult(current => offset && current ? { ...data, items: [...current.items, ...data.items.filter(item => !current.items.some(old => old.id === item.id))] } : data)
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar indicações.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const metrics = result?.metrics
  const metricsCards = [["Indicações registradas", metrics?.registered], ["Contatos registrados", metrics?.contacted], ["Em acompanhamento", metrics?.open], ["Adesões informadas", metrics?.reported]] as const
  function card(item: Referral) { return <article key={item.id} className={styles.referral}>
    <div className={styles.sectionHeading}><h3>{item.name}</h3><span className={styles.badge}>{stageNames[item.stage]}</span></div>
    <p className={styles.muted}>{offerNames[item.offer]}{item.offer === "TEAM" ? ` · ${item.seats} acessos` : ""}{item.company ? ` · ${item.company}` : ""}</p>
    {item.doNotContact && <p className={styles.error}>Não deseja contato</p>}
    {item.nextAction && <p>Próxima ação: {item.nextAction}</p>}
    {item.followUpAt && <p className={styles.note}>Retorno: {date(item.followUpAt)} · Brasília</p>}
    <Button variant="outline" size="sm" onClick={() => setSelected(item)} aria-label={`Acompanhar ${item.name}`}>Acompanhar <ArrowRight className="size-4" /></Button>
  </article> }
  return <BrokerPageShell title="Parceiros EME"><div className={styles.root}>
    <div className={styles.hero}><div><span className={styles.badge}><Handshake className="mr-1 size-3" /> Crescimento em parceria</span>
      <h2 className="mt-3">Cresça com o EME.</h2><p className={styles.muted}>Organize suas indicações e descubra o potencial da sua parceria.</p></div>
      <Button onClick={() => setSelected("new")}><Plus className="size-4" /> Registrar indicação</Button>
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className={styles.tabs}><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="referrals">Indicações</TabsTrigger><TabsTrigger value="simulator">Simulador</TabsTrigger><TabsTrigger value="guide">Planos e parceria</TabsTrigger></TabsList>
      <div role="status" aria-live="polite" className={styles.note}>{notice}</div>
      {error && <div role="alert" className={styles.error}>{error} {result ? "Os dados exibidos são da última consulta bem-sucedida." : "Os indicadores estão indisponíveis."} <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>Tentar novamente</Button></div>}
      <TabsContent value="overview" className={styles.stack}>
        <div className={styles.metrics}>{metricsCards.map(([label, value]) => <div className={styles.metric} key={label}><span>{label}</span><strong>{value ?? (loading ? "…" : "—")}</strong></div>)}</div>
        <p className={styles.note}>Atividades registradas por você. Adesão informada não comprova assinatura ou pagamento.</p>
        <div className={styles.overview}><div className={styles.stack}>
          <section className={styles.panel}><div className={styles.sectionHeading}><h2>Suas indicações</h2><Button size="sm" variant="ghost" onClick={() => setTab("referrals")}>Ver todas</Button></div>
            {loading && !result ? <p role="status">Carregando indicações…</p> : result?.items.length ? result.items.slice(0, 3).map(card) : result && <p className={styles.muted}>Você ainda não registrou indicações. Comece por um corretor ou uma imobiliária que autorizou o contato.</p>}
          </section>
          <section className={styles.panel}><h2>Comissões e repasses</h2><p><strong>Conciliação ainda não disponível</strong></p><p className={styles.muted}>Não há saldo confirmado nesta tela. Pagamentos, atribuição da indicação e repasses precisam ser validados pelo EME.</p><p className={styles.note}>Nenhuma transferência ou cobrança é realizada por esta área.</p></section>
          <section className={styles.panel}><h2>Apresente o EME</h2><p className={styles.muted}>Copie uma mensagem inicial e personalize antes de enviar. O envio e o registro do contato são ações separadas.</p>
            <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`Olá! Sou ${profile.fullName || "[seu nome]"}. Gostaria de apresentar o EME, uma plataforma para a rotina do corretor de imóveis. Você tem interesse em conhecer os recursos e as condições de assinatura?`); setNotice("Mensagem copiada. Nenhum envio ou contato foi registrado.") } catch { setNotice("Não foi possível copiar a mensagem neste navegador.") } }}><Copy className="size-4" /> Copiar apresentação</Button>
          </section>
        </div><PartnerSimulator /></div>
      </TabsContent>
      <TabsContent value="referrals" className={styles.stack}>
        <div className={styles.sectionHeading}><h2>Minhas indicações</h2><Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}><RefreshCw className="size-4" /> Atualizar</Button></div>
        <p className={styles.note}>Registros privados da sua parceria. Não criam contas, enviam convites ou garantem atribuição comercial. Próximas ações aqui são anotações; não disparam lembretes.</p>
        {loading && <p role="status">Carregando…</p>}
        <div className={styles.twoColumns}>{result?.items.map(card)}</div>
        {result?.total === 0 && <p className={styles.info}>Nenhuma indicação registrada. Use “Registrar indicação” para começar.</p>}
        {result?.nextOffset !== null && result?.nextOffset !== undefined && <Button variant="outline" disabled={loading} onClick={() => void load(result.nextOffset!)}>Carregar mais</Button>}
      </TabsContent>
      <TabsContent value="simulator"><PartnerSimulator /></TabsContent>
      <TabsContent value="guide"><PartnerGuide /></TabsContent>
    </Tabs>
    {selected && <ReferralDialog key={selected === "new" ? "new" : selected.id} referral={selected === "new" ? null : selected} close={() => setSelected(null)} saved={() => { setSelected(null); setNotice("Indicação salva com histórico. Nenhuma conta ou comissão foi criada."); void load() }} />}
  </div></BrokerPageShell>
}

function ReferralDialog({ referral, close, saved }: { referral: Referral | null; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ name: referral?.name ?? "", email: referral?.email ?? "", phone: referral?.phone ?? "", company: referral?.company ?? "",
    offer: referral?.offer ?? "PRO" as Offer, seats: String(referral?.seats ?? 1), stage: referral?.stage ?? "NEW" as Stage,
    notes: referral?.notes ?? "", nextAction: referral?.nextAction ?? "", followUpAt: localDate(referral?.followUpAt ?? null), doNotContact: referral?.doNotContact ?? false, activityNote: "", contactPermission: false })
  const [operationKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  function field<K extends keyof typeof form>(key: K, value: typeof form[K]) { setForm(f => ({ ...f, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("")
    try {
      const { stage, activityNote, contactPermission, ...common } = form
      const payload = { ...common, seats: Number(form.seats), followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : null, operationKey,
        ...(referral ? { stage, activityNote, expectedVersion: referral.version } : { contactPermission }) }
      await api(`${base}${referral ? `/${referral.id}` : ""}`, referral ? "PATCH" : "POST", payload)
      saved()
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) close() }}>
    <DialogContent className={`broker-portal-scope sm:max-w-2xl ${styles.dialog}`} showCloseButton={!busy} onEscapeKeyDown={e => { if (busy) e.preventDefault() }} onInteractOutside={e => { if (busy) e.preventDefault() }}>
      <DialogHeader className="shrink-0 pr-6"><DialogTitle>{referral ? "Acompanhar indicação" : "Registrar indicação"}</DialogTitle><DialogDescription>Registre apenas contatos autorizados. Nenhuma conta será criada ou mensagem enviada.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
        <div className={styles.dialogBody}><fieldset disabled={busy}>
          {form.doNotContact && <p className={styles.error}>Não deseja contato. Não faça uma nova abordagem sem rever essa preferência com a pessoa.</p>}
          <div className={styles.formGrid}>
            <Field label="Nome do contato *"><Input required minLength={2} maxLength={160} value={form.name} onChange={e => field("name", e.target.value)} /></Field>
            <Field label="E-mail do contato *"><Input type="email" required maxLength={254} value={form.email} onChange={e => field("email", e.target.value)} /></Field>
            <Field label="Telefone"><Input type="tel" maxLength={30} value={form.phone} onChange={e => field("phone", e.target.value)} /></Field>
            <Field label="Imobiliária / empresa"><Input maxLength={160} value={form.company} onChange={e => field("company", e.target.value)} /></Field>
            <Field label="Modalidade de interesse"><select aria-label="Modalidade de interesse" value={form.offer} onChange={e => { const offer = e.target.value as Offer; setForm(f => ({ ...f, offer, seats: offer === "TEAM" ? "3" : "1" })) }}>{offers.map(o => <option key={o} value={o}>{offerNames[o]}</option>)}</select></Field>
            {form.offer === "TEAM" && <Field label="Acessos da equipe *"><Input type="number" required min={3} max={1000} step={1} value={form.seats} onChange={e => field("seats", e.target.value)} /></Field>}
            {referral && <Field label="Etapa"><select aria-label="Etapa" value={form.stage} onChange={e => field("stage", e.target.value as Stage)}>{stages.map(s => <option key={s} value={s}>{stageNames[s]}</option>)}</select></Field>}
          </div>
          {form.stage === "WON_REPORTED" && <p className={styles.info}>Adesão informada por você, ainda sem validação de assinatura, atribuição ou comissão pelo EME.</p>}
          <Field label="Observações"><Textarea maxLength={3000} value={form.notes} onChange={e => field("notes", e.target.value)} /></Field>
          <div className={styles.formGrid}><Field label="Próxima ação"><Input maxLength={240} value={form.nextAction} onChange={e => field("nextAction", e.target.value)} /></Field>
            <Field label="Data de retorno (horário deste dispositivo)"><Input type="datetime-local" value={form.followUpAt} onChange={e => field("followUpAt", e.target.value)} /></Field></div>
          <label className={styles.checkbox}><input type="checkbox" checked={form.doNotContact} onChange={e => field("doNotContact", e.target.checked)} />Não deseja contato</label>
          {!referral && <label className={styles.checkbox}><input required type="checkbox" checked={form.contactPermission} onChange={e => field("contactPermission", e.target.checked)} />Tenho autorização para registrar os dados e tratar desta indicação.</label>}
          {referral && <Field label="Registrar atividade / contexto da atualização"><Textarea maxLength={1200} value={form.activityNote} onChange={e => field("activityNote", e.target.value)} placeholder="Ex.: conversa realizada e próximo passo combinado." /></Field>}
        </fieldset>
        {referral && <section><h3 className="mb-3 font-semibold">Histórico — últimas 30 atividades</h3><ol className={styles.history}>{referral.activities.map(a => <li key={a.id}><time dateTime={a.createdAt}>{date(a.createdAt)} · Brasília</time>{a.note}</li>)}</ol></section>}
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.dialogFooter}><Button type="button" variant="outline" disabled={busy} onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando…" : referral ? "Salvar acompanhamento" : "Salvar indicação"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}
