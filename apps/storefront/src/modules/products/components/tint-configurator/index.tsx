'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Text } from '@medusajs/ui'
import { ChevronRight, Palette } from 'lucide-react'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import { useTenantSections } from '@lib/site-config/context'
import { useTintSelectionStore } from '@lib/stores/tint-selection.store'
import { convertToLocale } from '@lib/util/money'
import ColorPickerModal, { type TintColor } from './color-picker-modal'

/**
 * Selector de color de una base entonable (sistema tintométrico).
 *
 * Se monta en el PDP de cualquier producto y se AUTOAPAGA: si la base no es
 * entonable (o la feature está apagada), `/api/store/tinting/colors` devuelve
 * `tintable: false` y esto renderiza `null`. Así el resto del catálogo no se
 * entera de que existe.
 *
 * NO tiene botón de agregar ni stepper propios: el color elegido y el precio del
 * ERP van a `tint-selection.store` y el ÚNICO botón de compra es el del footer
 * fijo, que ya maneja cantidad y lleva el color de la marca. Tener dos botones
 * permitía comprar la base sin color, que no es un producto vendible.
 *
 * El precio se cotiza siempre por UN envase: la cantidad la maneja el carrito.
 */

type TintConfiguratorProps = {
  variantId: string
  currencyCode: string
  /** Título de la base, para el encabezado del modal. */
  productTitle?: string | null
}

const QUOTE_DEBOUNCE_MS = 250

