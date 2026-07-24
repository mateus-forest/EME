"use client"

import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

type EmeLoaderMarkProps = {
  className?: string
  imageClassName?: string
}

export function EmeLoaderMark({ className, imageClassName }: EmeLoaderMarkProps) {
  const [useFallback, setUseFallback] = useState(false)

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,_rgba(35,145,82,0.14)_0%,_rgba(35,145,82,0.04)_48%,_transparent_78%)] blur-2xl" />
      <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.98)_0%,_rgba(242,248,244,0.76)_56%,_rgba(242,248,244,0)_100%)]" />
      <div className="absolute inset-x-[18%] bottom-[5%] h-[18%] rounded-full bg-[rgba(22,40,29,0.12)] blur-[18px]" />

      <div className="eme-logo-3d-spin relative w-full max-w-full [transform-style:preserve-3d] motion-reduce:animate-none">
        {useFallback ? (
          <Image
            src="/images/eme-logo-official.png"
            alt="EME"
            width={320}
            height={182}
            priority
            className={cn("h-auto w-full object-contain drop-shadow-[0_16px_32px_rgba(14,34,24,0.12)]", imageClassName)}
          />
        ) : (
          <img
            src="/eme-logo-3d.svg"
            alt="EME"
            loading="eager"
            fetchPriority="high"
            onError={() => setUseFallback(true)}
            className={cn("h-auto w-full object-contain drop-shadow-[0_18px_32px_rgba(14,34,24,0.14)]", imageClassName)}
          />
        )}
      </div>
    </div>
  )
}
