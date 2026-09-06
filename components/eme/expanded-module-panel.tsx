"use client"

import { useState, type KeyboardEvent } from "react"
import Image from "next/image"
import { ArrowUpRight, Check, CalendarDays, FileText, Home, ImageIcon, Users, WalletCards } from "lucide-react"
import type { EmeModule } from "@/lib/eme-modules"
import { LandingModalShell } from "./landing-modal-shell"
import styles from "./module-presentation.module.css"

const property = { title: "Apartamento com varanda", price: "R$ 350.000", location: "Vacaria · RS", image: "/property-living.png" }

/** Editorial examples use only fields supported by the product, never live customer data. */
function PropertyPreview({ channel }: { channel?: string }) {
  return <div className={styles.preview}>
    <div className={styles.previewHeader}><span>{channel ?? "Prévia do imóvel"}</span><span className={styles.pill}>{channel ? "Exemplo" : "Rascunho"}</span></div>
    <Image className={styles.propertyImage} src={property.image} alt="Sala de estar com varanda; imagem ilustrativa" width={1024} height={1024} sizes="(min-width: 1024px) 480px, 90vw" />
    <div className={styles.previewBody}>
      <p className={styles.eyebrow}>Apartamento · dados ilustrativos</p>
      <h3>{property.title}</h3><p>{property.location}</p><strong className={styles.price}>{property.price}</strong>
      <p className={styles.facts}><span>2 quartos</span><span>1 vaga</span><span>71 m²</span></p>
      <div className={styles.divider}>
        <h4>{channel === "Marketplace EME" ? "Descoberta e contato" : channel ? "Sua carteira, sua identidade" : "Publicação"}</h4>
        <p>{channel === "Marketplace EME" ? "Busque, compare e consulte o corretor responsável." : channel ? "Apresente os imóveis que você escolheu publicar." : "Escolha os canais após revisar a ficha."}</p>
        {!channel && <div className={styles.pills}><span className={styles.pill}>Catálogo EME</span><span className={styles.pill}>Marketplace EME</span></div>}
      </div>
    </div>
  </div>
}

function ClientPreview() {
  return <div className={styles.preview}>
    <div className={styles.previewHeader}><span>Atendimento e agenda</span><Users size={20} aria-hidden /></div>
    <div className={styles.previewBody}>
      <p className={styles.eyebrow}>Cadastro ilustrativo</p>
      <h3>Cliente de exemplo</h3><span className={styles.pill}>Em atendimento</span>
      <dl className={styles.fields}><div><dt>Interesse</dt><dd>Apartamento com varanda</dd></div><div><dt>Observações</dt><dd>Revisar as opções da carteira.</dd></div></dl>
      <div className={styles.divider}><h4><CalendarDays size={18} aria-hidden /> Próximos compromissos</h4>
        <ul className={styles.rows}><li><time>10:00</time><div><strong>Visita ao imóvel</strong><span>Compromisso registrado na agenda</span></div></li><li><time>15:00</time><div><strong>Revisar documentos</strong><span>Tarefa pendente</span></div></li></ul>
      </div>
      <p className={styles.small}>Os compromissos são cadastrados pelo corretor, sem vínculo automático presumido.</p>
    </div>
  </div>
}

function DocumentPreview({ contract }: { contract: boolean }) {
  return <div className={styles.preview}>
    <div className={styles.previewHeader}><span>{contract ? "Preparação do contrato" : "Preparação da proposta"}</span><FileText size={20} aria-hidden /></div>
    <div className={styles.previewBody}>
      <p className={styles.eyebrow}>Exemplo de preenchimento</p>
      <h3>{contract ? "Modelo para revisão" : "Proposta de compra"}</h3><span className={styles.pill}>Rascunho</span>
      <dl className={styles.fields}>
        <div><dt>{contract ? "Modelo" : "Cliente"}</dt><dd>{contract ? "Contrato do corretor" : "Cliente de exemplo"}</dd></div>
        <div><dt>Imóvel</dt><dd>{property.title}</dd></div>
        <div><dt>Valor informado</dt><dd>{property.price}</dd></div>
        <div><dt>{contract ? "Campos do documento" : "Condições de pagamento"}</dt><dd>A revisar antes de concluir</dd></div>
      </dl>
      <div className={styles.divider}><h4>Revisão antes da entrega</h4><p>{contract ? "Complete os campos para gerar o PDF final. O conteúdo jurídico deve ser revisado por você." : "Confira os dados e as condições antes de gerar e compartilhar o documento."}</p></div>
    </div>
  </div>
}

