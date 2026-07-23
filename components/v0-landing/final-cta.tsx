'use client'

import { motion } from 'motion/react'
import Image from 'next/image'

const easeOut = [0.16, 1, 0.3, 1] as const

export function FinalCta() {
  return (
    <section className="flex min-h-[90svh] flex-col items-center justify-center px-6 py-32 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 30, filter: 'blur(14px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1.2, ease: easeOut }}
        className="max-w-4xl text-balance text-5xl font-semibold leading-[1] tracking-[-0.03em] sm:text-7xl lg:text-8xl"
      >
        Seu próximo imóvel pode começar a{' '}
        <span className="text-brand-gradient">vender hoje.</span>
      </motion.h2>

      <motion.a
        href="#experimente"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1, ease: easeOut, delay: 0.2 }}
        className="mt-12 rounded-full bg-primary px-8 py-4 text-base font-medium text-primary-foreground transition-transform duration-300 hover:scale-[1.04]"
      >
        Começar gratuitamente
      </motion.a>

      <footer className="mt-32 flex w-full max-w-6xl flex-col items-center gap-6 border-t border-border/60 pt-10 sm:flex-row sm:justify-between">
        <Image src="/eme-logo.png" alt="EME" width={84} height={36} className="h-7 w-auto" />
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} EME — Inteligência para corretores de imóveis.
        </p>
      </footer>
    </section>
  )
}
