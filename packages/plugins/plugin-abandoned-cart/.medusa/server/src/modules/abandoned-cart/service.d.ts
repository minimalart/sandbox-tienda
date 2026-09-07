import { type AbandonedCartConfig, type AbandonedCartStep } from './config';
import { type AbandonedCartMetrics } from './lib';
import type { AbandonedCartChannel, AbandonedCartNotificationStatus } from './types';
/** Datos en vivo de un carrito, ya normalizados por el job antes del upsert. */
export type AbandonedCartSnapshot = {
    cart_id: string;
    email: string | null;
    phone: string | null;
    customer_id: string | null;
    sales_channel_id: string | null;
    cart_total: number | null;
    currency_code: string | null;
    /** `updated_at` del carrito core: define la inactividad. */
    last_activity_at: Date;
};
declare const AbandonedCartModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<import("@medusajs/framework/utils").ModelConfigurationsToConfigTemplate<{
    readonly AbandonedCart: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        cart_id: import("@medusajs/framework/utils").TextProperty;
        email: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        phone: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        cart_total: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").NumberProperty>;
        currency_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        status: import("@medusajs/framework/utils").TextProperty;
        last_step_sent: import("@medusajs/framework/utils").NumberProperty;
        next_eligible_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        last_activity_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
        recovered_order_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "abandoned_cart">;
    readonly AbandonedCartNotification: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        abandoned_cart_id: import("@medusajs/framework/utils").TextProperty;
        step: import("@medusajs/framework/utils").NumberProperty;
        channel: import("@medusajs/framework/utils").TextProperty;
        template: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        recipient: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        status: import("@medusajs/framework/utils").TextProperty;
        error: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        sent_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    }>, "abandoned_cart_notification">;
}>>;
declare class AbandonedCartModuleService extends AbandonedCartModuleService_base {
    getConfig(): AbandonedCartConfig;
    /**
     * Crea o actualiza el tracking de un carrito. Nunca reabre un carrito ya
     * `recovered`/`cancelled`. En altas nuevas, `next_eligible_at` = actividad +
     * primer paso; en existentes, refresca contacto/valor/actividad y reprograma la
     * secuencia cuando hace falta (ver abajo).
     */
    upsertFromSnapshot(snapshot: AbandonedCartSnapshot, config: AbandonedCartConfig): Promise<{
        record: any;
        created: boolean;
    }>;
    /** Tracking vencido para el próximo paso (candidatos a notificar). */
    listDue(now: Date, limit: number): Promise<any[]>;
    /** Horas de inactividad de un tracking respecto de `now`. */
    idleHoursFor(record: {
        last_activity_at?: Date | string | null;
    }, now: Date): number;
    /** El paso que corresponde enviar ahora para un tracking, o null. */
    resolveNextStep(record: {
        last_step_sent?: number | null;
        last_activity_at?: Date | string | null;
    }, config: AbandonedCartConfig, now: Date): AbandonedCartStep | null;
    /**
     * Registra el resultado de un envío (idempotente por paso+canal), avanza
     * `last_step_sent` cuando el paso se completó y recalcula `next_eligible_at`
     * hacia el siguiente paso (o null si no hay más).
     */
    recordStepResult(input: {
        abandonedCartId: string;
        step: number;
        results: Array<{
            channel: AbandonedCartChannel;
            template: string | null;
            recipient: string | null;
            status: AbandonedCartNotificationStatus;
            error?: string | null;
        }>;
        config: AbandonedCartConfig;
        now: Date;
    }): Promise<void>;
    /**
     * Saca un tracking de la cola de notificación sin cerrarlo: sigue contando en
     * las métricas de abandono, pero deja de ser `due`. Se usa cuando no hay forma
     * de contactar al cliente; si más adelante aparece un email o teléfono,
     * `upsertFromSnapshot` lo reprograma.
     */
    deferUntilContactable(abandonedCartId: string): Promise<void>;
    /**
     * Métricas agregadas del tracking, opcionalmente acotadas a un canal de venta.
     *
     * Agrega en SQL a propósito: la versión anterior traía hasta 10.000 filas y las
     * reducía en memoria, así que pasada esa marca las métricas no eran lentas sino
     * DIRECTAMENTE FALSAS, sin ningún aviso. Ahora la cardinalidad del resultado es
     * (estados × monedas × canales × contactable), no la cantidad de carritos.
     *
     * Usa knex crudo porque `MedusaService` no expone agregaciones; mismo escape
     * hatch que `modules/vimeo-video/service.ts`.
     */
    getMetrics(filters?: {
        sales_channel_id?: string;
    }): Promise<AbandonedCartMetrics>;
    /**
     * Marca como recuperado (se convirtió en orden). Corta la secuencia. `orderId`
     * puede ser null cuando se detecta el carrito ya completado sin conocer la orden.
     */
    markRecoveredByCartId(cartId: string, orderId: string | null): Promise<boolean>;
}
export default AbandonedCartModuleService;
