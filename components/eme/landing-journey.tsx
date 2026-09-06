"use client"

import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { UserPlus, House, BookOpen, Megaphone, Users, ChartNoAxesCombined, CalendarDays, Check } from "lucide-react"
import { LandingModalShell } from "./landing-modal-shell"
import styles from "./landing-journey.module.css"

const steps = [
  { title: "Crie sua conta", description: "Acesse o EME em minutos e comece sua jornada.", icon: UserPlus },
  { title: "Cadastre imóveis e clientes", description: "Organize sua base com praticidade e inteligência.", icon: House },
  { title: "Monte seu catálogo", description: "Apresente seus imóveis com materiais profissionais.", icon: BookOpen },
  { title: "Divulgue no Marketplace", description: "Ganhe visibilidade para o seu portfólio no ecossistema EME.", icon: Megaphone },
  { title: "Receba leads automáticos, qualificados e quentes", description: "O EME conecta você a oportunidades reais.", icon: Users },
  { title: "Crie campanhas, vídeos e anúncios", description: "Com o Studio IA, você produz e divulga em poucos cliques.", icon: ChartNoAxesCombined },
  { title: "Controle financeiro, propostas, contratos e agenda", description: "Tudo centralizado para você vender mais com organização.", icon: CalendarDays },
]

function JourneyContent() {
  const grid = useRef<HTMLOListElement>(null)
  const [paths, setPaths] = useState<string[]>([])
  const [visible, setVisible] = useState(true)
  const arrowId = useId()
  useEffect(() => {
    const element = grid.current
    if (!element) return
    const measure = () => {
      const boxes = Array.from(element.children).map(node => ({ x: (node as HTMLElement).offsetLeft, y: (node as HTMLElement).offsetTop,
        w: (node as HTMLElement).offsetWidth, h: (node as HTMLElement).offsetHeight }))
      setPaths(boxes.slice(0, -1).map((a, i) => {
        const b = boxes[i + 1]
        if (a.y === b.y) {
          const start = a.x + a.w
          const end = b.x
          const y = a.y + a.h * .4
          return `M${start} ${y} C${end - 4} ${y + 2} ${start + 4} ${y + 24} ${end} ${y + 30}`
        }
        if (a.x === b.x) return `M${a.x + a.w / 2} ${a.y + a.h} V${b.y}`
        const middle = (a.y + a.h + b.y) / 2
        const right = element.clientWidth - 1
        const startY = a.y + a.h * .55
        const endY = b.y + b.h * .45
        return `M${a.x + a.w} ${startY} C${right} ${startY + 6} ${right} ${middle - 30} ${right} ${middle - 22} Q${right} ${middle} ${right - 30} ${middle} H36 Q1 ${middle} 1 ${middle + 35} V${endY - 26} Q1 ${endY - 6} ${b.x} ${endY}`
      }))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    Array.from(element.children).forEach(child => observer.observe(child))
    measure()
    const visibility = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", visibility)
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility) }
  }, [])

  return <div className={styles.content} data-journey-running={visible}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>Como o EME funciona</p>
      <h2>Da operação ao resultado.</h2>
      <p className={styles.description}>O EME guia o corretor em uma jornada completa, do setup ao crescimento, com tudo o que você precisa em um só lugar.</p>
      <span className={styles.note}>Seu crescimento <br />tem um <br />sistema.</span>
    </header>
    <div className={styles.flow}>
      <ol ref={grid} className={styles.grid}>
        {steps.map(({ title, description, icon: Icon }, index) => <li key={title} className={styles.card} style={{ "--delay": `${index * 2.2}s` } as CSSProperties}>
          <div className={styles.symbol}><span>{index + 1}</span><Icon size={34} strokeWidth={1.6} aria-hidden /></div>
          <div className={styles.copy}><h3>{title}</h3><p>{description}</p></div>
        </li>)}
        <li className={`${styles.card} ${styles.result}`} style={{ "--delay": "15.4s" } as CSSProperties}>
          <h3 className={styles.resultTitle}>Resultado</h3>
          <div className={styles.resultSymbol} aria-hidden><ChartNoAxesCombined size={36} strokeWidth={1.4} /><span>✧</span></div>
          <ul>{["Mais resultado", "Mais agilidade", "Mais velocidade", "Mais autoridade"].map(text => <li key={text}><Check size={17} strokeWidth={1.8} aria-hidden />{text}</li>)}</ul>
        </li>
      </ol>
      <svg className={styles.connections} aria-hidden="true" focusable="false">
        <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L6 3.5 L1 6" className={styles.arrow} /></marker></defs>
        {paths.map((path, index) => <g key={index}><path d={path} className={styles.track} markerEnd={`url(#${arrowId})`} />
          <path d={path} pathLength={100} className={styles.light} style={{ "--delay": `${index * 2.2 + 1}s` } as CSSProperties} />
        </g>)}
      </svg>
    </div>
  </div>
}

export function LandingJourney({ hidden = false }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const tooltip = useId()
  return <>
    <span className={styles.triggerWrap} hidden={hidden}>
      <button ref={trigger} type="button" className={styles.trigger} aria-label="Como o EME funciona"
        aria-haspopup="dialog" aria-expanded={open} aria-describedby={tooltip} onClick={() => setOpen(true)}><span aria-hidden="true">?</span></button>
      <span id={tooltip} role="tooltip" className={styles.tooltip}>Como o EME funciona</span>
    </span>
    {open && !hidden && <LandingModalShell moduleId="journey" label="Como o EME funciona" presentation
      className={styles.shell} originEl={trigger.current} onClose={() => setOpen(false)}><JourneyContent /></LandingModalShell>}
  </>
}
