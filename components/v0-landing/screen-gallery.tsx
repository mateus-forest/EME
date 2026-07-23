'use client'

import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import Image from 'next/image'
import { useRef } from 'react'
import { BrowserFrame } from './frame'
import { ProposalList } from './proposal-list'

const SPRING = { stiffness: 90, damping: 30, restDelta: 0.0004 } as const

const SCREENS = [
  { src: '/screens/cos.png', w: 1905, h: 867, name: 'COS', desc: 'Seu centro de operações' },
  { src: '/screens/clientes.png', w: 1452, h: 680, name: 'Clientes', desc: 'CRM que não perde ninguém' },
  { src: '/screens/novo-imovel.png', w: 1490, h: 506, name: 'Imóveis', desc: 'Do rascunho ao anúncio' },
  { src: '/screens/studio.png', w: 1492, h: 760, name: 'Studio IA', desc: 'Conteúdo em segundos' },
  { src: '/screens/propostas.png', w: 1475, h: 815, name: 'Propostas', desc: 'Preenchidas pelo próprio EME' },
  { src: '/screens/catalogo-gestao.png', w: 853, h: 773, name: 'Catálogo', desc: 'Sua vitrine profissional' },
]

const easeOut = [0.16, 1, 0.3, 1] as const

function Panel({ screen, index, progress, total }: {
  screen: (typeof SCREENS)[number]
  index: number
  progress: import('motion/react').MotionValue<number>
  total: number
}) {
  // Each panel owns a slice of scroll: it glides in, rests centered for a long
  // hold, then glides out — leaving generous whitespace around the interface.
  const slice = 1 / total
  const start = index * slice
  const enterEnd = start + slice * 0.26
  const holdEnd = start + slice * 0.74
  const end = start + slice

  const x = useTransform(progress, [start, enterEnd, holdEnd, end], ['56%', '0%', '0%', '-56%'])
  const opacity = useTransform(progress, [start, start + slice * 0.16, end - slice * 0.16, end], [0, 1, 1, 0])
  const scale = useTransform(progress, [start, enterEnd, holdEnd, end], [0.94, 1, 1, 0.94])
  const blur = useTransform(progress, [start, enterEnd, holdEnd, end], ['blur(14px)', 'blur(0px)', 'blur(0px)', 'blur(14px)'])

  return (
    <motion.div
      style={{ x, opacity, scale, filter: blur }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6"
    >
      <div className="mb-6 flex items-baseline gap-3">
        <span className="text-lg font-semibold tracking-tight text-brand">{screen.name}</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">{screen.desc}</span>
      </div>
      <BrowserFrame className="w-fit">
        <div className="relative w-fit">
          <Image
            src={screen.src || '/placeholder.svg'}
            alt={`Tela ${screen.name} do EME`}
            width={screen.w}
            height={screen.h}
            sizes="(max-width: 768px) 92vw, 1000px"
            className="block h-auto w-auto max-h-[54vh] max-w-[min(92vw,64rem)] [filter:contrast(1.03)_saturate(1.02)]"
            priority={index === 0}
          />
          {screen.name === 'Propostas' && (
            <div className="@container absolute inset-0">
              <ProposalList />
            </div>
          )}
        </div>
      </BrowserFrame>
    </motion.div>
  )
}

export function ScreenGallery() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  const smooth = useSpring(scrollYProgress, SPRING)

  return (
      <section ref={ref} id="sistema" className="relative h-[960vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pt-24">
        {/* section title */}
        <div className="mx-auto w-full max-w-6xl shrink-0 px-6 sm:px-10">
          <motion.h2
            initial={{ opacity: 0, y: 30, filter: 'blur(12px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.4, ease: easeOut }}
            className="max-w-3xl text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl"
          >
            O sistema inteiro trabalha por você.
          </motion.h2>
        </div>

        {/* sliding windows */}
        <div className="relative mt-6 flex-1">
          {SCREENS.map((s, i) => (
            <Panel key={s.name} screen={s} index={i} progress={smooth} total={SCREENS.length} />
          ))}
        </div>
      </div>
    </section>
  )
}
