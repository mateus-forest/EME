"use client"

import { useSyncExternalStore } from "react"
import Image from "next/image"
import { Calculator, Check, ShieldCheck } from "lucide-react"

import { LandingModalShell } from "@/components/eme/landing-modal-shell"
import type { EmeModule } from "@/lib/eme-modules"
import agendaStyles from "./agenda-module-artwork.module.css"
import mobileStyles from "./mobile-module-artwork.module.css"
import panelStyles from "./expanded-module-panel.module.css"

type ModuleImageCrop = {
  sourceWidth: number
  sourceHeight: number
  x: number
  y: number
  width: number
  height: number
}

type ApprovedModalArtwork = {
  src: string
  width: number
  height: number
  closePosition: {
    x: number
    y: number
  }
}

const MODULE_ASPECT_RATIOS: Record<string, number> = {
  cos: 1521 / 828,
  clientes: 1551 / 1014,
  imoveis: 1536 / 1024,
  catalogo: 1223 / 816,
  "studio-ia": 1535 / 1024,
  propostas: 1536 / 1024,
  contratos: 1536 / 1024,
  agenda: 1452 / 941,
  marketplace: 1522 / 1033,
  financeiro: 1538 / 851,
}
const DEFAULT_ASPECT_RATIO = 1480 / 962
const COMPACT_MODAL_QUERY = "(max-width: 1023px)"
const IMAGE_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
const APPROVED_MODAL_ARTWORKS: Record<
  "cos" | "financeiro",
  {
    desktop: ApprovedModalArtwork
    mobile: ApprovedModalArtwork
  }
> = {
  cos: {
    desktop: {
      src: "/modals/cos-desktop-approved.png",
      width: 1521,
      height: 828,
      closePosition: { x: 1472.5, y: 46.5 },
    },
    mobile: {
      src: "/modals/cos-mobile-approved.png",
      width: 862,
      height: 1593,
      closePosition: { x: 808, y: 59.5 },
    },
  },
  financeiro: {
    desktop: {
      src: "/modals/finance-desktop-approved.png",
      width: 1538,
      height: 851,
      closePosition: { x: 1492, y: 47.5 },
    },
    mobile: {
      src: "/modals/finance-mobile-approved.png",
      width: 828,
      height: 1580,
      closePosition: { x: 765.5, y: 62 },
    },
  },
}

const MOBILE_MODULE_ARTWORK_CROPS: Record<string, ModuleImageCrop> = {
  marketplace: { sourceWidth: 1522, sourceHeight: 1033, x: 55, y: 185, width: 860, height: 650 },
  clientes: { sourceWidth: 1551, sourceHeight: 1014, x: 50, y: 95, width: 1175, height: 860 },
  imoveis: { sourceWidth: 1536, sourceHeight: 1024, x: 15, y: 135, width: 930, height: 780 },
  catalogo: { sourceWidth: 1785, sourceHeight: 881, x: 300, y: 185, width: 690, height: 620 },
  "studio-ia": { sourceWidth: 1535, sourceHeight: 1024, x: 480, y: 98, width: 1035, height: 865 },
  propostas: { sourceWidth: 1536, sourceHeight: 1024, x: 325, y: 30, width: 1210, height: 960 },
  contratos: { sourceWidth: 1536, sourceHeight: 1024, x: 520, y: 135, width: 950, height: 570 },
  agenda: { sourceWidth: 1452, sourceHeight: 941, x: 60, y: 145, width: 740, height: 660 },
}

const MOBILE_MODULE_COMPLEMENTS: Partial<Record<string, {
  title: string
  description: string
  icon: EmeModule["icon"]
}>> = {
  marketplace: {
    title: "Segurança e credibilidade",
    description: "Ambiente seguro, verificado e feito para gerar confiança para você e para o seu cliente.",
    icon: ShieldCheck,
  },
  propostas: {
    title: "Cálculo automático de financiamento",
    description: "Simule diferentes cenários de entrada, prazo e taxas para oferecer a melhor opção ao seu cliente com total confiança.",
    icon: Calculator,
  },
  contratos: {
    title: "Mais segurança",
    description: "Contratos revisados, claros e prontos para você fechar negócios com tranquilidade.",
    icon: ShieldCheck,
  },
}

const DESKTOP_MODULE_CROPS: Record<string, ModuleImageCrop> = {
  catalogo: { sourceWidth: 1785, sourceHeight: 881, x: 284, y: 30, width: 1223, height: 816 },
}
const AGENDA_DESKTOP_BENEFITS = [
  "Agendamento rápido de compromissos",
  "Lembretes automáticos para você e o cliente",
  "Sincronização com seu calendário",
  "Acompanhamento claro do que precisa ser feito",
] as const

