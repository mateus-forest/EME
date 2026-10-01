"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import * as Dialog from "@radix-ui/react-dialog"
import { ArrowRight, Plus, X } from "lucide-react"
import { officeSectors as sectors } from "./office-sectors"
import styles from "./office-landing.module.css"

export function OfficeLanding() {
  const [active, setActive] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)
  const lastTrigger = useRef<HTMLButtonElement | null>(null)
  const sector = sectors.find(item => item.id === active)
  const feature = sector?.items[selected]
  function openSector(id: string, trigger: HTMLButtonElement) {
    lastTrigger.current = trigger
    setSelected(0)
    setActive(id)
  }
  return <div className={styles.landing}>
    <a className={styles.skip} href="#ecossistema">Explorar os setores</a>
    <header className={styles.header}>
      <a className={styles.brand} href="/" aria-label="EME — início"><span className={styles.logoFrame}><Image src="/landing-2026/assets/eme-logo-relief.png" alt="EME" width={1254} height={1254} priority /></span><span>Ecossistema do<br />corretor de imóveis</span></a>
      <nav aria-label="Navegação principal"><a className={styles.ecosystemLink} href="#ecossistema">O ecossistema</a><a href="/imoveis">Marketplace</a><a href="/login">Entrar <ArrowRight aria-hidden="true" size={15} /></a><a className={styles.primary} href="/cadastro">Criar conta</a></nav>
    </header>
    <main>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.intro}><p className={styles.eyebrow}>A plataforma do corretor de imóveis</p><h1 id="hero-title">A estrutura de uma imobiliária.<br /><span>Nas mãos do corretor.</span></h1><p>Clientes, imóveis, captação, divulgação e gestão.<br />Explore o que o EME faz por você.</p></div>
        <div className={styles.scene}>
          <Image className={styles.office} src="/landing-2026/assets/office-ecosystem.webp" alt="Um corretor de camisa verde e uma corretora diante de um escritório com cinco setores conectados: Carteira, Vender, COS, Documentos e Operação." width={1536} height={1024} sizes="100vw" priority />
          <div className={styles.hotspots} aria-label="Setores do escritório">{sectors.map(item => <button key={item.id} className={styles.marker} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-haspopup="dialog" onClick={event => openSector(item.id, event.currentTarget)}><Plus size={16} aria-hidden="true" /><span>{item.name}</span></button>)}</div>
          <span className={styles.sceneNote}>Uma representação da estrutura que acompanha você.</span>
        </div>
      </section>
      <section id="ecossistema" className={styles.ecosystem} aria-labelledby="ecosystem-heading"><div><p className={styles.eyebrow}>Seu negócio. Tudo conectado.</p><h2 id="ecosystem-heading">Uma estrutura para cada próximo passo.</h2><p>Selecione uma área e descubra as ferramentas do seu dia a dia.</p></div><div className={styles.sectorGrid}>{sectors.map((item, index) => <button key={item.id} className={styles.sectorCard} aria-haspopup="dialog" onClick={event => openSector(item.id, event.currentTarget)}><span className={styles.number}>0{index + 1}</span><h3>{item.name}</h3><p>{item.items.map(entry => entry.name).join(" · ")}</p><ArrowRight size={20} aria-hidden="true" /></button>)}</div></section>
      <section className={styles.closing}><p className={styles.eyebrow}>Seu talento, com estrutura</p><h2>Você cuida das relações.<br /><span>O EME acompanha a operação.</span></h2><p>Comece pela sua conta e conheça as ferramentas por dentro.</p><a className={styles.primary} href="/cadastro">Criar minha conta <ArrowRight size={18} aria-hidden="true" /></a><a className={styles.secondary} href="/login">Já tenho uma conta</a></section>
    </main>
    <footer className={styles.footer}><span>EME · Ecossistema do corretor de imóveis</span><a href="/imoveis">Conhecer o Marketplace <ArrowRight size={15} aria-hidden="true" /></a></footer>
    <Dialog.Root open={!!sector} onOpenChange={open => { if (!open) setActive(null) }}><Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); lastTrigger.current?.focus() }}>
      <div className={styles.dialogHeader}><p className={styles.eyebrow}>Explore o EME</p><Dialog.Title>{sector?.name}</Dialog.Title><Dialog.Description>{sector?.intro}</Dialog.Description><Dialog.Close className={styles.close} aria-label="Fechar"><X size={22} /></Dialog.Close></div>
      <div className={styles.dialogBody}><div className={styles.featureList} aria-label={`Ferramentas de ${sector?.name ?? ""}`}>{sector?.items.map((item, index) => <button key={item.name} aria-pressed={index === selected} aria-controls="office-feature" onClick={() => setSelected(index)}><item.icon size={20} aria-hidden="true" /><span>{item.name}</span><ArrowRight size={16} aria-hidden="true" /></button>)}</div>{feature && <div id="office-feature" className={styles.feature} aria-live="polite"><feature.icon size={32} aria-hidden="true" /><h3>{feature.name}</h3><p>{feature.text}</p><a className={styles.primary} href={`/login?next=${encodeURIComponent(feature.route)}`}>Acessar {feature.name} <ArrowRight size={17} aria-hidden="true" /></a><a className={styles.secondary} href="/cadastro">Ainda não tenho conta</a></div>}</div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>
}
