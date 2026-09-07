import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `comment.site_id` — de qué tienda es cada comentario.
 *
 * Sin backfill: un producto puede estar en varias tiendas, así que no hay forma
 * confiable de asignar los comentarios viejos y adivinar sería inventar. Quedan en
 * `NULL` y se siguen moderando desde cualquier tienda — esconder reseñas de clientes
 * reales el día del deploy es peor que mostrarlas de más.
 */
export declare class Migration20260807190000Comments extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
