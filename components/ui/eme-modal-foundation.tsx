"use client"

import { Slot } from "@radix-ui/react-slot"
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ElementType,
  ReactNode,
} from "react"

import { cn } from "@/lib/utils"
import styles from "./eme-modal-foundation.module.css"

type ModalPartProps = ComponentPropsWithoutRef<"div"> & {
  asChild?: boolean
}

type ModalSurfaceStyle = CSSProperties & {
  "--eme-modal-aspect-fit-width"?: string
  "--eme-modal-preferred-aspect"?: number
  "--eme-modal-aspect"?: number
}

function ModalPart({
  asChild = false,
  className,
  marker,
  element = "div",
  ...props
}: ModalPartProps & {
  marker: string
  element?: ElementType
}) {
  const Comp = asChild ? Slot : element
  return <Comp className={cn(marker, className)} {...props} />
}

export function EmeModalViewport(props: ModalPartProps) {
  return <ModalPart marker={styles.viewport} data-eme-modal-viewport {...props} />
}

export function EmeModalBackdrop(props: ModalPartProps) {
  return <ModalPart marker={styles.backdrop} data-eme-modal-backdrop {...props} />
}

export function EmeModalSurface({
  asChild = false,
  className,
  preferredAspectRatio,
  style,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  asChild?: boolean
  preferredAspectRatio?: number
}) {
  const Comp = asChild ? Slot : "section"
  const hasPreferredAspect = Boolean(preferredAspectRatio && preferredAspectRatio > 0)
  const aspectStyle: ModalSurfaceStyle = hasPreferredAspect
    ? {
        "--eme-modal-aspect-fit-width": `calc(${preferredAspectRatio! * 100}dvh - ${preferredAspectRatio! * 48}px)`,
        "--eme-modal-preferred-aspect": preferredAspectRatio,
        "--eme-modal-aspect": preferredAspectRatio,
      }
    : {}

  return (
    <Comp
      data-eme-modal-surface
      data-eme-modal-preferred-aspect={hasPreferredAspect ? "true" : undefined}
      className={cn(styles.surface, className)}
      style={{ ...aspectStyle, ...style }}
      {...props}
    />
  )
}

export function EmeModalContent({
  asChild = false,
  className,
  flush = false,
  ...props
}: ModalPartProps & { flush?: boolean }) {
  return (
    <ModalPart
      asChild={asChild}
      marker={cn(styles.content, flush && styles.flush)}
      className={className}
      data-eme-modal-content
      data-eme-modal-flush={flush ? "true" : undefined}
      {...props}
    />
  )
}

export function EmeModalHeader(props: ModalPartProps) {
  return <ModalPart marker={styles.header} element="header" data-eme-modal-header {...props} />
}

export function EmeModalBody(props: ModalPartProps) {
  return <ModalPart marker={styles.body} data-eme-modal-body {...props} />
}

export function EmeModalFooter(props: ModalPartProps) {
  return <ModalPart marker={styles.footer} element="footer" data-eme-modal-footer {...props} />
}

export function EmeModalActions(props: ModalPartProps) {
  return (
    <ModalPart
      marker={styles.footer}
      element="footer"
      data-eme-modal-footer
      data-eme-modal-actions
      {...props}
    />
  )
}

export function EmeModalSplit({
  visualWeight = false,
  ...props
}: ModalPartProps & { visualWeight?: boolean }) {
  return (
    <ModalPart
      marker={styles.split}
      data-eme-modal-split
      data-eme-modal-ratio={visualWeight ? "visual" : undefined}
      {...props}
    />
  )
}

export function EmeModalVisual(props: ModalPartProps) {
  return <ModalPart marker={styles.visual} data-eme-modal-visual {...props} />
}

export function EmeModalDetails(props: ModalPartProps) {
  return <ModalPart marker={styles.details} data-eme-modal-details {...props} />
}

export function EmeModalCloseTarget({
  asChild = false,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean
  children: ReactNode
}) {
  if (asChild) {
    return (
      <Slot data-eme-modal-close-target className={cn(styles.closeTarget, className)} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      type="button"
      data-eme-modal-close-target
      className={cn(styles.closeTarget, className)}
      {...props}
    >
      {children}
    </button>
  )
}
