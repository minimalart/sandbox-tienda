'use server'

import { sdk, getMedusaSDK, getAdminSDK } from '@lib/config'
import { getGaClientId } from '@lib/analytics/ga-client-id'
import type { HttpTypes } from '@medusajs/types'
import { sanitizeCartGiftCardCodes } from '@lib/util/gift-card-cart'
import {
  CART_COMPLETED_AT_FIELD,
  isCompletedCart,
} from '@lib/util/completed-cart'
import {
  getActiveSalesChannelId,
  getAuthHeaders,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from '@lib/data/cookies'
import { getActiveSitePrefix } from '@lib/site-config/active-tenant'
import { getRegion } from '@lib/data/regions'
import { removeBundleInstanceFromCart } from '@lib/data/bundles'
import { revalidateTag } from 'next/cache'
import {
  buildB2CCartMetadata,
  hasB2CMetadata,
  hasB2BMetadata,
} from '@lib/util/b2c-metadata-builder'
import {
  buildGuestCartAddressesMetadata,
  parseGuestCartAddressesMetadata,
  type GuestCartAddress,
  upsertGuestCartAddress,
} from '@lib/util/guest-cart-addresses'
import {
  buildManualPromoCodesMetadata,
  hydrateCartPromotionsFromMetadata,
} from '@lib/util/cart-promotion-metadata'

// ============================================================================
// TIPOS
// ============================================================================

export interface CartAddress {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  company?: string
  postal_code: string
  city: string
  country_code: string
  province?: string
  phone?: string
  metadata?: Record<string, unknown>
}

export interface UpdateAddressesInput {
  shipping_address?: CartAddress
  billing_address?: CartAddress
  email?: string
  first_name?: string
  last_name?: string
  shipping_coords?: { latitude: string; longitude: string }
}

export interface AddLineItemInput {
  variant_id: string
  quantity: number
  metadata?: Record<string, unknown>
}

export interface CartResult {
  success: boolean
  cart: HttpTypes.StoreCart | null
  error?: string
}

export interface OrderResult {
  success: boolean
  type: 'order' | 'cart'
  order?: HttpTypes.StoreOrder
  cart?: HttpTypes.StoreCart
  error?: string
}

const getCartMetadataRecord = (
  cart: HttpTypes.StoreCart,
): Record<string, unknown> => {
  const { metadata } = cart

  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata)
  ) {
    return metadata as Record<string, unknown>
  }

  return {}
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

// ============================================================================
// CART REPOSITORY FUNCTIONS
// ============================================================================

/**
 * Enriches cart line items with real inventory data.
 *
 * Fetches ONLY the cart's products from the standard Store API filtered by
 * id[] (no cache) — the displayed stock reflects the real state when reviewing
 * the cart, with a small payload. Stock is read from
 * variants.inventory_items.inventory.location_levels (filtered by the B2C stock
 * location when configured), falling back to the computed inventory_quantity,
 * and treating non-managed variants as unlimited. Definitive inventory
 * validation still happens when the order is completed in Medusa.
 */
export async function enrichCartWithInventory(
  cart: HttpTypes.StoreCart,
): Promise<HttpTypes.StoreCart> {
  if (!cart.items?.length) return cart

  const cartProductIds = Array.from(
    new Set(
      cart.items
        .map((item) => item.product_id)
        .filter((id): id is string => !!id),
    ),
  )

  if (cartProductIds.length === 0) return cart

  const B2C_STOCK_LOCATION_ID = process.env.NEXT_PUBLIC_STOCK_LOCATION_ID || ''

  // Medusa necesita UN sales channel para calcular la disponibilidad de
  // inventario. Cuando el publishable key está atado a varios canales
  // (multi-tenant), `/store/products` con campos de inventario tira 400
  // ("provide a single sales channel id ...") si no lo pasamos explícito. Usamos
  // el canal del propio carrito (o el activo) para resolverlo.
  const salesChannelId =
    (cart as { sales_channel_id?: string | null }).sales_channel_id ||
    (await getActiveSalesChannelId()) ||
    undefined

  try {
    // Trae SOLO los productos del carrito (filtrado por id[]), sin cache: el stock
    // mostrado debe reflejar el estado real al revisar el carrito. La validación
    // definitiva de inventario ocurre igual al completar la orden en Medusa.
    const response = await sdk.client.fetch<HttpTypes.StoreProductListResponse>(
      '/store/products',
      {
        method: 'GET',
        query: {
          id: cartProductIds,
          limit: cartProductIds.length,
          ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
          fields:
            'id,variants.id,+variants.manage_inventory,+variants.inventory_quantity,*variants.inventory_items.inventory.location_levels',
        },
        cache: 'no-store',
      },
    )

    const products = response.products ?? []

    // Build variantId → real stock map
    const stockMap = new Map<string, number>()

    for (const product of products) {
      if (!product.variants) continue

      for (const variant of product.variants as Record<string, any>[]) {
        if (!variant.id) continue

        let stock: number | undefined

        // Get location_levels from inventory data
        const locationLevels: any[] | undefined =
          variant.inventory?.[0]?.location_levels ??
          variant.inventory_items?.[0]?.inventory?.location_levels

        if (Array.isArray(locationLevels) && locationLevels.length > 0) {
          // Filter by the B2C store's stock location and use available_quantity
          if (B2C_STOCK_LOCATION_ID) {
            const storeLevel = locationLevels.find(
              (level: any) => level.location_id === B2C_STOCK_LOCATION_ID,
            )
            stock = storeLevel
              ? Math.max(0, storeLevel.available_quantity ?? 0)
              : 0
          } else {
            // Fallback: sum available_quantity across all locations
            stock = locationLevels.reduce(
              (total: number, level: any) =>
                total + Math.max(0, level.available_quantity ?? 0),
              0,
            )
          }
        }

        // Sin location_levels: usar el inventory_quantity calculado por Medusa,
        // y si la variante no gestiona inventario, tratarla como ilimitada.
        if (stock === undefined) {
          if (typeof variant.inventory_quantity === 'number') {
            stock = Math.max(0, variant.inventory_quantity)
          } else {
            stock = variant.manage_inventory === false ? 999 : 0
          }
        }

        stockMap.set(variant.id, stock)
      }
    }

    if (stockMap.size === 0) return cart

    // Attach real stock to each cart line item's variant
    const enrichedItems = cart.items.map((item) => {
      const vid = item.variant_id
      if (vid && item.variant && stockMap.has(vid)) {
        return {
          ...item,
          variant: {
            ...item.variant,
            inventory_quantity: stockMap.get(vid)!,
          },
        }
      }
      return item
    })

    return { ...cart, items: enrichedItems } as HttpTypes.StoreCart
  } catch (error) {
    console.error('[enrichCartWithInventory] Failed to fetch inventory:', error)
    return cart
  }
}

