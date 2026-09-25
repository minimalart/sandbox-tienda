'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Text } from '@medusajs/ui'
import { ArrowLeft, Check } from 'lucide-react'
import ColorCatalog, {
  TINT_COLOR_DISCLAIMER,
} from '@modules/products/components/tint-configurator/color-catalog'
import type { TintColor } from '@modules/products/components/tint-configurator/types'
import BaseLineCard from './base-line-card'
import ColorPhotos from './color-photos'
import type { TintBaseLine, TintBasesResponse, TintColorImage } from '../types'

/**
 * Flujo inverso del tintométrico: primero el color, después con qué se logra.
 *
 * Es el camino del cliente que llega con el abanico en la mano: sabe el color y
 * no sabe (ni tiene por qué saber) qué línea de pintura lo consigue. El flujo
 * directo, elegir la base y después el color, sigue viviendo en el PDP.
 *
 * **Va por PASOS, no por ancla.** Antes los dos bloques convivían en la misma
 * pantalla y elegir un color scrolleaba hasta el resultado, abajo de una carta
 * de cientos de swatches: el clic parecía no hacer nada y el resultado quedaba
 * siempre a media pantalla de distancia. Ahora el paso 2 REEMPLAZA la carta, así
 * que el color elegido y sus productos son todo lo que hay en pantalla.
 *
 * El paso vive en la URL (`?color=…&carta=…`) y no en un `useState`: así el
 * botón "atrás" del navegador vuelve a la carta —que es lo que cualquiera
 * espera de algo que se comporta como otra página— y el resultado de un color se
 * puede compartir por link. Se navega con `pathname` y nunca con un href
 * literal: dentro de un demo la URL lleva el prefijo `/demo/{slug}` y un literal
 * lo perdería.
 *
 * La carta llega entera desde el servidor (son cientos de colores, no miles de
 * kilobytes) y las bases se piden recién al elegir un color: son las que dependen
 * del canal, la región y el cliente.
 */

type ColorFinderProps = {
  colors: TintColor[]
}

const COLOR_PARAM = 'color'
const COLLECTION_PARAM = 'carta'

const STEPS = [
  { number: 1 as const, label: 'Elegí el color' },
  { number: 2 as const, label: 'Elegí el producto' },
]

/**
 * Grilla de las cards de producto. Tres columnas en `xl` y no dos: desde que cada
 * card es de UN producto se fue el radio-group de envases, que era lo que pedía
 * ancho, y con dos columnas las cards quedaban desproporcionadamente anchas para
 * lo que tienen adentro (miniatura, título y tres renglones de precio).
 *
 * `grid-cols-1` NO es redundante: un `grid` pelado crea una pista implícita
 * `auto`, que se dimensiona por el `min-content` de la card, y cualquier
 * `white-space: nowrap` de adentro —el título llevaba `truncate`, y los importes
 * siguen— aporta su ancho ENTERO a ese min-content. Medido en el sitio: card de
 * 458px dentro de un viewport de 375, desbordando la página entera. `grid-cols-1`
 * de Tailwind es `minmax(0, 1fr)`, que es lo que corta esa propagación.
 *
 * En `md` van dos porque ahí el panel del color todavía no está al costado (es
 * `lg:block`), así que el ancho es el de la pantalla entera.
 */
const CARD_GRID = 'grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3'

/**
 * Salto de scroll SIN animación. `globals.css` declara
 * `html { scroll-behavior: smooth }`, y con eso cualquier `scrollTo` se anima
 * aunque no se lo pida: se veía la página recorrer la carta entera antes de
 * cambiar de paso. Se apaga el smooth inline durante el salto y se devuelve en
 * el frame siguiente.
 */
const jumpTo = (top: number) => {
  const html = document.documentElement
  html.style.scrollBehavior = 'auto'
  window.scrollTo(0, top)
  requestAnimationFrame(() => {
    html.style.scrollBehavior = ''
  })
}

