'use client'

import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from 'motion/react'
import { useRef, useState } from 'react'
import {
  Sparkles,
  Keyboard,
  FileCode2,
  ClipboardType,
  Link2,
  Camera,
  Mic,
  AlignLeft,
  MapPin,
  Check,
  Image as ImageIcon,
  Video,
  LayoutGrid,
  Megaphone,
  FileText,
} from 'lucide-react'
import { BrowserFrame } from './frame'

const ease = [0.16, 1, 0.3, 1] as const

const STEPS = [
  {
    n: '01',
    title: 'Escolha como cadastrar',
    desc: 'Comece do jeito que preferir. A IA cuida do resto.',
  },
  {
    n: '02',
    title: 'Envie o conteúdo',
    desc: 'Fotos, um áudio, uma descrição ou dados que você já tem.',
  },
  {
    n: '03',
    title: 'O EME entende o imóvel',
    desc: 'A IA extrai características, ambientes, localização e preço.',
  },
  {
    n: '04',
    title: 'Anúncio pronto',
    desc: 'Título, descrição e especificações estruturadas. Tudo revisável.',
  },
  {
    n: '05',
    title: 'Pronto para publicar',
    desc: 'O imóvel entra na carteira. Todo o resto nasce daqui.',
  },
]

/* ---------- Scene 01 — how to register ---------- */
const METHODS = [
  { icon: Sparkles, label: 'Criar com IA' },
  { icon: Keyboard, label: 'Manualmente' },
  { icon: FileCode2, label: 'Importar XML' },
  { icon: ClipboardType, label: 'Colar texto' },
  { icon: Link2, label: 'Colar link' },
  { icon: Camera, label: 'Enviar print' },
]

function SceneChoose() {
  return (
    <div className="grid h-full grid-cols-2 content-center gap-3 p-6 sm:gap-4 sm:p-8">
      {METHODS.map((m, i) => {
        const selected = i === 0
        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease, delay: 0.15 + i * 0.09 }}
            className={`relative flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 ${
              selected ? 'border-brand/40 bg-brand/5' : 'border-border/60 bg-background/50'
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                selected ? 'bg-brand/15 text-brand' : 'bg-secondary text-muted-foreground'
              }`}
            >
              <m.icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-sm font-medium tracking-tight">{m.label}</span>
            {selected ? (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease, delay: 0.9 }}
                className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-primary-foreground"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </motion.span>
            ) : null}
          </motion.div>
        )
      })}
    </div>
  )
}