function FinancePreview() {
  return <div className={styles.preview}>
    <div className={styles.previewHeader}><span>Recebimentos</span><WalletCards size={20} aria-hidden /></div>
    <div className={styles.previewBody}>
      <p className={styles.eyebrow}>Exemplo de controle operacional</p>
      <div className={styles.financeTotals}><div><span>Recebido</span><strong>R$ 7.200</strong></div><div><span>A receber</span><strong>R$ 4.500</strong></div></div>
      <ul className={styles.receipts}>
        <li><div><strong>Locação</strong><span className={styles.received}>Recebido</span></div><b>R$ 7.200</b></li>
        <li><div><strong>Comissão</strong><span className={styles.expected}>Previsto</span></div><b>R$ 3.000</b></li>
        <li><div><strong>Honorários</strong><span className={styles.overdue}>Atrasado</span></div><b>R$ 1.500</b></li>
      </ul>
      <div className={styles.divider}><h4><Home size={18} aria-hidden /> Valor da carteira</h4><strong className={styles.price}>{property.price}</strong><p>1 imóvel ilustrativo. Indicador operacional: não compõe receita nem resultado.</p></div>
    </div>
  </div>
}

function StudioPreview() {
  return <div className={styles.preview}>
    <div className={styles.previewHeader}><span>Preparar imóvel</span><ImageIcon size={20} aria-hidden /></div>
    <Image className={styles.studioImage} src="/property-raw.png" alt="Imagem de um ambiente vazio, usada para ilustrar a etapa de envio" width={1024} height={1024} sizes="(min-width: 1024px) 480px, 90vw" />
    <div className={styles.previewBody}><p className={styles.eyebrow}>Imagem de entrada · exemplo ilustrativo</p><h3>Do original à sua revisão</h3>
      <ol className={styles.steps}><li>Escolha a imagem e a preparação.</li><li>Gere e compare com o original.</li><li>Revise e aprove na Biblioteca.</li></ol>
      <p className={styles.small}>Esta demonstração mostra a etapa de entrada, não um resultado gerado. Cada resultado precisa ser conferido.</p>
    </div>
  </div>
}

export function ExpandedModulePanel({ module, originEl, onClose }: { module: EmeModule; originEl?: HTMLElement | null; onClose: () => void }) {
  const [viewIndex, setViewIndex] = useState(0)
  const view = module.views?.[viewIndex]
  const Icon = module.icon
  const benefits = view?.benefits ?? module.benefits
  const activeId = view?.id ?? module.id
  const href = view?.href ?? module.demoHref
  const action = view?.action ?? module.demoLabel
  const selectTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = module.views?.length ?? 0
    const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : event.key === "ArrowRight" ? (index + 1) % count : event.key === "ArrowLeft" ? (index + count - 1) % count : -1
    if (next < 0) return
    event.preventDefault()
    setViewIndex(next)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return <LandingModalShell label={module.name} moduleId={module.id} presentation originEl={originEl} onClose={onClose}>
    <div className={styles.presentation} data-has-views={Boolean(module.views)}>
      <div className={styles.intro}>
        <div className={styles.moduleLabel} data-choreography="0"><span><Icon size={27} strokeWidth={1.6} aria-hidden /></span>{module.name}</div>
        {module.views && <div className={styles.tabs} data-choreography="1" role="tablist" aria-label={module.name}>
          {module.views.map((item, index) => <button key={item.id} type="button" role="tab" id={`module-tab-${item.id}`} aria-controls={`module-view-${module.id}`} aria-selected={viewIndex === index} tabIndex={viewIndex === index ? 0 : -1} onClick={() => setViewIndex(index)} onKeyDown={(event) => selectTab(event, index)}>{item.label}</button>)}
        </div>}
        <h2 data-choreography="1">{module.tagline}</h2>
        <p data-choreography="2" id={`module-description-${module.id}`} className={styles.description}>{view?.description ?? module.longDescription}</p>
      </div>
      <div className={styles.visual} data-choreography="3" role={view ? "tabpanel" : undefined} id={`module-view-${module.id}`} aria-labelledby={view ? `module-tab-${view.id}` : undefined} aria-describedby={view ? `module-description-${module.id} module-details-${module.id}` : undefined} tabIndex={view ? 0 : undefined}>
        {module.id === "imoveis" ? <PropertyPreview /> : module.id === "clientes" ? <ClientPreview /> : module.id === "financeiro" ? <FinancePreview /> : module.id === "studio-ia" ? <StudioPreview /> : module.id === "propostas" ? <DocumentPreview contract={activeId === "contratos"} /> : <PropertyPreview channel={activeId === "marketplace" ? "Marketplace EME" : "Catálogo do corretor"} />}
        <p className={styles.caption}>Demonstração de organização · Dados ilustrativos</p>
      </div>
      <div className={styles.details} data-choreography="4" id={`module-details-${module.id}`}>
        <ul className={styles.benefits}>{benefits.slice(0, 3).map((benefit) => { const text = typeof benefit === "string" ? benefit : benefit.title; return <li key={text}><span><Check size={18} strokeWidth={2} aria-hidden /></span>{text}</li> })}</ul>
        <p className={styles.note}>{view?.note ?? module.note}</p>
        {href && action && <a className={styles.action} href={href} target="_blank" rel="noopener noreferrer">{action}<ArrowUpRight size={17} aria-hidden /><span className="sr-only"> (abre em nova aba)</span></a>}
      </div>
    </div>
  </LandingModalShell>
}