function CatalogDemoLink({ module, compact = false }: { module: EmeModule; compact?: boolean }) {
  if (module.id !== "catalogo" || !module.demoHref || !module.demoLabel) return null

  return (
    <a
      href={module.demoHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`${panelStyles.catalogCta}${compact ? ` ${panelStyles.catalogCtaMobile}` : ""}`}
    >
      {module.demoLabel}
      <span aria-hidden="true">↗</span>
    </a>
  )
}

function subscribeToCompactModal(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(COMPACT_MODAL_QUERY)
  mediaQuery.addEventListener("change", onStoreChange)
  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

function useCompactModal() {
  return useSyncExternalStore(
    subscribeToCompactModal,
    () => window.matchMedia(COMPACT_MODAL_QUERY).matches,
    () => false,
  )
}

function CroppedModuleImage({
  src,
  alt,
  crop,
  sizes,
  className = "",
  mobileMockup = false,
  fit = "cover",
}: {
  src: string
  alt: string
  crop: ModuleImageCrop
  sizes: string
  className?: string
  mobileMockup?: boolean
  fit?: "cover" | "contain"
}) {
  return (
    <div
      data-mobile-module-mockup={mobileMockup ? "" : undefined}
      className={`eme-module-modal-media relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${crop.width} / ${crop.height}` }}
    >
      <Image
        src={src}
        alt={alt}
        width={crop.sourceWidth}
        height={crop.sourceHeight}
        sizes={sizes}
        quality={88}
        placeholder="blur"
        blurDataURL={IMAGE_PLACEHOLDER}
        className="absolute inset-0 h-full w-full max-w-none"
        style={{
          left: `${-(crop.x / crop.width) * 100}%`,
          top: `${-(crop.y / crop.height) * 100}%`,
          width: `${(crop.sourceWidth / crop.width) * 100}%`,
          height: `${(crop.sourceHeight / crop.height) * 100}%`,
          objectFit: fit,
        }}
      />
    </div>
  )
}

function ApprovedModalArtwork({
  module,
  artwork,
  compact,
}: {
  module: EmeModule
  artwork: ApprovedModalArtwork
  compact: boolean
}) {
  return (
    <Image
      data-approved-modal-artwork={module.id}
      data-cos-approved-artwork={
        module.id === "cos" ? (compact ? "mobile" : "desktop") : undefined
      }
      data-finance-approved-artwork={
        module.id === "financeiro" ? (compact ? "mobile" : "desktop") : undefined
      }
      src={artwork.src}
      alt={`Módulo ${module.name}`}
      width={artwork.width}
      height={artwork.height}
      sizes={compact ? "calc(100vw - 24px)" : "min(1120px, calc(100vw - 64px))"}
      className="block h-auto w-full object-contain"
      unoptimized
    />
  )
}

