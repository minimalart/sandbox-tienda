"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260702120000CommentsReconcile = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
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
class Migration20260702120000CommentsReconcile extends migrations_1.Migration {
    async up() {
        const pendientes = (await this.execute(`
      select 'tabla:comment' as objeto where to_regclass('public.comment') is null
      union all select 'indice:IDX_comment_commentable_status'
        where to_regclass('public.comment') is not null
          and to_regclass('public."IDX_comment_commentable_status"') is null
      union all select 'indice:IDX_comment_parent_id'
        where to_regclass('public.comment') is not null
          and to_regclass('public."IDX_comment_parent_id"') is null
      union all select 'indice:IDX_comment_customer_id'
        where to_regclass('public.comment') is not null
          and to_regclass('public."IDX_comment_customer_id"') is null
      union all select 'indice:IDX_comment_deleted_at'
        where to_regclass('public.comment') is not null
          and to_regclass('public."IDX_comment_deleted_at"') is null
      union all select 'tabla:comment_settings' where to_regclass('public.comment_settings') is null
      union all select 'indice:IDX_comment_settings_deleted_at'
        where to_regclass('public.comment_settings') is not null
          and to_regclass('public."IDX_comment_settings_deleted_at"') is null
    `));
        console.log(pendientes.length
            ? `[reconcile comments] a reparar: ${pendientes.map((p) => p.objeto).join(', ')}`
            : '[reconcile comments] esquema completo: no-op');
        // --- Contenido de Migration20260619120000 (comments) ---
        this.addSql(`create table if not exists "comment" ("id" text not null, "commentable_type" text check ("commentable_type" in ('product', 'blog_post')) not null, "commentable_id" text not null, "parent_id" text null, "customer_id" text not null, "author_name" text null, "rating" integer null, "content" text null, "status" text check ("status" in ('pending', 'approved', 'hidden', 'deleted')) not null default 'pending', "verified_buyer" boolean not null default false, "edited_at" timestamptz null, "published_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "comment_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_commentable_status" ON "comment" ("commentable_type", "commentable_id", "status") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_parent_id" ON "comment" ("parent_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_customer_id" ON "comment" ("customer_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_deleted_at" ON "comment" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`create table if not exists "comment_settings" ("id" text not null, "enabled" boolean not null default true, "review_mode" text check ("review_mode" in ('comment', 'rating', 'both')) not null default 'both', "rating_scale" integer not null default 5, "who_can_comment" text check ("who_can_comment" in ('registered', 'verified_buyer')) not null default 'registered', "moderation" text check ("moderation" in ('auto', 'manual')) not null default 'auto', "edit_window_minutes" integer not null default 15, "min_length" integer not null default 5, "max_length" integer not null default 2000, "rate_limit_per_minute" integer not null default 5, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "comment_settings_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_comment_settings_deleted_at" ON "comment_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
    }
    async down() {
        // No-op: la baja de estas tablas la maneja la migración original
        // (Migration20260619120000). Esta solo reconcilia un estado inconsistente.
    }
}
exports.Migration20260702120000CommentsReconcile = Migration20260702120000CommentsReconcile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDIxMjAwMDBDb21tZW50c1JlY29uY2lsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lbnRzL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA3MDIxMjAwMDBDb21tZW50c1JlY29uY2lsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILE1BQWEsd0NBQXlDLFNBQVEsc0JBQVM7SUFDNUQsS0FBSyxDQUFDLEVBQUU7UUFDZixNQUFNLFVBQVUsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0tBa0J0QyxDQUFDLENBQThCLENBQUM7UUFDakMsT0FBTyxDQUFDLEdBQUcsQ0FDVCxVQUFVLENBQUMsTUFBTTtZQUNmLENBQUMsQ0FBQyxtQ0FBbUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNqRixDQUFDLENBQUMsOENBQThDLENBQ25ELENBQUM7UUFFRiwwREFBMEQ7UUFDMUQsSUFBSSxDQUFDLE1BQU0sQ0FDVCx3ckJBQXdyQixDQUN6ckIsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QscUpBQXFKLENBQ3RKLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHlHQUF5RyxDQUMxRyxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw2R0FBNkcsQ0FDOUcsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsMkdBQTJHLENBQzVHLENBQUM7UUFFRixJQUFJLENBQUMsTUFBTSxDQUNULDB6QkFBMHpCLENBQzN6QixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw2SEFBNkgsQ0FDOUgsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixpRUFBaUU7UUFDakUsMkVBQTJFO0lBQzdFLENBQUM7Q0FDRjtBQXhERCw0RkF3REMifQ==