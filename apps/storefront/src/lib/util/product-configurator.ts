/**
 * Productos que NO se pueden agregar al carrito desde una card: necesitan que
 * el cliente configure algo en el PDP antes de que la línea sea válida.
 *
 * Son dos casos y los dos terminan igual de mal si se los agrega a ciegas:
 *
 * - Gift card: la línea viaja con `gift_card_config` (diseño, monto,
 *   destinatario, mensaje, entrega). Sin esa metadata el hook de validación del
 *   plugin (`gift-card-cart-validation`) rechaza el carrito AL PAGAR, así que un
 *   quick-add deja un carrito que no se puede cerrar y el cliente se entera
 *   recién en el checkout.
 * - Base entonable: el color es obligatorio y la carta (cientos de colores, con
 *   precio que cotiza el ERP por fórmula) sólo vive en el PDP.
 *
 * Vive en `lib/util` porque lo consumen todas las superficies que listan
 * productos — PLP, home (cards default y compact), destacados — y antes cada una
 * decidía por su cuenta: la card compacta del home abría el quick view de una
 * gift card y ofrecía el botón de agregar.
 */

import { isTintableProduct } from "./tinting";

type ConfigurableLike = {
  is_giftcard?: unknown;
  tintable?: unknown;
  metadata?: Record<string, unknown> | null;
};

/** `true` si el producto es una gift card. */
export function isGiftCardProduct(
  product: ConfigurableLike | null | undefined,
): boolean {
  return product?.is_giftcard === true;
}

/**
 * `true` si la card tiene que llevar al PDP en vez de ofrecer quick view o
 * quick-add.
 */
export function requiresConfigurator(
  product: ConfigurableLike | null | undefined,
): boolean {
  if (!product) return false;
  return isGiftCardProduct(product) || isTintableProduct(product);
}

/**
 * Texto del CTA de la card para estos productos. `null` cuando el producto es
 * común y la card sigue con su comportamiento de siempre.
 */
export function configuratorCtaLabel(
  product: ConfigurableLike | null | undefined,
): string | null {
  if (isGiftCardProduct(product)) return "Personalizar gift card";
  if (isTintableProduct(product)) return "Elegí tu color";
  return null;
}
