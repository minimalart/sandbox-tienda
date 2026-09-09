'use client'

import { useAddToCartAnimation } from '@lib/context/add-to-cart-animation'
import { useCartStore } from '@lib/stores/cart.store'
import { useDemoHref, useTenant } from '@lib/site-config/context'
import { isImpulseTemplate } from '@lib/site-config/template-helpers'
import type { HttpTypes } from '@medusajs/types'
import { toast } from '@medusajs/ui'
import type { KitContentItem } from '@lib/site-config/types'
import ProductImage from '@modules/common/components/product-image'
import { useParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import FragranceSelector from '../fragrance-selector'
import type { FragranceItem } from '../fragrance-selector'
import IdealFor, { hasIdealForItems } from '../ideal-for'
import FormInput from '@modules/common/components/form-input'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import Textarea from '@modules/common/components/textarea'
import ProductInformation from '../product-information'
import ProductPrice from '../product-price'
import SubscribeAction from '../subscribe-action'
import type { SubscriptionActionConfig } from '../subscribe-action'
import MobileActions from './mobile-actions'
import { isOptionalTintProduct, isTintableProduct } from '@lib/util/tinting'
import {
  canIncrementQuantity,
  getLineItemMaxQuantity,
  getVariantMaxQuantity,
} from '@lib/util/max-purchasable-quantity'
import {
  hasTintColor,
  isTintSelectionReady,
  isTintingOptional,
  requiresTintSelection,
  useTintSelectionStore,
} from '@lib/stores/tint-selection.store'
import OptionSelect from './option-select'
import {
  type ProductVariantSelection,
  useProductVariantSelection,
} from './use-variant-selection'

export type KitProductOption = {
  productId: string
  title: string
  href: string
  image: string
}

export type KitProductDetails = {
  options: KitProductOption[]
  contents: KitContentItem[]
}

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region?: HttpTypes.StoreRegion
  disabled?: boolean
  hidePrice?: boolean
  description?: string
  inline?: boolean
  productPage?: boolean
  inStock?: boolean
  fragrances?: FragranceItem[]
  kitDetails?: KitProductDetails | null
  afterPriceActions?: ReactNode
  /**
   * Externally-owned variant selection. When provided (e.g. the quick-view modal
   * renders the size dropdown next to the price), ProductActions shares that
   * selection instead of its internal one and hides its own inline selector.
   */
  selection?: ProductVariantSelection
  /**
   * Compras recurrentes: config server-resuelta (toggle del tenant + sesión +
   * direcciones) que muestra el bloque "Suscribirse". Ausente = oculto (ej.
   * quick-view modal, tenants sin la feature).
   */
  subscription?: SubscriptionActionConfig
}

function ExpandableDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const [clamped, setClamped] = useState(false)

  useEffect(() => {
    const el = textRef.current
    if (el) {
      setClamped(el.scrollHeight > el.clientHeight)
    }
  }, [description])

  return (
    <div className='mt-2'>
      <p
        ref={textRef}
        className={`text-gray-600 text-sm leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}
        data-testid='product-description'
      >
        {description}
      </p>
      {clamped && (
        <button
          type='button'
          className='mt-1 font-medium text-[--primary-color] text-sm hover:underline'
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  )
}

function KitOptions({
  options,
  currentProductId,
}: {
  options: KitProductOption[]
  currentProductId: string
}) {
  if (!options.length) return null

  return (
    <div className='mt-4'>
      <h2 className='mb-3 font-semibold text-gray-900 text-sm'>
        Opciones de kit
      </h2>
      <div className='no-scrollbar flex gap-3 overflow-x-auto pb-2'>
        {options.map((option) => {
          const isActive = option.productId === currentProductId

          return (
            <LocalizedClientLink
              key={option.productId}
              href={option.href}
              className={`relative flex h-[96px] w-[120px] shrink-0 items-center justify-center rounded-xl border bg-white p-2 transition-all ${
                isActive
                  ? 'border-[--primary-color] shadow-[0_0_0_1px_var(--primary-color)]'
                  : 'border-gray-200 hover:border-[--primary-color] hover:shadow-md'
              }`}
              title={option.title}
            >
              <span className='relative h-full w-full'>
                <ProductImage
                  alt={option.title}
                  className='object-contain'
                  fill
                  sizes='120px'
                  src={option.image}
                />
              </span>
            </LocalizedClientLink>
          )
        })}
      </div>
    </div>
  )
}

function KitContents({ contents }: { contents: KitContentItem[] }) {
  const [expanded, setExpanded] = useState(true)

  if (!contents.length) return null

  return (
    <div className='mt-5 border-t border-gray-100 pt-4'>
      <button
        type='button'
        className='flex w-full items-center justify-between gap-3 text-left'
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <h3 className='font-semibold text-gray-900 text-base'>
          ¿Qué contiene el kit?
        </h3>
        <svg
          aria-hidden='true'
          className={`h-4 w-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox='0 0 20 20'
          fill='none'
        >
          <path
            d='M5 12.5L10 7.5L15 12.5'
            stroke='currentColor'
            strokeWidth='1.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </button>

      {expanded && (
        <div className='mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2'>
          {contents.map((item) => {
            const label =
              item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name

            return (
              <div
                key={`${item.name}-${item.quantity}`}
                className='flex min-h-[44px] items-center gap-3 text-gray-700'
              >
                {item.image && (
                  <span className='relative h-8 w-8 shrink-0'>
                    <ProductImage
                      alt={item.name}
                      className='object-contain'
                      fill
                      sizes='32px'
                      src={item.image}
                    />
                  </span>
                )}
                <span className='text-sm leading-snug sm:text-base'>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProductActions({
  product,
  disabled: _disabled,
  hidePrice,
  description,
  inline,
  productPage,
  inStock: inStockOverride,
  fragrances,
  kitDetails,
  afterPriceActions,
  selection,
  subscription,
}: ProductActionsProps) {
  // Variant selection: reuse the caller-provided selection when present (the
  // quick-view modal renders the size dropdown next to the price and shares it),
  // otherwise own it internally (product page renders the inline tile selector).
  const internalSelection = useProductVariantSelection(product)
  const {
    options,
    setOptionValue,
    selectedVariant,
    selectableOptions,
    variantInStock,
  } = selection ?? internalSelection
  const countryCode = useParams().countryCode as string
  const tenant = useTenant()
  const demoHref = useDemoHref()
  const showBuyNow = isImpulseTemplate(tenant.template)

  // Regalo a un tercero (solo gift cards). Si los campos quedan vacíos, la gift
  // card se emite al comprador (no se manda metadata).
  const isGiftCard = product.is_giftcard === true

  // Base entonable: el precio lo pone el ERP, así que el agregado va por la ruta
  // que escribe el precio custom de la línea.
  //
  // Hay DOS clases de base y no una. En la normal (`BASE P`, `BASE F`) el color
  // es obligatorio: el envase pelado no es un producto vendible y el botón se
  // comporta como con una variante sin elegir. En la OPCIONAL el mismo artículo
  // se vende terminado —el blanco de las líneas sin base P— y bloquearle la
  // compra sería romper una venta que ya funciona. Por eso el gate no es "es
  // base" sino "es base obligatoria, o eligió un color".
  const tintSelection = useTintSelectionStore()
  const isTintable = requiresTintSelection(
    tintSelection,
    selectedVariant?.id,
    isTintableProduct(product as never),
  )
  const tintOptional =
    isTintable &&
    isTintingOptional(
      tintSelection,
      selectedVariant?.id,
      isOptionalTintProduct(product as never),
    )
  /** Eligió color: manda la ruta entonada aunque el color fuese opcional. */
  const tintChosen = isTintable && hasTintColor(tintSelection, selectedVariant?.id)
  /** Sin color no se puede comprar. Falso en la base que también se vende blanca. */
  const tintRequired = isTintable && !tintOptional
  const tintReady =
    tintRequired || tintChosen
      ? isTintSelectionReady(tintSelection, selectedVariant?.id)
      : true
  // El alta entonada no es optimista (la escribe el backend con el precio del
  // ERP, que puede tardar segundos): sin este flag un doble click metía la línea
  // dos veces.
  const [addingTint, setAddingTint] = useState(false)
  const [giftRecipientEmail, setGiftRecipientEmail] = useState('')
  const [giftRecipientName, setGiftRecipientName] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const { triggerAnimation } = useAddToCartAnimation()
  const addButtonRef = useRef<HTMLElement>(null)

  // Zustand store - subscribe to reactive state
  const addItem = useCartStore((state) => state.addItem)
  const setCart = useCartStore((state) => state.setCart)
  const openCart = useCartStore((state) => state.openCart)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const changeItemQuantity = useCartStore((state) => state.changeItemQuantity)
  const cart = useCartStore((state) => state.cart)
  const pendingAdditions = useCartStore((state) => state.pendingAdditions)
  const pendingQuantityUpdates = useCartStore(
    (state) => state.pendingQuantityUpdates,
  )

  const inStock =
    inStockOverride !== undefined ? inStockOverride : variantInStock

  const actionsRef = useRef<HTMLDivElement>(null)

  // Get line item from store (reactive) - derive from cart state
  const lineItem = (() => {
    if (!cart?.items) return undefined
    if (selectedVariant?.id) {
      const exactMatch = cart.items.find(
        (item) => item.variant_id === selectedVariant.id,
      )
      if (exactMatch) return exactMatch
    }
    // Fallback: match by product ID (handles stale variant IDs)
    return cart.items.find((item) => item.product_id === product.id)
  })()
  const isAdding = selectedVariant?.id
    ? pendingAdditions.has(selectedVariant.id)
    : false
  const isUpdatingQuantity = lineItem
    ? pendingQuantityUpdates.has(lineItem.id)
    : false

  // add the selected variant to the cart
  // `skipAnimation` evita la animación de "volar al carrito" (que al terminar
  // abre el minicarrito). Lo usa "Comprar ahora": agrega en silencio y navega
  // directo al checkout, sin abrir el drawer.
  const handleAddToCart = async ({
    skipAnimation = false,
  }: { skipAnimation?: boolean } = {}) => {
    if (!selectedVariant?.id || !inStock) {
      return null
    }

    // Base entonable: la línea la crea el backend con el precio que cotizó el ERP
    // (la Store API descarta un `unit_price` que venga del cliente). Sin color no
    // se llega acá — el botón está deshabilitado — pero se corta igual por si
    // alguien dispara el handler desde otro lado.
    if (tintRequired || tintChosen) {
      if (!tintReady || !tintSelection.color || addingTint) return null
      setAddingTint(true)
      try {
        const res = await fetch('/api/store/tinting/line-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantId: selectedVariant.id,
            colorCode: tintSelection.color.code,
            collection: tintSelection.color.collection,
            quantity: 1,
            countryCode,
          }),
        })
        const data = (await res.json()) as { cart?: unknown; message?: string }
        if (!res.ok) {
          toast.error(data.message ?? 'No pudimos agregar el color al carrito.')
          return null
        }
        if (data.cart) setCart(data.cart as never)
        if (!skipAnimation) openCart()
        return true
      } catch {
        toast.error('No pudimos agregar el color al carrito.')
        return null
      } finally {
        setAddingTint(false)
      }
    }

    // Para gift cards, adjuntamos los datos del destinatario como metadata del
    // line item (claves exactas que lee el subscriber `order.placed` del back).
    // Si el comprador no completa el form, no mandamos metadata: la gift card
    // se emite a su propia cuenta.
    let giftMetadata: Record<string, unknown> | undefined
    if (isGiftCard) {
      const recipientEmail = giftRecipientEmail.trim()
      const recipientName = giftRecipientName.trim()
      const message = giftMessage.trim()
      if (recipientEmail || recipientName || message) {
        giftMetadata = {
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          message,
        }
      }
    }

    // La animación arranca en el click, no después del await: el carrito ya es
    // optimista, así que esperar la respuesta del backend (más la cola de
    // mutaciones) solo retrasaba el despegue de la imagen.
    // Se saltea en mobile dentro del productPage (BottomNav oculta, sin ícono
    // de carrito al que volar) y en "Comprar ahora".
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024
    if (!skipAnimation && addButtonRef.current && !(productPage && isMobile)) {
      const thumbnail = product.thumbnail || product.images?.[0]?.url
      triggerAnimation(addButtonRef.current, thumbnail)
    }

    // GA4 add_to_cart se emite server-side vía el plugin de backend
    // (@variablevic/google-analytics-medusa), no acá, para no duplicar el
    // evento. El cliente solo trackea page_view / view_item / begin_checkout.
    await addItem(
      selectedVariant.id,
      1,
      countryCode,
      product.id,
      giftMetadata,
      {
        title: product.title,
        handle: product.handle,
        thumbnail: product.thumbnail || product.images?.[0]?.url,
        unitPrice:
          (selectedVariant as { calculated_price?: { calculated_amount?: number } })
            .calculated_price?.calculated_amount ??
          (product as { subtotal?: number; price?: number }).subtotal ??
          (product as { subtotal?: number; price?: number }).price,
        currencyCode: (selectedVariant as {
          calculated_price?: { currency_code?: string };
        }).calculated_price?.currency_code,
      },
    )
  }

  // "Comprar ahora": agrega sin animación (no abre el minicarrito) y va directo
  // al checkout.
  const handleBuyNow = async () => {
    const result = await handleAddToCart({ skipAnimation: true })
    if (result === null) return
    // Mantener el prefijo /demo/{slug} cuando hay un demo activo (si no, el
    // checkout salía de /demo/dash y los links perdían el contexto).
    window.location.assign(demoHref("/checkout"))
  }

  // Quantity change handler (optimistic + debounced)
  const handleQuantityChange = (newQuantity: number) => {
    if (!lineItem) {
      return
    }
    updateQuantity(lineItem.id, newQuantity)
  }

  // Incremento/decremento RELATIVOS: leen la cantidad actual del store en vez de
  // una `quantityInCart` capturada en el render (que queda vieja entre clicks
  // rápidos), así no se pierden incrementos al tocar +/- rápido.
  const handleQuantityDelta = (delta: number) => {
    if (!lineItem) {
      return
    }
    changeItemQuantity(lineItem.id, delta)
  }

  // Optimistic: show quantity 1 while add is in progress so UI switches immediately
  const quantityInCart = lineItem?.quantity ?? (isAdding ? 1 : 0)

  // Techo de stock. Preferimos la línea del carrito (viene enriquecida con el
  // stock real por variante desde el server) y caemos a la variante del producto
  // cuando todavía no hay línea. `null` = sin techo conocido.
  // Sin este techo, clickear "+" rápido pasándose del stock mandaba UNA sola
  // cantidad imposible (el sync está debounceado) y el rollback devolvía la
  // cantidad previa al burst en vez de dejar el máximo disponible.
  const maxQuantity =
    getLineItemMaxQuantity(lineItem) ?? getVariantMaxQuantity(selectedVariant)
  const canIncrement = canIncrementQuantity(quantityInCart, maxQuantity)

  return (
    <div className='flex flex-col gap-y-2' ref={actionsRef}>
      {/* <h3 className="mb-2 font-semibold text-gray-900 text-xl">
          {product.title}
        </h3> */}

      {!hidePrice && (
        <ProductPrice product={product} variant={selectedVariant} />
      )}

      {!selection && selectableOptions.length > 0 && (
        <div className='mt-2 flex flex-col gap-y-4'>
          {selectableOptions.map(({ option }) => (
            <OptionSelect
              key={option.id}
              current={options[option.id]}
              data-testid='product-options'
              disabled={isAdding}
              option={option}
              title={option.title ?? ''}
              updateOption={setOptionValue}
            />
          ))}
        </div>
      )}

      {!hidePrice && afterPriceActions}

      {/* Description - between price and button */}
      {description && <ExpandableDescription description={description} />}

      {!inline && <ProductInformation product={product} />}

      {kitDetails ? (
        <>
          <KitOptions
            options={kitDetails.options}
            currentProductId={product.id!}
          />
          <KitContents contents={kitDetails.contents} />
        </>
      ) : fragrances && fragrances.length > 0 ? (
        <FragranceSelector
          fragrances={fragrances}
          currentProductId={product.id!}
        />
      ) : null}

      {/* Familia olfativa + Ideal para (solo en página de producto, no en quick-view) — oculto en mobile, se muestra debajo de la foto */}
      {!inline &&
        (() => {
          const olfactoryFamily = (
            product as HttpTypes.StoreProduct & {
              olfactory_family?:
                | { id?: string; name?: string }
                | Array<{ id?: string; name?: string }>
                | null
            }
          ).olfactory_family
          const usageSuggestion = (
            product as HttpTypes.StoreProduct & {
              usage_suggestion?:
                | { id?: string; name?: string }
                | Array<{ id?: string; name?: string }>
                | null
            }
          ).usage_suggestion

          const showFamily = hasIdealForItems(olfactoryFamily, 'tag')
          const showUsage = hasIdealForItems(usageSuggestion, 'icon')

          if (!showFamily && !showUsage) return null

          return (
            <div className='hidden lg:flex lg:gap-6'>
              {showFamily && (
                <div className={showUsage ? 'lg:w-2/5' : 'lg:w-full'}>
                  <IdealFor
                    title='Familia olfativa'
                    value={olfactoryFamily}
                    variant='tag'
                  />
                </div>
              )}
              {showUsage && (
                <div className={showFamily ? 'lg:w-3/5' : 'lg:w-full'}>
                  <IdealFor title='Ideal para' value={usageSuggestion} />
                </div>
              )}
            </div>
          )
        })()}

      {/* Regalar a un tercero — solo gift cards (opcional) */}
      {isGiftCard && (
        <div
          className='mt-4 rounded-2xl border border-gray-200 bg-white p-4'
          data-testid='gift-card-recipient-form'
        >
          <h3 className='font-semibold text-gray-900 text-sm'>
            ¿Es para regalar? (opcional)
          </h3>
          <p className='mt-1 text-gray-500 text-xs'>
            Completá los datos del destinatario y le enviamos la tarjeta por
            correo electrónico. Si lo dejás vacío, la recibís vos.
          </p>
          <div className='mt-3 flex flex-col gap-3'>
            <FormInput
              autoComplete='off'
              data-testid='gift-recipient-email'
              label='Correo electrónico del destinatario'
              onChange={(e) => setGiftRecipientEmail(e.target.value)}
              placeholder='ejemplo@correo.com'
              type='email'
              value={giftRecipientEmail}
            />
            <FormInput
              autoComplete='off'
              data-testid='gift-recipient-name'
              label='Nombre del destinatario'
              onChange={(e) => setGiftRecipientName(e.target.value)}
              placeholder='Ej: Juan'
              type='text'
              value={giftRecipientName}
            />
            <Textarea
              data-testid='gift-message'
              label='Mensaje'
              name='gift-message'
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder='Ej: ¡Feliz cumpleaños!'
              rows={3}
              value={giftMessage}
            />
          </div>
        </div>
      )}

      {(selectedVariant?.metadata as any)?.catalog_commercial?.presentation?.label && <p className="text-sm text-muted-foreground">{(selectedVariant?.metadata as any).catalog_commercial.presentation.label}{(selectedVariant?.metadata as any).catalog_commercial.presentation.unitsPerPackage ? ` × ${(selectedVariant?.metadata as any).catalog_commercial.presentation.unitsPerPackage}` : ""}</p>}
      {(selectedVariant?.metadata as any)?.catalog_commercial?.measurementUnit && <p className="text-sm text-muted-foreground">{(selectedVariant?.metadata as any).catalog_commercial.unitMultiplier} {(selectedVariant?.metadata as any).catalog_commercial.measurementUnit}</p>}
      {/* Sticky footer — always visible */}
      <MobileActions
        addButtonRef={addButtonRef}
        handleAddToCart={handleAddToCart}
        handleBuyNow={handleBuyNow}
        inline={inline}
        productPage={productPage}
        inStock={inStock}
        isAdding={isAdding || addingTint}
        isUpdatingQuantity={isUpdatingQuantity}
        onDecrement={() => handleQuantityDelta(-1)}
        onIncrement={() => {
          const isMobile =
            typeof window !== 'undefined' && window.innerWidth < 1024
          if (addButtonRef.current && !(productPage && isMobile)) {
            const thumbnail = product.thumbnail || product.images?.[0]?.url
            triggerAnimation(addButtonRef.current, thumbnail)
          }
          handleQuantityDelta(1)
        }}
        onRemove={() => handleQuantityChange(0)}
        product={product}
        // Entonables: siempre en modo "agregar". La identidad de la línea es
        // (variante + color), que el stepper del footer no sabe representar —
        // mostrarlo dejaría al cliente sin forma de agregar un segundo color de
        // la misma base.
        quantityInCart={tintRequired || tintChosen ? 0 : quantityInCart}
        canIncrement={canIncrement}
        show={true}
        showBuyNow={showBuyNow}
        variant={selectedVariant}
        blocked={(tintRequired || tintChosen) && !tintReady}
        blockedLabel={
          tintSelection.quoting && tintSelection.variantId === selectedVariant?.id
            ? 'Calculando…'
            : 'Elegí un color'
        }
        priceOverride={
          tintChosen && tintReady && typeof tintSelection.unitPrice === 'number'
            ? {
                unitPrice: tintSelection.unitPrice,
                surcharge: tintSelection.surcharge,
                currencyCode: tintSelection.currencyCode,
              }
            : null
        }
      />

      {/* Suscribirse (compras recurrentes) — solo si el tenant lo habilita y no es gift card */}
      {subscription?.enabled && !isGiftCard && (
        <SubscribeAction
          config={subscription}
          disabled={!inStock || !selectedVariant?.id}
          productTitle={product.title ?? 'este producto'}
          variantId={selectedVariant?.id ?? null}
        />
      )}
    </div>
  )
}