/**
 * Retrieves a cart by ID or from cookies
 */
export async function retrieveCart(
  cartId?: string,
): Promise<HttpTypes.StoreCart | null> {
  const id = cartId || (await getCartId())

  if (!id) {
    return null
  }

  const headers = await getAuthHeaders()

  try {
    const tenantSdk = await getMedusaSDK()
    const response = await tenantSdk.client.fetch<HttpTypes.StoreCartResponse>(
      `/store/carts/${id}`,
      {
        method: 'GET',
        query: {
          fields: `+metadata, *items, *region, *items.product, +items.product.metadata, *items.product.categories, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +promotions.application_method.max_quantity, *promotions.application_method.target_rules, *promotions.application_method.target_rules.values, +shipping_methods.name, *payment_collection, *payment_collection.payment_sessions, +${CART_COMPLETED_AT_FIELD}`,
        },
        headers,
        cache: 'no-store',
      },
    )

    // Self-heal: if the webhook (or anything else) converted this cart into
    // an order already, the cookie is pointing at a consumed cart. Drop it
    // so the storefront starts fresh on the next request, and treat the
    // cart as gone for this one.
    //
    // La regla vive en `util/completed-cart.ts` porque estaba escrita SOLO acá:
    // la otra implementación de `retrieveCart` (`data/cart.ts`) ni pedía el
    // campo, y era la que alimentaba el layout, `/cart` y el botón del header
    // (BUG-08).
    if (isCompletedCart(response.cart)) {
      await removeCartId()
      return null
    }

    const cart = await enrichCartWithInventory(response.cart)
    return sanitizeCartGiftCardCodes(hydrateCartPromotionsFromMetadata(cart))
  } catch {
    return null
  }
}

/**
 * Creates a new cart for the given region and sales channel
 */
export async function createCart(
  regionId: string,
  salesChannelId: string,
): Promise<HttpTypes.StoreCart> {
  const headers = await getAuthHeaders()

  // Build B2C metadata before creating the cart
  const metadata = await buildB2CCartMetadata()

  // GA: puente del client_id al metadata para que el plugin de backend pueda
  // atribuir los eventos server-side (add_to_cart, purchase) en GA4. Si GA está
  // desactivado o todavía no cargó, getGaClientId devuelve null y no se agrega.
  const gaClientId = await getGaClientId()

  const { cart } = await sdk.store.cart.create(
    {
      region_id: regionId,
      sales_channel_id: salesChannelId,
      metadata: gaClientId ? { ...metadata, ga_client_id: gaClientId } : metadata,
    },
    {},
    headers,
  )

  await setCartId(cart.id)
  return cart
}

/**
 * Gets or creates a cart for the given country code
 */
export async function getOrCreateCart(
  countryCode: string,
): Promise<HttpTypes.StoreCart> {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  // Canal DEMO-AWARE. Ojo: acá antes se usaba `getTenant()`, que devuelve el
  // tenant por defecto del build y NO mira la demo activa, así que un carrito
  // creado navegando /demo/{slug} quedaba atado al canal del store principal —
  // y el sync de más abajo lo RE-APUNTABA ahí en cada add, pisando cualquier
  // canal correcto. Mientras los productos de demo tenían `manage_inventory`
  // apagado el síntoma era invisible; con inventario gestionado Medusa resuelve
  // la disponibilidad por canal → stock location → nivel y el add-to-cart falla
  // con "Sales channel ... is not associated with any stock location for
  // variant ...". `getActiveSalesChannelId()` es el resolver correcto (ya se usa
  // en `retrieveCart` en este mismo archivo).
  const salesChannelId =
    (await getActiveSalesChannelId()) || process.env.NEXT_PUBLIC_SALES_CHANNEL_ID

  let cart = await retrieveCart()
  const headers = await getAuthHeaders()

  if (!cart) {
    cart = await createCart(region.id, salesChannelId!)
  } else {
    // Check if cart needs B2C metadata
    const cartMetadata = cart.metadata as Record<string, any> | null | undefined

    // Only add B2C metadata if:
    // 1. Cart doesn't have B2C metadata
    // 2. Cart doesn't have B2B metadata (we don't want to overwrite B2B orders)
    if (!hasB2CMetadata(cartMetadata) && !hasB2BMetadata(cartMetadata)) {
      const metadata = await buildB2CCartMetadata(cart)
      const { cart: updatedCart } = await sdk.store.cart.update(
        cart.id,
        { metadata },
        {},
        headers,
      )
      cart = updatedCart
    }
  }

  // Sync region and sales channel if needed.
  //
  // `region_id` se manda SOLO si cambió de verdad: `updateCartWorkflow` borra
  // todas las líneas con precio custom cuando detecta un cambio de región (por
  // el cambio de moneda/inclusión de IVA), y con el entonado tintométrico esas
  // líneas son las que llevan el precio que cotizó el ERP. Hoy el core compara
  // contra la región actual antes de borrar, así que reenviar la misma es
  // inofensivo — pero no depender de ese detalle sale gratis.
  const regionChanged = cart.region_id !== region.id
  const channelChanged = cart.sales_channel_id !== salesChannelId
  if (regionChanged || channelChanged) {
    const { cart: updatedCart } = await sdk.store.cart.update(
      cart.id,
      {
        ...(regionChanged ? { region_id: region.id } : {}),
        ...(channelChanged ? { sales_channel_id: salesChannelId } : {}),
      },
      {},
      headers,
    )
    cart = updatedCart
  }

  return cart
}

