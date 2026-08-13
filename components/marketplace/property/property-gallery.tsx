'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Grid2x2, Heart, Share2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PropertyGallery({
  title,
  photos,
  photoCount,
}: {
  title: string
  photos: string[]
  photoCount: number
}) {
  const [favorite, setFavorite] = useState(false)
  const [shared, setShared] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)
  // Índice do carrossel no mobile.
  const [slide, setSlide] = useState(0)

  const openLightbox = (i: number) => setLightbox(i)
  const closeLightbox = () => setLightbox(null)
  const step = (dir: 1 | -1) =>
    setLightbox((i) => (i === null ? i : (i + dir + photos.length) % photos.length))

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, photos.length])

  function handleShare() {
    // Demonstrativo — copia o link atual sem serviços externos.
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
    setShared(true)
    setTimeout(() => setShared(false), 1800)
  }

  return (
    <div className="relative">
      {/* Ações flutuantes */}
      <div className="absolute right-3 top-3 z-20 flex gap-2 md:right-4 md:top-4">
        <button
          type="button"
          onClick={() => setFavorite((f) => !f)}
          aria-pressed={favorite}
          aria-label={favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
          className="glass-strong flex h-10 w-10 items-center justify-center rounded-full text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 active:scale-95"
        >
          <Heart className={cn('h-5 w-5', favorite && 'fill-primary text-primary')} aria-hidden="true" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Compartilhar imóvel"
            className="glass-strong flex h-10 w-10 items-center justify-center rounded-full text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 active:scale-95"
          >
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </button>
          {shared && (
            <span className="glass-strong absolute right-0 top-12 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)]">
              Link copiado
            </span>
          )}
        </div>
      </div>

      {/* Desktop: galeria assimétrica */}
      <div className="hidden gap-3 md:grid md:grid-cols-[1.55fr_1fr] md:grid-rows-2">
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="group relative row-span-2 overflow-hidden rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Abrir foto principal"
        >
          <div className="relative aspect-[4/3] h-full w-full">
            <Image
              src={photos[0] || '/marketplace/placeholder.svg'}
              alt={`${title} — fachada`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 55vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
        </button>

        {photos.slice(1, 3).map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => openLightbox(i + 1)}
            className="group relative overflow-hidden rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Abrir foto ${i + 2}`}
          >
            <div className="relative h-full min-h-[150px] w-full">
              <Image
                src={src || '/marketplace/placeholder.svg'}
                alt={`${title} — ambiente ${i + 2}`}
                fill
                sizes="(max-width: 768px) 100vw, 35vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {/* Botão "ver todas" sobre a última foto secundária */}
              {i === 1 && (
                <span className="glass-strong absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground shadow-[var(--shadow-soft)]">
                  <Grid2x2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  Ver todas as {photoCount} fotos
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Mobile: carrossel por deslize */}
      <div className="md:hidden">
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => openLightbox(i)}
              onFocus={() => setSlide(i)}
              className="relative aspect-[4/3] w-[86%] shrink-0 snap-center overflow-hidden rounded-[1.5rem]"
              aria-label={`Abrir foto ${i + 1}`}
            >
              <Image
                src={src || '/marketplace/placeholder.svg'}
                alt={`${title} — foto ${i + 1}`}
                fill
                priority={i === 0}
                sizes="86vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden="true">
            {photos.map((src, i) => (
              <span
                key={src}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === slide ? 'w-5 bg-primary' : 'w-1.5 bg-border',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground"
          >
            <Grid2x2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Ver todas as {photoCount} fotos
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-foreground/85 p-4 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0">
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar galeria"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground transition-transform hover:scale-105 active:scale-95"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Foto anterior"
            className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground transition-transform hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="relative aspect-[4/3] w-full max-w-4xl overflow-hidden rounded-[1.5rem]">
            <Image
              src={photos[lightbox] || '/marketplace/placeholder.svg'}
              alt={`${title} — foto ${lightbox + 1}`}
              fill
              sizes="90vw"
              className="object-cover"
            />
          </div>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Próxima foto"
            className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-foreground transition-transform hover:scale-105 active:scale-95 md:right-16"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-4 py-1.5 text-sm font-medium text-foreground">
            {lightbox + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  )
}
