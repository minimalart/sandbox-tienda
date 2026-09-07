'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text } from '@medusajs/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TintColor } from './types'
import { foldForSearch, matchesWithTypos } from '@lib/util/fuzzy-match'

/**
 * La carta de colores: buscador, anclas por familia y grilla agrupada.
 *
 * Vive suelta del modal porque la usan los dos flujos: el PDP la abre dentro de
 * un diálogo (base → color) y la página de colores la muestra a ancho completo
 * (color → base). Duplicarla dejaría dos búsquedas que se comportan distinto
 * sobre la misma carta.
 *
 * Las familias son ANCLAS, no filtros: la lista muestra siempre la carta
 * completa agrupada, y el chip lleva hasta esa sección. Filtrar obligaba a
 * volver al chip "Todos" para pasar a la familia siguiente; así el cliente
 * recorre la carta de corrido, como el abanico impreso.
 *
 * El disclaimer del pie no es decorativo: los hex vienen de la carta del
 * fabricante y no del color real de la pintura entonada, así que prometer
 * fidelidad sería mentirle al cliente. Se renderiza acá, en un solo lugar.
 */

const ALL = '__all__'

export const TINT_COLOR_DISCLAIMER =
  'Los colores en pantalla son una referencia aproximada y pueden variar según el brillo y la calibración de tu dispositivo.'

/**
 * Tira de anclas en UNA sola fila, misma mecánica que los tabs del drawer del
 * admin: sin scrollbar visible, y cuando hay chips fuera de vista aparece una
 * flecha con degradado a ese lado. Al clickear, el chip se centra.
 */
