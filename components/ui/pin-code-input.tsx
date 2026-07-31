"use client"

import { useEffect, useMemo, useRef } from "react"

import { cn } from "@/lib/utils"
import { PIN_LENGTH, normalizePin } from "@/lib/pin-auth"

type PinCodeInputProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  inputClassName?: string
  ariaLabel?: string
}

export function PinCodeInput({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  className,
  inputClassName,
  ariaLabel = "PIN de acesso",
}: PinCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = useMemo(
    () =>
      Array.from({ length: PIN_LENGTH }, (_, index) => {
        const normalized = normalizePin(value)
        return normalized[index] ?? ""
      }),
    [value],
  )

  useEffect(() => {
    if (!autoFocus || disabled) return
    refs.current[0]?.focus()
  }, [autoFocus, disabled])

  function updateDigit(index: number, nextDigit: string) {
    const nextDigits = [...digits]
    nextDigits[index] = nextDigit
    onChange(nextDigits.join(""))
  }

  function focusIndex(index: number) {
    refs.current[index]?.focus()
    refs.current[index]?.select()
  }

  return (
    <div className={cn("flex items-center justify-center gap-2 sm:gap-3", className)} role="group" aria-label={ariaLabel}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          enterKeyHint="done"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digito ${index + 1} do PIN`}
          onChange={(event) => {
            const nextDigits = normalizePin(event.target.value)
            if (!nextDigits) {
              updateDigit(index, "")
              return
            }

            updateDigit(index, nextDigits[0])
            if (index < PIN_LENGTH - 1) {
              focusIndex(index + 1)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              if (digits[index]) {
                updateDigit(index, "")
                if (index > 0) {
                  window.setTimeout(() => focusIndex(index - 1), 0)
                }
                event.preventDefault()
                return
              }

              if (index > 0) {
                updateDigit(index - 1, "")
                focusIndex(index - 1)
                event.preventDefault()
                return
              }
            }

            if (event.key === "ArrowLeft" && index > 0) {
              focusIndex(index - 1)
              event.preventDefault()
              return
            }

            if (event.key === "ArrowRight" && index < PIN_LENGTH - 1) {
              focusIndex(index + 1)
              event.preventDefault()
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          onPaste={(event) => {
            const pasted = normalizePin(event.clipboardData.getData("text"))
            if (pasted.length !== PIN_LENGTH) return

            onChange(pasted)
            focusIndex(PIN_LENGTH - 1)
            event.preventDefault()
          }}
          className={cn(
            "h-14 w-12 rounded-2xl border border-black/[0.08] bg-white text-center text-xl font-semibold tracking-[0.08em] text-[#111111] outline-none transition-[border-color,box-shadow] focus:border-[#00C853] focus:shadow-[0_0_0_3px_rgba(0,200,83,0.16)] disabled:cursor-not-allowed disabled:opacity-60 sm:h-16 sm:w-14 sm:text-2xl",
            inputClassName,
          )}
        />
      ))}
    </div>
  )
}
