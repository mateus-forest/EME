"use client"

import { useRef, useState } from "react"
import { MessageCircle } from "lucide-react"
import { LandingModalShell } from "./landing-modal-shell"
import styles from "./landing-product-intro.module.css"

export function LandingProductIntro() {
  const [cosOpen, setCosOpen] = useState(false)
  const origin = useRef<HTMLButtonElement>(null)
  return <>
    <section className={styles.intro} aria-label="Conheça o EME">
      <p className={styles.category}>EME · Sistema Operacional do Corretor</p>
      <h1>Uma estrutura à altura do seu trabalho.</h1>
      <p className={styles.support}>Organize clientes e imóveis, prepare materiais e documentos e apresente sua carteira com apoio de IA.</p>
    </section>
    <aside className={styles.secondary}>
      <button ref={origin} type="button" onClick={() => setCosOpen(true)}><MessageCircle size={15} aria-hidden /> Conheça o papel do COS</button>
      <span>Acelerador EME · Em desenvolvimento</span>
    </aside>
    {cosOpen && <LandingModalShell label="COS, o assistente do EME" moduleId="cos-info" presentation originEl={origin.current} onClose={() => setCosOpen(false)}>
      <div className={styles.cosContent}>
        <MessageCircle size={30} aria-hidden />
        <h2>COS, o assistente do EME.</h2>
        <p>Consulte informações e acesse ações da sua operação por conversa, com passos claros para revisar e concluir.</p>
        <ul><li>Consulte clientes, imóveis, agenda e o resumo financeiro.</li><li>Acesse formulários de ações disponíveis, como cadastrar um cliente ou registrar um compromisso.</li><li>Revise e confirme os dados solicitados para concluir cada ação.</li></ul>
        <p className={styles.note}>As ações são delimitadas e podem utilizar Créditos IA. O COS não é um agente autônomo nem um monitor contínuo. Uma experiência mais ampla está em desenvolvimento.</p>
      </div>
    </LandingModalShell>}
  </>
}