export function FamilyAnchors({
  families,
  active,
  onPick,
}: {
  families: string[]
  active: string
  onPick: (family: string) => void
}) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const sync = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    sync()
    const onResize = () => sync()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [sync, families.length])

  const nudge = (dir: -1 | 1) =>
    stripRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' })

  const chip = (name: string) => {
    const isActive = active === name
    return (
      <button
        key={name}
        aria-label={name === ALL ? 'Ir al principio de la carta' : `Ir a ${name}`}
        className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors"
        onClick={(event) => {
          onPick(name)
          event.currentTarget.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          })
        }}
        style={{
          borderColor: isActive ? 'var(--primary-color)' : 'var(--ui-border-base)',
          backgroundColor: isActive
            ? 'color-mix(in srgb, var(--primary-color) 12%, white)'
            : 'transparent',
        }}
        type="button"
      >
        {name === ALL ? 'Todos' : name}
      </button>
    )
  }

  return (
    <div className="relative">
      {canLeft ? (
        <button
          aria-label="Familias anteriores"
          className="absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-white via-white to-transparent pr-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
          onClick={() => nudge(-1)}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </button>
      ) : null}
      <div
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={sync}
        ref={stripRef}
      >
        {[ALL, ...families].map(chip)}
      </div>
      {canRight ? (
        <button
          aria-label="Familias siguientes"
          className="absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-white via-white to-transparent pl-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base"
          onClick={() => nudge(1)}
          type="button"
        >
          <ChevronRight className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

type ColorCatalogProps = {
  colors: TintColor[]
  selectedCode: string | null
  onSelect: (color: TintColor) => void
  /**
   * Quién scrollea la lista. `self` = un contenedor propio con overflow (el
   * modal, que tiene alto acotado); `page` = la página entera (la página de
   * colores, donde encerrar la carta en una cajita con scroll propio sería
   * pelear contra el scroll del navegador).
   */
  scroll?: 'self' | 'page'
  /** Alto pegajoso de los encabezados de familia, para librar el header del sitio. */
  stickyTop?: string
  /** Columnas de la grilla. La página usa más que el modal. */
  gridClassName?: string
  autoFocusSearch?: boolean
}

const ColorCatalog = ({
  colors,
  selectedCode,
  onSelect,
  scroll = 'self',
  stickyTop = '0px',
  gridClassName = 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4',
  autoFocusSearch = false,
}: ColorCatalogProps) => {
  const [query, setQuery] = useState('')
  /** Sólo para resaltar el chip de la familia que se está viendo. No filtra. */
  const [activeFamily, setActiveFamily] = useState<string>(ALL)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef(new Map<string, HTMLDivElement>())
  const pageScroll = scroll === 'page'

  const filtered = useMemo(() => {
    // Se compara sin acentos: los nombres de la carta los tienen ("Rocío",
    // "Limón") y nadie los tipea al buscar.
    const needle = foldForSearch(query.trim())
    if (!needle) return colors

    // Se busca por nombre Y por código: el cliente que llega con el abanico en la
    // mano tipea el código.
    const literal = colors.filter(
      (color) =>
        foldForSearch(color.name).includes(needle) ||
        foldForSearch(color.code).includes(needle),
    )
    if (literal.length > 0) return literal

    // Recién sin ningún match literal se afloja y se toleran errores de tipeo. El
    // orden importa: quien transcribe bien nunca ve resultados de más, y quien se
    // come una tecla en "51YY 61/792" igual encuentra el color que tiene en la mano
    // en vez de un cartel de "no encontramos nada".
    return colors.filter((color) =>
      matchesWithTypos(needle, foldForSearch(`${color.name} ${color.code}`)),
    )
  }, [colors, query])

  // Agrupado por familia siempre: la grilla completa sin cortes sería una pared
  // indiferenciada de cientos de cuadraditos.
  const groups = useMemo(() => {
    const byFamily = new Map<string, TintColor[]>()
    for (const color of filtered) {
      const key = color.family?.trim() || 'Otros'
      const list = byFamily.get(key)
      if (list) list.push(color)
      else byFamily.set(key, [color])
    }
    // `Array.from` en vez de spread del iterator: el target de TS del storefront
    // no habilita downlevelIteration. El orden es el de la carta (los colores
    // llegan ordenados por el rank del fabricante), no alfabético.
    return Array.from(byFamily, ([name, items]) => ({ family: name, items }))
  }, [filtered])

  // Las anclas son las familias que HAY en pantalla: con una búsqueda activa, un
  // chip que no lleva a ninguna parte es peor que no tenerlo.
  const families = useMemo(() => groups.map((group) => group.family), [groups])

  /** Píxeles desde el borde superior del viewport donde "empieza" la lista. */
  const stickyOffset = useCallback(() => {
    if (!pageScroll) return 0
    const container = listRef.current
    if (!container) return 0
    // El valor sale del DOM y no del prop: `stickyTop` puede venir en rem o en
    // una var CSS y acá hacen falta píxeles.
    const probe = container.querySelector('[data-tint-sticky]')
    return probe ? probe.getBoundingClientRect().height : 0
  }, [pageScroll])

  const scrollToFamily = useCallback(
    (name: string) => {
      setActiveFamily(name)
      const container = listRef.current
      if (!container) return

      if (pageScroll) {
        if (name === ALL) {
          window.scrollTo({
            top: window.scrollY + container.getBoundingClientRect().top - stickyOffset(),
            behavior: 'smooth',
          })
          return
        }
        const section = sectionRefs.current.get(name)
        if (!section) return
        window.scrollTo({
          top: window.scrollY + section.getBoundingClientRect().top - stickyOffset(),
          behavior: 'smooth',
        })
        return
      }

      if (name === ALL) {
        container.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const section = sectionRefs.current.get(name)
      if (!section) return
      // Delta por bounding rect en vez de `offsetTop`: no depende de cuál sea el
      // offset parent de la sección.
      const delta =
        section.getBoundingClientRect().top - container.getBoundingClientRect().top
      container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' })
    },
    [pageScroll, stickyOffset],
  )

  // Qué familia se está viendo: la última cuyo encabezado quedó en o arriba del
  // borde superior de la lista.
  const syncActiveFamily = useCallback(() => {
    const container = listRef.current
    if (!container) return

    const top = pageScroll ? stickyOffset() : container.getBoundingClientRect().top
    if (container.getBoundingClientRect().top - top > -8) {
      setActiveFamily(ALL)
      return
    }
    let current = ALL
    for (const group of groups) {
      const section = sectionRefs.current.get(group.family)
      if (!section) continue
      if (section.getBoundingClientRect().top - top <= 8) current = group.family
      else break
    }
    setActiveFamily(current)
  }, [groups, pageScroll, stickyOffset])

  // En modo página el scroll no pasa por el contenedor: hay que escuchar la
  // ventana o el chip activo se queda clavado en "Todos".
  useEffect(() => {
    if (!pageScroll) return
    const onScroll = () => syncActiveFamily()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pageScroll, syncActiveFamily])

  // Buscar reordena la lista: el chip activo tiene que volver al principio.
  useEffect(() => {
    setActiveFamily(ALL)
    if (!pageScroll) listRef.current?.scrollTo({ top: 0 })
  }, [query, pageScroll])

  useEffect(() => {
    if (!autoFocusSearch) return
    // Foco en el buscador: con cientos de colores, buscar es la acción principal.
    const timer = setTimeout(() => searchRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [autoFocusSearch])

  return (
    <div className={pageScroll ? 'flex flex-col' : 'flex min-h-0 flex-1 flex-col'}>
      <div
        className={
          pageScroll
            ? 'sticky z-[2] flex flex-col gap-3 bg-white pb-3 pt-3'
            : 'flex flex-col gap-3 px-5 pt-4'
        }
        data-tint-sticky={pageScroll ? '' : undefined}
        style={pageScroll ? { top: stickyTop } : undefined}
      >
        {/* Borde `strong` y no `base`: el buscador vive en una barra pegajosa
            blanca sobre una página blanca, así que la hairline de `base` lo
            volvía invisible y parecía texto suelto en vez de un campo. Es la
            acción principal de la carta — tiene que leerse como tal. */}
        <input
          className="h-11 w-full rounded-lg border border-ui-border-strong px-3 text-sm outline-none focus:border-ui-border-interactive"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o código — ej. 51YY 61/792"
          ref={searchRef}
          type="search"
          value={query}
        />
        {families.length > 1 && (
          <FamilyAnchors
            active={activeFamily}
            families={families}
            onPick={scrollToFamily}
          />
        )}
      </div>

      <div
        className={pageScroll ? '' : 'flex-1 overflow-y-auto px-5 pb-4'}
        onScroll={pageScroll ? undefined : syncActiveFamily}
        ref={listRef}
      >
        {filtered.length === 0 ? (
          <Text className="pt-4 text-sm text-ui-fg-subtle">
            No encontramos colores con “{query}”.
          </Text>
        ) : (
          groups.map((group) => (
            <div
              className="mb-5 last:mb-0"
              key={group.family}
              ref={(node) => {
                if (node) sectionRefs.current.set(group.family, node)
                else sectionRefs.current.delete(group.family)
              }}
            >
              {groups.length > 1 ? (
                // Pegajoso: recorriendo cientos de colores hay que poder saber en
                // qué familia se está sin volver a scrollear para arriba.
                <Text
                  className="sticky z-[1] bg-white py-2 text-xs uppercase tracking-wide text-ui-fg-muted"
                  style={{ top: pageScroll ? `calc(${stickyTop} + 6.5rem)` : '0px' }}
                >
                  {group.family}
                </Text>
              ) : (
                <div className="pt-4" />
              )}
              <div className={gridClassName}>
                {group.items.map((color: TintColor) => {
                  const active = selectedCode === color.code
                  return (
                    <button
                      key={`${color.collection}-${color.code}`}
                      className="flex items-center gap-2 rounded-lg border p-2 text-left transition-colors"
                      onClick={() => onSelect(color)}
                      style={{
                        borderColor: active
                          ? 'var(--primary-color)'
                          : 'var(--ui-border-base)',
                        backgroundColor: active
                          ? 'color-mix(in srgb, var(--primary-color) 8%, white)'
                          : 'transparent',
                      }}
                      type="button"
                    >
                      <span
                        aria-hidden
                        className="h-9 w-9 shrink-0 rounded border border-black/10"
                        // Sin hex de la carta va gris: no se inventa un color.
                        style={{
                          backgroundColor: color.hex ?? 'var(--ui-bg-component)',
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{color.name}</span>
                        <span className="block truncate text-xs text-ui-fg-muted">
                          {color.code}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ColorCatalog
