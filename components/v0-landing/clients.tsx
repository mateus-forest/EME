'use client'

import { AnimatePresence, motion } from 'motion/react'
import { CalendarCheck, FileText, MessageCircle, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { BrowserFrame } from './frame'
import { Reveal } from './reveal'

const NOTES: { icon: LucideIcon; label: string }[] = [
  { icon: UserPlus, label: 'Novo lead' },
  { icon: CalendarCheck, label: 'Retorno hoje' },
  { icon: MessageCircle, label: 'Visita marcada' },
  { icon: FileText, label: 'Proposta enviada' },
]

const easeOut = [0.16, 1, 0.3, 1] as const

export function Clients() {
  const [notes, setNotes] = useState<{ id: number; i: number }[]>([])

  useEffect(() => {
    let id = 0
    let i = 0
    const push = () => {
      id += 1
      const cur = i % NOTES.length
      i += 1
      setNotes((prev) => [{ id, i: cur }, ...prev].slice(0, 3))
    }
    const t = setInterval(push, 3800)
    push()
    return () => clearInterval(t)
  }, [])

  return (
    <section id="clientes" className="px-6 py-28 sm:px-10 sm:py-40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="mb-4 text-sm font-medium tracking-tight text-brand">Clientes</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Nenhum cliente perdido.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
              Contatos quentes, retornos e visitas — priorizados sozinhos. O EME avisa você
              no momento certo.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="relative lg:pl-4">
          <BrowserFrame label="app.eme.com/clientes">
            <div className="relative aspect-[16/11] w-full bg-secondary/30">
              <Image
                src="/screens/clientes.png"
                alt="Tela de CRM de clientes do EME"
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-contain object-top"
              />
            </div>
          </BrowserFrame>

          {/* discreet floating notifications */}
          <div className="pointer-events-none absolute -right-2 top-6 flex w-52 flex-col gap-2 sm:-right-4">
            <AnimatePresence initial={false} mode="popLayout">
              {notes.map(({ id, i }) => {
                const Icon = NOTES[i].icon
                return (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, x: 24, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: 24, filter: 'blur(8px)' }}
                    transition={{ duration: 0.85, ease: easeOut }}
                    className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card/95 px-3.5 py-2.5 shadow-[0_20px_50px_-30px_rgba(20,120,60,0.5)] backdrop-blur"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="text-sm text-foreground">{NOTES[i].label}</span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