const TintConfigurator = ({ variantId, currencyCode, productTitle }: TintConfiguratorProps) => {
  const [colors, setColors] = useState<TintColor[] | null>(null)
  const [selected, setSelected] = useState<TintColor | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  /**
   * El color es opcional: este artículo también se vende terminado. Cambia el
   * copy y habilita el "Quitar", que es la única forma de volver al producto sin
   * entonar una vez que se eligió un color.
   */
  const [optional, setOptional] = useState(false)

  // El país da el contexto de precios cuando todavía no hay carrito. Sin él el
  // backend no puede resolver el precio de catálogo de la base y no hay con qué
  // calcular cuánto suma el entonado.
  const countryCode = useParams().countryCode as string | undefined

  // "Buscá tu color" (/colores) se puede apagar por tenant. Si el demo lo
  // esconde del nav, el PDP tampoco lo puede ofrecer: sería el único acceso a
  // una sección que el cliente decidió no mostrar.
  const { isTintingHidden } = useTenantSections()

  const setTintable = useTintSelectionStore((state) => state.setTintable)
  const setQuoting = useTintSelectionStore((state) => state.setQuoting)
  const setSelection = useTintSelectionStore((state) => state.setSelection)
  const setError = useTintSelectionStore((state) => state.setError)
  const clear = useTintSelectionStore((state) => state.clear)
  const quoting = useTintSelectionStore((state) => state.quoting)
  const storedError = useTintSelectionStore((state) => state.error)
  const unitPrice = useTintSelectionStore((state) => state.unitPrice)
  const surcharge = useTintSelectionStore((state) => state.surcharge)

  const inFlight = useRef<AbortController | null>(null)

  // Carta de colores de esta base. Un fallo acá apaga el bloque en silencio: el
  // PDP tiene que seguir mostrando el producto, y `tintable: false` desbloquea el
  // botón de comprar (vender la base sin entonar es peor que no vender nada).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(
          `/api/store/tinting/colors?variant_id=${encodeURIComponent(variantId)}`,
        )
        const data = (await res.json()) as {
          tintable?: boolean
          optional?: boolean
          colors?: TintColor[]
        }
        if (cancelled) return
        const tintable = Boolean(data.tintable && data.colors?.length)
        setColors(tintable ? (data.colors as TintColor[]) : [])
        setOptional(Boolean(data.optional))
        setTintable(variantId, tintable, Boolean(data.optional))
      } catch {
        if (cancelled) return
        setColors([])
        setOptional(false)
        setTintable(variantId, false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [variantId, setTintable])

  // Al desmontar (o cambiar de variante) se limpia la selección: si no, el botón
  // del footer podría quedar habilitado con el color de otro producto.
  useEffect(() => {
    setSelected(null)
    clear()
    return () => clear()
  }, [variantId, clear])

  /**
   * Vuelve al producto sin entonar. `clear()` borra la cotización del store, que
   * es lo que hace que el footer deje de mostrar el precio del ERP y vuelva al de
   * catálogo — sin esto el blanco quedaría con el precio del color elegido.
   */
  const removeColor = () => {
    setSelected(null)
    clear()
    // `clear()` deja `tintable` en `null` y ahí el botón vuelve a decidirse por la
    // metadata del producto, que puede estar vieja. Se re-afirma lo que ya
    // contestó el backend para que la salida sea determinística.
    setTintable(variantId, true, true)
  }

  // Cotización en vivo, por UN envase. Debounced y con abort: elegir varios
  // colores seguidos deja una sola llamada viva.
  useEffect(() => {
    if (!selected) return

    const timer = setTimeout(async () => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      setQuoting(variantId, true)

      try {
        const res = await fetch('/api/store/tinting/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant_id: variantId,
            color_code: selected.code,
            collection: selected.collection,
            quantity: 1,
            ...(countryCode ? { country_code: countryCode } : {}),
          }),
          signal: controller.signal,
        })
        const data = (await res.json()) as {
          quote?: {
            unit_price: number
            tint_surcharge: number | null
            currency_code: string | null
          }
          message?: string
        }
        if (controller.signal.aborted) return
        if (res.ok && data.quote) {
          setSelection({
            variantId,
            color: {
              code: selected.code,
              name: selected.name,
              collection: selected.collection,
              hex: selected.hex,
            },
            unitPrice: data.quote.unit_price,
            surcharge: data.quote.tint_surcharge,
            currencyCode: data.quote.currency_code,
          })
        } else {
          setError(variantId, data.message ?? 'No pudimos calcular el precio de este color.')
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
        setError(variantId, 'No pudimos calcular el precio de este color.')
      }
    }, QUOTE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [selected, variantId, countryCode, setQuoting, setSelection, setError])

  // Base no entonable (o carta vacía): el bloque no existe.
  if (!colors || colors.length === 0) return null

  // `convertToLocale` devuelve el número sin símbolo (así lo usa todo el
  // storefront), el `$` lo pone quien muestra.
  const money = (amount: number) =>
    `$ ${convertToLocale({ amount, currency_code: currencyCode })}`

  return (
    <section
      aria-label="Elegí tu color"
      className="mt-6 rounded-lg border border-ui-border-base p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <Text className="font-medium">
          {optional ? '¿Lo querés en otro color?' : 'Elegí tu color'}
        </Text>
        <Text className="text-xs text-ui-fg-subtle">
          {colors.length} {colors.length === 1 ? 'color' : 'colores'} disponibles
        </Text>
      </div>
      {/* En la base opcional hay que decir que se puede NO elegir: el bloque es
          idéntico al de una base obligatoria y sin esto se lee como un paso
          pendiente. */}
      {optional ? (
        <Text className="mt-1 text-xs text-ui-fg-subtle">
          También podés llevarlo tal como está, sin entonar.
        </Text>
      ) : null}

      {/* Trigger del selector. Con cientos de colores una grilla inline no sirve:
          el modal tiene buscador por nombre o código y tabs por familia. */}
      <button
        aria-haspopup="dialog"
        className="mt-3 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
        onClick={() => setPickerOpen(true)}
        style={{
          // Sin color elegido el borde usa el primario para que se lea como el
          // paso que falta. En la base opcional NO: ahí no falta nada, y pintarlo
          // de primario diría que la compra está trabada cuando no lo está.
          borderColor:
            selected || optional ? 'var(--ui-border-base)' : 'var(--primary-color)',
        }}
        type="button"
      >
        <span
          aria-hidden
          className="h-11 w-11 shrink-0 rounded border border-black/10"
          style={{ backgroundColor: selected?.hex ?? 'var(--ui-bg-component)' }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-sm">
            {selected ? selected.name : optional ? 'Elegir de la carta' : 'Elegí tu color'}
          </span>
          <span className="block truncate text-xs text-ui-fg-subtle">
            {selected
              ? selected.code
              : optional
                ? 'Opcional: el precio lo cotiza el sistema'
                : 'Necesario para agregar al carrito'}
          </span>
        </span>
        <span aria-hidden className="text-ui-fg-muted">
          ›
        </span>
      </button>

      {/* Salida al flujo inverso (/colores): elegir el color primero y ver con
          qué bases se logra. Acá abajo y no arriba a propósito: el camino
          principal sigue siendo la carta de ESTA base; esto es el plan B para
          quien no encontró su color entre los de este producto. */}
      {!isTintingHidden ? (
        <LocalizedClientLink
          className="mt-3 flex items-center gap-3 rounded-lg p-3 transition-colors hover:brightness-95"
          href="/colores"
          style={{ backgroundColor: 'var(--mc-green-soft)' }}
        >
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--mc-green-pale)' }}
          >
            <Palette className="h-5 w-5" style={{ color: 'var(--primary-color)' }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              ¿No encontraste el color que buscás?
            </span>
            <span className="block text-xs text-ui-fg-subtle">
              Explorá la carta completa y mirá con qué productos se logra
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-sm text-ui-fg-subtle sm:flex">
            Ver todos los colores
            <ChevronRight className="h-4 w-4" />
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ui-fg-muted sm:hidden" />
        </LocalizedClientLink>
      ) : null}

      <ColorPickerModal
        colors={colors}
        onClose={() => setPickerOpen(false)}
        onSelect={setSelected}
        open={pickerOpen}
        selectedCode={selected?.code ?? null}
        subtitle={productTitle ?? null}
      />

      {/* Desglose informativo. El total y el botón viven en el footer fijo: acá
          sólo se explica de dónde sale el precio. */}
      {selected ? (
        <div className="mt-3 space-y-1 border-t border-ui-border-base pt-3 text-sm">
          {/* La salida del entonado. Sólo en la base opcional: en una `BASE P`
              quitar el color deja un producto que no se puede comprar, así que
              ofrecerlo sería ofrecer un callejón sin salida. */}
          {optional ? (
            <div className="flex justify-end">
              <button
                className="text-xs text-ui-fg-subtle underline underline-offset-2 hover:text-ui-fg-base"
                onClick={removeColor}
                type="button"
              >
                Quitar el color y llevarlo sin entonar
              </button>
            </div>
          ) : null}
          {quoting ? <Text className="text-ui-fg-subtle">Calculando el precio…</Text> : null}
          {!quoting && storedError ? (
            <Text className="text-ui-fg-error">{storedError}</Text>
          ) : null}
          {!quoting && !storedError && typeof unitPrice === 'number' ? (
            <>
              {typeof surcharge === 'number' ? (
                <div className="flex justify-between text-ui-fg-subtle">
                  <span>Entonado {selected.name}</span>
                  <span>+{money(surcharge)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-medium">
                <span>Precio por envase</span>
                <span>{money(unitPrice)}</span>
              </div>
              <Text className="text-xs text-ui-fg-muted">IVA incluido</Text>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default TintConfigurator
