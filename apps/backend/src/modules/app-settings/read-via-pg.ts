import type { SiteResolution } from '../../lib/multistore/types';
import { findNamespace } from './descriptors';
import { readEntriesFromBlob } from './site-setting-store';
import { resolveEffectiveValue, resolveSettingSync } from './resolve';

type Pg = { raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }> };

/** Scoped reader for isolated plugin providers. Never turns a DB error into a
 * different store's credentials. The caller may retry the failed operation. */
export async function readSettingsViaPg(namespace: string, pg?: Pg, resolution?: SiteResolution) {
  const descriptors = findNamespace(namespace)?.settings;
  if (!descriptors) return undefined;
  const siteId = resolution?.status === 'site' ? resolution.site.id : null;
  if (!pg) {
    if (siteId || resolution?.status === 'unknownSite') {
      throw new Error('Scoped settings require a database connection.');
    }
    return Object.fromEntries(descriptors.map((d) => [d.key, resolveSettingSync(d)]));
  }
  const read = async (id: string | null) => {
    const result = await pg.raw(
      `SELECT "value" FROM "site_setting" WHERE "namespace" = ? AND ${id === null ? '"site_id" IS NULL' : '"site_id" = ?'} AND "deleted_at" IS NULL LIMIT 1`,
      id === null ? [namespace] : [namespace, id]
    );
    return readEntriesFromBlob((result.rows?.[0] as { value?: unknown } | undefined)?.value);
  };
  const [global, site] = await Promise.all([read(null), siteId ? read(siteId) : undefined]);
  return Object.fromEntries(
    descriptors.map((d) => [
      d.key,
      resolveEffectiveValue(
        d,
        { global: global.get(d.key), site: site?.get(d.key) },
        { resolution }
      ),
    ])
  );
}
