import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `canonical_form`: cuál de las dos formas de URL de una tienda es la canónica para
 * SEO — su subdominio (`host`) o su ruta (`path`).
 *
 * Las dos formas resuelven SIEMPRE y eso no es configurable: el certificado es un
 * wildcard (el subdominio resuelve por aritmética de strings, sin consultar nada) y la
 * forma con path no se puede borrar porque las preview URLs multi-tenant de Vercel son
 * Enterprise-only. Esta columna sólo decide cuál lleva el `<link rel="canonical">` y
 * cuál queda `noindex`.
 *
 * Default `'host'`: es el comportamiento que ya estaba hardcodeado, así que las filas
 * existentes no cambian de conducta.
 *
 * Va en una migración SEPARADA de `Migration20260804120000DemoStore` a propósito, en
 * vez de extenderla: esa puede haber corrido ya en algún entorno de desarrollo, y la
 * regla del repo (`apps/backend/CLAUDE.md`) es no editar nunca una migración aplicada.
 * Idempotente en los dos pasos.
 */
export class Migration20260805100000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "demo_store"
        add column if not exists "canonical_form" text not null default 'host';
    `);

    // El check va en su propio bloque tolerante: `ensure-tables.ts` crea las columnas
    // como text pelado sin constraints, así que en una DB creada por esa vía el
    // constraint no existe todavía, y en una creada por migraciones tampoco.
    this.addSql(`
      DO $$
      BEGIN
        ALTER TABLE IF EXISTS "demo_store" DROP CONSTRAINT IF EXISTS "demo_store_canonical_form_check";
        ALTER TABLE IF EXISTS "demo_store"
          ADD CONSTRAINT "demo_store_canonical_form_check"
          CHECK ("canonical_form" IN ('host', 'path'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_table THEN NULL;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "demo_store" drop constraint if exists "demo_store_canonical_form_check";
    `);
    this.addSql(`alter table if exists "demo_store" drop column if exists "canonical_form";`);
  }
}
