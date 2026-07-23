'use client'

import { motion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import Image from 'next/image'
import { useRef } from 'react'
import { Check } from 'lucide-react'
import { BrowserFrame } from './frame'
import { ProposalList } from './proposal-list'

const SPRING = { stiffness: 90, damping: 30, restDelta: 0.0004 } as const

/** A discrete status chip that appears over the form as it auto-fills, then fades. */
function FillChip({
  progress,
  enter,
  label,
  className,
}: {
  progress: MotionValue<number>
  enter: number
  label: string
  className: string
}) {
  const opacity = useTransform(progress, [enter, enter + 0.03, 0.3, 0.34], [0, 1, 1, 0])
  const y = useTransform(progress, [enter, enter + 0.03], [10, 0])
  return (
    <motion.div
      style={{ opacity, y }}
      className={`absolute z-20 flex items-center gap-1.5 rounded-full border border-brand/30 bg-card px-3 py-1.5 text-xs font-medium text-brand shadow-lg ${className}`}
    >
      <Check className="h-3 w-3" strokeWidth={3} /> {label}
    </motion.div>
  )
}

export function Proposals() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  const smooth = useSpring(scrollYProgress, SPRING)

  // The form auto-fills, then recedes into the background. The finished PDF
  // rises slowly, grows large and holds on screen for a long contemplation —
  // "the system just generated a proposal ready to send to the client."
  const formX = useTransform(smooth, [0.3, 0.52], ['0%', '-9%'])
  const formOpacity = useTransform(smooth, [0.3, 0.5], [1, 0.16])
  const formScale = useTransform(smooth, [0.3, 0.52], [1, 0.82])
  const formBlur = useTransform(smooth, [0.3, 0.52], ['blur(0px)', 'blur(10px)'])

  // Slow, deliberate reveal of the PDF.
  const pdfOpacity = useTransform(smooth, [0.26, 0.48], [0, 1])
  const pdfScale = useTransform(smooth, [0.26, 0.56], [0.58, 1])
  const pdfY = useTransform(smooth, [0.26, 0.56], ['48%', '0%'])
  const pdfRotate = useTransform(smooth, [0.26, 0.56], [8, 0])

  const captionOpacity = useTransform(smooth, [0.6, 0.72], [0, 1])
  const captionY = useTransform(smooth, [0.6, 0.72], [14, 0])

  return (
    <section ref={ref} id="propostas" className="relative h-[600vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pt-24">
        <div className="mx-auto w-full max-w-6xl shrink-0 px-6 text-center sm:px-10">
          <p className="mb-4 text-sm font-medium tracking-tight text-brand">Propostas</p>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            Um clique. Proposta pronta.
          </h2>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-6">
          <div className="relative flex h-full w-full max-w-5xl items-center justify-center">
            {/* form auto-filling, then receding behind */}
            <motion.div
              style={{ x: formX, opacity: formOpacity, scale: formScale, filter: formBlur }}
              className="absolute flex w-full items-center justify-center"
            >
              <BrowserFrame className="w-fit">
                <div className="relative w-fit">
                  <Image
                    src="/screens/propostas.png"
                    alt="Formulário de proposta sendo preenchido pelo EME"
                    width={1475}
                    height={815}
                    sizes="(max-width: 768px) 90vw, 720px"
                    className="block h-auto w-auto max-h-[46vh] max-w-[min(90vw,46rem)]"
                  />
                  <div className="@container absolute inset-0">
                    <ProposalList />
                  </div>
                </div>
              </BrowserFrame>
            </motion.div>

            {/* auto-fill status chips */}
            <FillChip progress={smooth} enter={0.05} label="Cliente" className="left-[12%] top-[30%]" />
            <FillChip progress={smooth} enter={0.11} label="Imóvel" className="right-[14%] top-[38%]" />
            <FillChip progress={smooth} enter={0.17} label="Imagem" className="left-[18%] top-[56%]" />
            <FillChip progress={smooth} enter={0.23} label="Resumo" className="right-[16%] top-[64%]" />

            {/* finished PDF rising forward to become the dominant focus */}
            <motion.div
              style={{ opacity: pdfOpacity, scale: pdfScale, y: pdfY, rotate: pdfRotate }}
              className="absolute z-30 flex flex-col items-center"
            >
              <BrowserFrame className="w-fit">
                <Image
                  src="/screens/proposta-pdf.png"
                  alt="Proposta comercial gerada em PDF"
                  width={655}
                  height={1072}
                  sizes="(max-width: 768px) 78vw, 460px"
                  className="block h-auto w-auto max-h-[62vh] max-w-[min(84vw,25rem)] [filter:contrast(1.03)_saturate(1.02)]"
                  priority
                />
              </BrowserFrame>
              <motion.p
                style={{ opacity: captionOpacity, y: captionY }}
                className="mt-5 text-center text-sm font-medium text-brand"
              >
                PDF pronto para enviar ao cliente
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
