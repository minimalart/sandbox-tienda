'use client'

import { useEffect } from 'react'
import { Text } from '@medusajs/ui'
import ColorCatalog, { TINT_COLOR_DISCLAIMER } from './color-catalog'
import type { TintColor } from './types'

/**
 * Modal de selección de color de una base entonable.
 *
 * El chrome del diálogo y nada más: la carta (buscador, anclas por familia,
 * grilla y disclaimer) vive en `color-catalog.tsx`, compartida con la página de
 * colores del flujo inverso.
 */

export type { TintColor }

type ColorPickerModalProps = {
  open: boolean
  onClose: () => void
  colors: TintColor[]
  selectedCode: string | null
  onSelect: (color: TintColor) => void
  /** Título del contexto: "Látex Interior · 3,6 L". */
  subtitle?: string | null
}

const ColorPickerModal = ({
  open,
  onClose,
  colors,
  selectedCode,
  onSelect,
  subtitle,
}: ColorPickerModalProps) => {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Sin esto el fondo scrollea detrás del modal en mobile.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      aria-labelledby="tint-picker-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ui-border-base px-5 py-4">
          <div className="flex flex-col">
            <Text className="font-medium" id="tint-picker-title">
              Elegí tu color
            </Text>
            {subtitle ? (
              <Text className="text-xs text-ui-fg-subtle">{subtitle}</Text>
            ) : null}
          </div>
          <button
            aria-label="Cerrar"
            className="text-2xl leading-none text-ui-fg-muted transition-colors hover:text-ui-fg-base"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <ColorCatalog
          autoFocusSearch
          colors={colors}
          onSelect={(color) => {
            onSelect(color)
            onClose()
          }}
          selectedCode={selectedCode}
        />

        <div className="border-t border-ui-border-base px-5 py-3">
          <Text className="text-xs text-ui-fg-muted">{TINT_COLOR_DISCLAIMER}</Text>
        </div>
      </div>
    </div>
  )
}

export default ColorPickerModal