/**
 * Updates cart data (addresses, email, etc.)
 */
export async function updateCart(
  data: HttpTypes.StoreUpdateCart,
): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  const headers = await getAuthHeaders()

  try {
    // Retrieve current cart to check metadata
    const currentCart = await retrieveCart(cartId)
    if (currentCart) {
      const cartMetadata = currentCart.metadata as
        | Record<string, any>
        | null
        | undefined

      // If cart doesn't have B2C metadata and is not a B2B cart, ensure B2C metadata
      if (!hasB2CMetadata(cartMetadata) && !hasB2BMetadata(cartMetadata)) {
        const b2cMetadata = await buildB2CCartMetadata(currentCart)
        // Merge with existing metadata if provided in update data
        data.metadata = {
          ...b2cMetadata,
          ...(data.metadata || {}),
        }
      } else if (data.metadata && typeof data.metadata === 'object') {
        // Preserve existing metadata when updating
        data.metadata = {
          ...(cartMetadata || {}),
          ...data.metadata,
        }
      }
    }

    await sdk.store.cart.update(cartId, data, {}, headers)

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    // retrieveCart fetches with full field selectors (items.total, etc.)
    // so computed totals are always present in the returned cart.
    const fullCart = await retrieveCart(cartId)
    return { success: true, cart: fullCart! }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error updating cart',
    }
  }
}

/**
 * Updates shipping and billing addresses
 */
export async function updateCartAddresses(
  input: UpdateAddressesInput,
): Promise<CartResult> {
  const updateData: Record<string, unknown> = {}
  if (input.shipping_address) {
    updateData.shipping_address = input.shipping_address
    updateData.billing_address = input.billing_address || input.shipping_address
  }
  if (input.email) {
    updateData.email = input.email
  }
  if (input.first_name || input.last_name) {
    const nameFields: Record<string, string> = {}
    if (input.first_name) {
      nameFields.first_name = input.first_name
    }
    if (input.last_name) {
      nameFields.last_name = input.last_name
    }
    updateData.shipping_address = {
      ...(updateData.shipping_address as Record<string, unknown> | undefined),
      ...nameFields,
    }
  }
  if (input.shipping_coords?.latitude && input.shipping_coords?.longitude) {
    updateData.metadata = {
      shipping_lat: input.shipping_coords.latitude,
      shipping_lng: input.shipping_coords.longitude,
    }
  }

  const result = await updateCart(updateData)

  if (result.success && result.cart) {
    try {
      await syncGuestCustomerProfileFromCartBeforeComplete(result.cart);
    } catch (err) {
      console.error( '[updateCartAddresses] Customer profile sync failed (non-blocking):', err);
    }
  }

  return result;
}

export async function addGuestCartAddress(
  address: GuestCartAddress,
): Promise<CartResult> {
  const cart = await retrieveCart()

  if (!cart) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  try {
    const metadataRecord = getCartMetadataRecord(cart)
    const guestMetadata = parseGuestCartAddressesMetadata(metadataRecord)
    const nextAddresses = upsertGuestCartAddress(
      guestMetadata.addresses,
      address,
    )

    return updateCart({
      metadata: buildGuestCartAddressesMetadata(metadataRecord, {
        addresses: nextAddresses,
        selected_address_id: address.id,
      }),
    })
  } catch (error: unknown) {
    return {
      success: false,
      cart: null,
      error: getErrorMessage(error, 'Error adding guest address'),
    }
  }
}

export async function selectGuestCartAddress(
  addressId: string,
): Promise<CartResult> {
  const cart = await retrieveCart()

  if (!cart) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  try {
    const metadataRecord = getCartMetadataRecord(cart)
    const guestMetadata = parseGuestCartAddressesMetadata(metadataRecord)
    const addressExists = guestMetadata.addresses.some(
      (address) => address.id === addressId,
    )

    if (!addressExists) {
      return {
        success: false,
        cart: cart,
        error: 'Address not found in cart metadata',
      }
    }

    return updateCart({
      metadata: buildGuestCartAddressesMetadata(metadataRecord, {
        selected_address_id: addressId,
      }),
    })
  } catch (error: unknown) {
    return {
      success: false,
      cart: null,
      error: getErrorMessage(error, 'Error selecting guest address'),
    }
  }
}

export async function removeGuestCartAddress(
  addressId: string,
): Promise<CartResult> {
  const cart = await retrieveCart()

  if (!cart) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  try {
    const metadataRecord = getCartMetadataRecord(cart)
    const guestMetadata = parseGuestCartAddressesMetadata(metadataRecord)
    const nextAddresses = guestMetadata.addresses.filter(
      (address) => address.id !== addressId,
    )

    const selectedAddressId =
      guestMetadata.selected_address_id === addressId
        ? (nextAddresses[0]?.id ?? null)
        : guestMetadata.selected_address_id

    return updateCart({
      metadata: buildGuestCartAddressesMetadata(metadataRecord, {
        addresses: nextAddresses,
        selected_address_id: selectedAddressId,
      }),
    })
  } catch (error: unknown) {
    return {
      success: false,
      cart: null,
      error: getErrorMessage(error, 'Error removing guest address'),
    }
  }
}

