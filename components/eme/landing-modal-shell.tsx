"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { motion, useReducedMotion } from "motion/react"
import { X } from "lucide-react"

import {
  EmeModalBackdrop,
  EmeModalCloseTarget,
  EmeModalContent,
  EmeModalSurface,
  EmeModalViewport,
} from "@/components/ui/eme-modal-foundation"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

type LandingModalShellProps = {
  label: string
  moduleId: string
  aspectRatio?: number
  originEl?: HTMLElement | null
  onClose: () => void
  children: ReactNode
}

function useLandingModalScrollLock() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior

    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
    }
  }, [])
}

export function LandingModalShell({
  label,
  moduleId,
  aspectRatio,
  originEl,
  onClose,
  children,
}: LandingModalShellProps) {
  const shellRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const closeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closingRef = useRef(false)
  const completedRef = useRef(false)
  const [closing, setClosing] = useState(false)
  const reduceMotion = useReducedMotion()

  useLandingModalScrollLock()

  const finishClose = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    if (closeFallbackRef.current) clearTimeout(closeFallbackRef.current)
    onClose()
  }, [onClose])

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    closeFallbackRef.current = setTimeout(finishClose, reduceMotion ? 30 : 240)
  }, [finishClose, reduceMotion])

  useEffect(() => {
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        handleClose()
        return
      }

      if (event.key !== "Tab" || !shellRef.current) return

      const focusable = Array.from(
        shellRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0)

      if (focusable.length === 0) {
        event.preventDefault()
        closeButtonRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener("keydown", onKeyDown)
      if (closeFallbackRef.current) clearTimeout(closeFallbackRef.current)
      if (originEl?.isConnected) originEl.focus({ preventScroll: true })
    }
  }, [handleClose, originEl])

  if (typeof document === "undefined") return null

  const openDuration = reduceMotion ? 0.01 : 0.26
  const closeDuration = reduceMotion ? 0.01 : 0.18
  return createPortal(
    <EmeModalViewport asChild>
      <div
        data-landing-modal-layer
        className="eme-landing-modal-layer"
      >
        <EmeModalBackdrop asChild>
          <motion.div
            aria-hidden="true"
            className="eme-landing-modal-backdrop cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: closing ? 0 : 1 }}
            transition={{ duration: closing ? closeDuration * 0.78 : openDuration * 0.78, ease: "easeOut" }}
            onClick={handleClose}
          />
        </EmeModalBackdrop>

        <EmeModalSurface asChild preferredAspectRatio={aspectRatio}>
          <motion.section
            ref={shellRef}
            role="dialog"
            aria-label={label}
            aria-modal="true"
            data-module-dialog={moduleId}
            data-landing-modal-shell
            className="eme-landing-modal-shell cursor-default text-foreground"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 14, scale: reduceMotion ? 1 : 0.982 }}
            animate={{
              opacity: closing ? 0 : 1,
              y: closing && !reduceMotion ? 8 : 0,
              scale: closing && !reduceMotion ? 0.988 : 1,
            }}
            transition={{
              duration: closing ? closeDuration : openDuration,
              ease: closing ? [0.4, 0, 1, 1] : [0.22, 1, 0.36, 1],
            }}
            onAnimationComplete={() => {
              if (closing) finishClose()
            }}
          >
            <EmeModalContent asChild flush>
              <div className="eme-landing-modal-content min-h-0 min-w-0">
                {children}
              </div>
            </EmeModalContent>

            <EmeModalCloseTarget asChild>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleClose}
                aria-label="Fechar"
                data-landing-modal-close
                className="eme-landing-modal-close text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme/60 focus-visible:ring-offset-2"
              >
                <X
                  data-eme-modal-close-icon
                  className="pointer-events-none block size-5 shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                  focusable="false"
                />
              </button>
            </EmeModalCloseTarget>
          </motion.section>
        </EmeModalSurface>
      </div>
    </EmeModalViewport>,
    document.body,
  )
}