/* ---------- Scene 02 — send content ---------- */
function SceneSend() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-6 sm:p-8">
      {/* photos */}
      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease, delay: 0.15 }}
        className="rounded-2xl border border-border/60 bg-background/50 p-4"
      >
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Camera className="h-4 w-4 text-brand" /> Fotos do imóvel
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease, delay: 0.4 + i * 0.18 }}
              className="h-12 flex-1 rounded-lg bg-gradient-to-br from-secondary to-secondary/40"
            />
          ))}
        </div>
      </motion.div>

      {/* audio */}
      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease, delay: 0.35 }}
        className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-4"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Mic className="h-4 w-4" />
        </span>
        <div className="flex flex-1 items-center gap-[3px]">
          {Array.from({ length: 22 }).map((_, i) => (
            <motion.span
              key={i}
              className="w-[3px] rounded-full bg-brand/60"
              animate={{ height: [6, 6 + ((i * 7) % 20), 6] }}
              transition={{
                duration: 1.4,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">0:14</span>
      </motion.div>

      {/* description typing */}
      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.7, ease, delay: 0.55 }}
        className="rounded-2xl border border-border/60 bg-background/50 p-4"
      >
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlignLeft className="h-4 w-4 text-brand" /> Descrição
        </div>
        <div className="space-y-2">
          {['92%', '78%'].map((w, i) => (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              animate={{ width: w }}
              transition={{ duration: 1.1, ease, delay: 0.7 + i * 0.5 }}
              className="h-2 rounded-full bg-muted-foreground/20"
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/* ---------- Scene 03 — EME understands ---------- */
const EXTRACTED = ['3 dormitórios', '2 vagas', '120 m²', 'Vista mar', 'Menino Deus', 'R$ 1.250.000']

function SceneUnderstand() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 p-6 sm:p-8">
      {/* scanning photo */}
      <div className="relative h-28 overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-secondary/30">
        <motion.div
          aria-hidden
          className="absolute inset-x-0 h-16 bg-gradient-to-b from-brand/0 via-brand/25 to-brand/0"
          initial={{ top: '-40%' }}
          animate={{ top: ['-40%', '110%'] }}
          transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
        />
        <div className="absolute left-4 top-4 flex items-center gap-2 text-xs text-brand">
          <MapPin className="h-3.5 w-3.5" /> Analisando ambientes…
        </div>
      </div>

      {/* extracted chips */}
      <div className="flex flex-wrap gap-2">
        {EXTRACTED.map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, y: 10, scale: 0.94, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease, delay: 0.4 + i * 0.22 }}
            className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

/* ---------- Scene 04 — listing ready ---------- */
function SceneListing() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-6 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease, delay: 0.15 }}
        className="relative rounded-2xl border border-border/60 bg-background/50 p-5"
      >
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease, delay: 1.2 }}
          className="absolute right-4 top-4 rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1 text-[11px] font-medium text-brand"
        >
          Revisável
        </motion.span>

        {/* title */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '70%' }}
          transition={{ duration: 0.9, ease, delay: 0.3 }}
          className="h-4 overflow-hidden rounded-md bg-foreground/80"
        />
        {/* description lines */}
        <div className="mt-4 space-y-2">
          {['100%', '96%', '88%'].map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: w }}
              transition={{ duration: 0.8, ease, delay: 0.6 + i * 0.28 }}
              className="h-2 rounded-full bg-muted-foreground/20"
            />
          ))}
        </div>
        {/* spec pills */}
        <div className="mt-5 flex gap-2">
          {['Apartamento', '3 suítes', 'Porto Alegre'].map((p, i) => (
            <motion.span
              key={p}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease, delay: 1.1 + i * 0.16 }}
              className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {p}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/* ---------- Scene 05 — ready to publish ---------- */
const ACTIONS = [
  { icon: ImageIcon, label: 'Imagens' },
  { icon: Video, label: 'Vídeos' },
  { icon: LayoutGrid, label: 'Catálogo' },
  { icon: Megaphone, label: 'Campanhas' },
  { icon: FileText, label: 'Propostas' },
]

function ScenePublish() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 p-6 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease, delay: 0.15 }}
        className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease, delay: 0.5 }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-primary-foreground"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </motion.span>
        <div>
          <p className="text-sm font-medium tracking-tight">Publicado na carteira</p>
          <p className="text-xs text-muted-foreground">Apartamento Impecável · Menino Deus</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-5 gap-2">
        {ACTIONS.map((a, i) => (
          <motion.div
            key={a.label}
            initial={{ opacity: 0, y: 14, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease, delay: 0.8 + i * 0.16 }}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-1 py-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <a.icon className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-medium tracking-tight text-muted-foreground">
              {a.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const SCENES = [SceneChoose, SceneSend, SceneUnderstand, SceneListing, ScenePublish]
const LABELS = [
  'app.eme.com/imoveis/novo',
  'app.eme.com/imoveis/novo · conteúdo',
  'app.eme.com/imoveis/novo · análise',
  'app.eme.com/imoveis/novo · anúncio',
  'app.eme.com/imoveis · carteira',
]

export function CreateFlow() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 30, restDelta: 0.0004 })

  const [active, setActive] = useState(0)
  useMotionValueEvent(smooth, 'change', (p) => {
    // Each scene owns an equal slice; the last slice holds to the end.
    // A small deadzone around each boundary prevents flicker when the spring
    // settles right on the edge.
    const slice = 1 / SCENES.length
    const idx = Math.min(SCENES.length - 1, Math.floor((p + slice * 0.04) / slice))
    setActive((prev) => (idx !== prev ? idx : prev))
  })

  const Scene = SCENES[active]

  return (
      <section ref={ref} id="fluxo" className="relative h-[720vh]">
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 sm:px-10 md:grid-cols-2 md:gap-14">
          {/* left — single active message + rail */}
          <div>
            <p className="mb-6 text-sm font-medium tracking-tight text-brand">Novo imóvel</p>

            <div className="relative min-h-[168px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 26, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -20, filter: 'blur(12px)' }}
                  transition={{ duration: 0.9, ease }}
                >
                  <span className="font-mono text-sm text-brand">{STEPS[active].n}</span>
                  <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
                    {STEPS[active].title}
                  </h2>
                  <p className="mt-4 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
                    {STEPS[active].desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* progress rail */}
            <div className="mt-10 flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  className="relative h-1 flex-1 overflow-hidden rounded-full bg-border/70"
                >
                  <motion.div
                    className="absolute inset-0 origin-left rounded-full bg-brand"
                    initial={false}
                    animate={{ scaleX: i <= active ? 1 : 0 }}
                    transition={{ duration: 0.8, ease }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* right — living scene */}
          <div className="md:pl-4">
            <BrowserFrame label={LABELS[active]} live={false}>
              <div className="relative aspect-[16/11] w-full bg-secondary/20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
                    transition={{ duration: 0.8, ease }}
                    className="absolute inset-0"
                  >
                    <Scene />
                  </motion.div>
                </AnimatePresence>
              </div>
            </BrowserFrame>
          </div>
        </div>
      </div>
    </section>
  )
}
