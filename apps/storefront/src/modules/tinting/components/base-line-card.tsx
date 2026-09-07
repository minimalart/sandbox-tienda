'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Text } from '@medusajs/ui'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCartStore } from '@lib/stores/cart.store'
import { convertToLocale } from '@lib/util/money'
import {
  canIncrementQuantity,
  getLineItemMaxQuantity,
} from '@lib/util/max-purchasable-quantity'
import type { TintColor } from '@modules/products/components/tint-configurator/types'
import { enqueueQuote } from '../lib/quote-scheduler'
import type { TintBaseLine, TintBaseSize } from '../types'

/**
 * Un PRODUCTO entonable con el color ya elegido, y un botón que lo agrega con ESE
 * color.
 *
 * Una card por producto, como en el resto de la tienda: cada envase es un artículo
 * distinto del ERP y su propio producto en Medusa, así que el balde de 4 y el de
 * 20 tienen su card igual que en el PLP y en el buscador. Antes se unificaban los
 * tamaños de una línea en una sola card con los envases como chips, y era la única
 * pantalla del sitio donde había que elegir el envase adentro de la card.
 *
 * Los chips sobreviven para el único caso en que un producto trae más de un
 * envase: varias variantes de presentación. Ahí elegir es OBLIGATORIO y se muestra
 * como tal —rótulo propio, chips con el borde primario y el botón rotulado "Elegí
 * el envase"—, la misma gramática que usa el PDP para el color: un botón gris que
 * no dice por qué está gris deja al cliente clickeando la nada.
 *
 * **El precio con color se cotiza sólo cuando el cliente elige ESTE producto**
 * ("Ver precio con color"), nunca solo. Cotizar de scroll —cada card al entrar al
 * viewport— reventaba el rate limit del endpoint (40 por minuto por IP): un color
 * cualquiera lo logran 45 productos, así que bastaba con bajar la página para que
 * la pantalla entera quedara en "Demasiadas consultas de color". Y era gasto puro:
 * el cliente compra uno, no los 45. Hasta que elige, cada card muestra el precio
 * de catálogo de la base etiquetado como "sin entonar".
 *
 * Por eso el flujo tiene dos pasos y no uno: primero elegir (que cotiza), después
 * agregar. "Agregar al carrito" no aparece hasta que hay precio, que es la misma
 * regla que antes hacía el botón deshabilitado mientras cotizaba: nadie agrega un
 * envase entonado sin haber visto cuánto sale.
 *
 * El desglose (base + entonado = precio del envase) es el mismo del PDP, y por
 * la misma razón: el precio entonado es bastante mayor que el de góndola de la
 * base y sin decir de dónde sale parece un error de precio.
 */

type BaseLineCardProps = {
  line: TintBaseLine
  color: TintColor
  countryCode: string
}

type TintLineMetadata = {
  color_code?: string
  collection?: string
}

/**
 * `size_label` ya viene con el ENVASE que se vende: lo normaliza el backend con
 * la misma regla que el título del producto (R25), y cuando el ERP no manda
 * etiqueta lo deriva del litraje ahí mismo. Acá NO se cae a `size_liters`, que es
 * el contenido de base que usa el motor para cotizar —8,7 donde el envase es 10—:
 * mostrarlo como envase es exactamente la contradicción que arregló
 * DESDEELSUR-27. Sin etiqueta queda el código de artículo, que es ruido pero no
 * miente sobre el litraje.
 */
const sizeText = (size: TintBaseSize) => size.size_label?.trim() || size.article_code

/**
 * El envase para la etiqueta, sin el fallback al código de artículo: en un chip
 * que hay que elegir "PL0012345" al menos distingue una opción de otra, pero
 * como etiqueta destacada de la card es ruido del ERP.
 */
const sizeBadgeText = (size: TintBaseSize) => size.size_label?.trim() || null

