import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `cataloging_execution.site_id` — desde qué tienda se lanzó la corrida.
 *
 * Scopea el HISTORIAL, no el efecto: el producto que la corrida enriquece es compartido
 * por toda la instancia. Sirve para que el operador de una tienda vea sus corridas sin
 * el ruido de las demás.
 *
 * Sin backfill: las existentes quedan en `NULL` y se siguen viendo desde cualquier
 * tienda, porque esconder el historial de enriquecido dejaría sin explicación un
 * producto que cambió.
 */
export declare class Migration20260807280000Catalogador extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
