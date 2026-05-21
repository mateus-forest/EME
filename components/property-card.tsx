"use client"

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react"
import { Bath, Bed, Building2, Car, MapPin } from "lucide-react"

import { getPropertyImage } from "@/lib/property-media"
import { cn } from "@/lib/utils"

type PropertyMetric = {
  label: string
  value: string | number
}

type PropertyCardProps = {
  title: string
  location: string
  price: string
  bedrooms: number
  bathrooms: number
  parking: number
  image?: string | null
  imageSeed?: string | number
  status?: string
  statusTone?: "published" | "draft" | "paused"
  badges?: ReactNode
  imageActions?: ReactNode
  metrics?: PropertyMetric[]
  meta?: ReactNode
  footer?: ReactNode
  onClick?: () => void
  className?: string
  contentClassName?: string
}

export function PropertyCard({
  title,
  location,
  price,
  bedrooms,
  bathrooms,
  parking,
  image,
  imageSeed = 0,
  status,
  statusTone = "published",
  badges,
  imageActions,
  metrics,
  meta,
  footer,
  onClick,
  className,
  contentClassName,
}: PropertyCardProps) {
  const initialImage = useMemo(() => getPropertyImage(image, imageSeed), [image, imageSeed])
  const [currentImage, setCurrentImage] = useState(initialImage)
  const interactive = Boolean(onClick)

  useEffect(() => {
    setCurrentImage(initialImage)
  }, [initialImage])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onClick) return

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <article
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(14,14,14,0.94))] text-left shadow-[0_18px_36px_rgba(0,0,0,0.16)]",
        interactive &&
          "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-[#00C853]/16 hover:shadow-[0_24px_50px_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-[#00C853]/30",
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-white/[0.03]">
        {currentImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImage}
            alt={title}
            className="h-full w-full object-cover"
            onError={() => setCurrentImage("")}
          />
        ) : (
          <PropertyImagePlaceholder />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        {(badges || imageActions) && (
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-col gap-1.5">{badges}</div>
            {imageActions ? <div className="shrink-0">{imageActions}</div> : null}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[1.35rem] font-semibold tracking-tight text-white sm:text-2xl">{price}</p>
        </div>
      </div>

      <div className={cn("grid gap-4 p-4", contentClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-white/50">
              <MapPin className="size-4 shrink-0 text-[#69F0AE]" />
              <span className="truncate">{location}</span>
            </p>
          </div>

          {status ? <PropertyStatusBadge status={status} tone={statusTone} /> : null}
        </div>

        <div className="flex flex-wrap gap-2.5 text-sm text-white/65">
          <PropertySpec icon={Bed} value={bedrooms} />
          <PropertySpec icon={Bath} value={bathrooms} />
          <PropertySpec icon={Car} value={parking} />
        </div>

        {metrics?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[1rem] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-xs text-white/40">{metric.label}</p>
                <p className="mt-1.5 text-sm font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {meta}
        {footer}
      </div>
    </article>
  )
}

function PropertySpec({
  icon: Icon,
  value,
}: {
  icon: typeof Bed
  value: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
      <Icon className="size-4 text-[#69F0AE]" />
      <span>{value}</span>
    </span>
  )
}

function PropertyImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white/[0.03] px-4 text-center">
      <Building2 className="size-9 text-white/30" />
      <p className="mt-3 text-sm font-medium text-white/65">Sem imagem cadastrada</p>
    </div>
  )
}

function PropertyStatusBadge({
  status,
  tone,
}: {
  status: string
  tone: "published" | "draft" | "paused"
}) {
  const toneClassName =
    tone === "published"
      ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"
      : tone === "draft"
        ? "border-[#ffd54f]/20 bg-[#ffd54f]/10 text-[#ffe082]"
        : "border-white/[0.08] bg-white/[0.05] text-white/65"

  return (
    <span className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", toneClassName)}>
      {status}
    </span>
  )
}
