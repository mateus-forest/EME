"use client"

import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"

type LandingRevealProps = {
  children: ReactNode
  className?: string
  delayMs?: number
}

export function LandingReveal({ children, className = "", delayMs = 0 }: LandingRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    setIsVisible(true)
  }, [])

  return (
    <div
      ref={ref}
      className={`landing-reveal ${isVisible ? "is-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  )
}
