"use client"

import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { UserPlus, House, BookOpen, Megaphone, Users, ChartNoAxesCombined, CalendarDays, Check } from "lucide-react"
import { LandingModalShell } from "./landing-modal-shell"
import styles from "./landing-journey.module.css"

const steps = [
  { title: "Crie sua conta", icon: UserPlus },
  { title: "Cadastre imóveis e clientes", icon: House },
  { title: "Monte seu catálogo", icon: BookOpen },
  { title: "Divulgue no Marketplace", icon: Megaphone },
  { title: "Receba leads automáticos, qualificados e quentes", icon: Users },
  { title: "Crie campanhas, vídeos e anúncios", icon: ChartNoAxesCombined },
  { title: "Controle financeiro, propostas, contratos e agenda", icon: CalendarDays },
]

function JourneyContent() {
  const grid = useRef<HTMLOListElement>(null)
  const [paths, setPaths] = useState<string[]>([])
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const element = grid.current
    if (!element) return
    const measure = () => {
      const boxes = Array.from(element.children).map(node => ({ x: (node as HTMLElement).offsetLeft, y: (node as HTMLElement).offsetTop,
        w: (node as HTMLElement).offsetWidth, h: (node as HTMLElement).offsetHeight }))
      setPaths(boxes.slice(0, -1).map((a, i) => {
        const b = boxes[i + 1]
        if (a.y === b.y) return `M${a.x + a.w} ${a.y + a.h / 2} H${b.x}`
        if (a.x === b.x) return `M${a.x + a.w / 2} ${a.y + a.h} V${b.y}`
        const middle = (a.y + a.h + b.y) / 2
        const right = element.clientWidth - 2
        return `M${a.x + a.w} ${a.y + a.h / 2} H${right - 6} Q${right} ${a.y + a.h / 2} ${right} ${a.y + a.h / 2 + 6} V${middle - 6} Q${right} ${middle} ${right - 6} ${middle} H8 Q2 ${middle} 2 ${middle + 6} V${b.y + b.h / 2 - 6} Q2 ${b.y + b.h / 2} 8 ${b.y + b.h / 2} H${b.x}`
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
    <header className={styles.heading}><p>Como o EME funciona</p><h2>Da operação ao resultado.</h2></header>
    <div className={styles.flow}>
      <ol ref={grid} className={styles.grid}>
        {steps.map(({ title, icon: Icon }, index) => <li key={title} className={styles.card} style={{ "--delay": `${index * 2.2}s` } as CSSProperties}>
          <div className={styles.symbol}><span>{index + 1}</span><Icon size={25} strokeWidth={1.6} aria-hidden /></div><h3>{title}</h3>
        </li>)}
        <li className={`${styles.card} ${styles.result}`} style={{ "--delay": "15.4s" } as CSSProperties}>
          <h3>Resultado</h3>
          <ul>{["Mais resultado", "Mais agilidade", "Mais velocidade", "Mais autoridade"].map(text => <li key={text}><Check size={17} strokeWidth={1.8} aria-hidden />{text}</li>)}</ul>
        </li>
      </ol>
      <svg className={styles.connections} aria-hidden="true" focusable="false">
        {paths.map((path, index) => <g key={index}><path d={path} className={styles.track} />
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
