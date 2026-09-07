import { model } from '@medusajs/framework/utils';

/**
 * StoreSetting — generic key/value settings (current value, not an audit log).
 * Used for the admin "Preferencias" screen: `multi_branch_enabled`,
 * `email_branding`, `ai_config`, `site_gate`, `storefront_url`…
 *
 * `site_id NULL` = valor GLOBAL de la instancia. NO significa "todas": es el
 * FALLBACK que se usa cuando una tienda no definió el suyo. Esa distinción es la
 * que separa `siteFilter` de `pickBySitePrecedence` en el seam — listar une, pero
 * resolver un valor efectivo tiene precedencia, y confundirlas es el fail-open que
 * documenta EXTENSIONES-MULTITIENDA.md.
 */
export const StoreSetting = model
  .define('store_setting', {
    id: model.id({ prefix: 'sset' }).primaryKey(),
    key: model.text(),
    value: model.json().nullable(),
    site_id: model.text().nullable(),
  })
  /**
   * DOS índices parciales, no uno sobre `(site_id, key)`.
   *
   * En Postgres `NULL != NULL`, así que un único `UNIQUE (site_id, key)` NO impide
   * dos filas globales con la misma clave — y con dos, `getSetting` devuelve
   * cualquiera de las dos según el plan de ejecución. El bug aparece meses después
   * como "la configuración se revierte sola".
   */
  .indexes([
    { on: ['key'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'key'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
  ]);