function DesktopModuleArtwork({ module }: { module: EmeModule }) {
  const crop = DESKTOP_MODULE_CROPS[module.id]

  return (
    <div data-desktop-module-artwork className="eme-module-modal-artwork relative h-full w-full overflow-hidden">
      {crop ? (
        <CroppedModuleImage
          src={module.mockup || "/placeholder.svg"}
          alt={`Módulo ${module.name}`}
          crop={crop}
          sizes="min(92vw, 1350px)"
          className="h-full w-full"
        />
      ) : (
        <Image
          src={module.mockup || "/placeholder.svg"}
          alt={`Módulo ${module.name}`}
          fill
          sizes="min(92vw, 1350px)"
          quality={88}
          placeholder="blur"
          blurDataURL={IMAGE_PLACEHOLDER}
          className="object-cover"
        />
      )}

      {module.id === "marketplace" && module.demoHref ? (
        <a
          href={module.demoHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver exemplo no Marketplace — Abrir demonstração"
          className="absolute bottom-[3.2%] left-[64.1%] h-[10.7%] w-[23.1%] rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme focus-visible:ring-offset-2"
        />
      ) : null}

      <CatalogDemoLink module={module} />
    </div>
  )
}

function AgendaModuleArtwork({ module }: { module: EmeModule }) {
  const ModuleIcon = module.icon
  const mockupCrop = MOBILE_MODULE_ARTWORK_CROPS.agenda

  return (
    <article
      data-agenda-modal-layout
      data-desktop-module-artwork
      className={agendaStyles.layout}
    >
      <div className={agendaStyles.visual}>
        <CroppedModuleImage
          src={module.mockup || "/placeholder.svg"}
          alt={`Prévia visual do módulo ${module.name}`}
          crop={mockupCrop}
          sizes="(min-width: 1024px) 58vw, calc(100vw - 60px)"
          className={agendaStyles.mockup}
          fit="contain"
        />
      </div>

      <div className={agendaStyles.content}>
        <div className={agendaStyles.eyebrow}>
          <span className={agendaStyles.eyebrowIcon} aria-hidden="true">
            <ModuleIcon className="size-5" strokeWidth={1.8} />
          </span>
          <span>{module.name}</span>
        </div>

        <h2 className={agendaStyles.title}>{module.tagline}</h2>
        <p className={agendaStyles.description}>{module.longDescription}</p>

        <ul className={agendaStyles.benefits} aria-label={`Benefícios de ${module.name}`}>
          {AGENDA_DESKTOP_BENEFITS.map((benefit) => (
            <li key={benefit} className={agendaStyles.benefit}>
              <span className={agendaStyles.benefitIcon} aria-hidden="true">
                <Check className="size-3.5" strokeWidth={2.25} />
              </span>
              <span className={agendaStyles.benefitTitle}>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function MobileModuleArtwork({ module }: { module: EmeModule }) {
  const ModuleIcon = module.icon
  const artworkCrop = MOBILE_MODULE_ARTWORK_CROPS[module.id]
  const complement = MOBILE_MODULE_COMPLEMENTS[module.id]
  const ComplementIcon = complement?.icon
  const moduleLabel = module.id === "marketplace"
    ? `${module.name} EME`
    : module.name

  return (
    <article
      data-mobile-module-scroll
      data-mobile-module-layout
      className={`${mobileStyles.layout} eme-hidden-scrollbar`}
    >
      <div data-mobile-module-label className={mobileStyles.eyebrow}>
        <span className={mobileStyles.eyebrowIcon} aria-hidden="true">
          <ModuleIcon className="size-5" strokeWidth={1.7} />
        </span>
        <span>{moduleLabel}</span>
      </div>

      <h2 data-mobile-module-title className={mobileStyles.title}>{module.tagline}</h2>
      <p data-mobile-module-description className={mobileStyles.description}>{module.longDescription}</p>

      {artworkCrop ? (
        <CroppedModuleImage
          src={module.mockup || "/placeholder.svg"}
          alt={`Prévia visual do módulo ${module.name}`}
          crop={artworkCrop}
          sizes="calc(100vw - 60px)"
          className={mobileStyles.mockup}
          mobileMockup
          fit="contain"
        />
      ) : null}

      <ul
        data-mobile-module-benefits
        className={mobileStyles.benefits}
        aria-label={`Benefícios de ${module.name}`}
      >
        {module.benefits.map((benefit) => {
          const title = typeof benefit === "string" ? benefit : benefit.title
          const description = typeof benefit === "string" ? null : benefit.description

          return (
            <li key={title} className={mobileStyles.benefit}>
              <span className={mobileStyles.benefitIcon} aria-hidden="true">
                <Check className="size-3.5" strokeWidth={2.2} />
              </span>
              <span className={mobileStyles.benefitCopy}>
                <span className={mobileStyles.benefitTitle}>{title}</span>
                {description ? (
                  <span className={mobileStyles.benefitDescription}>{description}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>

      <CatalogDemoLink module={module} compact />

      {complement && ComplementIcon ? (
        <div className={mobileStyles.complement} data-mobile-module-complement>
          <span className={mobileStyles.complementIcon} aria-hidden="true">
            <ComplementIcon className="size-8" strokeWidth={1.6} />
          </span>
          <div>
            <p className={mobileStyles.complementTitle}>{complement.title}</p>
            <p className={mobileStyles.complementDescription}>{complement.description}</p>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function ExpandedModulePanel({
  module,
  originEl,
  onClose,
}: {
  module: EmeModule
  originEl: HTMLElement
  onClose: () => void
}) {
  const compact = useCompactModal()
  const aspectRatio = MODULE_ASPECT_RATIOS[module.id] ?? DEFAULT_ASPECT_RATIO
  const isAgenda = module.id === "agenda"
  const approvedModuleId = module.id === "cos" || module.id === "financeiro"
    ? module.id
    : null
  const approvedVariant = compact ? "mobile" : "desktop"
  const approvedArtwork = approvedModuleId
    ? APPROVED_MODAL_ARTWORKS[approvedModuleId][approvedVariant]
    : null
  const modalAspectRatio = isAgenda
    ? undefined
    : approvedArtwork
      ? approvedArtwork.width / approvedArtwork.height
      : aspectRatio
  const imageOnly: {
    variant: "desktop" | "mobile"
    closeXPercent: number
    closeYPercent: number
  } | undefined = approvedArtwork
    ? {
        variant: approvedVariant,
        closeXPercent: (approvedArtwork.closePosition.x / approvedArtwork.width) * 100,
        closeYPercent: (approvedArtwork.closePosition.y / approvedArtwork.height) * 100,
      }
    : undefined

  return (
    <LandingModalShell
      label={module.name}
      moduleId={module.id}
      aspectRatio={modalAspectRatio}
      imageOnly={imageOnly}
      originEl={originEl}
      onClose={onClose}
    >
      {approvedArtwork ? (
        <ApprovedModalArtwork module={module} artwork={approvedArtwork} compact={compact} />
      ) : compact ? (
        <MobileModuleArtwork module={module} />
      ) : isAgenda ? (
        <AgendaModuleArtwork module={module} />
      ) : (
        <DesktopModuleArtwork module={module} />
      )}
    </LandingModalShell>
  )
}
