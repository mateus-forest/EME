'use client'

import { AnimatePresence, motion } from 'motion/react'
import {
  Building2,
  CalendarCheck,
  Check,
  FileSignature,
  FileText,
  Film,
  Globe,
  ImageIcon,
  Megaphone,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

type Activity = { icon: LucideIcon; label: string }

const ACTIVITIES: Activity[] = [
  { icon: Building2, label: 'Novo imóvel recebido' },
  { icon: UserPlus, label: 'Cliente registrado' },
  { icon: Megaphone, label: 'Anúncio criado' },
  { icon: ImageIcon, label: 'Imagens geradas' },
  { icon: Film, label: 'Vídeo criado' },
  { icon: Globe, label: 'Catálogo publicado' },
  { icon: CalendarCheck, label: 'Visita agendada' },
  { icon: FileText, label: 'Proposta criada' },
  { icon: FileSignature, label: 'Contrato preparado' },
]

const easeOut = [0.16, 1, 0.3, 1] as const

/** A never-idle activity feed — the EME visibly working on its own. */
export function LiveMockup({ className = '' }: { className?: string }) {
  const [feed, setFeed] = useState<{ id: number; item: Activity }[]>([])
  const [count, setCount] = useState(0)

  useEffect(() => {
    let id = 0
    let index = 0
    const push = () => {
      const item = ACTIVITIES[index % ACTIVITIES.length]
      index += 1
      id += 1
      setFeed((prev) => [{ id, item }, ...prev].slice(0, 5))
      setCount((c) => c + 1)
    }
    push()
    const timer = setInterval(push, 3400)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      className={`w-full overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_50px_140px_-50px_rgba(20,120,60,0.45)] ${className}`}
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <span className="h-6 w-6 rounded-lg bg-brand-gradient" />
        <div className="leading-tight">
          <p className="text-sm font-medium tracking-tight">COS</p>
          <p className="text-[11px] text-muted-foreground">Operando o seu dia</p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-brand/25 bg-brand/5 px-3 py-1 text-xs text-brand">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          Ativo
        </div>
      </div>

      {/* feed */}
      <div className="px-5 py-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Atividades recentes
          </p>
          <AnimatePresence mode="wait">
            <motion.span
              key={count}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.3 }}
              className="text-xs tabular-nums text-brand"
            >
              {count} tarefas
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {feed.map(({ id, item }, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, y: -12, filter: 'blur(8px)', scale: 0.98 }}
                  animate={{
                    opacity: i === 0 ? 1 : 0.55 - i * 0.08,
                    y: 0,
                    filter: 'blur(0px)',
                    scale: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
                  transition={{ duration: 0.8, ease: easeOut }}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="text-sm text-foreground">{item.label}</span>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.55, ease: easeOut }}
                    className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand/15 text-brand"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
