'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LegalTocEntry } from '../anchors'

type LegalTocProps = {
  entries: LegalTocEntry[]
}

/** Cuánto arriba del viewport cuenta como "la sección que estoy leyendo". */
const ACTIVE_OFFSET = 140

/**
 * Índice lateral "En esta página".
 *
 * Es el ÚNICO componente cliente de la página legal, y sólo por dos cosas que no se
 * pueden hacer sin JS: marcar la sección que se está leyendo, y ABRIR el acordeón de
 * destino al hacer click en un ítem.
 *
 * Lo segundo importa más de lo que parece. Los paneles son `<details>` y el `id` está
 * en el `<details>`, así que un `href="#ancla"` pelado scrollea hasta la sección pero
 * la deja CERRADA: el visitante llega y ve el título que ya veía. Por eso el handler
 * la abre antes de scrollear.
 *
 * Y por eso también son `<a href>` reales y no botones: sin JS el link igual navega
 * (llega al panel cerrado, que es peor que abierto pero mucho mejor que nada), y el
 * navegador puede copiar la dirección de la cláusula.
 */
export default function LegalToc({ entries }: LegalTocProps) {
  const [active, setActive] = useState<string | null>(entries[0]?.anchor ?? null)
  /** Evita recalcular en cada evento de scroll: uno por frame alcanza. */
  const frame = useRef<number | null>(null)

  const recompute = useCallback(() => {
    let current: string | null = entries[0]?.anchor ?? null
    for (const entry of entries) {
      const el = document.getElementById(entry.anchor)
      if (!el) continue
      // La ÚLTIMA sección cuyo borde superior ya pasó la línea de lectura. Con los
      // paneles cerrados hay varios visibles a la vez, así que "el primero que
      // intersecta" marcaría siempre el de arriba.
      if (el.getBoundingClientRect().top <= ACTIVE_OFFSET) current = entry.anchor
      else break
    }
    setActive(current)
  }, [entries])

  useEffect(() => {
    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null
        recompute()
      })
    }

    // Una primera pasada: se puede entrar con la página ya scrolleada (un `#ancla` en
    // la URL, o un "volver atrás" que restaura la posición).
    recompute()
    window.addEventListener('scroll', onScroll, { passive: true })
    // `resize` también: al cambiar el ancho, los títulos pasan de una a dos líneas y
    // todas las posiciones se corren.
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    }
  }, [recompute])

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, anchor: string) => {
    const el = document.getElementById(anchor)
    if (!(el instanceof HTMLDetailsElement)) return // sin panel, que navegue el link
    event.preventDefault()
    el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // `replaceState` y no `pushState`: el índice no es navegación, es la misma página.
    // Con `push`, el botón "atrás" tendría que recorrer una entrada por cláusula leída
    // antes de volver a la tienda.
    window.history.replaceState(null, '', `#${anchor}`)
    setActive(anchor)
  }

  return (
    <nav
      aria-label='En esta página'
      className='rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24'
    >
      <p className='mb-4 font-semibold text-[#18324A] text-sm'>En esta página</p>
      <ol className='flex flex-col gap-1'>
        {entries.map((entry, index) => {
          const isActive = entry.anchor === active
          return (
            <li key={entry.anchor}>
              <a
                href={`#${entry.anchor}`}
                onClick={(event) => handleClick(event, entry.anchor)}
                aria-current={isActive ? 'true' : undefined}
                className={`flex gap-1.5 border-l-2 py-2 pr-2 pl-3 text-[13px] leading-snug transition-colors ${
                  isActive
                    ? 'border-[--primary-color] bg-slate-50 font-semibold text-[--primary-color]'
                    : 'border-transparent text-slate-500 hover:text-[#18324A]'
                }`}
              >
                <span aria-hidden='true'>{index + 1}.</span>
                <span>{entry.name}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
