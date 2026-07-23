'use client'

import { motion, useScroll, useMotionValueEvent } from 'motion/react'
import Image from 'next/image'
import { useState } from 'react'

export function SiteNav() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 24)
  })

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <div
        className={`flex w-full max-w-6xl items-center justify-between rounded-full px-4 py-2.5 transition-all duration-500 sm:px-5 ${
          scrolled
            ? 'border border-border/60 bg-background/70 backdrop-blur-xl'
            : 'border border-transparent'
        }`}
      >
        <a href="#top" className="flex items-center gap-2" aria-label="EME — página inicial">
          <Image
            src="/eme-logo.png"
            alt="EME"
            width={92}
            height={40}
            priority
            className="h-7 w-auto"
          />
        </a>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#sistema" className="transition-colors hover:text-foreground">
            Sistema
          </a>
          <a href="#studio" className="transition-colors hover:text-foreground">
            Studio IA
          </a>
          <a href="#propostas" className="transition-colors hover:text-foreground">
            Propostas
          </a>
          <a href="#experimente" className="transition-colors hover:text-foreground">
            Experimente
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Entrar
          </a>
          <a
            href="/cadastro"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform duration-300 hover:scale-[1.03]"
          >
            Testar grátis
          </a>
        </div>
      </div>
    </motion.header>
  )
}
