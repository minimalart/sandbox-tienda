import type { MedusaContainer } from '@medusajs/framework/types';
import type { GiftCardDeliveryRow } from './types';
type OrderItem = {
    id: string;
    quantity: number;
    unit_price: number;
    total?: number;
    metadata?: Record<string, unknown> | null;
    product?: {
        is_giftcard?: boolean;
    } | null;
};
type Order = {
    id: string;
    display_id?: number | null;
    email: string;
    customer_id?: string | null;
    /** La tienda que vendió. Es lo que elige QUÉ configuración se sella en la entrega. */
    sales_channel_id?: string | null;
    currency_code: string;
    total: number;
    canceled_at?: string | Date | null;
    status?: string;
    items?: OrderItem[];
    payment_collections?: Array<{
        payments?: Array<{
            amount?: number;
            captured_at?: string | Date | null;
            canceled_at?: string | Date | null;
        }> | null;
    }> | null;
};
/**
 * AND entre el interruptor de DESPLIEGUE (`app-settings`, DB > env) y el de
 * NEGOCIO (`gift_card_settings.enabled`). Hacen falta los dos.
 */
export declare function isGiftCardExperienceEnabled(settingsEnabled: boolean): boolean;
export declare function capturedAmount(order: Order): number;
export declare function isFullyPaidOrder(order: Order): boolean;
export declare function isUniqueConstraintError(error: unknown): boolean;
/**
 * Crea los intents de UNA orden con la configuración de LA TIENDA QUE VENDIÓ.
 *
 * Todo lo que se lee acá se SELLA en `gift_card_delivery` —`expires_at` sale de
 * `default_expiry_days`, más `timezone`, `scheduled_at` y el diseño por defecto— y no
 * se vuelve a mirar: si sale de la fila global, la entrega queda mal para siempre
 * aunque después alguien arregle la configuración de la tienda. Por eso la tienda se
 * resuelve acá y no en el envío, que ya es tarde.
 *
 * `settings.enabled` también pasa a ser por tienda, y eso NO deja nada colgado: los
 * intents se crean de cero en cada pasada, así que una tienda con la experiencia
 * apagada simplemente no crea ninguno. Es distinto del gate de los JOBS, que corre
 * DESPUÉS de reclamar filas y por eso sigue siendo de lote (ver `delivery.ts`).
 */
export declare function createGiftCardIntentsForOrder(container: MedusaContainer, order: Order): Promise<GiftCardDeliveryRow[]>;
export declare function resolveBackingAccount(container: MedusaContainer, giftCardId: string): Promise<{
    id: string;
    code?: string;
} | null>;
export declare function processGiftCardsForOrder(container: MedusaContainer, orderId: string): Promise<{
    paid: boolean;
    intentCount: number;
}>;
export {};
