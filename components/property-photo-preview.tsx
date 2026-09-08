"use client"

import { useState } from "react"
import { describePropertyImage } from "@/lib/property-image-requirements"

// Read the original, not a resized Next image: dimensions must match publication validation.
export function PropertyPhotoPreview({ src, index }: { src: string; index: number }) {
  const [details, setDetails] = useState<ReturnType<typeof describePropertyImage> | null>(null)
  const [failed, setFailed] = useState(false)

  return (
    <figure className="min-w-0" data-testid={`property-photo-${index + 1}`}>
      <div className="aspect-[4/3] w-full bg-[#f3f5f2] sm:max-h-36">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Foto ${index + 1}${index === 0 ? " · capa atual" : ""}`}
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          onLoad={(event) => setDetails(describePropertyImage(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight))}
          onError={() => setFailed(true)}
        />
      </div>
      <figcaption className="grid gap-1 px-3 pb-12 pt-2 text-xs leading-5 text-[#475467]" aria-live="polite">
        <span className="font-medium">Foto {index + 1}{index === 0 ? " · capa atual" : ""}</span>
        {failed ? <span>Não foi possível carregar a foto. Reenvie o original se o problema persistir.</span> : details ? (
          <>
            <span>{details.dimensions}</span>
            <span className={details.coverEligible ? "text-[#008633]" : "text-amber-800"}>{details.status}</span>
          </>
        ) : <span>Conferindo dimensões do original…</span>}
      </figcaption>
    </figure>
  )
}