const BaseLineCard = ({ line, color, countryCode }: BaseLineCardProps) => {
  const [selected, setSelected] = useState<TintBaseSize | null>(
    line.sizes.length === 1 ? line.sizes[0] : null,
  )
  const [quote, setQuote] = useState<{
    unitPrice: number
    surcharge: number | null
    currency: string | null
  } | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const inFlight = useRef<AbortController | null>(null)

  const setCart = useCartStore((state) => state.setCart)
  const openCart = useCartStore((state) => state.openCart)
  const cartItems = useCartStore((state) => state.cart?.items)
  const changeItemQuantity = useCartStore((state) => state.changeItemQuantity)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const pendingQuantityUpdates = useCartStore((state) => state.pendingQuantityUpdates)

  // La identidad de una línea entonada es (variante + color), no la variante
  // sola: la misma base en dos colores son dos líneas del carrito. El stepper
  // tiene que mover la del color de ESTA pantalla y del envase elegido, o
  // estaría editando el pedido de otro color.
  const lineItem = useMemo(() => {
    if (!selected || !cartItems) return null
    return (
      cartItems.find((item) => {
        if (item.variant_id !== selected.variant_id) return false
        const tint = (item.metadata as { tint?: TintLineMetadata } | null | undefined)?.tint
        if (!tint) return false
        return (
          tint.color_code === color.code &&
          (!tint.collection || tint.collection === color.collection)
        )
      }) ?? null
    )
  }, [cartItems, selected, color.code, color.collection])

  const quantityInCart = lineItem?.quantity ?? 0
  const isUpdating = lineItem ? pendingQuantityUpdates.has(lineItem.id) : false

  // Techo de stock de la base (el carrito viene enriquecido con el stock real por
  // variante). `null` = sin techo conocido. Sin esto, clickear "+" rápido de más
  // mandaba UNA cantidad imposible y el rollback devolvía la cantidad previa.
  const stockCeiling = getLineItemMaxQuantity(lineItem)
  const canIncrement = canIncrementQuantity(quantityInCart, stockCeiling)

  // Cambiar de color —o de envase— reinicia la tarjeta: mostrar el precio del
  // color anterior junto al swatch del nuevo sería cobrar una cosa y mostrar otra,
  // y el cliente vuelve a "Ver precio con color" para el par nuevo.
  useEffect(() => {
    inFlight.current?.abort()
    setQuote(null)
    setQuoteError(null)
    setQuoting(false)
  }, [color.code, color.collection, selected])

  /**
   * Cotiza ESTE producto con ESTE color. Sólo la dispara el cliente: ver el
   * comentario de arriba y `lib/quote-scheduler.ts`.
   */
  const requestQuote = () => {
    if (!selected || quoting) return

    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    // Congelado en una const: el `finally` y los `set*` corren después de un await
    // y `selected` ya podría ser otro envase.
    const quoted = selected
    // El rótulo de "calculando" se prende al ENCOLAR y no al salir a la red: la
    // espera en la cola es tiempo de cálculo desde el punto de vista del cliente.
    setQuoting(true)
    setQuoteError(null)

    void enqueueQuote(async () => {
      // Mientras esperaba el turno el cliente pudo cambiar de envase o de color.
      if (controller.signal.aborted) return
      try {
        const res = await fetch('/api/store/tinting/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant_id: quoted.variant_id,
            color_code: color.code,
            collection: color.collection,
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
          setQuote({
            unitPrice: data.quote.unit_price,
            surcharge: data.quote.tint_surcharge,
            currency: data.quote.currency_code ?? quoted.currency_code,
          })
        } else {
          setQuoteError(data.message ?? 'No pudimos calcular el precio de este color.')
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
        setQuoteError('No pudimos calcular el precio de este color.')
      } finally {
        if (!controller.signal.aborted) setQuoting(false)
      }
    })
  }

  const handleAdd = async () => {
    if (!selected || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/store/tinting/line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: selected.variant_id,
          colorCode: color.code,
          collection: color.collection,
          quantity: 1,
          countryCode,
        }),
      })
      const data = (await res.json()) as { cart?: unknown; message?: string }
      if (!res.ok) {
        toast.error(data.message ?? 'No pudimos agregar el color al carrito.')
        return
      }
      if (data.cart) setCart(data.cart as never)
      openCart()
    } catch {
      toast.error('No pudimos agregar el color al carrito.')
    } finally {
      setAdding(false)
    }
  }

  const money = (amount: number, currency: string | null) =>
    `$ ${convertToLocale({ amount, currency_code: currency || 'ARS' })}`

  const sizeBadge = line.sizes.length === 1 ? sizeBadgeText(line.sizes[0]) : null

  const catalogPrice = selected?.base_price ?? line.sizes[0]?.base_price ?? null
  const catalogCurrency = selected?.currency_code ?? line.sizes[0]?.currency_code ?? null
  const needsSize = !selected

  // La base del desglose se despeja del total cotizado y no del precio de
  // catálogo: el ERP cotiza con la lista del cliente, así que restar el
  // entonado es la única forma de que las tres cifras cierren entre sí.
  const breakdownBase =
    quote && typeof quote.surcharge === 'number' ? quote.unitPrice - quote.surcharge : null

  return (
    // Dos filas, no dos columnas: la imagen sólo acompaña al título y a los
    // chips. El bloque de precios va a lo ANCHO de la card porque al lado de una
    // imagen de 96px, en un teléfono, le quedaban ~199px — menos que los ~200
    // que mide "Precio por envase" con su importe, así que empujaba la card más
    // ancha que la pantalla y desbordaba la página entera.
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-ui-bg-subtle">
          {line.product?.thumbnail ? (
            <Image
              alt={line.product.title ?? line.product_line}
              className="object-contain"
              fill
              sizes="96px"
              src={line.product.thumbnail}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            {/* Título ENTERO, no truncado: en tres columnas "Albalatex design
                satinado Base F x4 lt" se cortaba en "Albalatex design satin…",
                así que las cards de una misma línea quedaban indistinguibles
                entre sí. `break-words` porque los códigos de artículo del ERP
                no traen espacios donde cortar.

                **Texto, nunca link al PDP** (DESDEELSUR-37). El PDP de una base
                entonable es el flujo DIRECTO —elegí la base, después el color— y
                llegar ahí desde acá tira a la basura el color que el cliente ya
                eligió: el configurador del PDP arranca en blanco y hay que
                volver a buscar el color en una carta de miles de swatches. Peor:
                una base sin `sellable_untinted` no se puede comprar sin entonar,
                así que el PDP puede recibirlo con el botón de compra apagado. La
                card ya tiene todo lo que hace falta para comprar (precio con
                color y "Agregar al carrito"), así que el título es SÓLO
                identificación. */}
            <Text className="break-words text-sm font-medium">
              {line.product?.title ?? line.product_line}
            </Text>
            {/* La línea de pintura sólo como respaldo: el título del producto YA
                la contiene ("Albacryl látex interior mate Base F x4 lt"), y
                repetirla debajo en el crudo del ERP —mayúsculas sostenidas, sin
                tildes— leía como un error de datos. */}
            {line.product?.title ? null : (
              <Text className="break-words text-xs text-ui-fg-subtle">
                {line.product_line}
              </Text>
            )}
            {/* El envase, en etiqueta. Está dentro del título ("…Base F x4 lt")
                pero es el ÚNICO dato que distingue una card de la de al lado, y
                al final de tres líneas de texto no se ve. Sólo con un envase:
                con varios el dato ya está en los chips, que además hay que
                elegir. */}
            {sizeBadge ? (
              <span
                className="rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{
                  borderColor: 'var(--primary-color)',
                  backgroundColor: 'color-mix(in srgb, var(--primary-color) 12%, white)',
                }}
              >
                {sizeBadge}
              </span>
            ) : null}
          </div>

          {/* Paso obligatorio. Con un solo envase no hay nada que elegir: se
              autoselecciona y el rótulo sobra. */}
          {line.sizes.length > 1 ? (
            <div>
              <Text
                className="mb-1.5 text-xs font-medium"
                style={{
                  color: needsSize ? 'var(--primary-color)' : 'var(--ui-fg-subtle)',
                }}
              >
                {needsSize ? 'Elegí el envase' : 'Envase'}
              </Text>
              <div className="flex flex-wrap gap-2">
                {line.sizes.map((size) => {
                  const active = selected?.article_code === size.article_code
                  return (
                    <button
                      key={size.article_code}
                      aria-pressed={active}
                      className="rounded-full border px-3 py-1.5 text-xs transition-colors"
                      onClick={() => setSelected(size)}
                      style={{
                        // Sin envase elegido TODOS los chips llevan el borde
                        // primario: es el paso que falta, no una opción más.
                        borderColor:
                          active || needsSize
                            ? 'var(--primary-color)'
                            : 'var(--ui-border-base)',
                        backgroundColor: active
                          ? 'color-mix(in srgb, var(--primary-color) 12%, white)'
                          : 'transparent',
                        fontWeight: active ? 500 : 400,
                      }}
                      type="button"
                    >
                      {sizeText(size)}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* `basis-[200px]` y no `flex-1 min-w-[200px]`: 200px es lo que mide
          "Precio por envase" con su importe, y tiene que ser el tamaño BASE
          para que el algoritmo de wrap lo tenga en cuenta. Con `flex-1` la
          base es 0, así que la fila nunca decide envolver y el `min-width`
          termina estirando la línea por fuera de la card. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grow basis-[200px]">
            {quoting ? (
              // El precio de catálogo se queda mientras cotiza, con el mismo
              // criterio que en el error: la cifra que ya estaba no dejó de ser
              // cierta, y sacarla salta la card entera de alto.
              <div className="space-y-0.5">
                {catalogPrice !== null ? (
                  <Text className="text-sm text-ui-fg-subtle">
                    {money(catalogPrice, catalogCurrency)} sin entonar
                  </Text>
                ) : null}
                <Text className="text-xs text-ui-fg-muted">
                  Calculando el precio con color…
                </Text>
              </div>
            ) : quoteError ? (
              // El precio de catálogo se queda: el error es de la cotización del
              // color, no del producto, y dejar la card sin ninguna cifra la vuelve
              // indistinguible de las de al lado.
              <div className="space-y-0.5">
                {catalogPrice !== null ? (
                  <Text className="text-sm text-ui-fg-subtle">
                    {money(catalogPrice, catalogCurrency)} sin entonar
                  </Text>
                ) : null}
                <Text className="text-xs text-ui-fg-error">{quoteError}</Text>
              </div>
            ) : quote ? (
              // Mismo desglose que el PDP: cuánto es la base y cuánto agrega el
              // color. Si el ERP no separó el entonado se muestra sólo el total,
              // que es el dato que sí es cierto.
              <div className="space-y-0.5 text-sm">
                {breakdownBase !== null ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3 text-ui-fg-subtle">
                      <span className="truncate">Base sin entonar</span>
                      <span className="whitespace-nowrap">
                        {money(breakdownBase, quote.currency)}
                      </span>
                    </div>
                    {/* Sin el nombre del color: es fijo en toda la pantalla y
                        vive en el panel, y acá sólo hacía que la etiqueta se
                        truncara ("Entonado Toque…"). */}
                    <div className="flex items-baseline justify-between gap-3 text-ui-fg-subtle">
                      <span className="truncate">Entonado</span>
                      <span className="whitespace-nowrap">
                        +{money(quote.surcharge as number, quote.currency)}
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-baseline justify-between gap-3 font-medium">
                  <span className="truncate">Precio por envase</span>
                  <span className="whitespace-nowrap">
                    {money(quote.unitPrice, quote.currency)}
                  </span>
                </div>
                <Text className="text-xs text-ui-fg-muted">IVA incluido</Text>
              </div>
            ) : catalogPrice !== null ? (
              // Todavía no lo eligió, así que todavía no cotizó. El precio de
              // catálogo va SIEMPRE etiquetado como "sin entonar": es menor que el
              // entonado, y mostrarlo pelado sería publicar un precio que después
              // sube en el carrito.
              <Text className="text-sm text-ui-fg-subtle">
                {needsSize ? 'Desde ' : ''}
                {money(catalogPrice, catalogCurrency)} sin entonar
              </Text>
            ) : null}
          </div>

          {quantityInCart > 0 && lineItem ? (
            // Ya está en el carrito con ESTE color y ESTE envase: el botón deja
            // paso al stepper, como cualquier otra card del sitio.
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Text className="text-xs text-ui-fg-subtle">En el carrito</Text>
              <div
                className={`flex items-stretch divide-x divide-ui-border-base overflow-hidden rounded-lg border border-ui-border-base ${
                  isUpdating ? 'opacity-70' : ''
                }`}
              >
                {quantityInCart <= 1 ? (
                  <button
                    aria-label="Quitar del carrito"
                    className="p-2 text-red-600 transition-colors hover:bg-red-50"
                    onClick={() => updateQuantity(lineItem.id, 0)}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : (
                  <button
                    aria-label="Quitar una unidad"
                    className="p-2 transition-colors hover:bg-ui-bg-subtle"
                    onClick={() => changeItemQuantity(lineItem.id, -1)}
                    type="button"
                  >
                    <Minus className="size-4" />
                  </button>
                )}
                <span className="flex w-9 items-center justify-center text-sm font-medium">
                  {quantityInCart}
                </span>
                <button
                  aria-label="Agregar una unidad"
                  className="p-2 transition-colors hover:bg-ui-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canIncrement}
                  title={canIncrement ? undefined : 'No hay más stock disponible'}
                  onClick={() => changeItemQuantity(lineItem.id, 1)}
                  type="button"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          ) : quote ? (
            <button
              // `ml-auto`: cuando el desglose se lleva la fila entera, el botón
              // cae solo en la siguiente y sin esto se iría al borde izquierdo.
              className="ml-auto shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
              disabled={adding}
              onClick={handleAdd}
              style={{ backgroundColor: 'var(--primary-color)' }}
              type="button"
            >
              {adding ? 'Agregando…' : 'Agregar al carrito'}
            </button>
          ) : (
            // Elegir ESTE producto es lo que dispara la cotización. El botón dice
            // QUÉ falta y no sólo que no se puede —mismo criterio que el "Elegí un
            // color" del footer del PDP—, y sin envase elegido no hay qué cotizar.
            <button
              className="ml-auto shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
              disabled={needsSize || quoting}
              onClick={requestQuote}
              style={{
                borderColor: 'var(--primary-color)',
                color: 'var(--primary-color)',
                backgroundColor: 'color-mix(in srgb, var(--primary-color) 8%, white)',
              }}
              type="button"
            >
              {needsSize
                ? 'Elegí el envase'
                : quoting
                  ? 'Calculando…'
                  : quoteError
                    ? 'Reintentar'
                    : 'Ver precio con color'}
            </button>
          )}
      </div>
    </div>
  )
}

export default BaseLineCard