/**
 * Re-apunta un carrito EXISTENTE al canal activo cuando no coinciden.
 *
 * Hace falta porque `addCartLineItem` solo llama a `getOrCreateCart` (que sí
 * sincroniza canal y región) cuando NO hay carrito. Con un carrito ya en la
 * cookie ese camino no se ejecuta, así que un carrito nacido en el store
 * principal se quedaba pegado a su canal para siempre: al entrar a una demo y
 * agregar un producto, Medusa fallaba con "Sales channel ... is not associated
 * with any stock location for variant ..." (el producto de la demo no vive en el
 * canal del store principal). Sin esto el arreglo del canal solo servía para
 * carritos nuevos, y cualquiera con un carrito previo seguía sin poder comprar.
 *
 * NO toca carritos B2B: su canal es el mayorista y re-apuntarlo al B2C rompería
 * la cuenta corriente y los precios por volumen.
 */
async function syncCartSalesChannel(
  cart: HttpTypes.StoreCart,
  countryCode: string,
): Promise<HttpTypes.StoreCart> {
  if (hasB2BMetadata(cart.metadata as Record<string, any> | null | undefined)) {
    return cart
  }

  const salesChannelId =
    (await getActiveSalesChannelId()) || process.env.NEXT_PUBLIC_SALES_CHANNEL_ID
  if (!salesChannelId || cart.sales_channel_id === salesChannelId) return cart

  // La región viaja junto al canal: una demo puede estar en otra región/moneda, y
  // dejarlas desalineadas da precios que no resuelven.
  const region = await getRegion(countryCode)
  if (!region) return cart

  try {
    const headers = await getAuthHeaders()
    const { cart: updated } = await sdk.store.cart.update(
      cart.id,
      {
        // Igual que en `getOrCreateCart`: la región sólo si cambió, para no
        // rozar el borrado de líneas con precio custom (entonados) que hace
        // `updateCartWorkflow` ante un cambio de región.
        ...(cart.region_id !== region.id ? { region_id: region.id } : {}),
        sales_channel_id: salesChannelId,
      },
      {},
      headers,
    )
    return updated
  } catch {
    // Mejor intentar el add con el canal viejo que abortar: si el ítem pertenece
    // a los dos canales, sigue funcionando.
    return cart
  }
}

/**
 * Adds a line item to the cart
 */
export async function addCartLineItem(
  countryCode: string,
  input: AddLineItemInput,
): Promise<CartResult> {
  // Resolver el carrito destino SIN crear duplicados. Este es el bug de "se
  // agregan muchos productos y queda solo el último": `retrieveCart()` devuelve
  // null tanto cuando NO hay carrito como cuando el fetch falla por un blip. Si
  // ante un blip creábamos un carrito nuevo (getOrCreateCart), la cookie pasaba
  // a apuntar a un carrito vacío y los ítems ya agregados quedaban huérfanos →
  // solo sobrevivían los agregados después. Solo creamos carrito cuando de
  // verdad no hay: sin cookie, o con un carrito que retrieveCart auto-sanó por
  // estar completado (en ese caso ya borró la cookie).
  let cart = await retrieveCart()
  let cartId = cart?.id ?? null

  if (!cart) {
    const cookieCartId = await getCartId()
    if (cookieCartId) {
      // Hay cookie pero el retrieve dio null por un fallo transitorio: reusamos
      // ese id en vez de bifurcar a un carrito nuevo.
      cartId = cookieCartId
    } else {
      // Sin cookie (o carrito completado ya auto-sanado) → recién acá creamos.
      cart = await getOrCreateCart(countryCode)
      cartId = cart.id
    }
  } else {
    // Carrito preexistente: alinearlo al canal activo ANTES de agregar. Este es
    // el caso de "vengo del store principal y entro a una demo", donde el canal
    // del carrito no tiene los productos de la demo.
    cart = await syncCartSalesChannel(cart, countryCode)
    cartId = cart.id
  }

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart available' }
  }

  const headers = await getAuthHeaders()
  const tenantSdk = await getMedusaSDK()

  const doAddLineItem = async (targetCartId: string) => {
    const { cart: mutatedCart } = await tenantSdk.store.cart.createLineItem(
      targetCartId,
      {
        variant_id: input.variant_id,
        quantity: input.quantity,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
      {},
      headers,
    )

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    // retrieveCart re-enriquece (totales/inventario/promos). Si ESE retrieve
    // falla por un blip, caemos al carrito que devolvió createLineItem para no
    // devolver `cart: null` (que en el cliente rompía el merge y revertía el
    // ítem recién agregado).
    const enriched = await retrieveCart(targetCartId)
    return enriched ?? sanitizeCartGiftCardCodes(mutatedCart)
  }

  try {
    const updatedCart = await doAddLineItem(cartId)
    return { success: true, cart: updatedCart }
  } catch (error: any) {
    // Self-heal: if the cart has stale payment sessions (e.g. user abandoned
    // MercadoPago redirect), Medusa fails to clean them up on line-item changes.
    // Force-delete the payment collection and retry.
    if (error.message?.includes('Could not delete all payment sessions')) {
      const cartForHeal = cart ?? (await retrieveCart(cartId))
      const paymentCollectionId = (cartForHeal?.payment_collection as any)?.id
      if (paymentCollectionId) {
        try {
          const adminSdk = getAdminSDK()
          await adminSdk.client.fetch(
            `/admin/payment-collections/${paymentCollectionId}`,
            { method: 'DELETE' },
          )
          const updatedCart = await doAddLineItem(cartId)
          return { success: true, cart: updatedCart }
        } catch (retryError: any) {
          return {
            success: false,
            cart: null,
            error:
              retryError.message ||
              'Error al agregar producto tras limpiar sesiones de pago',
          }
        }
      }
    }
    return {
      success: false,
      cart: null,
      error: error.message || 'Error adding item to cart',
    }
  }
}

