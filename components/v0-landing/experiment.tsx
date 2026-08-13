'use client'

import { Spinner } from '@/components/ui/spinner'

import { AnimatePresence, motion } from 'motion/react'
import { ArrowUp, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Reveal } from './reveal'

const SUGGESTIONS = [
  'Criar anúncio',
  'Criar vídeo',
  'Criar catálogo',
  'Conversar com o COS',
  'Criar campanha',
]

const GEN_STEPS = [
  'Entendendo o imóvel',
  'Escrevendo o anúncio',
  'Gerando as imagens',
  'Montando o material',
]

const easeOut = [0.16, 1, 0.3, 1] as const

export function Experiment() {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle')
  const [step, setStep] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const start = () => {
    if (!value.trim() || status === 'generating') return
    setStatus('generating')
    setStep(0)
    timers.current.forEach(clearTimeout)
    timers.current = GEN_STEPS.map((_, i) =>
      setTimeout(() => setStep(i + 1), (i + 1) * 1300),
    )
    timers.current.push(setTimeout(() => setStatus('done'), (GEN_STEPS.length + 1) * 1300))
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const reset = () => {
    setStatus('idle')
    setStep(0)
    setValue('')
  }

  return (
    <section id="experimente" className="px-6 py-28 sm:py-40">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="text-sm font-medium tracking-tight text-brand">Experimente o EME</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">
            Descreva um imóvel. Veja o EME trabalhar.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12">
            <div className="relative rounded-3xl border border-border/70 bg-card p-2 shadow-[0_30px_90px_-40px_rgba(20,120,60,0.3)] transition-colors focus-within:border-brand/50">
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing &&
                    e.keyCode !== 229
                  ) {
                    e.preventDefault()
                    start()
                  }
                }}
                rows={2}
                placeholder="Descreva seu imóvel..."
                disabled={status === 'generating'}
                className="w-full resize-none bg-transparent px-4 py-3 text-left text-lg leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60"
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="pl-2 text-xs text-muted-foreground">
                  Enter para gerar
                </span>
                <button
                  onClick={start}
                  disabled={!value.trim() || status === 'generating'}
                  aria-label="Gerar conteúdo"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 enabled:hover:scale-105 disabled:opacity-40"
                >
                  {status === 'generating' ? (
                    <Spinner className="size-4" />
                  ) : (
                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>

            {/* suggestions */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setValue(s + ' para ')}
                  className="rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* generation output */}
            <AnimatePresence mode="wait">
              {status !== 'idle' && (
                <motion.div
                  key={status}
                  initial={{ opacity: 0, y: 16, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 1, ease: easeOut }}
                  className="mt-8 rounded-3xl border border-border/60 bg-card p-6 text-left"
                >
                  {status === 'generating' ? (
                    <div className="space-y-3">
                      {GEN_STEPS.map((label, i) => {
                        if (step < i) return null
                        const done = step > i
                        return (
                          <motion.div
                            key={label}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, ease: easeOut }}
                            className="flex items-center gap-3 text-sm"
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                done ? 'bg-brand/15 text-brand' : 'text-muted-foreground'
                              }`}
                            >
                              {done ? (
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              ) : (
                                <Spinner className="size-3.5" />
                              )}
                            </span>
                            <span className={done ? 'text-foreground' : 'text-muted-foreground'}>
                              {label}
                            </span>
                          </motion.div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-brand">
                        <Check className="h-4 w-4" strokeWidth={3} /> Conteúdo pronto
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {['Anúncio', 'Vídeo', 'Catálogo'].map((t) => (
                          <div
                            key={t}
                            className="rounded-2xl border border-border/60 bg-secondary/50 p-4"
                          >
                            <p className="text-sm font-medium">{t}</p>
                            <div className="mt-3 space-y-1.5">
                              <span className="block h-2 w-full rounded-full bg-muted-foreground/15" />
                              <span className="block h-2 w-4/5 rounded-full bg-muted-foreground/15" />
                              <span className="block h-2 w-2/3 rounded-full bg-muted-foreground/15" />
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={reset}
                        className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        Gerar outro
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
