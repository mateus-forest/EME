'use client'

import { AnimatePresence, motion, useScroll, useSpring, useMotionValueEvent, useTransform } from 'motion/react'
import { useRef, useState } from 'react'
import { LiveMockup } from './live-mockup'

const WORDS = ['cria.', 'organiza.', 'publica.', 'acompanha.', 'fecha.']
const easeOut = [0.16, 1, 0.3, 1] as const
// Shared inertial smoothing for all scroll-driven motion — glides and settles
// instead of snapping 1:1 with the wheel.
const SPRING = { stiffness: 90, damping: 30, restDelta: 0.0004 } as const

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  const smooth = useSpring(scrollYProgress, SPRING)

  // -1 = second line hidden; 0..4 = active word index.
  const [index, setIndex] = useState(-1)

  useMotionValueEvent(smooth, 'change', (p) => {
    if (p < 0.1) return setIndex(-1)
    const stage = Math.min(WORDS.length - 1, Math.floor((p - 0.1) / 0.16))
    setIndex(stage)
  })

  const hintOpacity = useTransform(smooth, [0, 0.06], [1, 0])
  const mockOpacity = useTransform(smooth, [0, 0.06, 0.92, 1], [1, 1, 1, 0])
  const mockY = useTransform(smooth, [0, 1], [0, -60])

  return (
    <section ref={ref} id="top" className="relative h-[560vh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-6 sm:px-10 lg:grid-cols-[1.05fr_0.95fr]">
          {/* headline */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.25, ease: easeOut, delay: 0.3 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-xs text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Sistema operacional do corretor
            </motion.p>

            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              <motion.span
                initial={{ opacity: 0, y: 24, filter: 'blur(14px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.5, ease: easeOut }}
                className="block"
              >
                Enquanto você vende,
              </motion.span>

              <span className="mt-1 flex flex-wrap items-baseline gap-x-4">
                <AnimatePresence>
                  {index >= 0 && (
                    <motion.span
                      key="prefix"
                      initial={{ opacity: 0, y: 20, filter: 'blur(12px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ duration: 1.15, ease: easeOut }}
                      className="block text-foreground"
                    >
                      o EME
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* swapping word */}
                <span className="relative inline-block min-w-[5ch]">
                  <AnimatePresence mode="wait">
                    {index >= 0 && (
                      <motion.span
                        key={WORDS[index]}
                        initial={{ opacity: 0, y: 26, filter: 'blur(14px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -26, filter: 'blur(14px)' }}
                        transition={{ duration: 0.8, ease: easeOut }}
                        className="block text-brand-gradient"
                      >
                        {WORDS[index]}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.4, ease: easeOut, delay: 0.7 }}
              className="mt-8 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              Uma inteligência trabalhando ao seu lado — do primeiro contato ao contrato assinado.
            </motion.p>

            <motion.div
              style={{ opacity: hintOpacity }}
              className="mt-10 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <motion.span
                aria-hidden
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="text-brand"
              >
                ↓
              </motion.span>
              Role para ver o EME trabalhar
            </motion.div>
          </div>

          {/* living mockup */}
          <motion.div style={{ opacity: mockOpacity, y: mockY }} className="lg:pl-6">
            <LiveMockup />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
