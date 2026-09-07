"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260630210000 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Re-aplicación idempotente de las tablas de shop-by-look.
 *
 * La migración original `Migration20260630120000` quedó REGISTRADA como aplicada
 * en `mikro_orm_migrations` pero la tabla `shop_by_look` no existía en prod
 * (típicamente por un drop manual o un restore de la DB anterior a esa tabla), y
 * `db:migrate` ya no la vuelve a correr al verla "aplicada". Esta migración tiene
 * un nombre nuevo (pendiente) y recrea las tablas con `IF NOT EXISTS`, así en el
 * próximo deploy quedan creadas sin tocar la consola. Segura de re-correr.
 */
class Migration20260630210000 extends migrations_1.Migration {
    async up() {
        this.addSql(`create table if not exists "shop_by_look" ("id" text not null, "title" text not null, "subtitle" text null, "cta_label" text null, "image_url" text not null, "image_alt" text null, "is_active" boolean not null default true, "sort_order" integer not null default 0, "placement" text not null default 'after_featured', "sales_channel_ids" jsonb null, "region_ids" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_by_look_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_deleted_at" ON "shop_by_look" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`create table if not exists "shop_by_look_product" ("id" text not null, "product_id" text not null, "variant_id" text null, "pos_x" integer not null default 50, "pos_y" integer not null default 50, "sort_order" integer not null default 0, "look_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_by_look_product_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_product_look_id" ON "shop_by_look_product" ("look_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_product_product_id" ON "shop_by_look_product" ("product_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_product_deleted_at" ON "shop_by_look_product" ("deleted_at") WHERE deleted_at IS NULL;`);
        // FK con guarda: no falla si ya existe (la original la crea sin IF NOT EXISTS).
        this.addSql(`do $$ begin if not exists (select 1 from pg_constraint where conname = 'shop_by_look_product_look_id_foreign') then alter table "shop_by_look_product" add constraint "shop_by_look_product_look_id_foreign" foreign key ("look_id") references "shop_by_look" ("id") on update cascade on delete cascade; end if; end $$;`);
    }
    async down() {
        // No-op: la baja de estas tablas la maneja la migración original
        // (Migration20260630120000). Esta solo reconcilia un estado inconsistente.
    }
}
exports.Migration20260630210000 = Migration20260630210000;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA2MzAyMTAwMDAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9zaG9wLWJ5LWxvb2svbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDYzMDIxMDAwMC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUMzQyxLQUFLLENBQUMsRUFBRTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQ1QsbWtCQUFta0IsQ0FDcGtCLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHFIQUFxSCxDQUN0SCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxxY0FBcWMsQ0FDdGMsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsK0hBQStILENBQ2hJLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHFJQUFxSSxDQUN0SSxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxxSUFBcUksQ0FDdEksQ0FBQztRQUNGLGdGQUFnRjtRQUNoRixJQUFJLENBQUMsTUFBTSxDQUNULDRUQUE0VCxDQUM3VCxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLGlFQUFpRTtRQUNqRSwyRUFBMkU7SUFDN0UsQ0FBQztDQUNGO0FBOUJELDBEQThCQyJ9