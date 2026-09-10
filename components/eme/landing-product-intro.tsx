"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { MessageCircle, UserRound, FileText, CircleCheck, ChartNoAxesColumnIncreasing, Send, Funnel, Database, Sparkles, Target, Info, ChartNoAxesCombined, ArrowUpRight } from "lucide-react"
import { LandingModalShell } from "./landing-modal-shell"
import styles from "./landing-product-intro.module.css"

const currentCapabilities = [
  { icon: UserRound, text: "Consulta clientes, imóveis, agenda e resumo financeiro" },
  { icon: FileText, text: "Abre ações guiadas, como cadastrar cliente e registrar compromissos" },
  { icon: CircleCheck, text: "Revisa e confirma dados antes de concluir cada ação" },
  { icon: ChartNoAxesColumnIncreasing, text: "Organiza a operação com passos claros e controle" },
]

const upcomingCapabilities = [
  { icon: MessageCircle, text: "Atender clientes e responder com mais autonomia" },
  { icon: Send, text: "Enviar mensagens e acompanhar conversas" },
  { icon: Funnel, text: "Qualificar leads e priorizar oportunidades" },
  { icon: Database, text: "Cadastrar clientes, imóveis e tarefas automaticamente" },
  { icon: FileText, text: "Gerar apoio operacional para propostas, contratos e agenda" },
  { icon: Sparkles, text: "Atuar como um verdadeiro assistente da rotina do corretor" },
]

export function LandingProductIntro({ showSupport = true, includeCos = true }: { showSupport?: boolean; includeCos?: boolean }) {
  return <>
    <section className={styles.intro} aria-label="Conheça o EME">
      <p className={styles.category}>EME · Sistema Operacional do Corretor</p>
      <h1>Uma estrutura à altura do seu trabalho.</h1>
      {showSupport && <p className={styles.support}>Organize clientes e imóveis, prepare materiais e documentos e apresente sua carteira com apoio de IA.</p>}
    </section>
    {includeCos && <LandingCosInfo />}
  </>
}

export function LandingCosInfo({ className = "", onOpenAccelerator }: { className?: string; onOpenAccelerator?: () => void }) {
  const [cosOpen, setCosOpen] = useState(false)
  const origin = useRef<HTMLButtonElement>(null)
  return <>
    <aside className={`${styles.secondary} ${className}`}>
      <button ref={origin} type="button" onClick={() => setCosOpen(true)}><MessageCircle size={15} aria-hidden /> Conheça o papel do COS</button>
      {onOpenAccelerator ? <button type="button" className={styles.acceleratorCta} onClick={onOpenAccelerator} aria-label="Conheça o Acelerador EME">
        <span><strong>Acelerador EME</strong><small>Em desenvolvimento</small></span><ArrowUpRight size={18} aria-hidden />
      </button> : <span>Acelerador EME · Em desenvolvimento</span>}
    </aside>
    {cosOpen && <LandingModalShell label="COS, o assistente do EME" moduleId="cos-info" presentation className={styles.cosShell} originEl={origin.current} onClose={() => setCosOpen(false)}>
      <div className={styles.cosContent}>
        <header className={styles.cosHeader}>
          <span className={styles.cosLogo} data-choreography="0"><Image src="/marketplace/cos-logo.png" alt="Símbolo oficial do COS" width={76} height={76} sizes="76px" /></span>
          <h2 data-choreography="1">COS, o assistente do EME.</h2>
          <p data-choreography="2">Hoje o COS já executa ações operacionais e consulta informações. <br />A próxima versão amplia essa atuação para toda a jornada do corretor.</p>
        </header>
        <div className={styles.cosVersions}>
          <section className={styles.cosCard} aria-labelledby="cos-current-title" data-choreography="3">
            <span className={styles.cosBadge}>COS 2.6 <span aria-hidden>•</span> versão atual</span>
            <h3 id="cos-current-title">O que já entrega hoje</h3>
            <p className={styles.cosDescription}>O COS ajuda você a consultar informações e executar ações da sua operação, com segurança e praticidade.</p>
            <ul className={styles.cosCapabilities}>{currentCapabilities.map(({ icon: Icon, text }) => <li key={text}><span className={styles.cosIcon}><Icon size={19} strokeWidth={1.7} aria-hidden /></span><span>{text}</span></li>)}</ul>
            <p className={styles.cosCurrentNote}><Info size={18} strokeWidth={1.7} aria-hidden /><span>Ações delimitadas e uso pontual com apoio de IA.</span></p>
          </section>
          <section className={`${styles.cosCard} ${styles.cosUpcoming}`} aria-labelledby="cos-upcoming-title" data-choreography="4">
            <span className={styles.cosBadge}>COS 3.8 <span aria-hidden>•</span> em desenvolvimento</span>
            <h3 id="cos-upcoming-title">O próximo nível do COS</h3>
            <p className={styles.cosDescription}>Uma versão mais completa, proativa e integrada, para apoiar você em toda a jornada comercial.</p>
            <ul className={styles.cosCapabilities}>{upcomingCapabilities.map(({ icon: Icon, text }) => <li key={text}><span className={styles.cosIcon}><Icon size={19} strokeWidth={1.7} aria-hidden /></span><span>{text}</span></li>)}</ul>
            <p className={styles.cosObjective}><Target size={23} strokeWidth={1.7} aria-hidden /><span><strong>Objetivo:</strong> transformar o COS no centro operacional da rotina comercial.</span></p>
          </section>
        </div>
        <footer className={styles.cosFooter} data-choreography="5"><ChartNoAxesCombined size={22} strokeWidth={1.6} aria-hidden /><p>Do suporte operacional atual à execução completa da rotina do corretor.</p></footer>
      </div>
    </LandingModalShell>}
  </>
}
