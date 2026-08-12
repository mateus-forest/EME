"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Brush, Eraser, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Point = { x: number; y: number }
type Stroke = { mode: "paint" | "erase"; width: number; points: Point[] }

export type ObjectMaskValue = {
  file: File
  width: number
  height: number
}

type StudioObjectMaskEditorProps = {
  imageUrl: string
  disabled?: boolean
  onChange: (value: ObjectMaskValue | null) => void
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, color: string) {
  const firstPoint = stroke.points[0]
  if (!firstPoint) return

  context.save()
  context.strokeStyle = color
  context.fillStyle = color
  context.lineCap = "round"
  context.lineJoin = "round"
  context.lineWidth = stroke.width

  if (stroke.points.length === 1) {
    context.beginPath()
    context.arc(firstPoint.x, firstPoint.y, stroke.width / 2, 0, Math.PI * 2)
    context.fill()
  } else {
    context.beginPath()
    context.moveTo(firstPoint.x, firstPoint.y)
    for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y)
    context.stroke()
  }
  context.restore()
}

export function StudioObjectMaskEditor({ imageUrl, disabled = false, onChange }: StudioObjectMaskEditorProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const activeStrokeRef = useRef<Stroke | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [tool, setTool] = useState<"paint" | "erase">("paint")
  const [brushSize, setBrushSize] = useState(36)
  const [historyLength, setHistoryLength] = useState(0)
  const [hasSelection, setHasSelection] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const redraw = useCallback((strokes = strokesRef.current) => {
    const overlay = overlayCanvasRef.current
    const mask = maskCanvasRef.current
    if (!overlay || !mask || !dimensions) return

    const overlayContext = overlay.getContext("2d")
    const maskContext = mask.getContext("2d", { willReadFrequently: true })
    if (!overlayContext || !maskContext) return

    overlayContext.clearRect(0, 0, dimensions.width, dimensions.height)
    maskContext.save()
    maskContext.globalCompositeOperation = "source-over"
    maskContext.fillStyle = "#000000"
    maskContext.fillRect(0, 0, dimensions.width, dimensions.height)
    maskContext.restore()

    for (const stroke of strokes) {
      drawStroke(maskContext, stroke, stroke.mode === "paint" ? "#ffffff" : "#000000")
      if (stroke.mode === "paint") {
        drawStroke(overlayContext, stroke, "rgba(0, 155, 58, 0.48)")
      } else {
        overlayContext.save()
        overlayContext.globalCompositeOperation = "destination-out"
        drawStroke(overlayContext, stroke, "rgba(0, 0, 0, 1)")
        overlayContext.restore()
      }
    }
  }, [dimensions])

  async function publishMask() {
    const canvas = maskCanvasRef.current
    if (!canvas || !dimensions) return
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return

    const pixels = context.getImageData(0, 0, dimensions.width, dimensions.height).data
    let containsWhitePixel = false
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] === 255 && pixels[offset + 1] === 255 && pixels[offset + 2] === 255) {
        containsWhitePixel = true
        break
      }
    }

    if (!containsWhitePixel) {
      setHasSelection(false)
      onChangeRef.current(null)
      return
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) {
      onChangeRef.current(null)
      return
    }
    onChangeRef.current({
      file: new File([blob], "object-mask.png", { type: "image/png" }),
      width: dimensions.width,
      height: dimensions.height,
    })
    // Only announce a valid selection after the PNG has been produced and shared
    // with the parent. This keeps the visible state and the generation CTA aligned.
    setHasSelection(true)
  }

  function resetEditor(nextDimensions?: { width: number; height: number }) {
    strokesRef.current = []
    activeStrokeRef.current = null
    activePointerIdRef.current = null
    setHistoryLength(0)
    setHasSelection(false)
    onChangeRef.current(null)
    if (nextDimensions) setDimensions(nextDimensions)
  }

  useEffect(() => {
    resetEditor()
  }, [imageUrl])

  useEffect(() => {
    const overlay = overlayCanvasRef.current
    const mask = maskCanvasRef.current
    if (!overlay || !mask || !dimensions) return
    overlay.width = dimensions.width
    overlay.height = dimensions.height
    mask.width = dimensions.width
    mask.height = dimensions.height
    redraw()
  }, [dimensions, redraw])

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = overlayCanvasRef.current
    if (!canvas || !dimensions) return null
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null
    return {
      point: {
        x: Math.max(0, Math.min(dimensions.width, (event.clientX - bounds.left) * dimensions.width / bounds.width)),
        y: Math.max(0, Math.min(dimensions.height, (event.clientY - bounds.top) * dimensions.height / bounds.height)),
      },
      scale: ((dimensions.width / bounds.width) + (dimensions.height / bounds.height)) / 2,
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || !dimensions) return
    const mapped = pointFromEvent(event)
    if (!mapped) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Eventos sintéticos e alguns navegadores touch não oferecem pointer capture.
    }
    const stroke: Stroke = {
      mode: tool,
      width: brushSize * mapped.scale,
      points: [mapped.point],
    }
    activeStrokeRef.current = stroke
    activePointerIdRef.current = event.pointerId
    strokesRef.current = [...strokesRef.current, stroke]
    setHistoryLength(strokesRef.current.length)
    redraw()
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = activeStrokeRef.current
    if (!stroke || activePointerIdRef.current !== event.pointerId) return
    const mapped = pointFromEvent(event)
    if (!mapped) return
    event.preventDefault()
    stroke.points.push(mapped.point)
    redraw()
  }

  function finishStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    activeStrokeRef.current = null
    activePointerIdRef.current = null
    void publishMask()
  }

  function undo() {
    if (disabled || strokesRef.current.length === 0) return
    strokesRef.current = strokesRef.current.slice(0, -1)
    setHistoryLength(strokesRef.current.length)
    redraw()
    void publishMask()
  }

  function clear() {
    if (disabled) return
    strokesRef.current = []
    activeStrokeRef.current = null
    activePointerIdRef.current = null
    setHistoryLength(0)
    redraw([])
    void publishMask()
  }

  return (
    <div className="grid min-w-0 gap-4" data-testid="object-mask-editor">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={tool === "paint" ? "default" : "outline"} disabled={disabled} onClick={() => setTool("paint")} className="rounded-xl">
          <Brush className="size-4" />Pincel
        </Button>
        <Button type="button" size="sm" variant={tool === "erase" ? "default" : "outline"} disabled={disabled} onClick={() => setTool("erase")} className="rounded-xl">
          <Eraser className="size-4" />Apagar marcação
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled || historyLength === 0} onClick={undo} className="rounded-xl text-[#5F6B7A]">
          <RotateCcw className="size-4" />Desfazer
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled || historyLength === 0} onClick={clear} className="rounded-xl text-[#5F6B7A]">
          <Trash2 className="size-4" />Limpar seleção
        </Button>
      </div>

      <label className="grid gap-2 text-sm font-medium text-[#374151]">
        <span className="flex items-center justify-between gap-3"><span>Tamanho do pincel</span><span className="text-xs font-normal text-[#7B8491]">{brushSize}px</span></span>
        <input aria-label="Tamanho do pincel" type="range" min="12" max="84" step="4" value={brushSize} disabled={disabled} onChange={(event) => setBrushSize(Number(event.target.value))} className="w-full accent-[#009b3a]" />
      </label>

      <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-[#eef2f6]">
        <div className="relative w-full select-none">
          {/* A imagem é apenas a referência visual; ela nunca é desenhada na máscara técnica. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Imagem para marcar o objeto"
            draggable={false}
            className="block h-auto w-full"
            onLoad={(event) => resetEditor({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          />
          <canvas
            ref={overlayCanvasRef}
            aria-label="Área que será removida"
            data-testid="object-mask-canvas"
            data-image-width={dimensions?.width ?? 0}
            data-image-height={dimensions?.height ?? 0}
            className={cn("absolute inset-0 size-full cursor-crosshair", disabled && "cursor-not-allowed opacity-70")}
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
          />
          <canvas ref={maskCanvasRef} data-testid="object-mask-output" className="hidden" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] bg-white px-4 py-3">
          <p className="text-xs leading-5 text-[#667085]">Pinte somente sobre o objeto ou região que deseja remover.</p>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", hasSelection ? "bg-[#eef9f1] text-[#08752f]" : "bg-[#f3f4f6] text-[#7B8491]")}>{hasSelection ? "Área marcada" : "Sem seleção"}</span>
        </div>
      </div>
    </div>
  )
}