/**
 * Los dos pasos, siempre visibles: en el paso 2 el cliente tiene que poder ver
 * de un vistazo dónde está y que volver es una opción. El paso ya cumplido es
 * clickeable —es el mismo "volver" que el botón de arriba del resultado— y el
 * que todavía no llegó no lo es.
 */
const StepBar = ({
  current,
  onGoToStep1,
}: {
  current: 1 | 2
  onGoToStep1: () => void
}) => (
  <ol aria-label="Pasos" className="flex items-center gap-2 sm:gap-3">
    {STEPS.map((step, index) => {
      const isCurrent = step.number === current
      const isDone = step.number < current
      const badge = (
        <>
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
            style={{
              borderColor:
                isCurrent || isDone ? 'var(--primary-color)' : 'var(--ui-border-base)',
              backgroundColor: isCurrent ? 'var(--primary-color)' : 'transparent',
              color: isCurrent
                ? '#fff'
                : isDone
                  ? 'var(--primary-color)'
                  : 'var(--ui-fg-muted)',
            }}
          >
            {isDone ? <Check className="size-3.5" /> : step.number}
          </span>
          <span
            className="whitespace-nowrap text-sm"
            style={{
              color: isCurrent ? 'var(--ui-fg-base)' : 'var(--ui-fg-muted)',
              fontWeight: isCurrent ? 500 : 400,
            }}
          >
            {step.label}
          </span>
        </>
      )

      return (
        <li className="flex items-center gap-2 sm:gap-3" key={step.number}>
          {index > 0 ? (
            <span aria-hidden className="h-px w-4 bg-ui-border-base sm:w-8" />
          ) : null}
          {isDone ? (
            <button
              aria-current={undefined}
              className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-70"
              onClick={onGoToStep1}
              type="button"
            >
              {badge}
            </button>
          ) : (
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              {badge}
            </span>
          )}
        </li>
      )
    })}
  </ol>
)

