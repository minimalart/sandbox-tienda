/**
 * Helpers puros del módulo de carritos abandonados (sin dependencias de runtime),
 * compartibles entre job, workflow y API.
 */
import type { AbandonedCartConfig } from './config';
/**
 * Ventana de detección: un carrito es candidato si su última actividad cae
 * ENTRE `oldestAllowed` y `idleBefore`. Se calcula acá (puro) y se aplica en SQL,
 * no en JavaScript: filtrar en memoria después de paginar hace que un lote de
 * carritos viejos consuma la corrida entera y la detección nunca avance.
 */
export type DetectionWindow = {
    /** Actividad más reciente admitida: ya superó el umbral de inactividad. */
    idleBefore: Date;
    /** Actividad más antigua admitida: la ventana de recuperación sigue abierta. */
    oldestAllowed: Date;
};
export declare function detectionWindow(now: Date, config: AbandonedCartConfig): DetectionWindow;
/**
 * Chequeo redundante con el filtro SQL, a propósito: cubre el borde de reloj
 * entre el cálculo de la ventana y la query, y deja el invariante explícito.
 */
export declare function isWithinDetectionWindow(lastActivity: Date | string | null | undefined, window: DetectionWindow): boolean;
/**
 * Un carrito es *contactable* si tenemos por dónde escribirle. NO es condición
 * para trackearlo: se trackea todo carrito abandonado (para medir el abandono
 * real) y el contacto solo decide si se puede notificar. `cart.email` recién
 * existe después del paso de dirección del checkout, así que exigirlo en la
 * detección amputa la mayor parte del funnel.
 */
export declare function isContactable(record: {
    email?: string | null;
    phone?: string | null;
}): boolean;
/**
 * Cuándo vuelve a ser elegible un tracking, dado el último paso enviado y la
 * última actividad del carrito. `null` = no quedan pasos.
 *
 * Los offsets de los pasos son horas de inactividad ACUMULADAS desde la última
 * actividad, así que si el carrito revive hay que recalcular desde la actividad
 * nueva: dejar el valor viejo lo deja en el pasado y dispara un recordatorio
 * sobre un carrito que el cliente está usando en este momento.
 */
export declare function nextEligibleAfter(lastActivity: Date, lastStepSent: number, config: AbandonedCartConfig): Date | null;
/** Una fila del `GROUP BY` de la agregación de métricas. */
export type MetricsAggregateRow = {
    status: string;
    currency_code: string | null;
    sales_channel_id: string | null;
    contactable: boolean;
    count: number;
    /** `SUM(cart_total)` del grupo, en la unidad mayor de la moneda. */
    value: number;
};
export type AbandonedCartMetrics = {
    total: number;
    /** Trackeados a los que se les puede escribir (tienen email y/o teléfono). */
    contactable: number;
    /** Trackeados sin contacto: el techo de recuperación que hoy se pierde. */
    uncontactable: number;
    by_status: Record<string, number>;
    by_sales_channel: Record<string, number>;
    /** Valor abierto (pending + notified) por moneda. Nunca se suman monedas. */
    recoverable_value_by_currency: Record<string, number>;
    /** Valor efectivamente convertido en órdenes, por moneda. */
    recovered_value_by_currency: Record<string, number>;
    /**
     * `recovered / contactable`. El denominador son los contactables, no el total:
     * incluir carritos que nunca se pudieron notificar diluye la tasa y mide la
     * captura de contacto, no la efectividad de la secuencia.
     */
    recovery_rate: number;
};
/**
 * Da forma a las métricas a partir de las filas agregadas. Pura y sin DB para que
 * sea testeable: la agregación en sí vive en el service.
 */
export declare function shapeMetrics(rows: MetricsAggregateRow[]): AbandonedCartMetrics;
/** Formatea un monto en la unidad mayor de la moneda (es-AR, 2 decimales). */
export declare function formatMoney(amount: number | null | undefined): string;
/**
 * Arma el link de recuperación del carrito. Apunta a una ruta del storefront que
 * restaura el carrito por id y redirige al checkout (dependencia del storefront,
 * ver plan). Si no hay STOREFRONT_URL configurada, devuelve un path relativo.
 */
export declare function buildRecoveryUrl(cartId: string, countryCode?: string | null): string;
export declare function fullName(first?: string | null, last?: string | null): string;
