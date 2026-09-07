/**
 * Recuperación de carritos abandonados. Un carrito abandonado = carrito de
 * Medusa (`Modules.CART`) con `completed_at IS NULL`, con items, inactivo más allá
 * de un umbral y dentro de la ventana de recuperación. Este módulo NO duplica el
 * carrito: mantiene solo una fila de *tracking* por carrito para orquestar la
 * secuencia de recordatorios y evitar reenvíos. El estado real del carrito se
 * relee siempre en vivo desde el módulo core.
 *
 * El contacto (email y/o teléfono) NO es condición para trackear: se trackea todo
 * carrito abandonado para poder medir el abandono real, y el contacto solo decide
 * si el tracking puede notificarse. `cart.email` recién existe después del paso de
 * dirección del checkout, así que exigirlo en la detección dejaba afuera a la
 * mayor parte del funnel y hacía que las métricas midieran otra cosa.
 */
export declare const ABANDONED_CART_MODULE = "abandonedCart";
/**
 * Estados del seguimiento:
 * - `pending`   → detectado, todavía no se envió ningún paso.
 * - `notified`  → se envió al menos un paso; puede seguir enviando o estar completo.
 * - `recovered` → el carrito se convirtió en orden (corta la secuencia).
 * - `cancelled` → descartado manualmente / ya no elegible.
 */
export type AbandonedCartStatus = 'pending' | 'notified' | 'recovered' | 'cancelled';
/** Canales por los que se puede notificar un paso de la secuencia. */
export type AbandonedCartChannel = 'email' | 'whatsapp';
/** Resultado del intento de envío de un paso/canal. */
export type AbandonedCartNotificationStatus = 'sent' | 'failed' | 'skipped';
