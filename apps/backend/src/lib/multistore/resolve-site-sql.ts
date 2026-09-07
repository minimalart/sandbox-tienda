import { SITE_REGISTRY_TABLE } from './module-key';
import { toSiteRef } from './resolve-site';
import type { SiteHint, SiteResolution } from './types';

/**
 * Gemelo SQL de `resolve-site.ts`, para services de módulo y providers.
 *
 * No es una optimización: es obligatorio. Los providers (fulfillment, payment,
 * notification) reciben un container AISLADO y NO pueden `container.resolve()` de
 * otro módulo — por eso `kapso-whatsapp/service.ts` y `email/service.ts` ya leen
 * `store_setting` por SQL crudo con `PG_CONNECTION`.
 *
 * RIESGO CONOCIDO: este camino puentea los filtros de MikroORM (soft delete entre
 * ellos), así que el `deleted_at IS NULL` va explícito en cada query y hay un test
 * que cruza las columnas nombradas acá contra `models/demo-store.ts`. Si alguien
 * renombra una columna, sin ese test esto devolvería `null` sin un solo error.
 */

type PgLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: any[] }>;
};

const COLUMNS =
  '"id", "slug", "name", "is_main", "sales_channel_id", "b2b_sales_channel_id", "region_id", "stock_location_id"';

/** Las columnas que este archivo nombra. El test de drift las cruza contra el modelo. */
export const SQL_MIRRORED_COLUMNS = [
  'id',
  'slug',
  'name',
  'is_main',
  'sales_channel_id',
  'b2b_sales_channel_id',
  'region_id',
  'stock_location_id',
] as const;

const UNDEFINED_TABLE = '42P01';

const isUndefinedTable = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === UNDEFINED_TABLE;

export async function resolveSiteViaSql(
  pg: PgLike | undefined,
  hint: SiteHint = {},
): Promise<SiteResolution> {
  if (!pg) return { status: 'registryAbsent', reason: 'module' };

  const asked = Boolean(hint.siteId || hint.slug);

  const attempts: Array<{ where: string; bindings: unknown[] }> = [];
  if (hint.siteId) attempts.push({ where: '"id" = ?', bindings: [hint.siteId] });
  if (hint.slug) attempts.push({ where: '"slug" = ?', bindings: [hint.slug] });
  if (hint.salesChannelId) {
    attempts.push({
      where: '("sales_channel_id" = ? OR "b2b_sales_channel_id" = ?)',
      bindings: [hint.salesChannelId, hint.salesChannelId],
    });
  }

  try {
    for (const attempt of attempts) {
      const result = await pg.raw(
        `SELECT ${COLUMNS} FROM "${SITE_REGISTRY_TABLE}"
           WHERE ${attempt.where} AND "deleted_at" IS NULL
           LIMIT 1`,
        attempt.bindings,
      );
      const row = result?.rows?.[0];
      if (row) return { status: 'site', site: toSiteRef(row) };
    }

    const all = await pg.raw(
      `SELECT ${COLUMNS} FROM "${SITE_REGISTRY_TABLE}" WHERE "deleted_at" IS NULL LIMIT 2`,
    );
    const rows = all?.rows ?? [];

    if (rows.length === 0) return { status: 'registryAbsent', reason: 'empty' };
    if (asked) return { status: 'unknownSite', hint };
    if (rows.length === 1) return { status: 'singleSite', site: toSiteRef(rows[0]) };

    if (hint.allowMainFallback) {
      const main = await pg.raw(
        `SELECT ${COLUMNS} FROM "${SITE_REGISTRY_TABLE}"
           WHERE "is_main" = true AND "deleted_at" IS NULL
           LIMIT 1`,
      );
      const row = main?.rows?.[0];
      if (row) return { status: 'site', site: toSiteRef(row) };
    }

    return { status: 'allSites' };
  } catch (error) {
    if (isUndefinedTable(error)) return { status: 'registryAbsent', reason: 'table' };
    throw error;
  }
}
