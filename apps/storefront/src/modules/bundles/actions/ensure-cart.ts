"use server";

import { getOrSetCart } from "@lib/data/cart";

/**
 * Devuelve el id del carrito activo, creándolo si todavía no existe.
 *
 * El wizard se abre por link (una lista escolar se comparte por WhatsApp), así
 * que lo normal es que el visitante llegue SIN carrito: la página se renderiza
 * con `cartId: null` y, sin esto, el kit terminado moría en "Necesitás un
 * carrito activo". `getOrSetCart` es el mismo camino que usa "agregar al
 * carrito" del PDP — resuelve región, canal de venta y cookie.
 */
export async function ensureCart(countryCode: string): Promise<string> {
  const cart = await getOrSetCart(countryCode);
  if (!cart?.id) {
    throw new Error("No pudimos crear un carrito para agregar el kit.");
  }
  return cart.id;
}
