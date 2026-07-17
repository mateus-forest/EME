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
        "flex h-full flex-col justify-between overflow-hidden rounded-[1.6rem] border border-black/[0.06] bg-[linear-gradient(180deg,#fffefc,#f8f6f1)] text-left shadow-[0_18px_36px_rgba(15,23,42,0.08)]",
        interactive &&
          "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-[#009b3a]/18 hover:shadow-[0_24px_50px_rgba(15,23,42,0.12)] focus:outline-none focus:ring-2 focus:ring-[#009b3a]/20",
        className,
      )}
    >
      <div className="relative aspect-[4/3] max-h-[220px] min-h-0 w-full shrink-0 overflow-hidden bg-[#f3f4ee]">
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
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/55 to-transparent" />

        {(badges || imageActions) && (
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-col gap-1.5">{badges}</div>
            {imageActions ? <div className="shrink-0">{imageActions}</div> : null}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[1.35rem] font-semibold tracking-tight text-[#111111] sm:text-2xl">{price}</p>
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col gap-4 p-4", contentClassName)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-[#111111]">{title}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-[#6b7280]">
              <MapPin className="size-4 shrink-0 text-[#009b3a]" />
              <span className="truncate">{location}</span>
            </p>
          </div>

          {status ? <PropertyStatusBadge status={status} tone={statusTone} /> : null}
        </div>

        <div className="flex flex-wrap gap-2.5 text-sm text-[#5f6b7a]">
          <PropertySpec icon={Bed} value={bedrooms} />
          <PropertySpec icon={Bath} value={bathrooms} />
          <PropertySpec icon={Car} value={parking} />
        </div>

        {metrics?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-3 py-2.5"
              >
                <p className="text-xs text-[#8b95a1]">{metric.label}</p>
                <p className="mt-1.5 text-sm font-semibold text-[#111111]">{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {meta}
        {footer ? <div className="mt-auto">{footer}</div> : null}
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1.5">
      <Icon className="size-4 text-[#009b3a]" />
      <span>{value}</span>
    </span>
  )
}

function PropertyImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#f3f4ee] px-4 text-center">
      <Building2 className="size-9 text-[#94a3b8]" />
      <p className="mt-3 text-sm font-medium text-[#6b7280]">Sem imagem cadastrada</p>
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
      ? "border-[#009b3a]/20 bg-[#eef9f1] text-[#009b3a]"
      : tone === "draft"
        ? "border-[#f2d48f]/30 bg-[#fff8e8] text-[#a16207]"
        : "border-black/[0.06] bg-[#f8faf8] text-[#5f6b7a]"

  return (
    <span className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", toneClassName)}>
      {status}
    </span>
  )
}