const ColorFinder = ({ colors }: ColorFinderProps) => {
  const countryCode = (useParams().countryCode as string | undefined) ?? ''
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [lines, setLines] = useState<TintBaseLine[] | null>(null)
  /**
   * Las fotos del color vienen con las bases y no con la carta: la carta la
   * renderiza el servidor con cientos de colores y sumarle 8 URLs a cada uno
   * engordaría el HTML de la página entera para mostrar las de uno solo.
   */
  const [photos, setPhotos] = useState<TintColorImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * Contador de reintentos, y única razón por la que existe: un fallo del
   * backend acá es casi siempre pasajero (un gateway que se cae por minutos),
   * y sin esto la única salida de la pantalla era elegir OTRO color —o sea,
   * abandonar el que el cliente vino a buscar—. Es un contador y no un
   * booleano porque tiene que poder disparar el efecto más de una vez.
   */
  const [attempt, setAttempt] = useState(0)
  const inFlight = useRef<AbortController | null>(null)
  /** Dónde estaba la carta cuando se eligió el color, para restaurarla al volver. */
  const catalogScroll = useRef(0)
  /** Se eligió un color y el paso 2 todavía no se pintó: hay que subir al pintarlo. */
  const pendingTop = useRef(false)

  const code = searchParams.get(COLOR_PARAM)
  const collection = searchParams.get(COLLECTION_PARAM)

  // El color sale de la URL pero se resuelve contra la carta: un link viejo o un
  // código tipeado a mano no puede dejar el paso 2 mostrando un color que no
  // existe. Si no matchea, simplemente estamos en el paso 1.
  const selected = useMemo(() => {
    if (!code) return null
    return (
      colors.find(
        (color) =>
          color.code === code && (!collection || color.collection === collection),
      ) ?? null
    )
  }, [code, collection, colors])

  const step: 1 | 2 = selected ? 2 : 1

  const pick = useCallback(
    (color: TintColor) => {
      catalogScroll.current = window.scrollY
      const params = new URLSearchParams(searchParams.toString())
      params.set(COLOR_PARAM, color.code)
      params.set(COLLECTION_PARAM, color.collection)
      pendingTop.current = true
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const back = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(COLOR_PARAM)
    params.delete(COLLECTION_PARAM)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  // El paso 2 arranca arriba: es una pantalla nueva, no la continuación de
  // donde venía scrolleando la carta. Se sube DESPUÉS de que el paso 2 reemplazó
  // a la carta y antes de que el navegador pinte (por eso layout effect): si se
  // sube antes, con la carta todavía en pantalla, el cliente ve la página
  // desplazarse hasta arriba y recién después abrirse el color (DESDEELSUR-74).
  useLayoutEffect(() => {
    if (step !== 2 || !pendingTop.current) return
    pendingTop.current = false
    jumpTo(0)
  }, [step])

  // Volver al paso 1 después de haber bajado por cientos de swatches tiene que
  // devolver al mismo lugar de la carta; si no, hay que volver a buscar el color
  // que se estaba mirando.
  useEffect(() => {
    if (step !== 1) return
    const top = catalogScroll.current
    if (!top) return
    catalogScroll.current = 0
    requestAnimationFrame(() => jumpTo(top))
  }, [step])

  useEffect(() => {
    if (!selected) {
      setLines(null)
      setPhotos([])
      setError(null)
      setLoading(false)
      return
    }

    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setLoading(true)
    setError(null)
    setLines(null)
    setPhotos([])

    const load = async () => {
      try {
        const qs = new URLSearchParams({
          color_code: selected.code,
          collection: selected.collection,
        })
        if (countryCode) qs.set('country_code', countryCode)
        const res = await fetch(`/api/store/tinting/bases?${qs.toString()}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as TintBasesResponse & { message?: string }
        if (controller.signal.aborted) return
        if (!res.ok) {
          setError(data.message ?? 'No pudimos buscar los productos para ese color.')
          return
        }
        setLines(data.lines ?? [])
        setPhotos(data.color?.images ?? [])
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setError('No pudimos buscar los productos para ese color.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [selected, countryCode, attempt])

  return (
    <div className="flex flex-col gap-6">
      <StepBar current={step} onGoToStep1={back} />

      {step === 1 ? (
        <section aria-label="Carta de colores">
          <Text className="text-sm text-ui-fg-subtle">
            Elegí un color de la carta y en el paso siguiente te mostramos con qué
            productos se logra. El precio entonado lo calculamos del producto que
            elijas.
          </Text>
          <Text className="mt-1 text-xs text-ui-fg-muted">
            {colors.length} colores disponibles
          </Text>
          <div className="mt-4">
            <ColorCatalog
              colors={colors}
              gridClassName="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
              onSelect={pick}
              scroll="page"
              selectedCode={null}
              stickyTop="0px"
            />
          </div>
          <Text className="pt-2 text-xs text-ui-fg-muted">{TINT_COLOR_DISCLAIMER}</Text>
        </section>
      ) : selected ? (
        <section aria-label="Productos disponibles">
          {/* Mobile: el color viaja en una barra pegajosa. Es la misma función
              que cumple el panel en desktop —saber siempre qué color estás
              mirando y poder cambiarlo— pero sin robarle ancho a las cards. */}
          <div className="sticky top-0 z-10 mb-4 flex items-center gap-3 border-b border-ui-border-base bg-white py-2 lg:hidden">
            <span
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-md border border-black/10"
              style={{ backgroundColor: selected.hex ?? 'var(--ui-bg-component)' }}
            />
            <div className="min-w-0 flex-1">
              <Text className="truncate text-sm font-medium">{selected.name}</Text>
              <Text className="truncate text-xs text-ui-fg-subtle">{selected.code}</Text>
            </div>
            <button
              className="shrink-0 rounded-lg border border-ui-border-base px-3 py-1.5 text-xs transition-colors"
              onClick={back}
              type="button"
            >
              Cambiar
            </button>
          </div>

          {/* Desktop: dos columnas. El color deja de ocupar una fila entera —que
              con 4-8 líneas de producto era ancho puro desperdiciado— y pasa a
              una columna angosta que acompaña el scroll. */}
          <div className="lg:grid lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:items-start lg:gap-8">
            {/* El aside ya no está oculto en mobile: la card sigue siendo sólo de
                desktop, pero las fotos del color se muestran en los dos (en
                mobile quedan abajo de la barra pegajosa, que cumple el rol de la
                card). Así el carrusel se renderiza UNA vez y no dos veces con
                clases de visibilidad cruzadas. */}
            <aside className="lg:sticky lg:top-4">
              <div className="hidden rounded-lg border border-ui-border-base p-4 lg:block">
                <span
                  aria-hidden
                  className="mb-3 block h-24 w-full rounded-md border border-black/10"
                  style={{ backgroundColor: selected.hex ?? 'var(--ui-bg-component)' }}
                />
                <Text className="font-medium leading-snug">{selected.name}</Text>
                <Text className="mt-0.5 text-xs text-ui-fg-subtle">
                  {selected.code} · {selected.collection}
                </Text>
                <button
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ui-border-base px-3 py-2 text-sm transition-colors hover:bg-ui-bg-subtle"
                  onClick={back}
                  type="button"
                >
                  <ArrowLeft className="size-4" />
                  Cambiar color
                </button>
                {lines && lines.length > 0 ? (
                  <Text className="mt-3 border-t border-ui-border-base pt-3 text-xs text-ui-fg-subtle">
                    {lines.length}{' '}
                    {lines.length === 1 ? 'producto lo logra' : 'productos lo logran'}
                  </Text>
                ) : null}
              </div>
              {photos.length ? (
                <div className="mb-4 lg:mb-0">
                  <ColorPhotos colorName={selected.name} images={photos} />
                </div>
              ) : null}
              {/* El disclaimer del color ya se muestra en mobile al final de la
                  columna de productos: acá tiene que quedar sólo en desktop. */}
              <Text className="hidden pt-3 text-xs text-ui-fg-muted lg:block">
                {TINT_COLOR_DISCLAIMER}
              </Text>
            </aside>

            <div>
              {loading ? (
                <div className={CARD_GRID}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      className="h-40 animate-pulse rounded-lg bg-ui-bg-subtle"
                      key={i}
                    />
                  ))}
                </div>
              ) : error ? (
                // Con la misma forma que el empty state, y por la misma razón:
                // un renglón de texto rojo suelto no dice qué hacer después.
                // Acá el camino principal es REINTENTAR —el color elegido
                // sigue siendo el que el cliente quiere— y cambiar de color
                // queda como salida secundaria.
                <div className="rounded-lg border border-ui-border-base p-6 text-center">
                  <Text className="text-sm text-ui-fg-error">{error}</Text>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
                      onClick={() => setAttempt((n) => n + 1)}
                      style={{ backgroundColor: 'var(--primary-color)' }}
                      type="button"
                    >
                      Reintentar
                    </button>
                    <button
                      className="text-sm underline"
                      onClick={back}
                      style={{ color: 'var(--primary-color)' }}
                      type="button"
                    >
                      Elegir otro color
                    </button>
                  </div>
                </div>
              ) : lines && lines.length > 0 ? (
                <div className={CARD_GRID}>
                  {lines.map((line) => (
                    <BaseLineCard
                      color={selected}
                      countryCode={countryCode}
                      key={line.key}
                      line={line}
                    />
                  ))}
                </div>
              ) : (
                // Un color puede estar en la carta y no tener ninguna base vendible
                // en esta tienda. Decirlo es mejor que dejar la sección en blanco.
                <div className="rounded-lg border border-ui-border-base p-6 text-center">
                  <Text className="text-sm text-ui-fg-subtle">
                    Por ahora no tenemos productos con {selected.name} en esta tienda.
                  </Text>
                  <button
                    className="mt-3 text-sm underline"
                    onClick={back}
                    style={{ color: 'var(--primary-color)' }}
                    type="button"
                  >
                    Probá con otro color
                  </button>
                </div>
              )}

              <Text className="pt-4 text-xs text-ui-fg-muted lg:hidden">
                {TINT_COLOR_DISCLAIMER}
              </Text>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default ColorFinder
