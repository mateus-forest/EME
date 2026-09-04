"use client"

import { useSyncExternalStore } from "react"
import Image from "next/image"
import { Check } from "lucide-react"

import { LandingModalShell } from "@/components/eme/landing-modal-shell"
import type { EmeModule } from "@/lib/eme-modules"

type ModuleImageCrop = {
  sourceWidth: number
  sourceHeight: number
  x: number
  y: number
  width: number
  height: number
}

const MODULE_ASPECT_RATIOS: Record<string, number> = {
  cos: 1408 / 833,
  clientes: 1551 / 1014,
  imoveis: 1536 / 1024,
  catalogo: 1223 / 816,
  "studio-ia": 1535 / 1024,
  propostas: 1536 / 1024,
  contratos: 1536 / 1024,
  agenda: 1452 / 941,
  marketplace: 1522 / 1033,
  financeiro: 1077 / 846,
}
const DEFAULT_ASPECT_RATIO = 1480 / 962
const COMPACT_MODAL_QUERY = "(max-width: 1023px)"
const IMAGE_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="

const MOBILE_MODULE_BANNERS: Record<string, string> = {
  cos: "/eme/mobile-modals/cos.png",
  agenda: "/eme/mobile-modals/agenda.png",
  marketplace: "/eme/mobile-modals/marketplace.png",
  contratos: "/eme/mobile-modals/contratos.png",
  propostas: "/eme/mobile-modals/propostas.png",
  "studio-ia": "/eme/mobile-modals/studio-ia.png",
  catalogo: "/eme/mobile-modals/catalogo.png",
  imoveis: "/eme/mobile-modals/imoveis.png",
  clientes: "/eme/mobile-modals/clientes.png",
}

const MOBILE_MODULE_CROPS: Record<string, ModuleImageCrop> = {
  agenda: { sourceWidth: 941, sourceHeight: 1672, x: 57, y: 56, width: 826, height: 1582 },
  cos: { sourceWidth: 941, sourceHeight: 1672, x: 83, y: 48, width: 773, height: 1576 },
}

const MOBILE_MODULE_MOCKUP_CROPS: Record<string, ModuleImageCrop> = {
  financeiro: { sourceWidth: 1672, sourceHeight: 941, x: 315, y: 165, width: 635, height: 525 },
}

const DESKTOP_MODULE_CROPS: Record<string, ModuleImageCrop> = {
  cos: { sourceWidth: 1672, sourceHeight: 941, x: 129, y: 51, width: 1408, height: 833 },
  catalogo: { sourceWidth: 1785, sourceHeight: 881, x: 284, y: 30, width: 1223, height: 816 },
  financeiro: { sourceWidth: 1672, sourceHeight: 941, x: 312, y: 49, width: 1077, height: 846 },
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
}: {
  src: string
  alt: string
  crop: ModuleImageCrop
  sizes: string
  className?: string
}) {
  return (
    <div
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
          objectFit: "cover",
        }}
      />
    </div>
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
    </div>
  )
}

function MobileModuleArtwork({ module }: { module: EmeModule }) {
  const mobileBanner = MOBILE_MODULE_BANNERS[module.id]
  const mobileCrop = MOBILE_MODULE_CROPS[module.id]
  const mobileMockupCrop = MOBILE_MODULE_MOCKUP_CROPS[module.id]

  if (mobileBanner) {
    return (
      <div
        data-mobile-module-scroll
        className="eme-module-modal-scroll eme-hidden-scrollbar h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        <CroppedModuleImage
          src={mobileBanner}
          alt={`Apresentação do módulo ${module.name}`}
          crop={mobileCrop || { sourceWidth: 941, sourceHeight: 1672, x: 0, y: 0, width: 941, height: 1672 }}
          sizes="calc(100vw - 16px)"
          className="w-full"
        />
      </div>
    )
  }

  const ModuleIcon = module.icon
  return (
    <div
      data-mobile-module-scroll
      className="eme-module-modal-scroll eme-hidden-scrollbar h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-contain px-5"
      style={{
        paddingTop: "max(4.75rem, calc(env(safe-area-inset-top) + 3.5rem))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex items-center gap-2.5 text-eme-dark">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-eme/10">
          <ModuleIcon className="size-5 text-eme" strokeWidth={1.7} aria-hidden />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">{module.name}</span>
      </div>

      <h2 className="mt-5 text-balance text-[27px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground">
        {module.tagline}
      </h2>
      <p className="mt-3 text-pretty text-[14px] leading-relaxed text-foreground/68">
        {module.longDescription}
      </p>

      <div
        data-mobile-module-mockup
        className="eme-module-modal-media relative mt-5 w-full shrink-0 overflow-hidden rounded-[22px] border border-foreground/8 bg-[#f6f3ef] p-2"
        style={{
          aspectRatio: mobileMockupCrop
            ? `${mobileMockupCrop.width} / ${mobileMockupCrop.height}`
            : MODULE_ASPECT_RATIOS[module.id] ?? DEFAULT_ASPECT_RATIO,
        }}
      >
        {mobileMockupCrop ? (
          <CroppedModuleImage
            src={module.mockup || "/placeholder.svg"}
            alt={`Prévia visual do módulo ${module.name}`}
            crop={mobileMockupCrop}
            sizes="calc(100vw - 58px)"
            className="absolute inset-2 rounded-[16px]"
          />
        ) : (
          <Image
            src={module.mockup || "/placeholder.svg"}
            alt={`Prévia visual do módulo ${module.name}`}
            fill
            sizes="calc(100vw - 58px)"
            quality={88}
            placeholder="blur"
            blurDataURL={IMAGE_PLACEHOLDER}
            className="object-cover p-2"
          />
        )}
      </div>

      <ul className="mt-5 grid gap-3" aria-label={`Benefícios de ${module.name}`}>
        {module.benefits.map((benefit) => {
          const title = typeof benefit === "string" ? benefit : benefit.title
          const description = typeof benefit === "string" ? null : benefit.description

          return (
            <li key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-eme/12 text-eme-dark">
                <Check className="size-3.5" strokeWidth={2.2} aria-hidden />
              </span>
              <span className="min-w-0 text-[13px] leading-snug text-foreground/82">
                <span className="font-medium">{title}</span>
                {description ? (
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-foreground/55">
                    {description}
                  </span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
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

  return (
    <LandingModalShell
      label={module.name}
      moduleId={module.id}
      aspectRatio={aspectRatio}
      originEl={originEl}
      onClose={onClose}
    >
      {compact ? <MobileModuleArtwork module={module} /> : <DesktopModuleArtwork module={module} />}
    </LandingModalShell>
  )
}
