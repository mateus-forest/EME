'use client'

import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import Image from 'next/image'
import { useRef } from 'react'
import { BrowserFrame } from './frame'

const SPRING = { stiffness: 90, damping: 30, restDelta: 0.0004 } as const

export function Catalog() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  const smooth = useSpring(scrollYProgress, SPRING)

  // The edit screen recedes early, the public catalog rises and locks into
  // full sharpness, then holds crystal-clear for the vast majority of the
  // scroll so the visitor can truly appreciate it. Only in the very last
  // stretch does an extremely soft blur begin, preparing the next transition.
  const mgmtOpacity = useTransform(smooth, [0.2, 0.32], [1, 0])
  const mgmtY = useTransform(smooth, [0.2, 0.32], ['0%', '-8%'])
  const mgmtScale = useTransform(smooth, [0.2, 0.32], [1, 0.94])
  const mgmtBlur = useTransform(smooth, [0.2, 0.32], ['blur(0px)', 'blur(14px)'])

  // Public catalog: fully sharp by 0.42, holds sharp until 0.9, faint blur at end.
  const pubOpacity = useTransform(smooth, [0.3, 0.42], [0, 1])
  const pubY = useTransform(smooth, [0.3, 0.42], ['6%', '0%'])
  const pubScale = useTransform(smooth, [0.3, 0.42], [1.04, 1])
  const pubBlur = useTransform(smooth, [0.3, 0.42, 0.9, 1], ['blur(16px)', 'blur(0px)', 'blur(0px)', 'blur(5px)'])

  // Title 1 rises out first; title 2 enters after, then stays sharp until the very end.
  const t1Opacity = useTransform(smooth, [0.18, 0.3], [1, 0])
  const t1Y = useTransform(smooth, [0.18, 0.3], ['0%', '-120%'])
  const t1Blur = useTransform(smooth, [0.18, 0.3], ['blur(0px)', 'blur(10px)'])

  const t2Opacity = useTransform(smooth, [0.3, 0.42], [0, 1])
  const t2Y = useTransform(smooth, [0.3, 0.42], ['120%', '0%'])
  const t2Blur = useTransform(smooth, [0.3, 0.42, 0.92, 1], ['blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(4px)'])

  return (
    <section ref={ref} id="catalogo" className="relative h-[620vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden px-6 pt-24 sm:px-10">
        <div className="mx-auto w-full max-w-6xl shrink-0 text-center">
          <p className="mb-4 text-sm font-medium tracking-tight text-brand">Catálogo</p>
          <h2 className="relative mx-auto flex h-[1.15em] max-w-3xl items-center justify-center overflow-hidden text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            <motion.span
              style={{ opacity: t1Opacity, y: t1Y, filter: t1Blur }}
              className="absolute inset-x-0 block"
            >
              Você publica.
            </motion.span>
            <motion.span
              style={{ opacity: t2Opacity, y: t2Y, filter: t2Blur }}
              className="absolute inset-x-0 block text-brand-gradient"
            >
              O mundo vê.
            </motion.span>
          </h2>
        </div>

        <div className="relative mx-auto mt-8 flex w-full max-w-5xl flex-1 items-center justify-center">
          <motion.div
            style={{ opacity: mgmtOpacity, y: mgmtY, scale: mgmtScale, filter: mgmtBlur }}
            className="absolute flex w-full items-center justify-center"
          >
            <BrowserFrame className="w-fit">
              <Image
                src="/screens/catalogo-gestao.png"
                alt="Gestão do catálogo do corretor"
                width={853}
                height={773}
                sizes="(max-width: 768px) 90vw, 620px"
                className="block h-auto w-auto max-h-[58vh] max-w-[min(90vw,40rem)] [filter:contrast(1.03)_saturate(1.02)]"
              />
            </BrowserFrame>
          </motion.div>

          <motion.div
            style={{ opacity: pubOpacity, y: pubY, scale: pubScale, filter: pubBlur }}
            className="absolute flex w-full items-center justify-center"
          >
            <BrowserFrame className="w-fit">
              <Image
                src="/screens/catalogo-publico.png"
                alt="Página pública do catálogo publicada"
                width={861}
                height={1042}
                sizes="(max-width: 768px) 88vw, 560px"
                className="block h-auto w-auto max-h-[66vh] max-w-[min(88vw,35rem)] [filter:contrast(1.03)_saturate(1.02)]"
              />
            </BrowserFrame>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