/**
 * Agrega al carrito una base ENTONADA (sistema tintométrico).
 *
 * No usa `sdk.store.cart.createLineItem` porque la Store API de Medusa no acepta
 * un precio de línea: su validador es `{variant_id, quantity, metadata}` y
 * descarta el resto en silencio. El precio del entonado lo calcula el ERP, así
 * que la línea la crea una ruta propia del backend (`POST
 * /store/tinting/line-items`) que corre `addToCartWorkflow` con `unit_price`.
 *
 * Acá NO viaja ni el precio ni el código de fórmula: sólo la variante, el color y
 * la cantidad. El backend resuelve la fórmula y re-cotiza.
 */
export async function addTintedCartLineItem(
  countryCode: string,
  input: { variant_id: string; color_code: string; collection?: string | null; quantity: number },
): Promise<CartResult> {
  // Misma resolución de carrito que `addCartLineItem`: nunca crear un carrito
  // nuevo ante un blip de red, porque la cookie pasaría a apuntar a uno vacío.
  let cart = await retrieveCart()
  let cartId = cart?.id ?? null

  if (!cart) {
    const cookieCartId = await getCartId()
    if (cookieCartId) {
      cartId = cookieCartId
    } else {
      cart = await getOrCreateCart(countryCode)
      cartId = cart.id
    }
  } else {
    cart = await syncCartSalesChannel(cart, countryCode)
    cartId = cart.id
  }

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart available' }
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000'
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ''

  try {
    const res = await fetch(`${backendUrl}/store/tinting/line-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(publishableKey ? { 'x-publishable-api-key': publishableKey } : {}),
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({
        cart_id: cartId,
        variant_id: input.variant_id,
        color_code: input.color_code,
        ...(input.collection ? { collection: input.collection } : {}),
        quantity: input.quantity,
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { message?: string }
      return {
        success: false,
        cart: null,
        error: detail.message || 'No pudimos agregar el color al carrito.',
      }
    }

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    const enriched = await retrieveCart(cartId)
    return { success: true, cart: enriched ?? cart ?? null }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error?.message || 'No pudimos agregar el color al carrito.',
    }
  }
}

/**
 * Updates a line item quantity
 */
export async function updateCartLineItem(
  lineId: string,
  quantity: number,
): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  const headers = await getAuthHeaders()

  try {
    const tenantSdk = await getMedusaSDK()
    await tenantSdk.store.cart.updateLineItem(
      cartId,
      lineId,
      { quantity },
      {},
      headers,
    )

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    const updatedCart = await retrieveCart(cartId)
    return { success: true, cart: updatedCart }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error updating line item',
    }
  }
}

/**
 * Removes a line item from the cart
 */
export async function removeCartLineItem(lineId: string): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  const headers = await getAuthHeaders()

  try {
    const tenantSdk = await getMedusaSDK()
    await tenantSdk.store.cart.deleteLineItem(cartId, lineId, {}, headers)

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    const updatedCart = await retrieveCart(cartId)
    return { success: true, cart: updatedCart }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error removing line item',
    }
  }
}

/**
 * Saca un kit (todas las líneas que comparten `bundle_instance_id`) del
 * carrito con UNA llamada al backend. Antes se borraba línea por línea con el
 * DELETE de Medusa: N requests y N recálculos de totales por kit.
 */
export async function removeCartBundleInstance(
  bundleInstanceId: string,
): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  try {
    await removeBundleInstanceFromCart({
      cart_id: cartId,
      bundle_instance_id: bundleInstanceId,
    })

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    const updatedCart = await retrieveCart(cartId)
    return { success: true, cart: updatedCart }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error removing bundle',
    }
  }
}

/**
 * Sets the shipping method for the cart
 */
export async function setCartShippingMethod(
  shippingOptionId: string,
  data?: Record<string, unknown>,
): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  const headers = await getAuthHeaders()

  try {
    await sdk.store.cart.addShippingMethod(
      cartId,
      { option_id: shippingOptionId, data: data ?? {} },
      {},
      headers,
    )

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    const updatedCart = await retrieveCart(cartId)
    return { success: true, cart: updatedCart }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error setting shipping method',
    }
  }
}

/**
 * Initiates a payment session for the cart
 * @param providerId - Payment provider ID
 * @param origin - Optional storefront origin URL for multi-tenant back_urls (e.g., https://storefront-b2c.minimalart.org)
 */
export async function initiateCartPayment(
  providerId: string,
  origin?: string,
): Promise<CartResult> {
  const cart = await retrieveCart()

  if (!cart) {
    return { success: false, cart: null, error: 'No cart found' }
  }
  
  try {
    await syncGuestCustomerProfileFromCartBeforeComplete(cart)
  } catch (syncError) {
    console.error(
      '[initiateCartPayment] Customer profile sync failed (non-blocking):',
      syncError,
    )
  }

  const headers = await getAuthHeaders()

  const sessionData: Record<string, unknown> = { provider_id: providerId }

  // cart_id viaja en data para que MercadoPago lo use como external_reference:
  // así el webhook puede linkear el pago de MP con el carrito y crear la orden.
  // origin se sigue pasando (opcional) para back_urls dinámicas si hiciera falta.
  const paymentData: Record<string, unknown> = { cart_id: cart.id }
  // sales_channel_id viaja en data para que el provider de MercadoPago resuelva
  // la cuenta de la sucursal (cobro por sucursal). El webhook se rutea por este
  // id (notification_url ?sc=...). Sin coincidencia en el mapa de cuentas, el
  // provider usa la cuenta global (sin regresión).
  if (cart.sales_channel_id) {
    paymentData.sales_channel_id = cart.sales_channel_id
  }
  if (origin) {
    paymentData.origin = origin
    // Base de retorno CON el prefijo del sitio activo. Sin esto MercadoPago
    // arma sus back_urls desde `storefrontUrl` pelado y devuelve al comprador
    // al /checkout/success del sitio PRINCIPAL: sale de la tienda en la que
    // estaba comprando. En el sitio principal el prefijo es '' y esto es un
    // no-op — por eso el bug sólo se veía en las tiendas.
    const sitePrefix = await getActiveSitePrefix()
    paymentData.return_base = `${origin.replace(/\/$/, '')}${sitePrefix}`
  }
  sessionData.data = paymentData

  const doInitiate = async (cartObj: HttpTypes.StoreCart) => {
    await sdk.store.payment.initiatePaymentSession(
      cartObj,
      sessionData as unknown as { provider_id: string },
      {},
      headers,
    )
    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')
    return await retrieveCart(cartObj.id)
  }

  try {
    const updatedCart = await doInitiate(cart)
    return { success: true, cart: updatedCart }
  } catch (error: any) {
    // Some providers (e.g. MercadoPago) throw when Medusa tries to cancel their
    // existing session during provider switch. Force-delete the payment collection
    // via admin API so the retry starts with a clean slate.
    if (error.message?.includes('Could not delete all payment sessions')) {
      const paymentCollectionId = (cart.payment_collection as any)?.id
      if (paymentCollectionId) {
        try {
          const adminSdk = getAdminSDK()
          await adminSdk.client.fetch(
            `/admin/payment-collections/${paymentCollectionId}`,
            { method: 'DELETE' },
          )
          const freshCart = await retrieveCart(cart.id)
          if (freshCart) {
            const updatedCart = await doInitiate(freshCart)
            return { success: true, cart: updatedCart }
          }
        } catch (retryError: any) {
          return {
            success: false,
            cart,
            error: retryError.message || 'Error al cambiar el método de pago',
          }
        }
      }
    }
    return {
      success: false,
      cart,
      error: error.message || 'Error initiating payment',
    }
  }
}

/**
 * Applies promotion codes to the cart
 */
export async function applyCartPromotions(
  codes: string[],
): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  const headers = await getAuthHeaders()

  try {
    await sdk.store.cart.update(
      cartId,
      {
        promo_codes: codes,
        metadata: buildManualPromoCodesMetadata(codes),
      },
      {},
      headers,
    )

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    // Refetch con la query enriquecida — `cart.update` devuelve los items
    // con los totales calculados sin hidratar (total/original_total/subtotal
    // = undefined). retrieveCart() incluye los `+items.*` necesarios.
    const cart = await retrieveCart(cartId)
    return { success: true, cart }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error applying promotions',
    }
  }
}

/**
 * Aplica una gift card al carrito vía el endpoint del loyalty-plugin
 * (POST /store/carts/:id/gift-cards). Refetch con retrieveCart para devolver
 * los totales hidratados (gift_card_total, total, etc.).
 */
export async function applyCartGiftCard(code: string): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  const headers = await getAuthHeaders()

  try {
    const tenantSdk = await getMedusaSDK()
    await tenantSdk.client.fetch(`/store/carts/${cartId}/gift-cards`, {
      method: 'POST',
      body: { code: code.trim() },
      headers,
    })

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    const cart = await retrieveCart(cartId)
    return { success: true, cart }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error applying gift card',
    }
  }
}

/** Aplica el saldo acreditado del cliente en la moneda del carrito. */
export async function applyCartStoreCredit(): Promise<CartResult> {
  const cartId = await getCartId()
  if (!cartId) return { success: false, cart: null, error: 'No cart found' }

  try {
    const tenantSdk = await getMedusaSDK()
    await tenantSdk.client.fetch(`/store/carts/${cartId}/store-credits`, {
      method: 'POST',
      body: {},
      headers: await getAuthHeaders(),
    })
    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')
    return { success: true, cart: await retrieveCart(cartId) }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error applying store credit',
    }
  }
}

/**
 * Quita una gift card del carrito (DELETE /store/carts/:id/gift-cards).
 */
export async function removeCartGiftCard(code: string): Promise<CartResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, cart: null, error: 'No cart found' }
  }

  const headers = await getAuthHeaders()

  try {
    const tenantSdk = await getMedusaSDK()
    await tenantSdk.client.fetch(`/store/carts/${cartId}/gift-cards`, {
      method: 'DELETE',
      body: { code: code.trim() },
      headers,
    })

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    const cart = await retrieveCart(cartId)
    return { success: true, cart }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error removing gift card',
    }
  }
}

type MedusaAdminClient = ReturnType<typeof getAdminSDK>

async function findCustomerIdByEmail(
  adminSdk: MedusaAdminClient,
  email: string,
): Promise<string | undefined> {
  try {
    const { customers } = await adminSdk.admin.customer.list({
      email,
      limit: 1,
    })
    return customers?.[0]?.id
  } catch {
    return undefined
  }
}

/**
 * Writes checkout names onto the Customer *before* cart.complete so Medusa's
 * order-placed notification (email) resolves the correct display name. The
 * post-complete sync remains as a fallback if the linked customer differs.
 */
export async function syncGuestCustomerProfileFromCartBeforeComplete(
  cart: HttpTypes.StoreCart,
): Promise<void> {
  if (!process.env.MEDUSA_ADMIN_API_KEY) {
    return
  }

  const email = cart.email?.trim()
  if (!email) {
    return
  }

  const shipping = cart.shipping_address ?? cart.billing_address
  if (!shipping) {
    return
  }

  const first = shipping.first_name?.trim() || undefined
  const last = shipping.last_name?.trim() || undefined
  const phone = shipping.phone?.trim() || undefined

  if (!first && !last && !phone) {
    return
  }

  const adminSdk = getAdminSDK()

  const cartWithCustomer = cart as HttpTypes.StoreCart & {
    customer_id?: string
    customer?: { id?: string }
  }
  let customerId =
    cartWithCustomer.customer_id ?? cartWithCustomer.customer?.id ?? undefined

  if (!customerId) {
    customerId = await findCustomerIdByEmail(adminSdk, email)
  }

  async function applyCheckoutNamesToCustomer(id: string): Promise<void> {
    const { customer } = await adminSdk.admin.customer.retrieve(id, {
      fields: 'id,first_name,last_name,phone,has_account',
    })
    if (!customer) {
      return
    }

    const hasAccount =
      (customer as { has_account?: boolean }).has_account === true

    const body: Record<string, string> = {}
    if (first) {
      if (!hasAccount || !customer.first_name?.trim()) {
        body.first_name = first
      }
    }
    if (last) {
      if (!hasAccount || !customer.last_name?.trim()) {
        body.last_name = last
      }
    }
    if (phone) {
      if (!hasAccount || !customer.phone?.trim()) {
        body.phone = phone
      }
    }

    if (Object.keys(body).length > 0) {
      await adminSdk.admin.customer.update(id, body)
    }
  }

  try {
    if (customerId) {
      await applyCheckoutNamesToCustomer(customerId)
      return
    }

    await adminSdk.admin.customer.create({
      email,
      first_name: first ?? '',
      last_name: last ?? '',
      phone: phone ?? '',
      has_account: false,
    } as unknown as Parameters<
      MedusaAdminClient['admin']['customer']['create']
    >[0])
  } catch (err) {
    const existingId = await findCustomerIdByEmail(adminSdk, email)
    if (existingId) {
      try {
        await applyCheckoutNamesToCustomer(existingId)
      } catch (inner) {
        console.error(
          '[syncGuestCustomerProfileFromCartBeforeComplete] retry update failed',
          inner,
        )
      }
      return
    }
    console.error('[syncGuestCustomerProfileFromCartBeforeComplete]', err)
  }
}

async function resolveOrderCustomerId(
  adminSdk: MedusaAdminClient,
  order: HttpTypes.StoreOrder,
): Promise<string | undefined> {
  const withCustomer = order as HttpTypes.StoreOrder & {
    customer_id?: string
    customer?: { id?: string }
  }
  if (withCustomer.customer_id) {
    return withCustomer.customer_id
  }
  if (withCustomer.customer?.id) {
    return withCustomer.customer.id
  }
  if (!order.id) {
    return undefined
  }
  try {
    const { order: adminOrder } = await adminSdk.admin.order.retrieve(
      order.id,
      {
        fields: 'id,customer_id,customer.id',
      },
    )
    const adminOrderWithCustomer = adminOrder as {
      customer_id?: string
      customer?: { id?: string }
    }
    return (
      adminOrderWithCustomer.customer_id ??
      adminOrderWithCustomer.customer?.id ??
      undefined
    )
  } catch {
    return undefined
  }
}

/**
 * Fallback after complete: fills empty profile fields from the order shipping
 * address. Prefer {@link syncGuestCustomerProfileFromCartBeforeComplete} so
 * notifications sent during complete already see the name.
 */
export async function syncGuestCustomerProfileFromOrder(
  order: HttpTypes.StoreOrder,
): Promise<void> {
  if (!process.env.MEDUSA_ADMIN_API_KEY) {
    return
  }

  const shipping = order.shipping_address
  if (!shipping) {
    return
  }

  const first = shipping.first_name?.trim() || undefined
  const last = shipping.last_name?.trim() || undefined
  const phone = shipping.phone?.trim() || undefined

  if (!first && !last && !phone) {
    return
  }

  const adminSdk = getAdminSDK()
  const customerId = await resolveOrderCustomerId(adminSdk, order)
  if (!customerId) {
    return
  }

  try {
    const { customer } = await adminSdk.admin.customer.retrieve(customerId, {
      fields: 'id,first_name,last_name,phone',
    })

    if (!customer) {
      return
    }

    const body: Record<string, string> = {}
    if (first && !customer.first_name?.trim()) {
      body.first_name = first
    }
    if (last && !customer.last_name?.trim()) {
      body.last_name = last
    }
    if (phone && !customer.phone?.trim()) {
      body.phone = phone
    }

    if (Object.keys(body).length > 0) {
      await adminSdk.admin.customer.update(customerId, body)
    }
  } catch (err) {
    console.error('[syncGuestCustomerProfileFromOrder]', err)
  }
}

/** Dedupe concurrent complete calls for the same cart (same Node instance). */
const inflightCartCompletion = new Map<string, Promise<OrderResult>>()

async function runCompleteCartForId(cartId: string): Promise<OrderResult> {
  const headers = await getAuthHeaders()

  try {
    // Retrieve cart before completing to ensure metadata
    const cart = await retrieveCart(cartId)
    if (cart) {
      const cartMetadata = cart.metadata as
        | Record<string, any>
        | null
        | undefined

      // Ensure B2C metadata is present before completing (unless it's a B2B cart)
      if (!hasB2CMetadata(cartMetadata) && !hasB2BMetadata(cartMetadata)) {
        const b2cMetadata = await buildB2CCartMetadata(cart)
        await sdk.store.cart.update(
          cartId,
          { metadata: b2cMetadata },
          {},
          headers,
        )
      }

      await syncGuestCustomerProfileFromCartBeforeComplete(cart)
    }

    const result = await sdk.store.cart.complete(cartId, {}, headers)

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    if (result.type === 'order') {
      const orderCacheTag = await getCacheTag('orders')
      revalidateTag(orderCacheTag, 'max')
      removeCartId()

      // If this cart came from a preloaded checkout link, mark it consumed so
      // single-use links can no longer be resolved. Best-effort, non-blocking.
      const checkoutLinkToken = (cart?.metadata as Record<string, unknown>)
        ?.checkout_link_token
      if (typeof checkoutLinkToken === 'string' && checkoutLinkToken) {
        try {
          const tenantSdk = await getMedusaSDK()
          await tenantSdk.client.fetch(
            `/store/checkout-links/${encodeURIComponent(checkoutLinkToken)}/consume`,
            { method: 'POST' },
          )
        } catch (consumeError) {
          console.error(
            '[completeCart] Failed to consume checkout link (non-blocking):',
            consumeError,
          )
        }
      }

      await syncGuestCustomerProfileFromOrder(result.order)

      return {
        success: true,
        type: 'order',
        order: result.order,
      }
    }

    return {
      success: false,
      type: 'cart',
      cart: result.cart,
      error: 'Order could not be completed',
    }
  } catch (error: unknown) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status: number }).status
        : undefined
    const message =
      error instanceof Error ? error.message : 'Error completing order'

    if (status === 409) {
      return {
        success: false,
        type: 'cart',
        error:
          'El pedido ya se está procesando. Si completaste el pago, revisá tu correo o esperá unos segundos y actualizá la página.',
      }
    }

    return {
      success: false,
      type: 'cart',
      error: message,
    }
  }
}

/**
 * Completes the cart and places an order
 */
export async function completeCart(): Promise<OrderResult> {
  const cartId = await getCartId()

  if (!cartId) {
    return { success: false, type: 'cart', error: 'No cart found' }
  }

  let pending = inflightCartCompletion.get(cartId)
  if (!pending) {
    pending = (async () => {
      try {
        return await runCompleteCartForId(cartId)
      } finally {
        inflightCartCompletion.delete(cartId)
      }
    })()
    inflightCartCompletion.set(cartId, pending)
  }

  return pending
}

/**
 * Clears the cart cookie
 */
export async function clearCart(): Promise<void> {
  removeCartId()
  const cartCacheTag = await getCacheTag('carts')
  revalidateTag(cartCacheTag, 'max')
}

/**
 * Vacía DE VERDAD el carrito: borra sus line items en el backend.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * "Vaciar carrito" borraba sólo la cookie (`removeCartId`). Para el comprador el
 * carrito quedaba vacío —la próxima visita arranca uno nuevo—, pero el carrito
 * viejo seguía vivo en Medusa con TODOS sus productos, su email y
 * `completed_at: null`. O sea: vaciar no vaciaba nada, ABANDONABA el carrito.
 *
 * Y un carrito con items, con email y sin completar es exactamente la definición
 * de carrito abandonado, así que el cron lo detectaba y le mandaba a la persona
 * "te quedaron productos en el carrito" — con el carrito vacío en pantalla
 * (DESDEELSUR-61, BUG-17).
 *
 * El chequeo del plugin de carrito abandonado NO estaba roto: relee el carrito
 * antes de enviar y se saltea si está vacío. Estaba mirando un carrito que
 * REALMENTE tenía items. El bug siempre estuvo de este lado.
 *
 * ── DETALLES ─────────────────────────────────────────────────────────────────
 *
 * Secuencial y no en paralelo: cada borrado hace que Medusa recalcule los totales
 * del carrito, y mandarlos todos juntos pone varias escrituras sobre la misma fila.
 * Un carrito tiene unas pocas líneas; no vale la pena arriesgar por esa latencia.
 *
 * Si algún borrado falla se devuelve `success: false` con las que quedaron: quien
 * llama tiene que poder revertir el vaciado optimista de la UI en vez de mostrar un
 * carrito vacío que en el servidor no lo está — que es el mismo desfasaje que
 * causó este bug.
 */
export async function emptyCartLineItems(): Promise<CartResult> {
  const cartId = await getCartId()

  // Sin cookie no hay nada que vaciar, y no es un error: el botón ya no debería
  // estar visible. Se devuelve éxito para que la ruta siga y limpie igual.
  if (!cartId) {
    return { success: true, cart: null }
  }

  const headers = await getAuthHeaders()

  try {
    // `retrieveCart` ya resuelve el caso peligroso: pide `completed_at` y, si el
    // carrito ya se convirtió en orden, suelta la cookie y devuelve null.
    //
    // UN CARRITO YA COMPRADO NO SE TOCA, y ese caso llega acá de verdad: al volver
    // de la pasarela, las pantallas de éxito y de pago pendiente también piden
    // 'clearCart' para soltar la cookie. Borrarle las líneas a una compra sería
    // destructivo, y si Medusa rechazara el borrado la cookie quedaría apuntando
    // al carrito comprado — exactamente el BUG-08. Tampoco haría falta: un carrito
    // completado nunca se notifica como abandonado.
    //
    // Null también cubre "el carrito ya no existe". En los dos casos no hay nada
    // que vaciar y la respuesta es éxito.
    const cart = await retrieveCart(cartId)
    if (!cart) {
      return { success: true, cart: null }
    }

    const tenantSdk = await getMedusaSDK()
    for (const item of cart.items ?? []) {
      await tenantSdk.store.cart.deleteLineItem(cartId, item.id, {}, headers)
    }

    const cartCacheTag = await getCacheTag('carts')
    revalidateTag(cartCacheTag, 'max')

    return { success: true, cart: null }
  } catch (error: any) {
    return {
      success: false,
      cart: null,
      error: error.message || 'Error emptying cart',
    }
  }
}

