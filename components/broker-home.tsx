"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, ArrowRight, BookOpenText, Building2, CalendarDays, Check, ChevronRight, FileSignature, MessageCircle, Plus, RefreshCw, Sparkles, UsersRound, WalletCards } from "lucide-react"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import styles from "./broker-home.module.css"

export type BrokerHomeSummary = {
  activePropertiesCount: number
  pending: { unattendedLeads: number; pendingAgenda: number; awaitingSignature: number; draftDocuments: number; overdueFinancialReceipts: number }
}

export function BrokerHome() {
  const { profile } = useBrokerProfile()
  const [summary, setSummary] = useState<BrokerHomeSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    fetch("/api/brokers/operation-health", { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || typeof data.activePropertiesCount !== "number" || !data.pending) throw new Error("Resumo indisponível")
        if (!controller.signal.aborted) setSummary(data)
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])

  return <BrokerPageShell title="Início" variant="home" contentClassName="!p-0">
    <BrokerHomeView name={profile.fullName} photoUrl={profile.photoUrl} summary={summary} loading={loading} error={error} onRetry={() => setAttempt((current) => current + 1)} />
  </BrokerPageShell>
}

type HomeViewProps = {
  name: string
  photoUrl?: string
  summary: BrokerHomeSummary | null
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

export function BrokerHomeView({ name, photoUrl, summary, loading = false, error = false, onRetry }: HomeViewProps) {
  const firstName = name.trim().split(/\s+/)[0]
  const ready = !loading && !error && summary !== null
  const priorities = ready ? [
    { count: summary.pending.unattendedLeads, label: "Contatos sem atendimento", detail: "Retome a conversa com quem demonstrou interesse.", href: "/corretor/clientes", icon: MessageCircle },
    { count: summary.pending.pendingAgenda, label: "Compromissos pendentes", detail: "Confira os compromissos de hoje e os atrasados.", href: "/corretor/agenda", icon: CalendarDays },
    { count: summary.pending.awaitingSignature, label: "Contratos para assinatura", detail: "Acompanhe a próxima etapa da negociação.", href: "/corretor/documentos/contratos", icon: FileSignature },
    { count: summary.pending.overdueFinancialReceipts, label: "Recebimentos atrasados", detail: "Revise os valores que precisam de acompanhamento.", href: "/corretor/financeiro", icon: WalletCards },
    { count: summary.pending.draftDocuments, label: "Documentos em rascunho", detail: "Continue de onde parou.", href: "/corretor/documentos", icon: FileSignature },
  ].filter((item) => item.count > 0) : []

  return <div className={styles.home}>
    <section className={styles.intro} aria-label="Boas-vindas">
      <div className={styles.identity}>
        <Avatar className={styles.avatar}><AvatarImage src={photoUrl} alt={name || "Seu perfil"} /><AvatarFallback>{firstName?.slice(0, 1) || "E"}</AvatarFallback></Avatar>
        <div><p className={styles.eyebrow}>SEU ESPAÇO NO EME</p><h1>{firstName ? `Olá, ${firstName}.` : "Boas-vindas ao EME."}</h1><p className={styles.subtitle}>Tudo o que você precisa para seguir em frente.</p></div>
      </div>
      <Link href="/corretor/novo-imovel" className={styles.primary}><Plus size={17} /> Adicionar imóvel</Link>
    </section>

    <section className={styles.catalog} aria-labelledby="home-catalog-title">
      <div className={styles.catalogCopy}><span className={styles.catalogLabel}><BookOpenText size={16} /> SEU CATÁLOGO</span><h2 id="home-catalog-title">Sua carteira. Sua vitrine.</h2><p>Organize seus imóveis e leve as melhores oportunidades aos seus clientes.</p><Link href="/corretor/catalogo" className={styles.catalogAction}>Gerenciar catálogo <ArrowUpRight size={17} /></Link></div>
      <div className={styles.catalogMark} aria-hidden="true"><BookOpenText strokeWidth={0.8} /></div>
    </section>

    <section aria-labelledby="home-shortcuts-title" className={styles.section}>
      <div className={styles.sectionHeading}><h2 id="home-shortcuts-title">O que vamos fazer?</h2><span>Acessos rápidos</span></div>
      <div className={styles.shortcuts}>
        {[
          { title: "Meus imóveis", description: ready ? `${summary.activePropertiesCount} ${summary.activePropertiesCount === 1 ? "imóvel ativo" : "imóveis ativos"}` : "Organize sua carteira", href: "/corretor/imoveis", icon: Building2 },
          { title: "Clientes", description: "Relacionamentos e contatos", href: "/corretor/clientes", icon: UsersRound },
          { title: "Agenda", description: "Visitas e compromissos", href: "/corretor/agenda", icon: CalendarDays },
          { title: "Studio IA", description: "Crie materiais para divulgar", href: "/corretor/studio-ia", icon: Sparkles },
        ].map((item) => <Link className={styles.shortcut} href={item.href} key={item.href}><div className={styles.shortcutTop}><item.icon size={22} strokeWidth={1.6} /><ArrowUpRight size={15} /></div><h3>{item.title}</h3><p>{item.description}</p></Link>)}
      </div>
    </section>

    <div className={styles.lowerGrid}>
      <section className={styles.priorities} aria-labelledby="home-priorities-title" aria-busy={loading}>
        <div className={styles.sectionHeading}><h2 id="home-priorities-title">Precisa da sua atenção</h2>{ready && priorities.length > 0 ? <span>{priorities.length} {priorities.length === 1 ? "categoria" : "categorias"}</span> : null}</div>
        {loading ? <div className={styles.status} role="status"><RefreshCw size={18} /><p>Buscando suas pendências…</p></div> : error || !summary ? <div className={styles.status} role="status"><p>Não foi possível carregar o resumo. Seus acessos continuam disponíveis.</p><button onClick={onRetry} type="button"><RefreshCw size={15} /> Tentar novamente</button></div> : priorities.length === 0 ? <div className={styles.empty}><span><Check size={23} /></span><div><h3>Nenhuma pendência por aqui.</h3><p>Atendimentos, agenda, assinaturas e recebimentos sem alertas no momento.</p></div></div> : <div className={styles.priorityList}>{priorities.map((item) => <Link href={item.href} key={item.href} className={styles.priority}><item.icon size={19} strokeWidth={1.6} /><div><h3>{item.label}</h3><p>{item.detail}</p></div><span className={styles.count}>{item.count}</span><ChevronRight size={16} /></Link>)}</div>}
      </section>
      <aside className={styles.assistant} aria-labelledby="home-assistant-title"><span className={styles.assistantIcon}><Sparkles size={22} strokeWidth={1.5} /></span><p className={styles.eyebrow}>ASSISTENTE EME · COS</p><h2 id="home-assistant-title">Uma ajuda para o próximo passo.</h2><p>Consulte seus dados e peça ajuda para organizar sua rotina.</p><Link href="/corretor/cos" className={styles.assistantAction}>Abrir assistente <ArrowRight size={17} /></Link><Link href="/corretor/suporte" className={styles.support}>Precisa de suporte?</Link></aside>
    </div>
    <footer className={styles.footer}>Seu trabalho, com mais clareza.<span>EME</span></footer>
  </div>
}
