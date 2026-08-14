"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import {
  formatStructuredInput,
  normalizeStructuredInput,
  type StructuredInputKind,
} from "@/lib/structured-fields"

type StructuredInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "onChange" | "value" | "defaultValue" | "inputMode"> & {
  kind: StructuredInputKind
  value: string | number
  onValueChange: (formattedValue: string, normalizedValue: string | number | null) => void
}

function inputModeFor(kind: StructuredInputKind): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  if (kind === "phone") return "tel"
  return kind === "decimal" || kind === "percent" ? "decimal" : "numeric"
}

function digitPosition(value: string, caret: number) {
  return (value.slice(0, caret).match(/\d/g) ?? []).length
}

function caretForDigitPosition(value: string, position: number, kind: StructuredInputKind) {
  if (position <= 0) return kind === "currency" ? Math.min(value.length, value.indexOf("R$") + 3) : 0
  let seen = 0
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) seen += 1
    if (seen === position) return index + 1
  }
  return kind === "currency" && value.includes(",") ? value.indexOf(",") : value.length
}

const StructuredInput = React.forwardRef<HTMLInputElement, StructuredInputProps>(function StructuredInput(
  { kind, value, onValueChange, onFocus, ...props },
  forwardedRef,
) {
  const localRef = React.useRef<HTMLInputElement | null>(null)
  const setRef = React.useCallback((node: HTMLInputElement | null) => {
    localRef.current = node
    if (typeof forwardedRef === "function") forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  const displayValue = value === "" || value === null || value === undefined
    ? ""
    : formatStructuredInput(kind, String(value))

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const rawValue = event.target.value
    const selection = event.target.selectionStart ?? rawValue.length
    const position = digitPosition(rawValue, selection)
    const formatted = formatStructuredInput(kind, rawValue)
    onValueChange(formatted, normalizeStructuredInput(kind, formatted))

    requestAnimationFrame(() => {
      const input = localRef.current
      if (!input || document.activeElement !== input) return
      const nextCaret = caretForDigitPosition(formatted, position, kind)
      input.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return (
    <Input
      {...props}
      ref={setRef}
      type="text"
      inputMode={inputModeFor(kind)}
      autoComplete={props.autoComplete ?? "off"}
      value={displayValue}
      onChange={handleChange}
      onFocus={(event) => {
        onFocus?.(event)
        if (kind === "currency" && event.currentTarget.value.includes(",")) {
          const input = event.currentTarget
          const caret = input.value.indexOf(",")
          requestAnimationFrame(() => input.setSelectionRange(caret, caret))
        }
      }}
    />
  )
})

export { StructuredInput }
