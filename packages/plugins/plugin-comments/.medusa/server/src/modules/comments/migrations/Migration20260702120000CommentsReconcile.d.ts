import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Reconciliación idempotente de `Migration20260619120000` (tablas `comment` y
 * `comment_settings`).
 *
 * Por qué existe: `mikro_orm_migrations` es UNA tabla global y umzug registra cada
 * migración por NOMBRE, sin módulo. `Migration20260619120000` también existe en
 * `ai-assistant`: en los entornos donde ese módulo migró primero (prod migró
 * ai-assistant el 19/06 antes de que comments llegara a main), la homónima de este
 * módulo quedó salteada EN SILENCIO y las tablas de comentarios sin crear.
 *
 * El SELECT inicial audita y loguea qué faltaba: ese log, en el output de
 * `db:migrate` del job predeploy, es la auditoría por entorno. Con esquema sano,
 * todo es no-op. El sufijo del módulo en el nombre evita nuevas colisiones.
 */
export declare class Migration20260702120000CommentsReconcile extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
